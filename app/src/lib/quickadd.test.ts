import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { sampleData } from './seed';
import { importInbox, newQuickKey, quickAccount, quickMenu } from './quickadd';

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
});
