import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Data } from './types';
import { emptyData, sampleData } from './seed';
import { monthFlow } from './monthFlow';
import { ctxAt } from './dates';
import { NEXT, borrowNext, transferLeftover } from './plan';

const exp = (id: string, p: string, amt: number, date: string) => ({ id, ts: 1, p, a: 'bank', amt, note: id, date, tags: [], cat: 'Other', sub: '' });
function data(carry?: string): Data {
  const e = emptyData(sampleData());
  return {
    ...e, settings: { ...e.settings, currency: 'COP' }, incomes: [],
    pockets: [{ id: 'mer', name: 'Mercado', weeklyStr: '150000', hue: 40, carry }, { id: 'sal', name: 'Salidas', weeklyStr: '120000', hue: 320 }],
    accounts: [{ id: 'bank', name: 'Bank', kind: 'Checking', type: 'bank', bal: 0, hue: 85 }],
    expenses: [exp('a', 'mer', 120000, '2026-11-04'), exp('b', 'mer', 210000, '2026-11-12'), exp('c', 'mer', 95000, '2026-11-18'), exp('d', 'mer', 88000, '2026-11-24')],
    moves: carry ? [] : [
      { id: 'm1', week: '2026-11-02', day: '2026-11-08', from: 'mer', to: 'mer', amt: 30000, next: true },
      { id: 'm2', week: '2026-11-09', day: '2026-11-15', from: 'mer', to: 'mer', amt: 30000, borrow: true },
      { id: 'm3', week: '2026-11-23', day: '2026-11-23', from: 'sal', to: 'mer', amt: 20000 }
    ]
  };
}

describe('monthFlow', () => {
  it('shows each week, what moved on by hand and what was left untouched', () => {
    const r = monthFlow(data(), 'mer', '2026-11', '2026-11-25');
    expect(r.map(x => x.from)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
    expect(r.map(x => x.state)).toEqual(['past', 'past', 'past', 'now', 'future']);
    expect(r.map(x => x.budget)).toEqual([150000, 180000, 120000, 170000, 150000]);
    expect(r.map(x => x.result)).toEqual([30000, -30000, 25000, 82000, 150000]);
    expect(r[0].links.map(l => [l.kind, l.amt])).toEqual([['next', 30000]]);
    expect(r[1]).toMatchObject({ fromPrev: 30000, repaid: 0, otherIn: 0 });
    expect(r[1].links.map(l => [l.kind, l.amt])).toEqual([['borrow', 30000]]);
    expect(r[2]).toMatchObject({ repaid: 30000, otherOut: 0 });
    expect(r[2].links.map(l => [l.kind, l.amt])).toEqual([['idle', 25000]]);
    expect(r[3]).toMatchObject({ otherIn: 20000, links: [] });
  });
  it('with carry over on, leftovers and overspends move on by themselves', () => {
    const r = monthFlow(data('2026-11-02'), 'mer', '2026-11', '2026-11-25');
    expect(r[0].links).toEqual([{ kind: 'auto', amt: 30000 }]);
    expect(r[1]).toMatchObject({ carry: 30000, budget: 180000, result: -30000 });
    expect(r[1].links).toEqual([{ kind: 'auto', amt: -30000 }]);
    expect(r[2]).toMatchObject({ carry: -30000, budget: 120000, result: 25000 });
  });
  it('a quincena pocket has two periods', () => {
    const d = data(); d.pockets[0] = { ...d.pockets[0], period: 'half' }; d.moves = [];
    const r = monthFlow(d, 'mer', '2026-11', '2026-11-25');
    expect(r.map(x => [x.from, x.to, x.spent])).toEqual([['2026-11-01', '2026-11-15', 330000], ['2026-11-16', '2026-11-30', 183000]]);
    expect(r[0].links).toEqual([{ kind: 'uncovered', amt: 180000 }]);
  });
  it('moves made for a past period with ctxAt(period end) land in that period (week and quincena)', () => {
    const d = data(); d.moves = [];
    // week of Nov 9: 150000 - 210000 = -60000 over; cover 40000 from the next week
    const b = borrowNext(d, ctxAt('2026-11-15'), 'mer', 40000)!;
    const r = monthFlow({ ...d, ...b }, 'mer', '2026-11', '2026-11-25');
    expect(r[1].links).toMatchObject([{ kind: 'borrow', amt: 40000 }, { kind: 'uncovered', amt: 20000 }]);
    expect(r[2]).toMatchObject({ repaid: 40000, budget: 110000 });
    // week of Nov 2: 30000 left, send it on
    const n = transferLeftover(d, ctxAt('2026-11-08'), 'mer', { [NEXT]: 30000 })!;
    const r2 = monthFlow({ ...d, ...n }, 'mer', '2026-11', '2026-11-25');
    expect(r2[0].links).toMatchObject([{ kind: 'next', amt: 30000 }]);
    expect(r2[1]).toMatchObject({ fromPrev: 30000, budget: 180000 });
    // quincena 1-15: nothing left (over), 16-30: 120000+... next move from the 2nd quincena into December
    const h = data(); h.pockets[0] = { ...h.pockets[0], period: 'half' }; h.moves = []; h.expenses = [exp('z', 'mer', 100000, '2026-11-20')];
    const t = transferLeftover(h, ctxAt('2026-11-30'), 'mer', { [NEXT]: 50000 })!;
    const r3 = monthFlow({ ...h, ...t }, 'mer', '2026-11', '2026-12-05');
    // 2nd quincena: 150000 - 100000 spent = 50000, all moved on
    expect(r3[1]).toMatchObject({ budget: 150000, result: 50000, left: 0 });
    expect(r3[1].links[0]).toMatchObject({ kind: 'next', amt: 50000 });
  });
  it('a monthly pocket is one row; a pocket with a first-period amount shows it', () => {
    const d = data(); d.moves = []; d.pockets[0] = { ...d.pockets[0], period: 'month', weeklyStr: '600000' };
    const r = monthFlow(d, 'mer', '2026-11', '2026-11-25');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ from: '2026-11-01', to: '2026-11-30', budget: 600000, spent: 513000, result: 87000 });
    const s = data(); s.moves = []; s.pockets[0] = { ...s.pockets[0], start: { from: '2026-11-16', amt: 50000 } };
    const q = monthFlow(s, 'mer', '2026-11', '2026-11-25');
    // Weeks before the pocket existed are left out, so nothing in them can be moved on.
    expect(q.map(x => x.from)).toEqual(['2026-11-16', '2026-11-23', '2026-11-30']);
    expect(q[0].base).toBe(50000);
    const born = data(); born.moves = []; born.pockets[0] = { ...born.pockets[0], id: 'p' + new Date(2026, 10, 18, 12).getTime().toString(36) };
    expect(monthFlow(born, born.pockets[0].id, '2026-11', '2026-11-25').map(x => x.from)).toEqual(['2026-11-16', '2026-11-23', '2026-11-30']);
  });
});
