import 'fake-indexeddb/auto';
import { afterAll, describe, expect, it } from 'vitest';
import { editedBalance, fmtPlain, moneyScale } from './derive';
import { balances, settleUp, sharesOf, splitProblem, type TripItem } from './settle';
import { getData, setData } from './store';

const setCurrency = (c: string) => setData(x => ({ settings: { ...x.settings, currency: c as never } }));
const before = getData().settings.currency;
afterAll(() => setCurrency(before));

describe('euros (and dollars, pounds): cents everywhere', () => {
  it('editing a balance by less than 1 is saved', () => {
    setCurrency('€');
    expect(editedBalance(1500.75, 1500.25)).toBe(1500.75);
    expect(editedBalance(1500.25, 1500.2512)).toBe(1500.2512); // unchanged box keeps the exact balance
    expect(editedBalance(99, 1500.25)).toBe(99);
  });
  it('pesos still ignore the fractions interest adds', () => {
    setCurrency('COP');
    expect(editedBalance(3250000, 3250000.4)).toBe(3250000.4);
    expect(editedBalance(3250001, 3250000.4)).toBe(3250001);
  });
  it('trips split to the cent', () => {
    setCurrency('€');
    const it: TripItem = { id: 'a', kind: 'expense', desc: 'Dinner', amount: 10, paidBy: 'me', split: { mode: 'equal', among: ['me', 'ana', 'leo'] }, date: '2026-11-11', createdBy: 'me', createdAt: 1 };
    const s = sharesOf(it, moneyScale());
    expect(Object.values(s).sort()).toEqual([3.33, 3.33, 3.34]);
    const members = [{ id: 'me', name: 'Me' }, { id: 'ana', name: 'Ana' }, { id: 'leo', name: 'Leo' }];
    const plan = settleUp(balances(members, [it], moneyScale()), moneyScale());
    expect(plan.reduce((a, p) => a + p.amount, 0)).toBeCloseTo(s.ana + s.leo, 2);
    expect(plan.every(p => Math.abs(p.amount * 100 - Math.round(p.amount * 100)) < 1e-6)).toBe(true);
  });
  it('split messages and friend notifications use the app currency', () => {
    setCurrency('€');
    expect(splitProblem(10, 'amounts', ['a', 'b'], { a: 4.5, b: 5 }, moneyScale() === 1)).toBe('The amounts add up to 9.5, not 10.');
    expect(fmtPlain(12.5)).toBe('€12.50');
    setCurrency('COP');
    expect(fmtPlain(12500)).toBe('$12.500');
  });
});
