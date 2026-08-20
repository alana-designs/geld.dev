import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  ChevronRightIcon,
  EyeIcon,
  KeyboardIcon,
  LogOutIcon,
  MailIcon,
  PlusIcon,
  SparklesIcon,
  UserPlusIcon,
  XIcon } from
'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { IncomeSource } from '../types/income';
import { formatCurrency } from '../utils/format';
import {
  frequencyMeta,
  generateAutoEntries,
  monthlyNet,
  netPerPeriod,
  retirementDeductions,
  sumAmounts } from
'../utils/income';
import { monthLabel, totalOf } from '../utils/rollups';
import { IncomeSourceSheet } from '../components/income/IncomeSourceSheet';
import { MonthPicker } from '../components/MonthPicker';
import { ChangelogModal } from '../components/changelog/ChangelogModal';
import { latestRelease } from '../data/changelog';

interface SettingsProps {
  onSignIn: () => void;
}

export function Settings({ onSignIn }: SettingsProps) {
  const {
    user,
    signOut,
    incomeSources,
    activeCategories,
    takeHome,
    members,
    inviteMember,
    removeMember,
    setViewId,
    months,
    selectedMonth,
    setSelectedMonth
  } = useBudget();
  const [sheet, setSheet] = useState<{open: boolean;source: IncomeSource | null;}>({
    open: false,
    source: null
  });
  const [invite, setInvite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = invite.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (members.some((m) => m.email.toLowerCase() === email.toLowerCase())) {
      setError('That person is already in your household.');
      return;
    }
    try {
      await inviteMember(email);
      setInvite('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the invite — try again.');
    }
  };

  // Same source of truth as the Dashboard's "Total savings rate" — actual
  // dated auto-entries for the selected month, not a flat per-year average,
  // so the two numbers never disagree.
  const autoSavings = totalOf(generateAutoEntries(incomeSources, activeCategories, selectedMonth));

  // Salaried income isn't tied to a month — always show it. Hourly income is
  // one paycheck per entry, so only show the ones received in the viewed
  // month, or the list balloons as paychecks pile up.
  const visibleIncomeSources = incomeSources.filter(
    (s) => s.payType === 'salaried' || s.paycheckDate?.slice(0, 7) === selectedMonth
  );

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-card border border-line bg-surface">
        <button
          type="button"
          onClick={() => setChangelogOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas">

          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-muted">
            <SparklesIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium tracking-[-0.01em] text-ink">
              What&rsquo;s new in Geld
            </span>
            <span className="block truncate text-xs text-muted">
              {latestRelease ? `v${latestRelease.version} · ${latestRelease.title}` : 'Nothing published yet'}
            </span>
          </span>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
        </button>
      </section>

      <header>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
          Income · household · account
        </p>
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-ink">Settings</h1>
      </header>

      <section className="rounded-card border border-line bg-surface">
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
              Monthly take-home
            </p>
            <p className="tabular text-2xl font-bold tracking-[-0.03em] text-ink">
              {formatCurrency(takeHome, false)}
            </p>
            {autoSavings > 0 &&
            <p className="mt-1 text-xs text-muted">
                Already excludes {formatCurrency(autoSavings, false)}/mo sent to savings
                automatically
              </p>
            }
          </div>
          <MonthPicker months={months} value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        <ul className="divide-y divide-line">
          {visibleIncomeSources.map((source) => {
            const meta = source.frequency ? frequencyMeta(source.frequency) : null;
            const retirement = sumAmounts(retirementDeductions(source));
            return (
              <li key={source.id}>
                <button
                  type="button"
                  onClick={() => setSheet({ open: true, source })}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas">

                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-muted">
                    <KeyboardIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium tracking-[-0.01em] text-ink">
                      {source.name}
                    </span>
                    <span className="tabular block truncate text-xs text-muted">
                      {source.payType === 'hourly' ?
                      `${formatCurrency(netPerPeriod(source))} received ${source.paycheckDate ? format(parseISO(source.paycheckDate), 'MMM d, yyyy') : '—'}` :
                      `${formatCurrency(netPerPeriod(source))} ${meta?.short} · ${formatCurrency(monthlyNet(source, selectedMonth), false)}/mo`}
                      {retirement > 0 &&
                      ` · ${formatCurrency(retirement)}${source.payType === 'hourly' ? ' to savings' : '/paycheck already went to savings'}`}
                    </span>
                    <span className="block text-[11px] text-subtle">
                      {source.payType === 'hourly' ?
                      `Counted in ${monthLabel(selectedMonth)}'s take-home` :
                      `Updated ${format(parseISO(source.updatedAt), 'MMM d, yyyy')}`}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
                </button>
              </li>);

          })}
          {incomeSources.length === 0 &&
          <li className="px-4 py-6 text-center">
              <p className="text-sm font-semibold text-ink">No income set up yet</p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">
                Add a paycheck so &ldquo;left to spend&rdquo; is based on real take-home, not a
                guess.
              </p>
            </li>
          }
          {incomeSources.length > 0 && visibleIncomeSources.length === 0 &&
          <li className="px-4 py-6 text-center">
              <p className="text-sm font-semibold text-ink">
                No paychecks logged for {monthLabel(selectedMonth)}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">
                Pick a different month, or add the paycheck you received this month.
              </p>
            </li>
          }
        </ul>

        <button
          type="button"
          onClick={() => setSheet({ open: true, source: null })}
          className="flex w-full items-center justify-center gap-1.5 border-t border-line py-3 text-xs font-medium text-primary transition-colors hover:bg-canvas">
          
          <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Add income source
        </button>
      </section>

      <section className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">Household</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-subtle">
            Everyone keeps their own income, categories, and entries. You can see each
            other&rsquo;s tabs, but only edit your own.
          </p>
        </div>

        <ul className="divide-y divide-line">
          {members.map((member) =>
          <li key={member.id} className="flex items-center gap-3 px-4 py-2.5">
              <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ backgroundColor: member.color }}
              aria-hidden="true">
              
                {member.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {member.isSelf ? 'You' : member.name}
                  {member.demo &&
                <span className="ml-1.5 rounded border border-line px-1 text-[10px] font-normal uppercase tracking-wide text-subtle">
                      Demo
                    </span>
                }
                </span>
                <span className="block truncate text-xs text-muted">{member.email}</span>
              </span>

              {member.status === 'pending' ?
            <span className="shrink-0 rounded-full bg-wants/10 px-2 py-1 text-[11px] font-medium text-wants">
                  Invite sent
                </span> :

            !member.isSelf &&
            <button
              type="button"
              onClick={() => setViewId(member.id)}
              className="flex shrink-0 items-center gap-1 rounded-control border border-line px-2.5 py-1.5 text-[11px] font-medium text-ink hover:bg-canvas">
              
                    <EyeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    View
                  </button>

            }

              {!member.isSelf &&
            <button
              type="button"
              onClick={() => removeMember(member.id)}
              aria-label={`Remove ${member.name}`}
              className="shrink-0 rounded-full p-1.5 text-subtle transition-colors hover:bg-canvas hover:text-alert">
              
                  <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            }
            </li>
          )}
        </ul>

        <form onSubmit={sendInvite} className="border-t border-line p-3">
          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-control border border-line px-2.5 focus-within:border-ink">
              <MailIcon className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
              <input
                type="email"
                value={invite}
                onChange={(e) => {
                  setInvite(e.target.value);
                  setError(null);
                }}
                placeholder="partner@example.com"
                aria-label="Invite by email"
                className="w-full bg-transparent px-2 py-2.5 text-sm text-ink outline-none placeholder:text-subtle" />
              
            </div>
            <button
              type="submit"
              className="flex shrink-0 items-center gap-1.5 rounded-control bg-primary px-3 text-xs font-semibold text-white transition-transform active:scale-[0.98]">
              
              <UserPlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Invite
            </button>
          </div>
          {error && <p className="mt-1.5 text-[11px] text-alert">{error}</p>}
          <p className="mt-1.5 text-[11px] leading-relaxed text-subtle">
            They&rsquo;ll get an email link, set up their own paycheck and categories, then their
            tab appears next to yours.
          </p>
        </form>
      </section>

      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">Account</h2>
        {user ?
        <>
            <p className="mt-1.5 text-sm text-muted">{user.email}</p>
            <button
            type="button"
            onClick={signOut}
            className="mt-3 flex items-center gap-2 rounded-control border border-line px-3 py-2.5 text-xs font-medium text-ink transition-colors hover:bg-canvas">
            
              <LogOutIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Sign out
            </button>
          </> :

        <>
            <p className="mt-1.5 text-sm text-muted">
              Sign in with a magic link to keep this ledger across devices.
            </p>
            <button
            type="button"
            onClick={onSignIn}
            className="mt-3 rounded-control bg-primary px-3 py-2.5 text-xs font-semibold text-white">
            
              Sign in
            </button>
          </>
        }
      </section>

      <IncomeSourceSheet
        open={sheet.open}
        source={sheet.source}
        onClose={() => setSheet({ open: false, source: null })} />
      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </div>);

}