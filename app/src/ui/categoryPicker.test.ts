import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { recentCats } from './CategoryPicker';

describe('recent categories', () => {
  const e = (ts: number, cat: string, sub = 'General') => ({ ts, cat, sub, p: '' });
  it('newest first, no repeats, three at most', () => {
    expect(recentCats([e(1, 'Groceries'), e(5, 'Transport', 'Taxi'), e(3, 'Groceries', 'Market'), e(4, 'Fun'), e(2, 'Health')]))
      .toEqual([['Transport', 'Taxi'], ['Fun', 'General'], ['Groceries', 'Market']]);
  });
});
