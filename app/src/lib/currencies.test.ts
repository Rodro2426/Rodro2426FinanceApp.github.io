// The same month of money, run in every currency the app offers. Pesos have no cents; $, € and £ do.
// Nothing may turn into NaN, and every split must add up exactly.
import 'fake-indexeddb/auto';
import { afterAll, describe, expect, it } from 'vitest';
import type { Currency, Data } from './types';
import { sampleData } from './seed';
import { makeCtx } from './dates';
import { acctTxns, fmt, monthStats, pocketStats, roundAmt } from './derive';
import { addExtraIncome, coverWith, monthSummary, splitAmong, suggestCover, transferLeftover } from './plan';
import { netWorth } from './networth';
import { balanceAt, cashflow, netWorthAt } from './reports';
import { addDebtPay, deleteDebt, saveDebt } from './debts';
import { balances, settleUp, type TripItem } from './settle';
import { runInterest } from './interest';
import { unitsFor } from './split';
import { getData, setData } from './store';

const TODAY = '2026-11-11';
const CURRENCIES: Currency[] = ['COP', '$', '€', '£'];
const before = getData().settings.currency;
afterAll(() => setData(x => ({ settings: { ...x.settings, currency: before } })));

/** The sample month, in pesos as it is, or scaled down with cents for the other currencies. */
function world(cur: Currency): Data {
  const d = sampleData(TODAY);
  const e = (n: number) => (cur === 'COP' ? n : Math.round((n / 4000) * 100 + 37) / 100);
  setData(x => ({ settings: { ...x.settings, currency: cur } })); // fmt and roundAmt read the live setting
  return {
    ...d, settings: { ...d.settings, currency: cur }, incomeStr: String(e(Number(d.incomeStr))),
    accounts: d.accounts.map(a => ({ ...a, bal: e(a.bal), ...(a.limit ? { limit: e(a.limit) } : {}) })),
    pockets: d.pockets.map(p => ({ ...p, weeklyStr: String(e(Number(p.weeklyStr))) })),
    expenses: d.expenses.map(t => ({ ...t, amt: e(t.amt) })), incomes: d.incomes.map(t => ({ ...t, amt: e(t.amt) })),
    payments: d.payments.map(p => ({ ...p, amt: e(p.amt) })), moves: [],
    goals: d.goals.map(g => ({ ...g, target: e(g.target), saved: e(g.saved) })),
    debts: (d.debts ?? []).map(x => ({ ...x, amt: e(x.amt), pays: x.pays.map(p => ({ ...p, amt: e(p.amt) })) }))
  };
}
const units = (cur: Currency, n: number) => Math.round(n * unitsFor(cur));
const exact = (cur: Currency, n: number) => Math.abs(n * unitsFor(cur) - Math.round(n * unitsFor(cur))) < 1e-6;
const finite = (o: object) => Object.values(o).every(v => typeof v !== 'number' || Number.isFinite(v));

