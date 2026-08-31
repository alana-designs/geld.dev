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
import { availableMonths, inMonth, toMonthKey, usageByCategory } from '../utils/rollups';
import { totalMonthlyNet } from '../utils/income';
import { generateRecurringEntries } from '../utils/recurring';

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

/**
 * An invite someone else sent to *your* email. You can't read the inviting
 * household's profiles (you're not in it yet), so these come from the
 * `my_pending_invites()` RPC, which returns just enough to decide.
 */
export interface IncomingInvite {
  id: string;
  inviterName: string;
  inviterEmail: string;
  householdSize: number;
  /** ISO timestamp. Invites lapse an hour after they're sent. */
  expiresAt: string;
}

/**
 * Someone who accepted an invite this household sent, waiting on the inviter to
 * confirm. `acceptedEmail` is the address that actually accepted — the thing
 * worth reading, since a typo'd invite can be claimed by a stranger and the
 * display name is theirs to choose.
 */
export interface PendingConfirmation {
  id: string;
  invitedEmail: string;
  acceptedName: string;
  acceptedEmail: string;
  acceptedAt: string;
}

const INVITE_COLORS = ['#8c6239', '#6f7a4a', '#93627e', '#a3562f'];

interface NewTransaction {
  amount: number;
  categoryId: string;
  description: string;
  date: string;
  recurring?: boolean;
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
  /** Your own display name — editable, shown to household members instead of your email. */
  selfName: string | null;
  updateMyName: (name: string) => Promise<void>;
  inviteMember: (email: string, name?: string) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  memberById: (id: string) => Member | undefined;

  /** Invites addressed to you, from households you're not in yet. */
  incomingInvites: IncomingInvite[];
  /** Says yes. Nothing is shared until the inviter confirms your address. */
  acceptInvite: (inviteId: string) => Promise<void>;
  declineInvite: (inviteId: string) => Promise<void>;

  /** People waiting on you to confirm them into your household. */
  pendingConfirmations: PendingConfirmation[];
  /** Verifies the address that accepted, and moves them in. */
  confirmMember: (inviteId: string) => Promise<void>;
  /** Rejects the person who accepted — used when the address isn't who you meant. */
  rejectMember: (inviteId: string) => Promise<void>;

  /** You accepted an invite and are waiting on the inviter to confirm your address. */
  awaitingConfirmation: boolean;

  /** Moves you and your entries out into a household of your own. */
  leaveHousehold: () => Promise<void>;

  /** Scoped to whichever tab is selected */
  categories: Category[];
  transactions: Transaction[];
  /** Full household data — for export and other cross-member operations */
  allCategories: Category[];
  allTransactions: Transaction[];
  /** Household-wide payroll savings, kept out of allTransactions. */
  allAutoEntries: Transaction[];
  allIncomeSources: IncomeSource[];
  takeHome: number;
  autoEntriesFor: (monthKey: string) => Transaction[];
  myAutoEntriesFor: (monthKey: string) => Transaction[];
  recurringEntriesFor: (monthKey: string) => Transaction[];
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
  createdAt: row.created_at,
  recurring: row.recurring,
  // Posted server-side by generate_paycheck_entries() (migrations 0012/0013),
  // never typed in — flagged so they render read-only and stay out of spend.
  auto: row.source === 'auto',
  autoSource: row.source === 'auto' ? 'income' : undefined
});

/** Payroll savings: a real row, but never spending — that money was never
 *  spendable cash. Recurring-expense projections are `auto` too, and *are*
 *  spending, so they must not match here. */
