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

// Where to send someone back to once they finish signing in. The login page
// records the page they were actually after; a magic link opened in a
// different browser won't have it, so we fall back to the dashboard.
const POST_AUTH_KEY = 'expense-tracker:post-auth-path';

export function setPostAuthPath(path: string) {
  if (path && path !== '/login') {
    window.sessionStorage.setItem(POST_AUTH_KEY, path);
  } else {
    window.sessionStorage.removeItem(POST_AUTH_KEY);
  }
}

export function authRedirectTo(): string {
  return window.location.origin + readPostAuthPath();
}

function readPostAuthPath(): string {
  const path = window.sessionStorage.getItem(POST_AUTH_KEY);
  // Only ever an in-app path, never a full URL — an attacker-supplied value in
  // here shouldn't be able to bounce a freshly signed-in session off-site.
  return path && path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

/** Read the intended destination once, then forget it. */
export function consumePostAuthPath(): string {
  const path = readPostAuthPath();
  window.sessionStorage.removeItem(POST_AUTH_KEY);
  return path;
}

/** True while an OAuth or magic-link callback is still being exchanged. */
export function hasAuthCallback(): boolean {
  const { search, hash } = window.location;
  return /(^|[?&#])(code|access_token|error|error_description)=/.test(search + hash);
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