describe.each(CURRENCIES)('all the money math in %s', cur => {
  const c = makeCtx(4, TODAY);

  it('pockets: budget − spent = left, with no broken numbers', () => {
    const d = world(cur);
    for (const p of d.pockets) {
      const s = pocketStats(d, p.id, c)!, m = monthStats(d, p.id, c);
      expect(finite(s) && finite(m)).toBe(true);
      expect(units(cur, s.left)).toBe(units(cur, s.budget - s.spent));
    }
    expect(finite(monthSummary(d, c))).toBe(true);
  });

  it('splitting income between pockets adds up to the cent', () => {
    const d = world(cur);
    for (const A of cur === 'COP' ? [100001, 7, 999999] : [100.01, 0.07, 9999.99]) {
      for (const dist of ['budget', 'even'] as const) {
        const parts = Object.values(splitAmong(d, A, dist));
        expect(parts.reduce((a, v) => a + units(cur, v), 0)).toBe(units(cur, A));
        expect(parts.every(v => exact(cur, v) && v >= 0)).toBe(true);
      }
    }
  });

  it('extra income for the rest of the month raises the month plan by exactly that much', () => {
    const d = world(cur), A = cur === 'COP' ? 250001 : 250.01;
    const after = { ...d, ...addExtraIncome(d, c, { amt: A, acct: 'a1', note: 'Bonus', toPockets: A, mode: 'month', dist: 'budget' }) };
    const plan = (x: Data) => x.pockets.reduce((a, p) => a + units(cur, monthStats(x, p.id, c).budget), 0);
    expect(plan(after) - plan(d)).toBe(units(cur, A));
    expect(units(cur, after.accounts.find(a => a.id === 'a1')!.bal - d.accounts.find(a => a.id === 'a1')!.bal)).toBe(units(cur, A));
  });

  it('moving leftover between pockets keeps the total, and covering the shortfall lowers it by what was given up', () => {
    const d = world(cur), total = (x: Data) => x.pockets.reduce((a, p) => a + units(cur, pocketStats(x, p.id, c)!.left), 0);
    const amt = cur === 'COP' ? 10001 : 10.01;
    const moved = { ...d, ...transferLeftover(d, c, 'groc', { fun: amt })! };
    expect(total(moved)).toBe(total(d));
    const short = { ...d, accounts: d.accounts.map(a => (a.type === 'card' ? a : { ...a, bal: roundAmt(a.bal / 50) })) };
    const sug = suggestCover(short, c), given = Object.values(sug).reduce((a, v) => a + units(cur, v), 0);
    expect(given).toBeGreaterThan(0);
    const covered = { ...short, ...coverWith(short, c, sug)! };
    expect(units(cur, monthSummary(short, c).real) - units(cur, monthSummary(covered, c).real)).toBe(given);
  });

  it('debts: lend, get part back, delete: balances return to where they started', () => {
    const d = world(cur), amt = cur === 'COP' ? 78000 : 19.87, part = cur === 'COP' ? 30000 : 7.33;
    let x = { ...d, ...saveDebt(d, { id: 'z', ts: 1, dir: 'owed', name: 'Juan', amt, date: TODAY, acct: 'c1', pays: [] }) };
    x = { ...x, ...addDebtPay(x, 'z', { id: 'zp', ts: 2, amt: part, date: TODAY, acct: 'a1' })! };
    expect(units(cur, x.accounts.find(a => a.id === 'a1')!.bal)).toBe(units(cur, d.accounts.find(a => a.id === 'a1')!.bal + part));
    x = { ...x, ...deleteDebt(x, 'z') };
    for (const a of d.accounts) expect(units(cur, x.accounts.find(y => y.id === a.id)!.bal)).toBe(units(cur, a.bal));
  });

  it('net worth is the same on the Accounts tab and in the report, and account histories add up', () => {
    const d = world(cur);
    expect(units(cur, netWorth(d).total)).toBe(units(cur, netWorthAt(d, TODAY)));
    for (const a of d.accounts) {
      const h = acctTxns(d, a.id);
      expect(Number.isFinite(h.opening)).toBe(true);
      expect(units(cur, balanceAt(d, a.id, TODAY))).toBe(units(cur, a.bal));
    }
    expect(cashflow(d, ['2026-10', '2026-11']).every(finite)).toBe(true);
  });

  it('trips: an awkward bill split three ways settles to zero', () => {
    const scale = unitsFor(cur), amount = cur === 'COP' ? 100000 : 100;
    const it1: TripItem = { id: 'a', kind: 'expense', desc: 'Dinner', amount, paidBy: 'me', split: { mode: 'equal', among: ['me', 'ana', 'leo'] }, date: TODAY, createdBy: 'me', createdAt: 1 };
    const members = [{ id: 'me', name: 'Me' }, { id: 'ana', name: 'Ana' }, { id: 'leo', name: 'Leo' }];
    const bal = balances(members, [it1], scale);
    expect(Object.values(bal).reduce((a, v) => a + units(cur, v), 0)).toBe(0);
    const pays = settleUp(bal, scale).map((p, i) => ({ id: 'p' + i, kind: 'payment' as const, desc: '', amount: p.amount, paidBy: p.from, to: p.to, date: TODAY, createdBy: 'me', createdAt: 2 }));
    expect(Object.values(balances(members, [it1, ...pays], scale)).every(v => units(cur, v) === 0)).toBe(true);
  });

  it('daily interest stays a real number', () => {
    const d = world(cur);
    const withRate = { ...d, accounts: d.accounts.map(a => (a.id === 'a2' ? { ...a, rate: 11, accruedTo: '2026-11-01' } : a)) };
    const p = runInterest(withRate, TODAY)!;
    const a2 = p.accounts!.find(a => a.id === 'a2')!;
    expect(Number.isFinite(a2.bal) && a2.bal > withRate.accounts.find(a => a.id === 'a2')!.bal).toBe(true);
  });

  it('amounts are written the right way', () => {
    world(cur);
    expect(fmt(1234.5)).toBe(cur === 'COP' ? '$1.235' : `${cur}1,234.50`);
    expect(fmt(-0.5)).toBe(cur === 'COP' ? '−$1' : `−${cur}0.50`);
  });
});

describe('dollar investments in an app that is not in dollars', () => {
  it('a US$100 stock or fund is converted, never counted 1:1', async () => {
    const { convert } = await import('./invest');
    const inv = { trades: [], quotes: {}, usdRate: 4000, usdRateAt: 0, fxPerUsd: { EUR: 0.9, GBP: 0.8 } };
    expect(convert(inv, 100, 'USD', 'COP')).toBe(400000);
    expect(convert(inv, 100, 'USD', '$')).toBe(100);
    expect(convert(inv, 100, 'USD', '€')).toBe(90);
    expect(convert(inv, 100, 'USD', '£')).toBe(80);
    expect(convert(inv, 400000, 'COP', '€')).toBe(90); // a Colombian stock, through dollars
    expect(convert(inv, 400000, 'COP', 'COP')).toBe(400000);
    // No live rate yet: still converted with a rough rate, not 1:1.
    expect(convert({ ...inv, fxPerUsd: undefined }, 100, 'USD', '€')).toBeLessThan(100);
  });
});
