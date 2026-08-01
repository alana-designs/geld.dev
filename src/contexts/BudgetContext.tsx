import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode } from
'react';
import { AuthUser, Category, Member, ParentCategory, Transaction } from '../types/budget';
import { IncomeSource } from '../types/income';
import { seedCategories } from '../data/categories';
import { seedTransactions } from '../data/transactions';
import { seedIncomeSources } from '../data/income';
import {
  HOUSEHOLD_VIEW,
  SELF_ID,
  partnerCategories,
  partnerIncome,
  partnerTransactions,
  seedMembers } from
'../data/household';
import { availableMonths, toMonthKey, usageByCategory } from '../utils/rollups';
import { generateAutoEntries, totalMonthlyNet } from '../utils/income';

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
  signIn: (email: string) => void;
  signOut: () => void;
  setupComplete: boolean;
  completeSetup: () => void;

  /** Household */
  members: Member[];
  activeMembers: Member[];
  viewId: string;
  setViewId: (id: string) => void;
  viewMember: Member | null;
  isHousehold: boolean;
  /** Only your own tab is editable — everyone else is read-only. */
  canEdit: boolean;
  inviteMember: (email: string, name?: string) => void;
  removeMember: (id: string) => void;
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

  addTransaction: (input: NewTransaction) => void;
  updateTransaction: (id: string, patch: Partial<NewTransaction>) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (name: string, parent: ParentCategory, monthlyGoal?: number) => Category;
  updateCategory: (id: string, patch: CategoryPatch) => void;
  deleteCategory: (id: string) => void;
  categoryById: (id: string) => Category | undefined;
  categoryHasEntries: (id: string) => boolean;
  saveIncomeSource: (source: IncomeSource) => void;
  deleteIncomeSource: (id: string) => void;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

const slug = (value: string) =>
`${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category'}-${Math.random().
toString(36).
slice(2, 6)}`;

const INVITE_COLORS = ['#8c6239', '#6f7a4a', '#93627e', '#a3562f'];

