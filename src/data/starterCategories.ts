import { ParentCategory } from '../types/budget';

/** Seeded into a brand-new profile's categories on first load. From PRD §5.2. */
export const STARTER_CATEGORIES: { name: string; parent: ParentCategory }[] = [
// Needs
{ name: 'Rent/Mortgage', parent: 'Needs' },
{ name: 'Groceries', parent: 'Needs' },
{ name: 'Utilities', parent: 'Needs' },
{ name: 'Phone', parent: 'Needs' },
{ name: 'Internet', parent: 'Needs' },
{ name: 'Car Payment', parent: 'Needs' },
{ name: 'Car Insurance', parent: 'Needs' },
{ name: 'Car Maintenance', parent: 'Needs' },
{ name: 'Gas/Transportation', parent: 'Needs' },
{ name: 'Debt Payments', parent: 'Needs' },
{ name: 'Pets', parent: 'Needs' },
{ name: 'Household', parent: 'Needs' },

// Wants
{ name: 'Eating Out', parent: 'Wants' },
{ name: 'Shopping', parent: 'Wants' },
{ name: 'Subscriptions', parent: 'Wants' },
{ name: 'Gym', parent: 'Wants' },
{ name: 'Social Events', parent: 'Wants' },
{ name: 'Hobbies', parent: 'Wants' },
{ name: 'Concerts', parent: 'Wants' },

// Savings
{ name: 'Retirement Contribution', parent: 'Savings' },
{ name: 'Emergency Fund', parent: 'Savings' },
{ name: 'Brokerage/Investing', parent: 'Savings' },
{ name: 'Crypto', parent: 'Savings' }];
