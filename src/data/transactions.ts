import { format, subDays } from 'date-fns';
import { Transaction } from '../types/budget';

const day = (n: number) => format(subDays(new Date(), n), 'yyyy-MM-dd');

interface Seed {
  daysAgo: number;
  amount: number;
  categoryId: string;
  description: string;
}

const seeds: Seed[] = [
{ daysAgo: 0, amount: 6.75, categoryId: 'eating-out', description: 'Oat latte before standup' },
{ daysAgo: 0, amount: 82.31, categoryId: 'groceries', description: 'Weekly shop — Trader Joe\u2019s' },
{ daysAgo: 0, amount: 14.0, categoryId: 'gas', description: 'Parking downtown' },
{ daysAgo: 1, amount: 48.6, categoryId: 'eating-out', description: 'Sara\u2019s birthday dinner' },
{ daysAgo: 1, amount: 22.99, categoryId: 'subscriptions', description: 'Streaming bundle' },
{ daysAgo: 2, amount: 1850, categoryId: 'rent', description: 'July rent' },
{ daysAgo: 2, amount: 34.12, categoryId: 'household', description: 'Light bulbs + dish soap' },
{ daysAgo: 3, amount: 61.44, categoryId: 'gas', description: 'Fill up on the way to Ojai' },
{ daysAgo: 3, amount: 120.0, categoryId: 'shopping', description: 'Running shoes' },
{ daysAgo: 4, amount: 400, categoryId: 'emergency', description: 'Monthly auto-transfer' },
{ daysAgo: 4, amount: 18.25, categoryId: 'eating-out', description: 'Farmers market lunch' },
{ daysAgo: 5, amount: 71.9, categoryId: 'groceries', description: 'Produce + chicken restock' },
{ daysAgo: 6, amount: 55.0, categoryId: 'gym', description: 'Climbing gym membership' },
{ daysAgo: 7, amount: 145.2, categoryId: 'utilities', description: 'Electric bill — heat wave' },
{ daysAgo: 8, amount: 92.0, categoryId: 'concerts', description: 'Tickets — Big Thief at the Greek' },
{ daysAgo: 9, amount: 43.7, categoryId: 'pets', description: 'Dog food + poop bags' },
{ daysAgo: 10, amount: 600, categoryId: 'retirement', description: 'Roth IRA contribution' },
{ daysAgo: 11, amount: 27.4, categoryId: 'eating-out', description: 'Tacos with Andrew' },
{ daysAgo: 12, amount: 340, categoryId: 'car-payment', description: 'Auto loan — July' },
{ daysAgo: 13, amount: 66.5, categoryId: 'groceries', description: 'Costco run, split' },
{ daysAgo: 14, amount: 75.0, categoryId: 'phone', description: 'Phone bill' },
{ daysAgo: 15, amount: 38.0, categoryId: 'hobbies', description: 'Film developing' },
{ daysAgo: 17, amount: 70.0, categoryId: 'internet', description: 'Fiber — July' },
{ daysAgo: 19, amount: 250, categoryId: 'brokerage', description: 'Index fund buy' },
{ daysAgo: 21, amount: 88.15, categoryId: 'social', description: 'Bowling night, covered the lane' }];


/** Manual entries only — payroll savings are generated from income sources. */
export const seedTransactions: Transaction[] = seeds.map((s, i) => ({
  id: `seed-${i}`,
  memberId: 'me',
  amount: s.amount,
  categoryId: s.categoryId,
  description: s.description,
  date: day(s.daysAgo),
  createdAt: new Date(Date.now() - s.daysAgo * 86400000).toISOString()
}));