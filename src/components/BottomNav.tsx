import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, ListIcon, PlusIcon, SettingsIcon, TargetIcon } from 'lucide-react';

interface BottomNavProps {
  onAdd: () => void;
}

export function BottomNav({ onAdd }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      
      <div className="mx-auto grid max-w-2xl grid-cols-5 items-center px-3 py-2">
        <NavItem to="/" label="Home" Icon={HomeIcon} end />
        <NavItem to="/activity" label="Activity" Icon={ListIcon} />

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onAdd}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/25 transition-transform active:scale-95"
            aria-label="Add expense">
            
            <PlusIcon className="h-6 w-6" strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>

        <NavItem to="/budget" label="Budget" Icon={TargetIcon} />
        <NavItem to="/settings" label="Settings" Icon={SettingsIcon} />
      </div>
    </nav>);

}

function NavItem({
  to,
  label,
  Icon,
  end = false





}: {to: string;label: string;Icon: typeof HomeIcon;end?: boolean;}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
      `flex flex-col items-center gap-1 py-1.5 text-[11px] font-medium transition-colors ${
      isActive ? 'text-ink' : 'text-subtle hover:text-ink'}`

      }>
      
      {({ isActive }) =>
      <>
          <Icon className="h-5 w-5" strokeWidth={isActive ? 2.3 : 1.8} aria-hidden="true" />
          {label}
        </>
      }
    </NavLink>);

}