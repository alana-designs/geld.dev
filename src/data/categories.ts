import { Category } from '../types/budget';

const own = (rows: Omit<Category, 'memberId'>[]): Category[] =>
rows.map((row) => ({ ...row, memberId: 'me' }));

export const seedCategories: Category[] = own([
// Needs
{ id: 'rent', name: 'Rent', parent: 'Needs', monthlyGoal: 1850, archived: false },
{ id: 'groceries', name: 'Groceries', parent: 'Needs', monthlyGoal: 550, archived: false },
{ id: 'utilities', name: 'Utilities', parent: 'Needs', monthlyGoal: 160, archived: false },
{ id: 'phone', name: 'Phone', parent: 'Needs', monthlyGoal: 75, archived: false },
{ id: 'internet', name: 'Internet', parent: 'Needs', monthlyGoal: 70, archived: false },
{ id: 'car-payment', name: 'Car Payment', parent: 'Needs', monthlyGoal: 340, archived: false },
{ id: 'car-insurance', name: 'Car Insurance', parent: 'Needs', monthlyGoal: 125, archived: false },
{ id: 'gas', name: 'Gas / Transit', parent: 'Needs', monthlyGoal: 140, archived: false },
{ id: 'pets', name: 'Pets', parent: 'Needs', monthlyGoal: 80, archived: false },
{ id: 'household', name: 'Household', parent: 'Needs', monthlyGoal: 90, archived: false },

// Wants
{ id: 'eating-out', name: 'Eating Out', parent: 'Wants', monthlyGoal: 300, archived: false },
{ id: 'shopping', name: 'Shopping', parent: 'Wants', monthlyGoal: 200, archived: false },
{ id: 'subscriptions', name: 'Subscriptions', parent: 'Wants', monthlyGoal: 60, archived: false },
{ id: 'gym', name: 'Gym', parent: 'Wants', monthlyGoal: 55, archived: false },
{ id: 'social', name: 'Social Events', parent: 'Wants', monthlyGoal: 150, archived: false },
{ id: 'hobbies', name: 'Hobbies', parent: 'Wants', monthlyGoal: 100, archived: false },
{ id: 'concerts', name: 'Concerts', parent: 'Wants', monthlyGoal: 80, archived: false },

// Savings
{ id: 'retirement', name: 'Retirement', parent: 'Savings', monthlyGoal: 600, archived: false },
{ id: 'emergency', name: 'Emergency Fund', parent: 'Savings', monthlyGoal: 400, archived: false },
{ id: 'brokerage', name: 'Brokerage', parent: 'Savings', monthlyGoal: 250, archived: false }]
);