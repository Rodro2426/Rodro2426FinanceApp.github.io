import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { sampleData } from './seed';
import { cardAccount, importInbox, newQuickKey, quickAccount, quickMenu, shortcutCats } from './quickadd';

const ts = new Date(2026, 10, 9, 13, 30).getTime();

describe('quick add inbox', () => {
  it('makes a 32-character hex key', () => {
    const k = newQuickKey();
    expect(k).toMatch(/^[a-f0-9]{32}$/);
    expect(newQuickKey()).not.toBe(k);
  });

  it('lists pockets plus "No pocket", and only your own accounts', () => {
    const d = sampleData();
    const m = quickMenu(d, 'es');
    expect(m.pockets).toEqual([...d.pockets.map(p => p.name), 'Sin bolsillo']);
    expect(m.accounts).toEqual(d.accounts.filter(a => !a.notMine).map(a => a.name));
  });

  it('saves an item as a normal expense in the named pocket and charges the account', () => {
    const d = sampleData();
    const pocket = d.pockets[0], acct = quickAccount(d), before = d.accounts.find(a => a.id === acct)!;
    const { patch, added } = importInbox(d, [{ id: 'abc1', amt: 25000, pocket: pocket.name.toUpperCase(), note: 'Arepas', ts }]);
    expect(added).toHaveLength(1);
    const e = added[0];
    expect(e).toMatchObject({ id: 'eq-abc1', p: pocket.id, a: acct, amt: 25000, note: 'Arepas', date: '2026-11-09' });
    expect(e.cat).toBeTruthy();
    const after = patch!.accounts!.find(a => a.id === acct)!;
    expect(after.bal).toBe(before.type === 'card' ? before.bal + 25000 : before.bal - 25000);
    expect(patch!.expenses![0].id).toBe('eq-abc1');
  });

  it('uses the last category of that pocket, or the one sent when it exists', () => {
    const d = sampleData();
    const pocket = d.pockets[0];
    const last = [...d.expenses].filter(e => e.p === pocket.id).sort((a, b) => b.ts - a.ts)[0];
    const r1 = importInbox(d, [{ id: 'c1', amt: 1000, pocket: pocket.name, ts }]);
    if (last) expect(r1.added[0].cat).toBe(last.cat);
    const other = d.cats[d.cats.length - 1].name;
    const r2 = importInbox(d, [{ id: 'c2', amt: 1000, pocket: pocket.name, category: other, ts }]);
    expect(r2.added[0].cat).toBe(other);
  });

  it('saves an unknown pocket or "No pocket" without a pocket', () => {
    const d = sampleData();
    const { added } = importInbox(d, [{ id: 'n1', amt: 500, pocket: 'Sin bolsillo', ts }, { id: 'n2', amt: 700, pocket: 'Nope', ts: ts + 1 }]);
    expect(added.map(e => e.p)).toEqual(['', '']);
  });

  it('pays from the named account when the Shortcut sends one', () => {
    const d = sampleData();
    const other = d.accounts.filter(a => !a.notMine)[1];
    const { added } = importInbox(d, [{ id: 'a1', amt: 500, account: other.name, ts }]);
    expect(added[0].a).toBe(other.id);
  });

  it('never imports the same item twice and skips bad amounts', () => {
    const d = sampleData();
    const once = importInbox(d, [{ id: 'dup', amt: 900, ts }]);
    const d2 = { ...d, ...once.patch };
    const again = importInbox(d2, [{ id: 'dup', amt: 900, ts }, { id: 'zero', amt: 0, ts }]);
    expect(again.added).toHaveLength(0);
    expect(again.patch).toBeNull();
  });

  it('finds the account from the Wallet card name, then remembers the card', () => {
    const d = sampleData();
    const own = d.accounts.filter(a => !a.notMine), target = own[own.length - 1];
    const card = `Visa ${target.name.toUpperCase()} Oro`;
    expect(cardAccount(d, card)).toBe(target.id);
    const { patch } = importInbox({ ...d, settings: { ...d.settings, quickAdd: { key: 'k' } } }, [{ id: 'w1', amt: 800, card, ts }]);
    expect(patch!.settings!.quickAdd!.cards).toEqual({ [card]: target.id });
    expect(cardAccount(d, 'Mastercard Unknown Bank')).toBe(quickAccount(d));
  });

  it('uses the card link the person chose over the name match', () => {
    const d = sampleData();
    const own = d.accounts.filter(a => !a.notMine);
    const linked = { ...d, settings: { ...d.settings, quickAdd: { key: 'k', cards: { [`Visa ${own[0].name}`]: own[1].id } } } };
    expect(cardAccount(linked, `Visa ${own[0].name}`)).toBe(own[1].id);
    const { added } = importInbox(linked, [{ id: 'w2', amt: 800, card: `Visa ${own[0].name}`, ts }]);
    expect(added[0].a).toBe(own[1].id);
  });

  it('gives a store the category it had last time', () => {
    const d = sampleData();
    const pick = d.cats[d.cats.length - 1].name;
    const past = { ...d.expenses[0], id: 'old', note: 'Éxito', cat: pick, sub: '', ts: ts - 1000 };
    const { added } = importInbox({ ...d, expenses: [past, ...d.expenses] }, [{ id: 'm1', amt: 800, note: 'éxito', pocket: d.pockets[0].name, ts }]);
    expect(added[0].cat).toBe(pick);
  });

  it('offers the pinned categories in the Shortcut, else the last ones used', () => {
    const d = sampleData();
    const names = d.cats.map(k => k.name);
    const pinned = { ...d, settings: { ...d.settings, quickAdd: { key: 'k', pins: [names[2], 'Gone', names[0]] } } };
    expect(shortcutCats(pinned)).toEqual([names[2], names[0]]);
    expect(quickMenu(pinned, 'en').cats).toEqual([names[2], names[0]]);
    const recent = shortcutCats(d);
    expect(recent.length).toBeGreaterThan(0);
    expect(recent.length).toBeLessThanOrEqual(6);
    expect(new Set(recent).size).toBe(recent.length);
    expect(shortcutCats({ ...d, expenses: [] })).toEqual(names.slice(0, 6));
  });

  it('shows built-in names in Spanish and maps them back when the purchase comes in', () => {
    const real = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => 'es', setItem: () => {}, removeItem: () => {} };
    try {
      const d = sampleData();
      const groceries = d.cats.find(k => k.name === 'Groceries')!;
      const pinned = { ...d, settings: { ...d.settings, quickAdd: { key: 'k', pins: [groceries.name] } } };
      expect(quickMenu(pinned, 'es').cats).toEqual(['Mercado']);
      const { added } = importInbox(pinned, [{ id: 'es1', amt: 800, category: 'Mercado', ts }]);
      expect(added[0].cat).toBe('Groceries');
    } finally { (globalThis as { localStorage?: unknown }).localStorage = real; }
  });
});