export function BudgetProvider({ children }: {children: ReactNode;}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [members, setMembers] = useState<Member[]>(seedMembers);
  const [categories, setCategories] = useState<Category[]>([
  ...seedCategories,
  ...partnerCategories]
  );
  const [transactions, setTransactions] = useState<Transaction[]>([
  ...seedTransactions,
  ...partnerTransactions]
  );
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([
  ...seedIncomeSources,
  ...partnerIncome]
  );
  const [viewId, setViewId] = useState<string>(SELF_ID);

  const months = useMemo(() => availableMonths(transactions), [transactions]);
  const [selectedMonth, setSelectedMonth] = useState<string>(toMonthKey(new Date()));

  useEffect(() => {
    if (!months.includes(selectedMonth)) setSelectedMonth(months[0]);
  }, [months, selectedMonth]);

  const signIn = useCallback((email: string) => {
    setUser({ email });
    setMembers((prev) => prev.map((m) => m.isSelf ? { ...m, email } : m));
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setSetupComplete(false);
    setViewId(SELF_ID);
  }, []);

  const completeSetup = useCallback(() => setSetupComplete(true), []);

  const isHousehold = viewId === HOUSEHOLD_VIEW;
  const canEdit = viewId === SELF_ID;

  const inviteMember = useCallback((email: string, name?: string) => {
    setMembers((prev) => [
    ...prev,
    {
      id: `member-${Date.now()}`,
      name: name?.trim() || email.split('@')[0],
      email: email.trim(),
      isSelf: false,
      status: 'pending',
      color: INVITE_COLORS[prev.length % INVITE_COLORS.length]
    }]
    );
  }, []);

  const removeMember = useCallback((id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id || m.isSelf));
    setViewId((current) => current === id ? SELF_ID : current);
  }, []);

  const addTransaction = useCallback((input: NewTransaction) => {
    setTransactions((prev) => [
    {
      id: `tx-${Date.now()}`,
      memberId: SELF_ID,
      createdAt: new Date().toISOString(),
      ...input
    },
    ...prev]
    );
    setSelectedMonth(input.date.slice(0, 7));
  }, []);

  const updateTransaction = useCallback((id: string, patch: Partial<NewTransaction>) => {
    setTransactions((prev) =>
    prev.map((tx) => tx.id === id && tx.memberId === SELF_ID ? { ...tx, ...patch } : tx)
    );
    if (patch.date) setSelectedMonth(patch.date.slice(0, 7));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((tx) => !(tx.id === id && tx.memberId === SELF_ID)));
  }, []);

  const addCategory = useCallback((name: string, parent: ParentCategory, monthlyGoal = 0) => {
    const category: Category = {
      id: slug(name),
      memberId: SELF_ID,
      name: name.trim(),
      parent,
      monthlyGoal,
      archived: false
    };
    setCategories((prev) => [...prev, category]);
    return category;
  }, []);

  const updateCategory = useCallback((id: string, patch: CategoryPatch) => {
    setCategories((prev) =>
    prev.map((c) => c.id === id && c.memberId === SELF_ID ? { ...c, ...patch } : c)
    );
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories((prev) => prev.filter((c) => !(c.id === id && c.memberId === SELF_ID)));
  }, []);

  const saveIncomeSource = useCallback((source: IncomeSource) => {
    setIncomeSources((prev) => {
      const owned = { ...source, memberId: SELF_ID };
      return prev.some((s) => s.id === owned.id) ?
      prev.map((s) => s.id === owned.id ? owned : s) :
      [...prev, owned];
    });
  }, []);

  const deleteIncomeSource = useCallback((id: string) => {
    setIncomeSources((prev) => prev.filter((s) => !(s.id === id && s.memberId === SELF_ID)));
  }, []);

  const categoryById = useCallback(
    (id: string) => categories.find((c) => c.id === id),
    [categories]
  );

  const categoryHasEntries = useCallback(
    (id: string) => transactions.some((tx) => tx.categoryId === id),
    [transactions]
  );

  const memberById = useCallback((id: string) => members.find((m) => m.id === id), [members]);

  const activeMembers = useMemo(() => members.filter((m) => m.status === 'active'), [members]);

  const inView = useCallback(
    (memberId: string) => isHousehold ? activeMembers.some((m) => m.id === memberId) : memberId === viewId,
    [isHousehold, activeMembers, viewId]
  );

  const viewCategories = useMemo(
    () => categories.filter((c) => inView(c.memberId)),
    [categories, inView]
  );

  const viewTransactions = useMemo(
    () => transactions.filter((tx) => inView(tx.memberId)),
    [transactions, inView]
  );

  const viewIncome = useMemo(
    () => incomeSources.filter((s) => inView(s.memberId)),
    [incomeSources, inView]
  );

  const takeHome = useMemo(() => totalMonthlyNet(viewIncome), [viewIncome]);

  const autoEntriesFor = useCallback(
    (key: string) => generateAutoEntries(viewIncome, categories, key),
    [viewIncome, categories]
  );

  const totalsByMember = useCallback(
    (key: string) =>
    activeMembers.map((member) => {
      const memberIncome = incomeSources.filter((s) => s.memberId === member.id);
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
    [activeMembers, incomeSources, categories, transactions]
  );

  const myCategories = useMemo(
    () => categories.filter((c) => c.memberId === SELF_ID),
    [categories]
  );
  const activeCategories = useMemo(() => myCategories.filter((c) => !c.archived), [myCategories]);
  const myIncome = useMemo(
    () => incomeSources.filter((s) => s.memberId === SELF_ID),
    [incomeSources]
  );
  const usage = useMemo(
    () => usageByCategory(transactions.filter((tx) => tx.memberId === SELF_ID)),
    [transactions]
  );

  const viewMember = isHousehold ? null : members.find((m) => m.id === viewId) ?? null;

  const value = useMemo(
    () => ({
      user,
      signIn,
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
    signIn,
    signOut,
    setupComplete,
    completeSetup,
    members,
    activeMembers,
    viewId,
    viewMember,
    isHousehold,
    canEdit,
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