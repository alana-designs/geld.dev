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
  id: 'r-2026-10-18-income-edit',
  version: '1.2.1',
  date: '2026-10-18',
  title: 'Editing a paycheck keeps your savings history',
  summary:
  'Changing anything in Settings › Income used to quietly delete every savings entry your paycheck had already generated. It no longer does — and entries that are already posted now survive even if you remove the deduction behind them.',
  items: [
  'Edit a paycheck as often as you like — amounts, labels, pay dates — and your past savings entries stay put.',
  'Removing a deduction keeps the entries it already generated. Past paydays really happened, so they stay in your activity.',
  'Those leftover entries can still be deleted one at a time, the same way as before.',
  'Heads up: savings entries from July and August 2026 were lost to this bug before it was found, and have not been restored.',]

},
{
  id: 'r-2026-10-18',
  version: '1.2',
  date: '2026-10-18',
  title: 'Delete a paycheck savings entry',
  summary:
  'Savings entries that come from your paycheck can now be removed one at a time \u2014 handy when a pay period went in at the wrong rate. Your income settings are left exactly as they were.',
  items: [
  'Open any entry tagged \u201cAuto \u00b7 from paycheck\u201d in Activity or on the dashboard and tap Delete this one.',
  'It only affects that pay date. Every other payday keeps generating as before.',
  'Nothing changes in Settings \u203a Income \u2014 the deduction keeps its amount.',
  'The entry stays gone: it won\u2019t come back the next time entries are generated.',]

},
{
  id: 'r-2026-10-07',
  version: '1.1',
  date: '2026-10-07',
  title: 'Export your activity to Excel',
  summary:
  'You can now download everything you’ve logged as an Excel file, with each month on its own sheet. Handy for digging into your spending habits or spotting month-over-month trends.',
  items: [
  'Find the new Export button at the top of the Activity tab.',
  'Every month with activity gets its own sheet, oldest to newest.',
  'Each row has the date, note, amount, category, and whether it’s a Need, Want, or Saving.',
  'Only your own entries are included — anything logged by someone in your household stays out.',]

},
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
