import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { sampleData } from './seed';
import { catOf } from './derive';
import { incCatOf } from './reports';
import { moveExpenses, moveIncomes, renameExpenseCat, renameIncomeCat, renameSub } from './categories';
import type { Data } from './types';

const apply = (d: Data, p: Partial<Data> | null) => ({ ...d, ...p });

describe('organizing categories', () => {
  it('renames a category in the list, its expenses and its bills', () => {
    const d = sampleData();
    const from = catOf(d.expenses[0])[0];
    const n = d.expenses.filter(e => catOf(e)[0] === from).length;
    const r = apply(d, renameExpenseCat(d, from, '  Comida  '));
    expect(r.cats.some(k => k.name === from)).toBe(false);
    expect(r.cats.some(k => k.name === 'Comida')).toBe(true);
    expect(r.expenses.filter(e => catOf(e)[0] === 'Comida')).toHaveLength(n);
    expect(r.expenses.filter(e => catOf(e)[0] === from)).toHaveLength(0);
  });

  it('merges into an existing category with the same name (any capitals), joining subcategories', () => {
    const d = sampleData();
    const [a, b] = d.cats;
    const total = d.expenses.filter(e => [a.name, b.name].includes(catOf(e)[0])).length;
    const r = apply(d, renameExpenseCat(d, a.name, b.name.toUpperCase()));
    expect(r.cats).toHaveLength(d.cats.length - 1);
    const merged = r.cats.find(k => k.name === b.name)!;
    for (const s of a.subs) expect(merged.subs.map(x => x.toLowerCase())).toContain(s.toLowerCase());
    expect(r.expenses.filter(e => catOf(e)[0] === b.name)).toHaveLength(total);
  });

  it('renames bills that rely on the default category', () => {
    const d = sampleData();
    d.bills = [{ ...d.bills[0], kind: 'Bill', cat: undefined }];
    if (!d.cats.some(k => k.name === 'Home')) d.cats.push({ name: 'Home', subs: ['General'] });
    const r = apply(d, renameExpenseCat(d, 'Home', 'Casa'));
    expect(r.bills[0].cat).toBe('Casa');
  });

  it('renames a subcategory and its expenses, and merges with an existing one', () => {
    const d = sampleData();
    const e = d.expenses.find(x => catOf(x)[1])!;
    const [c, s] = catOf(e);
    const r = apply(d, renameSub(d, c, s, 'Nueva'));
    expect(r.cats.find(k => k.name === c)!.subs).toContain('Nueva');
    expect(catOf(r.expenses.find(x => x.id === e.id)!)).toEqual([c, 'Nueva']);
    const other = r.cats.find(k => k.name === c)!.subs.find(x => x !== 'Nueva');
    if (other) {
      const m = apply(r, renameSub(r, c, 'Nueva', other));
      expect(m.cats.find(k => k.name === c)!.subs).not.toContain('Nueva');
      expect(catOf(m.expenses.find(x => x.id === e.id)!)[1]).toBe(other);
    }
  });

  it('does nothing for an empty or unchanged name', () => {
    const d = sampleData();
    expect(renameExpenseCat(d, d.cats[0].name, '   ')).toBeNull();
    expect(renameExpenseCat(d, d.cats[0].name, d.cats[0].name)).toBeNull();
  });

  it('renames income categories, including incomes that got theirs automatically', () => {
    const d = sampleData();
    d.incomes = [...d.incomes, { id: 'in-x1', ts: 1, a: d.accounts[0].id, amt: 1000, note: 'x', date: '2026-11-01' }];
    const auto = incCatOf(d, d.incomes[d.incomes.length - 1]);
    const r = apply(d, renameIncomeCat(d, auto, 'Varios'));
    expect(r.incCats).toContain('Varios');
    expect(r.incCats).not.toContain(auto);
    expect(incCatOf(r, r.incomes.find(t => t.id === 'in-x1')!)).toBe('Varios');
  });

  it('moves chosen transactions to another category', () => {
    const d = sampleData();
    const ids = d.expenses.slice(0, 2).map(e => e.id);
    const r = apply(d, moveExpenses(d, ids, 'Travel', 'Hotels'));
    for (const id of ids) expect(catOf(r.expenses.find(e => e.id === id)!)).toEqual(['Travel', 'Hotels']);
    expect(r.expenses[2]).toEqual(d.expenses[2]);
    d.incomes = [{ id: 'in-y', ts: 1, a: d.accounts[0].id, amt: 5, note: 'y', date: '2026-11-01' }];
    expect(apply(d, moveIncomes(d, ['in-y'], 'Gift')).incomes[0].cat).toBe('Gift');
  });
});