const isPayrollAuto = (tx: Transaction) => tx.auto === true && tx.autoSource === 'income';

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
    payType: row.pay_type,
    grossPay: Number(row.gross_pay),
    frequency: row.frequency,
    paycheckDate: row.paycheck_date,
    semimonthlySchedule: row.semimonthly_schedule,
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
  const [incomingInvites, setIncomingInvites] = useState<IncomingInvite[]>([]);
  const [pendingConfirmations, setPendingConfirmations] = useState<PendingConfirmation[]>([]);
  /** You accepted an invite and are waiting on the inviter to confirm your address. */
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  /** Bumped after joining a household, to re-run the load effect from scratch. */
  const [reloadKey, setReloadKey] = useState(0);
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
    setIncomingInvites([]);
    setPendingConfirmations([]);
    setAwaitingConfirmation(false);
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
      // maybeSingle, not single: a missing profile is a recoverable state, not
      // an error. handle_new_user() only fires on INSERT into auth.users, so an
      // account whose profile row was removed never gets one back on its own --
      // ensure_profile() creates a fresh household of one rather than leaving
      // the app stuck on a blank screen.
      let { data: me, error: meError } = await supabase.
      from('profiles').
      select('*').
      eq('id', userId).
      maybeSingle();
      if (!active) return;

      if (!meError && !me) {
        const healed = await supabase.rpc('ensure_profile').single();
        if (!active) return;
        me = healed.data;
        meError = healed.error;
      }

      if (meError || !me) {
        console.error(meError);
        setLoading(false);
        return;
      }
      setProfile(me);

      const [profilesRes, invitesRes, categoriesRes, incomingRes, confirmRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('household_id', me.household_id),
      // RLS returns this household's own invites plus any addressed to my email,
      // so one query covers both the outgoing list and my own waiting-to-be-
      // confirmed row. Split by household_id below.
      supabase.
      from('household_invites').
      select('*').
      in('status', ['pending', 'accepted']),
      supabase.from('categories').select('*').eq('household_id', me.household_id),
      supabase.rpc('my_pending_invites'),
      supabase.rpc('pending_member_confirmations')]
      );
      if (!active) return;
      // A failed invite lookup shouldn't block the whole app from loading —
      // worst case you don't see a pending invite until the next refresh.
      if (incomingRes.error) console.error(incomingRes.error);
      if (confirmRes.error) console.error(confirmRes.error);
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
      const allInvites = invitesRes.data ?? [];
      setInvites(allInvites.filter((i) => i.household_id === me.household_id && i.status === 'pending'));
      setAwaitingConfirmation(
        allInvites.some((i) => i.household_id !== me.household_id && i.status === 'accepted')
      );
      setIncomingInvites(
        (incomingRes.data ?? []).map((row) => ({
          id: row.invite_id,
          inviterName: row.inviter_name,
          inviterEmail: row.inviter_email,
          householdSize: Number(row.household_size),
          expiresAt: row.expires_at
        }))
      );
      setPendingConfirmations(
        (confirmRes.data ?? []).map((row) => ({
          id: row.invite_id,
          invitedEmail: row.invited_email,
          acceptedName: row.accepted_name,
          acceptedEmail: row.accepted_email,
          acceptedAt: row.accepted_at
        }))
      );
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
  }, [session?.user?.id, reloadKey]);

  const user: AuthUser | null = session?.user?.email ? { email: session.user.email } : null;
  const selfId = profile?.id ?? null;
  const selfName = profile?.name ?? null;
  const setupComplete = profile?.onboarded ?? false;

  const updateMyName = useCallback(
    async (name: string) => {
      if (!profile) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const { data, error } = await supabase.
      from('profiles').
      update({ name: trimmed }).
      eq('id', profile.id).
      select().
      single();
      if (error) throw error;
      setProfile(data);
      setProfiles((prev) => prev.map((p) => p.id === data.id ? data : p));
    },
    [profile]
  );

  const sendMagicLink = useCallback(async (email: string, remember = true) => {
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
      // expires_at is set server-side — a client that could write it could put
      // it far enough ahead to make the 1-hour window meaningless.
      const { data, error } = await supabase.
      rpc('send_household_invite', { p_email: email.trim(), p_name: name?.trim() || null }).
      single();
      if (error) {
        throw new Error(
          error.code === '23505' ?
          "That person's already been invited." :
          error.message || 'Could not send the invite — try again.'
        );
      }
      setInvites((prev) => [...prev, data]);
    },
    [profile]
  );

  const removeMember = useCallback(
    async (id: string) => {
      if (!profile) return;

      const pending = invites.find((i) => i.id === id);
      if (pending) {
        const { error } = await supabase.
        from('household_invites').
        delete().
        eq('id', id).
        eq('household_id', profile.household_id);
        if (error) throw error;
        setInvites((prev) => prev.filter((i) => i.id !== id));
        setViewId((current) => current === id ? profile.id : current);
        return;
      }

      // An active member: they and their entries move out to a household of
      // their own, rather than anything being deleted.
      const { error } = await supabase.rpc('remove_household_member', { p_user_id: id });
      if (error) throw new Error(error.message);
      setViewId((current) => current === id ? profile.id : current);
      setReloadKey((k) => k + 1);
    },
    [profile, invites]
  );

  // household_id isn't writable from the client (migration 0005), so every
  // membership change goes through a security-definer function.

  // Accepting records intent only — nothing moves and nothing is shared until
  // the inviter confirms the address that accepted (migration 0008).
  const acceptInvite = useCallback(async (inviteId: string) => {
    const { error } = await supabase.rpc('accept_household_invite', { p_invite_id: inviteId });
    if (error) throw new Error(error.message);
    setIncomingInvites((prev) => prev.filter((i) => i.id !== inviteId));
    setAwaitingConfirmation(true);
  }, []);

  const declineInvite = useCallback(async (inviteId: string) => {
    const { error } = await supabase.from('household_invites').delete().eq('id', inviteId);
    if (error) throw error;
    setIncomingInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }, []);

  // The step that actually shares: the inviter has read the address back.
  const confirmMember = useCallback(async (inviteId: string) => {
    const { error } = await supabase.rpc('confirm_household_member', { p_invite_id: inviteId });
    if (error) throw new Error(error.message);
    setPendingConfirmations((prev) => prev.filter((c) => c.id !== inviteId));
    setReloadKey((k) => k + 1);
  }, []);

  const rejectMember = useCallback(async (inviteId: string) => {
    const { error } = await supabase.rpc('decline_household_member', { p_invite_id: inviteId });
    if (error) throw new Error(error.message);
    setPendingConfirmations((prev) => prev.filter((c) => c.id !== inviteId));
  }, []);

  const leaveHousehold = useCallback(async () => {
    const { error } = await supabase.rpc('leave_household');
    if (error) throw new Error(error.message);
    setViewId('');
    setReloadKey((k) => k + 1);
  }, []);

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

  const mappedTransactions: Transaction[] = useMemo(
    () => rawTransactions.map(mapTransaction),
    [rawTransactions]
  );

  // The spend ledger excludes payroll savings; callers that want those pull
  // them deliberately through autoEntriesFor / myAutoEntriesFor. Keeping the
  // two apart preserves the split the old client-side projection created.
  const transactions: Transaction[] = useMemo(
    () => mappedTransactions.filter((tx) => !isPayrollAuto(tx)),
    [mappedTransactions]
  );
  const payrollEntries: Transaction[] = useMemo(
    () => mappedTransactions.filter(isPayrollAuto),
    [mappedTransactions]
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

  const takeHome = useMemo(
    () => totalMonthlyNet(viewIncome, selectedMonth),
    [viewIncome, selectedMonth]
  );

  const viewPayrollEntries = useMemo(
    () => payrollEntries.filter((tx) => inView(tx.memberId)),
    [payrollEntries, inView]
  );

  const autoEntriesFor = useCallback(
    (key: string) => inMonth(viewPayrollEntries, key),
    [viewPayrollEntries]
  );

  // Settings reports the signed-in member's own payroll savings, never the
  // household roll-up, so it needs a self-scoped view.
  const myAutoEntriesFor = useCallback(
    (key: string) => inMonth(payrollEntries.filter((tx) => tx.memberId === profile?.id), key),
    [payrollEntries, profile]
  );

  const recurringEntriesFor = useCallback(
    (key: string) => generateRecurringEntries(viewTransactions, key),
    [viewTransactions]
  );

  const totalsByMember = useCallback(
    (key: string) =>
    activeMembers.map((member) => {
      const memberTransactions = transactions.filter((tx) => tx.memberId === member.id);
      const memberIncome = allIncomeSources.filter((s) => s.memberId === member.id);
      const auto = inMonth(payrollEntries.filter((tx) => tx.memberId === member.id), key);
      const recurring = generateRecurringEntries(memberTransactions, key);
      return {
        member,
        spent: [
        ...memberTransactions.filter((tx) => tx.date.slice(0, 7) === key),
        ...recurring].
        reduce((sum, tx) => sum + tx.amount, 0),
        takeHome: totalMonthlyNet(memberIncome, key),
        autoSavings: auto.reduce((sum, tx) => sum + tx.amount, 0)
      };
    }),
    [activeMembers, allIncomeSources, payrollEntries, transactions]
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

  // Hourly paychecks count toward whichever month they were received in, so
  // that month needs to be reachable even if nothing else was logged yet.
  const hourlyPaycheckMonths = useMemo(
    () =>
    allIncomeSources.
    map((s) => s.payType === 'hourly' ? s.paycheckDate?.slice(0, 7) : null).
    filter((key): key is string => Boolean(key)),
    [allIncomeSources]
  );
  const months = useMemo(
    () => availableMonths(transactions, new Date(), hourlyPaycheckMonths),
    [transactions, hourlyPaycheckMonths]
  );
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
        date: input.date,
        recurring: input.recurring ?? false
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
      if (patch.recurring !== undefined) dbPatch.recurring = patch.recurring;
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
          pay_type: source.payType,
          gross_pay: source.grossPay,
          frequency: source.payType === 'hourly' ? null : source.frequency,
          paycheck_date: source.payType === 'hourly' ? source.paycheckDate : null,
          semimonthly_schedule:
          source.payType === 'salaried' && source.frequency === 'semimonthly' ?
          source.semimonthlySchedule :
          null,
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
          pay_type: source.payType,
          gross_pay: source.grossPay,
          frequency: source.payType === 'hourly' ? null : source.frequency,
          paycheck_date: source.payType === 'hourly' ? source.paycheckDate : null,
          semimonthly_schedule:
          source.payType === 'salaried' && source.frequency === 'semimonthly' ?
          source.semimonthlySchedule :
          null,
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
      selfName,
      updateMyName,
      inviteMember,
      removeMember,
      memberById,
      incomingInvites,
      acceptInvite,
      declineInvite,
      pendingConfirmations,
      confirmMember,
      rejectMember,
      awaitingConfirmation,
      leaveHousehold,
      categories: viewCategories,
      transactions: viewTransactions,
      allCategories: categories,
      allTransactions: transactions,
      allAutoEntries: payrollEntries,
      allIncomeSources,
      takeHome,
      autoEntriesFor,
      myAutoEntriesFor,
      recurringEntriesFor,
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
    selfName,
    updateMyName,
    inviteMember,
    removeMember,
    memberById,
    incomingInvites,
    acceptInvite,
    declineInvite,
    pendingConfirmations,
    confirmMember,
    rejectMember,
    awaitingConfirmation,
    leaveHousehold,
    viewCategories,
    viewTransactions,
    categories,
    transactions,
    allIncomeSources,
    takeHome,
    autoEntriesFor,
    myAutoEntriesFor,
    payrollEntries,
    recurringEntriesFor,
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
