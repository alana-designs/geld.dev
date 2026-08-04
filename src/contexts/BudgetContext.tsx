import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode } from
'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, setRememberMe } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { AuthUser, Category, Member, ParentCategory, Transaction } from '../types/budget';
import { Deduction, IncomeSource, TaxLine } from '../types/income';
import { STARTER_CATEGORIES } from '../data/starterCategories';
import { availableMonths, toMonthKey, usageByCategory } from '../utils/rollups';
import { generateAutoEntries, totalMonthlyNet } from '../utils/income';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type CategoryRow = Database['public']['Tables']['categories']['Row'];
type CategoryUpdate = Database['public']['Tables']['categories']['Update'];
type CategoryGoalRow = Database['public']['Tables']['category_goals']['Row'];
type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type TransactionUpdate = Database['public']['Tables']['transactions']['Update'];
type IncomeSourceRow = Database['public']['Tables']['income_sources']['Row'];
type IncomeDeductionRow = Database['public']['Tables']['income_deductions']['Row'];
type IncomeTaxLineRow = Database['public']['Tables']['income_tax_lines']['Row'];
type InviteRow = Database['public']['Tables']['household_invites']['Row'];

/** Not a real household row — the "combined view" tab, selected client-side only. */
export const HOUSEHOLD_VIEW = 'household';

const INVITE_COLORS = ['#8c6239', '#6f7a4a', '#93627e', '#a3562f'];

interface NewTransaction {
  amount: number;
  categoryId: string;
  description: string;
  date: string;
}

export interface CategoryPatch {
  name?: string;
  parent?: ParentCategory;
  monthlyGoal?: number;
  archived?: boolean;
}

interface BudgetContextValue {
  user: AuthUser | null;
  loading: boolean;
  sendMagicLink: (email: string, remember?: boolean) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  setupComplete: boolean;
  completeSetup: () => Promise<void>;

  /** Household */
  members: Member[];
  activeMembers: Member[];
  viewId: string;
  setViewId: (id: string) => void;
  viewMember: Member | null;
  isHousehold: boolean;
  /** Only your own tab is editable — everyone else is read-only. */
  canEdit: boolean;
  /** Your own member id — stable once signed in, used to switch back to "your" tab. */
  selfId: string | null;
  inviteMember: (email: string, name?: string) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  memberById: (id: string) => Member | undefined;

  /** Scoped to whichever tab is selected */
  categories: Category[];
  transactions: Transaction[];
  takeHome: number;
  autoEntriesFor: (monthKey: string) => Transaction[];
  totalsByMember: (monthKey: string) => {
    member: Member;
    spent: number;
    takeHome: number;
    autoSavings: number;
  }[];

  /** Always yours, regardless of the selected tab */
  activeCategories: Category[];
  incomeSources: IncomeSource[];
  usage: Record<string, number>;

  months: string[];
  selectedMonth: string;
  setSelectedMonth: (key: string) => void;

  addTransaction: (input: NewTransaction) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<NewTransaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (name: string, parent: ParentCategory, monthlyGoal?: number) => Promise<Category>;
  updateCategory: (id: string, patch: CategoryPatch) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  categoryById: (id: string) => Category | undefined;
  categoryHasEntries: (id: string) => boolean;
  saveIncomeSource: (source: IncomeSource) => Promise<void>;
  deleteIncomeSource: (id: string) => Promise<void>;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

// ---------------------------------------------------------------------------
// DB row -> app-type mapping
// ---------------------------------------------------------------------------

const mapTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  memberId: row.user_id,
  amount: Number(row.amount),
  categoryId: row.category_id,
  description: row.description,
  date: row.date,
  createdAt: row.created_at
});

const mapDeduction = (row: IncomeDeductionRow): Deduction => ({
  id: row.id,
  label: row.label,
  amount: Number(row.amount),
  tag: row.tag,
  categoryId: row.category_id ?? undefined
});

const mapTaxLine = (row: IncomeTaxLineRow): TaxLine => ({
  id: row.id,
  label: row.label,
  amount: Number(row.amount)
});

