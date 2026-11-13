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

describe('recent income categories', () => {
  it('newest first, no repeats, only ones still in the list, filled up from the list', async () => {
    const { recentIncomeCats } = await import('./CategoryPicker');
    const list = ['Salary', 'Freelance', 'Business', 'Gift'];
    expect(recentIncomeCats([{ ts: 1, cat: 'Gift' }, { ts: 3, cat: 'Freelance' }, { ts: 2, cat: 'Freelance' }, { ts: 4, cat: 'Deleted one' }, { ts: 5 }], list)).toEqual(['Freelance', 'Gift', 'Salary']);
    expect(recentIncomeCats([], list)).toEqual(['Salary', 'Freelance', 'Business']);
  });
});
