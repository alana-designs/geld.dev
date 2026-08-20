export interface ReleaseNote {
  id: string;
  version: string;
  /** ISO date the release shipped */
  date: string;
  title: string;
  summary: string;
  /** Optional — generate one in Magic Patterns (or elsewhere) and paste the URL in. */
  image?: string;
  items: string[];
}

/** Newest first. Empty until the first real entry is written. */
export const releases: ReleaseNote[] = [];

export const latestRelease: ReleaseNote | undefined = releases[0];

const LAST_SEEN_KEY = 'expense-tracker:changelog-last-seen';

/** Whether there's a release newer than the one last opened. */
export function hasUnreadRelease(): boolean {
  if (!latestRelease) return false;
  return window.localStorage.getItem(LAST_SEEN_KEY) !== latestRelease.version;
}

export function markChangelogSeen() {
  if (latestRelease) window.localStorage.setItem(LAST_SEEN_KEY, latestRelease.version);
}
