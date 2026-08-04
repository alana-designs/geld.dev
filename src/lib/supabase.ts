import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (check your .env file).');
}

// "Remember me" preference, itself stored in localStorage so it survives
// across tabs/restarts even before a session exists. Defaults to true
// (stay signed in) so existing users keep today's behavior.
const REMEMBER_KEY = 'expense-tracker:remember-me';

export function getRememberMe(): boolean {
  const v = window.localStorage.getItem(REMEMBER_KEY);
  return v === null ? true : v === 'true';
}

export function setRememberMe(remember: boolean) {
  window.localStorage.setItem(REMEMBER_KEY, String(remember));
}

// Routes the Supabase session to localStorage (persists indefinitely, across
// browser restarts, until sign-out or cache is cleared) or sessionStorage
// (cleared as soon as the tab/browser closes), based on the remember-me flag
// captured at sign-in time.
const routedStorage = {
  getItem: (key: string) => {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    const target = getRememberMe() ? window.localStorage : window.sessionStorage;
    target.setItem(key, value);
    // Make sure a switch from "remembered" to "this session only" (or back)
    // doesn't leave a stale copy of the token sitting in the other store.
    const other = target === window.localStorage ? window.sessionStorage : window.localStorage;
    other.removeItem(key);
  },
  removeItem: (key: string) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
};

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: routedStorage
  }
});
