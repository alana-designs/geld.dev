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

/** Newest first. */
export const releases: ReleaseNote[] = [
{
  id: 'r-2026-08-22',
  version: '1.0',
  date: '2026-08-22',
  title: 'Top 5 categories & two-way household invites',
  summary:
  'Your top 5 spending habits for the month now show up on your dashboard in a new widget. Adding someone to your household now takes a yes from both sides, and you can leave or remove a member whenever you want.',
  image: '/changelog/household-and-budget-bars.svg',
  items: [
  'Lines over budget turn red in the bar itself, not just in the text beside it.',
  'Invites need both people to agree: they accept, then you confirm their email address before anything is shared.',
  'Invites expire after an hour, so a mistyped address can\u2019t be claimed later on.',
  'You can leave a household or remove someone from yours. Entries stay with the account that logged them \u2014 nothing is deleted.',]

}];

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
