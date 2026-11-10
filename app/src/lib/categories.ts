// Organizing categories: rename (or merge into an existing one) and move transactions between categories.
// A category name lives in several places, and all of them change together:
// - expenses (`cat`/`sub`; old expenses without one get theirs from the pocket, see catOf),
// - scheduled bills and subscriptions (`cat`/`sub`; missing = 'Home' for bills, 'Entertainment' otherwise),
// - the category list (`cats`), and for incomes: `incomes[].cat` and the income list (`incCats`).
import type { Bill, Category, Data } from './types';
import { catOf } from './derive';
import { incCatOf, incomeCatList } from './reports';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const billCat = (b: Bill) => b.cat || (b.kind === 'Bill' ? 'Home' : 'Entertainment');
const isSpend = (b: Bill) => b.kind !== 'Income' && b.kind !== 'CardPayment';

/** The existing expense category a new name would collide with (another one with the same name), if any. */
export const expenseCatClash = (d: Data, from: string, to: string) => d.cats.find(k => k.name !== from && same(k.name, to))?.name ?? null;
export const incomeCatClash = (d: Data, from: string, to: string) => incomeCatList(d).find(k => k !== from && same(k, to)) ?? null;

/**
 * Renames an expense category. If another category already has that name, the two merge: subcategories are joined
 * and every transaction moves over. Returns null when there's nothing to do.
 */
export function renameExpenseCat(d: Data, from: string, toRaw: string): Partial<Data> | null {
  const to0 = toRaw.trim();
  if (!to0 || to0 === from || !d.cats.some(k => k.name === from)) return null;
  const into = expenseCatClash(d, from, to0), to = into ?? to0;
  const src = d.cats.find(k => k.name === from)!;
  let cats: Category[];
  if (into) {
    cats = d.cats.filter(k => k.name !== from).map(k => (k.name === into ? { ...k, subs: [...k.subs, ...src.subs.filter(s => !k.subs.some(x => same(x, s)))] } : k));
  } else cats = d.cats.map(k => (k.name === from ? { ...k, name: to } : k));
  const expenses = d.expenses.map(e => { const [c, s] = catOf(e); return c === from ? { ...e, cat: to, sub: s } : e; });
  const bills = d.bills.map(b => (isSpend(b) && billCat(b) === from ? { ...b, cat: to } : b));
  return { cats, expenses, bills };
}

/** Renames a subcategory inside one category (merging if that name already exists there). */
export function renameSub(d: Data, cat: string, from: string, toRaw: string): Partial<Data> | null {
  const to0 = toRaw.trim(), k = d.cats.find(x => x.name === cat);
  if (!to0 || to0 === from || !k || !k.subs.includes(from)) return null;
  const into = k.subs.find(s => s !== from && same(s, to0)), to = into ?? to0;
  const subs = into ? k.subs.filter(s => s !== from) : k.subs.map(s => (s === from ? to : s));
  const cats = d.cats.map(x => (x.name === cat ? { ...x, subs } : x));
  const expenses = d.expenses.map(e => { const [c, s] = catOf(e); return c === cat && s === from ? { ...e, cat, sub: to } : e; });
  const bills = d.bills.map(b => (isSpend(b) && billCat(b) === cat && (b.sub ?? '') === from ? { ...b, sub: to } : b));
  return { cats, expenses, bills };
}

/** Renames an income category (merging if that name already exists). Incomes that got it automatically keep it. */
export function renameIncomeCat(d: Data, from: string, toRaw: string): Partial<Data> | null {
  const to0 = toRaw.trim(), list = incomeCatList(d);
  if (!to0 || to0 === from || !list.includes(from)) return null;
  const into = incomeCatClash(d, from, to0), to = into ?? to0;
  const incCats = into ? list.filter(k => k !== from) : list.map(k => (k === from ? to : k));
  const incomes = d.incomes.map(t => (incCatOf(d, t) === from ? { ...t, cat: to } : t));
  return { incCats, incomes };
}

/** Moves expenses to another category and subcategory. */
export function moveExpenses(d: Data, ids: string[], cat: string, sub: string): Partial<Data> {
  const set = new Set(ids);
  return { expenses: d.expenses.map(e => (set.has(e.id) ? { ...e, cat, sub } : e)) };
}

/** Moves incomes to another income category. */
export function moveIncomes(d: Data, ids: string[], cat: string): Partial<Data> {
  const set = new Set(ids);
  return { incomes: d.incomes.map(t => (set.has(t.id) ? { ...t, cat } : t)) };
}
