import React from 'react';
import { motion } from 'framer-motion';
import { EyeIcon, UsersIcon } from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { HOUSEHOLD_VIEW } from '../data/household';

/**
 * One control, on every screen: whose ledger am I looking at?
 * Your own tab is editable; everyone else's is read-only.
 */
export function MemberTabs() {
  const { activeMembers, viewId, setViewId, viewMember, canEdit } = useBudget();
  if (activeMembers.length < 2) return null;

  const tabs = [
  ...activeMembers.map((m) => ({ id: m.id, label: m.isSelf ? 'You' : m.name, color: m.color })),
  { id: HOUSEHOLD_VIEW, label: 'Household', color: '#38352f' }];


  return (
    <div className="space-y-2">
      <div
        role="tablist"
        aria-label="Household member"
        className="flex gap-1 rounded-full bg-line/70 p-1">
        
        {tabs.map((tab) => {
          const active = viewId === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setViewId(tab.id)}
              className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-medium transition-colors ${
              active ? 'text-ink' : 'text-muted hover:text-ink'}`
              }>
              
              {active &&
              <motion.span
                layoutId="member-tab"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-full bg-surface shadow-sm" />

              }
              <span className="relative flex min-w-0 items-center gap-1.5">
                {tab.id === HOUSEHOLD_VIEW ?
                <UsersIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> :

                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tab.color }}
                  aria-hidden="true" />

                }
                <span className="truncate">{tab.label}</span>
              </span>
            </button>);

        })}
      </div>

      {!canEdit &&
      <p className="flex items-center gap-1.5 px-1 text-[11px] text-subtle">
          <EyeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {viewMember ?
        `Viewing ${viewMember.name}'s budget — read-only.` :
        'Combined household view — read-only.'}
        </p>
      }
    </div>);

}