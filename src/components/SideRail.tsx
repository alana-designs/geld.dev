import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, ListIcon, SettingsIcon, TargetIcon, UserIcon } from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { WhatsNewCard } from './changelog/WhatsNewCard';
import { ChangelogModal } from './changelog/ChangelogModal';
import { hasUnreadRelease } from '../data/changelog';

interface SideRailProps {
  onAccount: () => void;
}

const items = [
{ to: '/', label: 'Home', Icon: HomeIcon, end: true },
{ to: '/activity', label: 'Activity', Icon: ListIcon, end: false },
{ to: '/budget', label: 'Budget', Icon: TargetIcon, end: false },
{ to: '/settings', label: 'Settings', Icon: SettingsIcon, end: false }];


/** Desktop navigation. The primary "add expense" action lives in the content column. */
export function SideRail({ onAccount }: SideRailProps) {
  const { user, selfName, activeMembers } = useBudget();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [unread, setUnread] = useState(hasUnreadRelease);

  return (
    <aside
      aria-label="Primary"
      className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex">

      <div className="flex h-14 items-center border-b border-line px-5">
        <span className="text-sm font-bold tracking-[-0.03em] text-ink">Geld</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {items.map(({ to, label, Icon, end }) =>
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
          `flex items-center gap-2.5 rounded-control px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive ? 'bg-canvas text-ink' : 'text-muted hover:bg-canvas hover:text-ink'}`
          }>

            {({ isActive }) =>
          <>
                <Icon
              className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : 'text-subtle'}`}
              strokeWidth={isActive ? 2.2 : 1.8}
              aria-hidden="true" />

                {label}
              </>
          }
          </NavLink>
        )}
      </nav>

      <div className="p-3">
        <WhatsNewCard
          unread={unread}
          onOpen={() => {
            setUnread(false);
            setChangelogOpen(true);
          }} />

      </div>

      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={onAccount}
          className="flex w-full items-center gap-2.5 rounded-control px-3 py-2.5 text-left transition-colors hover:bg-canvas">

          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-canvas text-subtle">
            <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-ink">
              {user ? selfName ?? user.email : 'Sign in'}
            </span>
            <span className="block text-[11px] text-subtle">
              {activeMembers.length > 1 ? `Household of ${activeMembers.length}` : 'Household of 1'}
            </span>
          </span>
        </button>
      </div>

      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </aside>);

}
