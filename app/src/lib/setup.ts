// The first-time setup (screens/Setup.tsx): suggestions and the pieces of real data each step creates.
// Everything here is plain data in, data out, so it can be tested without the screen.
import type { Account, Bill, Data, Pocket } from './types';
import { ACCT_KIND, HUES } from './constants';
import { logoUrl } from './logo';
import { tr } from './i18n';
import { uid } from './derive';
import { addDays, todayISO } from './dates';

/** Banks people in Colombia pick most; the logo comes from the bank's website. `cash` is the wallet. */
export const BANKS: { name: string; site?: string; cash?: boolean }[] = [
  { name: 'Bancolombia', site: 'bancolombia.com' },
  { name: 'Davivienda', site: 'davivienda.com' },
  { name: 'Nequi', site: 'nequi.com.co' },
  { name: 'Nu', site: 'nu.com.co' },
  { name: 'BBVA', site: 'bbva.com.co' },
  { name: 'Banco de Bogotá', site: 'bancodebogota.com' },
  { name: 'Daviplata', site: 'daviplata.com' },
  { name: 'Lulo Bank', site: 'lulobank.com' },
  { name: 'Rappi', site: 'rappi.com.co' },
  { name: 'Cash', cash: true }
];

/** The bank's logo address, or null for a bank typed by hand or cash. */
export const bankLogo = (name: string) => { const b = BANKS.find(x => x.name === name); return b?.site ? logoUrl(b.site) : null; };

export interface PocketPick { key: string; name: string; emoji: string; share: number; on: boolean; weekly: number }

/** Suggested pockets with the share of the monthly income each usually takes; the first four start selected. */
const POCKETS: [string, string, number][] = [
  ['Groceries', 'pk:cart', 0.22], ['Transport', 'pk:bus', 0.1], ['Eating out', 'pk:plate', 0.08], ['Fun', 'pk:ticket', 0.06],
  ['Personal care', 'pk:bottle', 0.04], ['Coffee', 'pk:coffee', 0.02], ['Pets', 'pk:paw', 0.04], ['Clothes', 'pk:shirt', 0.04], ['Gym', 'pk:gym', 0.03]
];

/** A weekly amount rounded to $5.000, so the suggestions read like amounts a person would choose. */
export const roundBudget = (n: number) => Math.max(0, Math.round(n / 5000) * 5000);

/** The suggestions with a weekly budget worked out from the monthly income (0 when there's no income yet). */
export function suggestPockets(income: number, weeks: number): PocketPick[] {
  return POCKETS.map(([name, emoji, share], i) => ({ key: name, name: tr(name), emoji, share, on: i < 4, weekly: roundBudget((income * share) / weeks) }));
}

export interface BillPick { key: string; name: string; kind: Bill['kind']; cat: string; sub: string; on: boolean; amt: number; day: number }
export const BILLS: Omit<BillPick, 'on' | 'amt' | 'day'>[] = [
  { key: 'Rent', name: 'Rent', kind: 'Bill', cat: 'Home', sub: 'Rent' },
  { key: 'Utilities', name: 'Utilities', kind: 'Bill', cat: 'Home', sub: 'Utilities' },
  { key: 'Internet', name: 'Internet', kind: 'Bill', cat: 'Home', sub: 'Internet' },
  { key: 'Phone plan', name: 'Phone plan', kind: 'Bill', cat: 'Home', sub: 'Utilities' },
  { key: 'Netflix', name: 'Netflix', kind: 'Subscription', cat: 'Entertainment', sub: 'Movies' },
  { key: 'Spotify', name: 'Spotify', kind: 'Subscription', cat: 'Entertainment', sub: 'Events' },
  { key: 'Gym', name: 'Gym', kind: 'Subscription', cat: 'Health', sub: 'Gym' }
];

/** What's left of the monthly income after the pockets and the bills: shown live while choosing. Negative = over. */
export function leftFree(income: number, weeks: number, pockets: { on: boolean; weekly: number }[], bills: { on: boolean; amt: number }[] = []) {
  const planned = pockets.filter(p => p.on).reduce((a, p) => a + p.weekly * weeks, 0);
  const fixed = bills.filter(b => b.on).reduce((a, b) => a + b.amt, 0);
  return income - planned - fixed;
}

const hueAt = (i: number) => HUES[i % HUES.length];
const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

/** A bank, savings or cash account, with its logo when it's a known bank (or the photo or website logo the person chose). */
export function makeAccount(d: Data, name: string, bal: number, photo?: string | null): Account {
  const cash = BANKS.find(b => b.name === name)?.cash;
  const type = cash ? 'cash' : 'bank';
  return { id: uid('x'), name: tr(clean(name)), kind: ACCT_KIND[type], type, bal: Math.max(0, Math.round(bal)), hue: hueAt(d.accounts.length), photo: photo ?? bankLogo(name) };
}

/** A credit card: what's owed now, the limit, and the cutoff and pay-by days. */
export function makeCard(d: Data, name: string, owed: number, limit: number, cutDay?: number, payDay?: number): Account {
  const day = (n?: number) => (n && n >= 1 && n <= 31 ? Math.round(n) : undefined);
  return { id: uid('x'), name: clean(name), kind: ACCT_KIND.card, type: 'card', bal: Math.max(0, Math.round(owed)), limit: Math.max(0, Math.round(limit)), cutDay: day(cutDay), payDay: day(payDay), hue: hueAt(d.accounts.length) };
}

/**
 * The monthly income and when it arrives: one payday, or a quincena (half on the 15th, half on the 30th).
 * The income lands in `acct` on its own on those days, starting tomorrow: on payday the balance typed in setup
 * usually already has that pay in it, so it must not be added again.
 */
export function makeIncome(total: number, pay: 'month' | 'half', day: number, acct: string, today = todayISO()): Pick<Data, 'incomeStr'> & { bills: Bill[] } {
  const amt = Math.max(0, Math.round(total));
  const base = { kind: 'Income' as const, hue: 150, paidMonths: [], acct, auto: true, start: addDays(today, 1) };
  const bills: Bill[] = !amt ? [] : pay === 'half'
    ? [{ ...base, id: uid('i'), name: tr('Salary') + ' · 1', amt: Math.floor(amt / 2), dueDay: 15 }, { ...base, id: uid('i'), name: tr('Salary') + ' · 2', amt: amt - Math.floor(amt / 2), dueDay: 30 }]
    : [{ ...base, id: uid('i'), name: tr('Salary'), amt, dueDay: Math.min(31, Math.max(1, Math.round(day) || 1)) }];
  return { incomeStr: String(amt), bills };
}

/** The chosen pockets, in the person's language, each with its own colour. Own pockets typed by hand keep their name. */
export function makePockets(picks: PocketPick[]): Pocket[] {
  return picks.filter(p => p.on && clean(p.name)).map((p, i) => ({ id: uid('p'), name: clean(p.name), emoji: p.emoji, weeklyStr: String(roundBudget(p.weekly)), hue: hueAt(i) }));
}

/** The chosen bills as monthly reminders that are ticked off by hand (paid from `acct`). */
export function makeBills(picks: BillPick[], acct: string, today = todayISO()): Bill[] {
  return picks.filter(b => b.on && clean(b.name) && b.amt > 0).map((b, i) => ({
    id: uid('b'), name: tr(clean(b.name)), kind: b.kind, amt: Math.round(b.amt), dueDay: Math.min(31, Math.max(1, Math.round(b.day) || 1)),
    hue: hueAt(i + 2), paidMonths: [], acct: acct || undefined, auto: false, start: today, cat: b.cat, sub: b.sub
  }));
}
