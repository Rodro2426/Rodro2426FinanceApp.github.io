import type { Category } from './types';

export const HUES = [25, 150, 250, 300, 80, 195];
export const tint = (h: number) => `oklch(0.94 0.04 ${h})`;
export const mid = (h: number) => `oklch(0.78 0.1 ${h})`;
export const ink = (h: number) => `oklch(0.42 0.1 ${h})`;

export const RED = 'var(--color-accent-700)';
export const TEXT = 'var(--color-text)';
export const LINE = 'var(--color-neutral-200)';
export const GREEN = 'oklch(0.62 0.12 160)';

export const CATS: Category[] = [
  { name: 'Groceries', subs: ['Supermarket', 'Bakery', 'Liquor store'] },
  { name: 'Food & dining', subs: ['Restaurants', 'Coffee', 'Delivery', 'Snacks'] },
  { name: 'Transport', subs: ['Ride apps', 'Gas', 'Parking', 'Public transport'] },
  { name: 'Entertainment', subs: ['Movies', 'Events', 'Games', 'Bars'] },
  { name: 'Personal care', subs: ['Pharmacy', 'Beauty', 'Hair'] },
  { name: 'Health', subs: ['Medical', 'Gym', 'Insurance'] },
  { name: 'Home', subs: ['Rent', 'Utilities', 'Internet', 'Supplies'] },
  { name: 'Shopping', subs: ['Clothes', 'Tech', 'Gifts'] },
  { name: 'Education', subs: ['Courses', 'Books', 'Stationery'] },
  { name: 'Financial', subs: ['Interest', 'Fees'] },
  { name: 'Other', subs: ['Other'] }
];

/** Default category for the sample pockets. */
export const POCKET_CAT: Record<string, [string, string]> = {
  groc: ['Groceries', 'Supermarket'], trans: ['Transport', 'Ride apps'], dine: ['Food & dining', 'Restaurants'],
  fun: ['Entertainment', 'Movies'], care: ['Personal care', 'Pharmacy']
};

export const MERCHANT_CAT: Record<string, [string, string]> = {
  'Éxito': ['Groceries', 'Supermarket'], 'D1': ['Groceries', 'Supermarket'], 'Carulla': ['Groceries', 'Supermarket'], 'Ara': ['Groceries', 'Supermarket'], 'Olímpica': ['Groceries', 'Supermarket'],
  'Uber': ['Transport', 'Ride apps'], 'DiDi': ['Transport', 'Ride apps'], 'Cabify': ['Transport', 'Ride apps'], 'Terpel gas': ['Transport', 'Gas'], 'TuLlave recarga': ['Transport', 'Public transport'],
  'Rappi': ['Food & dining', 'Delivery'], 'Juan Valdez': ['Food & dining', 'Coffee'], 'Starbucks': ['Food & dining', 'Coffee'], 'Crepes & Waffles': ['Food & dining', 'Restaurants'], 'El Corral': ['Food & dining', 'Restaurants'], 'Frisby': ['Food & dining', 'Restaurants'],
  'Cine Colombia': ['Entertainment', 'Movies'], 'Andrés DC': ['Entertainment', 'Bars'], 'Steam': ['Entertainment', 'Games'], 'TuBoleta': ['Entertainment', 'Events'], 'Bolera': ['Entertainment', 'Games'],
  'Farmatodo': ['Personal care', 'Pharmacy'], 'Cruz Verde': ['Personal care', 'Pharmacy'], 'Peluquería': ['Personal care', 'Hair'], 'Sephora': ['Personal care', 'Beauty']
};

export const EMOJIS = ['🛒', '🚌', '🍽️', '🎟️', '🧴', '💪', '☕', '🎁', '🐶', '✈️', '📚', '💊', '🏠', '🎮', '👗', '🍺', '⛽', '🎬', '💄', '🧾', '🍔', '🚗', '🎵', '🌱'];

export const ACCT_TYPE_LABEL = { bank: 'Bank', savings: 'Savings', cash: 'Cash', card: 'Card' } as const;
export const ACCT_KIND = { bank: 'Checking', savings: 'Savings', cash: 'Wallet', card: 'Credit card' } as const;