const mapIncomeSource = (
row: IncomeSourceRow,
deductions: IncomeDeductionRow[],
taxes: IncomeTaxLineRow[])
: IncomeSource => {
  const mine = deductions.filter((d) => d.income_source_id === row.id);
  return {
    id: row.id,
    memberId: row.user_id,
    name: row.name,
    grossPay: Number(row.gross_pay),
    frequency: row.frequency,
    preTax: mine.filter((d) => d.phase === 'pre_tax').map(mapDeduction),
    postTax: mine.filter((d) => d.phase === 'post_tax').map(mapDeduction),
    taxes: taxes.filter((t) => t.income_source_id === row.id).map(mapTaxLine),
    netOverride: row.net_override != null ? Number(row.net_override) : null,
    updatedAt: row.updated_at
  };
};

const mapProfileToMember = (row: ProfileRow, selfId: string): Member => ({
  id: row.id,
  name: row.name,
  email: row.email,
  isSelf: row.id === selfId,
  status: 'active',
  color: row.color
});

const mapInviteToMember = (row: InviteRow): Member => ({
  id: row.id,
  name: row.name?.trim() || row.email.split('@')[0],
  email: row.email,
  isSelf: false,
  status: 'pending',
  color: row.color
});

/** Latest goal at or before the given month — the auto-rollover read path. */
function goalForMonth(goals: CategoryGoalRow[], categoryId: string, monthKey: string): number {
  const cutoff = `${monthKey}-01`;
  let amount = 0;
  let bestMonth = '';
  for (const g of goals) {
    if (g.category_id !== categoryId || g.effective_month > cutoff) continue;
    if (g.effective_month > bestMonth) {
      bestMonth = g.effective_month;
      amount = Number(g.amount);
    }
  }
  return amount;
}

const currentMonthStart = () => `${toMonthKey(new Date())}-01`;

