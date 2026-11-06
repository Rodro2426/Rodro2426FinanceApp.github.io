import type { Category } from './types';

export const HUES = [25, 150, 250, 300, 80, 195];
/*
 * Colors of pockets, accounts and goals are stored as a number:
 *  - 0–359: a hue. The app makes a soft background and a readable text color from it, adapted to light/dark mode.
 *  - 1,000,000 + 0xRRGGBB: an exact color the user picked from the palette or typed as a code. It's used as is in
 *    both modes, with white or dark text, whichever reads better on it.
 */
const CUSTOM = 1_000_000;
export const isCustomColor = (h: number) => h >= CUSTOM;
export const colorFromHex = (hex: string) => CUSTOM + parseInt(hex.replace('#', ''), 16);
export const hexOfColor = (h: number) => '#' + Math.max(0, Math.min(0xffffff, h - CUSTOM)).toString(16).padStart(6, '0');
/** White or near-black, whichever has more contrast on this color. */
export function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const l = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  const L = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.05) ? '#ffffff' : '#1b1a19';
}
/** Soft background for a hue; follows light/dark mode (see --tint-* in styles.css). A custom color is used as is. */
export const tint = (h: number) => (h >= CUSTOM ? hexOfColor(h) : `oklch(var(--tint-l) var(--tint-c) ${h})`);
export const mid = (h: number) => (h >= CUSTOM ? hexOfColor(h) : `oklch(var(--mid-l) 0.1 ${h})`);
/** Text/icon color for a hue on its tint; follows light/dark mode. On a custom color: white or dark, for contrast. */
export const ink = (h: number) => (h >= CUSTOM ? textOn(hexOfColor(h)) : `oklch(var(--ink-l) var(--ink-c) ${h})`);

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