export function BudgetProvider({ children }: {children: ReactNode;}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [rawCategories, setRawCategories] = useState<CategoryRow[]>([]);
  const [rawGoals, setRawGoals] = useState<CategoryGoalRow[]>([]);
  const [rawTransactions, setRawTransactions] = useState<TransactionRow[]>([]);
  const [rawIncomeSources, setRawIncomeSources] = useState<IncomeSourceRow[]>([]);
  const [rawDeductions, setRawDeductions] = useState<IncomeDeductionRow[]>([]);
  const [rawTaxLines, setRawTaxLines] = useState<IncomeTaxLineRow[]>([]);

  const [viewId, setViewId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(toMonthKey(new Date()));

  const resetHouseholdState = useCallback(() => {
    setProfile(null);
    setProfiles([]);
    setInvites([]);
    setRawCategories([]);
    setRawGoals([]);
    setRawTransactions([]);
    setRawIncomeSources([]);
    setRawDeductions([]);
    setRawTaxLines([]);
    setViewId('');
  }, []);

  // Track the Supabase session; a magic-link click lands here via detectSessionInUrl.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        resetHouseholdState();
        setLoading(false);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [resetHouseholdState]);

  // Once signed in, load (and if brand-new, bootstrap) the whole household.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    let active = true;
    setLoading(true);

    (async () => {
      const { data: me, error: meError } = await supabase.
      from('profiles').
      select('*').
      eq('id', userId).
      single();
      if (!active) return;
      if (meError || !me) {
        console.error(meError);
        setLoading(false);
        return;
      }
      setProfile(me);

      const [profilesRes, invitesRes, categoriesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('household_id', me.household_id),
      supabase.
      from('household_invites').
      select('*').
      eq('household_id', me.household_id).
      eq('status', 'pending'),
      supabase.from('categories').select('*').eq('household_id', me.household_id)]
      );
      if (!active) return;
      const firstError = profilesRes.error || invitesRes.error || categoriesRes.error;
      if (firstError) {
        console.error(firstError);
        setLoading(false);
        return;
      }

      let categories = categoriesRes.data ?? [];
      const mineCount = categories.filter((c) => c.user_id === me.id).length;
      if (mineCount === 0) {
        const { data: seeded, error: seedError } = await supabase.
        from('categories').
        insert(
          STARTER_CATEGORIES.map((c) => ({
            user_id: me.id,
            household_id: me.household_id,
            parent: c.parent,
            name: c.name
          }))
        ).
        select();
        if (seedError) console.error(seedError);else
        categories = [...categories, ...(seeded ?? [])];
      }
      if (!active) return;

      const categoryIds = categories.map((c) => c.id);
      const [goalsRes, txRes, incomeRes] = await Promise.all([
      categoryIds.length ?
      supabase.from('category_goals').select('*').in('category_id', categoryIds) :
      Promise.resolve({ data: [] as CategoryGoalRow[], error: null }),
      supabase.
      from('transactions').
      select('*').
      eq('household_id', me.household_id).
      order('date', { ascending: false }),
      supabase.from('income_sources').select('*').eq('household_id', me.household_id)]
      );
      if (!active) return;
      const secondError = goalsRes.error || txRes.error || incomeRes.error;
      if (secondError) {
        console.error(secondError);
        setLoading(false);
        return;
      }

      const incomeIds = (incomeRes.data ?? []).map((s) => s.id);
      const [dedRes, taxRes] = await Promise.all([
      incomeIds.length ?
      supabase.from('income_deductions').select('*').in('income_source_id', incomeIds) :
      Promise.resolve({ data: [] as IncomeDeductionRow[], error: null }),
      incomeIds.length ?
      supabase.from('income_tax_lines').select('*').in('income_source_id', incomeIds) :
      Promise.resolve({ data: [] as IncomeTaxLineRow[], error: null })]
      );
      if (!active) return;
      const thirdError = dedRes.error || taxRes.error;
      if (thirdError) console.error(thirdError);

      setProfiles(profilesRes.data ?? []);
      setInvites(invitesRes.data ?? []);
      setRawCategories(categories);
      setRawGoals(goalsRes.data ?? []);
      setRawTransactions(txRes.data ?? []);
      setRawIncomeSources(incomeRes.data ?? []);
      setRawDeductions(dedRes.data ?? []);
      setRawTaxLines(taxRes.data ?? []);
      setViewId((current) => current || me.id);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const user: AuthUser | null = session?.user?.email ? { email: session.user.email } : null;
  const selfId = profile?.id ?? null;
  const setupComplete = profile?.onboarded ?? false;

  const sendMagicLink = useCallback(async (email: string, remember: boolean = true) => {
    setRememberMe(remember);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const completeSetup = useCallback(async () => {
    if (!profile) return;
    const { error } = await supabase.from('profiles').update({ onboarded: true }).eq('id', profile.id);
    if (error) throw error;
    setProfile((p) => p ? { ...p, onboarded: true } : p);
  }, [profile]);

  const isHousehold = viewId === HOUSEHOLD_VIEW;
  const canEdit = viewId === profile?.id;

  const members: Member[] = useMemo(() => {
    if (!profile) return [];
    return [
    ...profiles.map((p) => mapProfileToMember(p, profile.id)),
    ...invites.map(mapInviteToMember)];

  }, [profiles, invites, profile]);
  const activeMembers = useMemo(() => members.filter((m) => m.status === 'active'), [members]);

  const inviteMember = useCallback(
    async (email: string, name?: string) => {
      if (!profile) return;
      const color = INVITE_COLORS[(profiles.length + invites.length) % INVITE_COLORS.length];
      const { data, error } = await supabase.
      from('household_invites').
      insert({
        household_id: profile.household_id,
        invited_by: profile.id,
        email: email.trim(),
        name: name?.trim() || null,
        color
      }).
      select().
      single();
      if (error) {
        throw new Error(
          error.code === '23505' ?
          "That person's already been invited." :
          'Could not send the invite — try again.'
        );
      }
      setInvites((prev) => [...prev, data]);
    },
    [profile, profiles.length, invites.length]
  );

  const removeMember = useCallback(
    async (id: string) => {
      if (!profile) return;
      const pending = invites.find((i) => i.id === id);
      if (!pending) return; // Removing an active household member isn't supported yet.
      const { error } = await supabase.
      from('household_invites').
      delete().
      eq('id', id).
      eq('household_id', profile.household_id);
      if (error) {
        console.error(error);
        return;
      }
      setInvites((prev) => prev.filter((i) => i.id !== id));
      setViewId((current) => current === id ? profile.id : current);
    },
    [profile, invites]
  );

  const memberById = useCallback((id: string) => members.find((m) => m.id === id), [members]);

  const categories: Category[] = useMemo(
    () =>
    rawCategories.map((c) => ({
      id: c.id,
      memberId: c.user_id,
      name: c.name,
      parent: c.parent,
      monthlyGoal: goalForMonth(rawGoals, c.id, selectedMonth),
      archived: c.archived
    })),
    [rawCategories, rawGoals, selectedMonth]
  );

  const transactions: Transaction[] = useMemo(
    () => rawTransactions.map(mapTransaction),
    [rawTransactions]
  );

  const allIncomeSources: IncomeSource[] = useMemo(
    () => rawIncomeSources.map((s) => mapIncomeSource(s, rawDeductions, rawTaxLines)),
    [rawIncomeSources, rawDeductions, rawTaxLines]
  );

  const inView = useCallback(
    (memberId: string) => isHousehold ? activeMembers.some((m) => m.id === memberId) : memberId === viewId,
    [isHousehold, activeMembers, viewId]
  );

  const viewCategories = useMemo(() => categories.filter((c) => inView(c.memberId)), [categories, inView]);
  const viewTransactions = useMemo(
    () => transactions.filter((tx) => inView(tx.memberId)),
    [transactions, inView]
  );
  const viewIncome = useMemo(
    () => allIncomeSources.filter((s) => inView(s.memberId)),
    [allIncomeSources, inView]
  );

  const takeHome = useMemo(() => totalMonthlyNet(viewIncome), [viewIncome]);

  const autoEntriesFor = useCallback(
    (key: string) => generateAutoEntries(viewIncome, categories, key),
    [viewIncome, categories]
  );

  const totalsByMember = useCallback(
    (key: string) =>
    activeMembers.map((member) => {
      const memberIncome = allIncomeSources.filter((s) => s.memberId === member.id);
      const auto = generateAutoEntries(memberIncome, categories, key);
      return {
        member,
        spent: transactions.
        filter((tx) => tx.memberId === member.id && tx.date.slice(0, 7) === key).
        reduce((sum, tx) => sum + tx.amount, 0),
        takeHome: totalMonthlyNet(memberIncome),
        autoSavings: auto.reduce((sum, tx) => sum + tx.amount, 0)
      };
    }),
    [activeMembers, allIncomeSources, categories, transactions]
  );

  const myCategories = useMemo(
    () => categories.filter((c) => c.memberId === profile?.id),
    [categories, profile]
  );
  const activeCategories = useMemo(() => myCategories.filter((c) => !c.archived), [myCategories]);
  const myIncome = useMemo(
    () => allIncomeSources.filter((s) => s.memberId === profile?.id),
    [allIncomeSources, profile]
  );
  const usage = useMemo(
    () => usageByCategory(transactions.filter((tx) => tx.memberId === profile?.id)),
    [transactions, profile]
  );

  const months = useMemo(() => availableMonths(transactions), [transactions]);
  useEffect(() => {
    if (!months.includes(selectedMonth)) setSelectedMonth(months[0]);
  }, [months, selectedMonth]);

  const viewMember = isHousehold ? null : members.find((m) => m.id === viewId) ?? null;

  const categoryById = useCallback((id: string) => categories.find((c) => c.id === id), [categories]);
  const categoryHasEntries = useCallback(
    (id: string) => transactions.some((tx) => tx.categoryId === id),
    [transactions]
  );

  const addTransaction = useCallback(
    async (input: NewTransaction) => {
      if (!profile) return;
      const { data, error } = await supabase.
      from('transactions').
      insert({
        user_id: profile.id,
        household_id: profile.household_id,
        category_id: input.categoryId,
        amount: input.amount,
        description: input.description,
        date: input.date
      }).
      select().
      single();
      if (error) throw error;
      setRawTransactions((prev) => [data, ...prev]);
      setSelectedMonth(input.date.slice(0, 7));
    },
    [profile]
  );

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<NewTransaction>) => {
      if (!profile) return;
      const dbPatch: TransactionUpdate = {};
      if (patch.amount !== undefined) dbPatch.amount = patch.amount;
      if (patch.categoryId !== undefined) dbPatch.category_id = patch.categoryId;
      if (patch.description !== undefined) dbPatch.description = patch.description;
      if (patch.date !== undefined) dbPatch.date = patch.date;
      const { data, error } = await supabase.
      from('transactions').
      update(dbPatch).
      eq('id', id).
      eq('user_id', profile.id).
      select().
      single();
      if (error) throw error;
      setRawTransactions((prev) => prev.map((tx) => tx.id === id ? data : tx));
      if (patch.date) setSelectedMonth(patch.date.slice(0, 7));
    },
    [profile]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!profile) return;
      const { error } = await supabase.
      from('transactions').
      delete().
      eq('id', id).
      eq('user_id', profile.id);
      if (error) throw error;
      setRawTransactions((prev) => prev.filter((tx) => tx.id !== id));
    },
    [profile]
  );

  const addCategory = useCallback(
    async (name: string, parent: ParentCategory, monthlyGoal = 0): Promise<Category> => {
      if (!profile) throw new Error('Not signed in');
      const { data, error } = await supabase.
      from('categories').
      insert({
        user_id: profile.id,
        household_id: profile.household_id,
        parent,
        name: name.trim(),
        archived: false
      }).
      select().
      single();
      if (error) throw error;
      setRawCategories((prev) => [...prev, data]);

      let goal = 0;
      if (monthlyGoal > 0) {
        const { data: goalRow, error: goalError } = await supabase.
        from('category_goals').
        insert({ category_id: data.id, amount: monthlyGoal, effective_month: currentMonthStart() }).
        select().
        single();
        if (goalError) throw goalError;
        setRawGoals((prev) => [...prev, goalRow]);
        goal = monthlyGoal;
      }

      return {
        id: data.id,
        memberId: data.user_id,
        name: data.name,
        parent: data.parent,
        monthlyGoal: goal,
        archived: data.archived
      };
    },
    [profile]
  );

  const updateCategory = useCallback(
    async (id: string, patch: CategoryPatch) => {
      if (!profile) return;
      const dbPatch: CategoryUpdate = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.parent !== undefined) dbPatch.parent = patch.parent;
      if (patch.archived !== undefined) dbPatch.archived = patch.archived;

      if (Object.keys(dbPatch).length > 0) {
        const { data, error } = await supabase.
        from('categories').
        update(dbPatch).
        eq('id', id).
        eq('user_id', profile.id).
        select().
        single();
        if (error) throw error;
        setRawCategories((prev) => prev.map((c) => c.id === id ? data : c));
      }

      if (patch.monthlyGoal !== undefined) {
        const effectiveMonth = currentMonthStart();
        const { data: goalRow, error: goalError } = await supabase.
        from('category_goals').
        upsert(
          { category_id: id, amount: patch.monthlyGoal, effective_month: effectiveMonth },
          { onConflict: 'category_id,effective_month' }
        ).
        select().
        single();
        if (goalError) throw goalError;
        setRawGoals((prev) => {
          const idx = prev.findIndex(
            (g) => g.category_id === id && g.effective_month === effectiveMonth
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = goalRow;
            return next;
          }
          return [...prev, goalRow];
        });
      }
    },
    [profile]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      if (!profile) return;
      const { error } = await supabase.
      from('categories').
      delete().
      eq('id', id).
      eq('user_id', profile.id);
      if (error) throw error;
      setRawCategories((prev) => prev.filter((c) => c.id !== id));
      setRawGoals((prev) => prev.filter((g) => g.category_id !== id));
    },
    [profile]
  );

  const saveIncomeSource = useCallback(
    async (source: IncomeSource) => {
      if (!profile) return;
      const isNew = !rawIncomeSources.some((s) => s.id === source.id);
      let incomeSourceId = source.id;
      let updatedAt = new Date().toISOString();

      if (isNew) {
        const { data, error } = await supabase.
        from('income_sources').
        insert({
          user_id: profile.id,
          household_id: profile.household_id,
          name: source.name,
          gross_pay: source.grossPay,
          frequency: source.frequency,
          net_override: source.netOverride
        }).
        select().
        single();
        if (error) throw error;
        incomeSourceId = data.id;
        updatedAt = data.updated_at;
        setRawIncomeSources((prev) => [...prev, data]);
      } else {
        const { data, error } = await supabase.
        from('income_sources').
        update({
          name: source.name,
          gross_pay: source.grossPay,
          frequency: source.frequency,
          net_override: source.netOverride,
          updated_at: updatedAt
        }).
        eq('id', source.id).
        eq('user_id', profile.id).
        select().
        single();
        if (error) throw error;
        setRawIncomeSources((prev) => prev.map((s) => s.id === source.id ? data : s));

        const [delDed, delTax] = await Promise.all([
        supabase.from('income_deductions').delete().eq('income_source_id', source.id),
        supabase.from('income_tax_lines').delete().eq('income_source_id', source.id)]
        );
        if (delDed.error) throw delDed.error;
        if (delTax.error) throw delTax.error;
      }

      const deductionRows = [
      ...source.preTax.map((d) => ({
        income_source_id: incomeSourceId,
        phase: 'pre_tax' as const,
        label: d.label,
        amount: d.amount,
        tag: d.tag,
        category_id: d.categoryId ?? null
      })),
      ...source.postTax.map((d) => ({
        income_source_id: incomeSourceId,
        phase: 'post_tax' as const,
        label: d.label,
        amount: d.amount,
        tag: d.tag,
        category_id: d.categoryId ?? null
      }))];

      const taxRows = source.taxes.map((t) => ({
        income_source_id: incomeSourceId,
        label: t.label,
        amount: t.amount
      }));

      const [dedRes, taxRes] = await Promise.all([
      deductionRows.length ?
      supabase.from('income_deductions').insert(deductionRows).select() :
      Promise.resolve({ data: [] as IncomeDeductionRow[], error: null }),
      taxRows.length ?
      supabase.from('income_tax_lines').insert(taxRows).select() :
      Promise.resolve({ data: [] as IncomeTaxLineRow[], error: null })]
      );
      if (dedRes.error) throw dedRes.error;
      if (taxRes.error) throw taxRes.error;

      setRawDeductions((prev) => [
      ...prev.filter((d) => d.income_source_id !== incomeSourceId),
      ...(dedRes.data ?? [])]
      );
      setRawTaxLines((prev) => [
      ...prev.filter((t) => t.income_source_id !== incomeSourceId),
      ...(taxRes.data ?? [])]
      );
    },
    [profile, rawIncomeSources]
  );

  const deleteIncomeSource = useCallback(
    async (id: string) => {
      if (!profile) return;
      const { error } = await supabase.
      from('income_sources').
      delete().
      eq('id', id).
      eq('user_id', profile.id);
      if (error) throw error;
      setRawIncomeSources((prev) => prev.filter((s) => s.id !== id));
      setRawDeductions((prev) => prev.filter((d) => d.income_source_id !== id));
      setRawTaxLines((prev) => prev.filter((t) => t.income_source_id !== id));
    },
    [profile]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      sendMagicLink,
      signOut,
      setupComplete,
      completeSetup,
      members,
      activeMembers,
      viewId,
      setViewId,
      viewMember,
      isHousehold,
      canEdit,
      selfId,
      inviteMember,
      removeMember,
      memberById,
      categories: viewCategories,
      transactions: viewTransactions,
      takeHome,
      autoEntriesFor,
      totalsByMember,
      activeCategories,
      incomeSources: myIncome,
      usage,
      months,
      selectedMonth,
      setSelectedMonth,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addCategory,
      updateCategory,
      deleteCategory,
      categoryById,
      categoryHasEntries,
      saveIncomeSource,
      deleteIncomeSource
    }),
    [
    user,
    loading,
    sendMagicLink,
    signOut,
    setupComplete,
    completeSetup,
    members,
    activeMembers,
    viewId,
    viewMember,
    isHousehold,
    canEdit,
    selfId,
    inviteMember,
    removeMember,
    memberById,
    viewCategories,
    viewTransactions,
    takeHome,
    autoEntriesFor,
    totalsByMember,
    activeCategories,
    myIncome,
    usage,
    months,
    selectedMonth,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    updateCategory,
    deleteCategory,
    categoryById,
    categoryHasEntries,
    saveIncomeSource,
    deleteIncomeSource]

  );

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget() {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('useBudget must be used inside a BudgetProvider');
  return ctx;
}
