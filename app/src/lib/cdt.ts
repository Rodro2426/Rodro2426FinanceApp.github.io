// CDTs (term deposits): interest math, popular offers, opening/closing them, and the daily automation.
import type { Cdt, CdtPayout, Data, Income, Notif, Payment } from './types';
import { addDays, daysBetween, shortDate, todayISO } from './dates';
import { fmt, uid } from './derive';

/** Colombia withholds 4% of CDT interest at the source (retención en la fuente). */
export const WITHHOLD = 0.04;
export const PERIOD_DAYS: Record<CdtPayout, number> = { end: 0, monthly: 30, quarterly: 90, semiannual: 180 };
export const PAYOUT_LABEL: Record<CdtPayout, string> = { end: 'At maturity', monthly: 'Every month', quarterly: 'Every 3 months', semiannual: 'Every 6 months' };

/** Interest a sum earns over `days` at `ea` % effective annual. */
export const grossFor = (amount: number, ea: number, days: number) => amount * (Math.pow(1 + ea / 100, days / 365) - 1);
const net = (c: Cdt, gross: number) => (c.withholding ? gross * (1 - WITHHOLD) : gross);

const lastOf = <T,>(a: T[]) => a[a.length - 1];
export const endOf = (c: Cdt) => addDays(c.start, c.days);
export const cdtsOf = (d: Data) => d.investments.cdts ?? [];

export interface Payout { k: number; date: string; days: number; gross: number; net: number; final: boolean }
/** Every interest payment: one at maturity, or one per period (the last may be shorter) with the last on the maturity day. */
export function payouts(c: Cdt): Payout[] {
  const pd = PERIOD_DAYS[c.payout];
  if (!pd || pd >= c.days) { const g = grossFor(c.amount, c.rate, c.days); return [{ k: 1, date: endOf(c), days: c.days, gross: g, net: net(c, g), final: true }]; }
  const out: Payout[] = [];
  for (let at = 0, k = 1; at < c.days; k++) {
    const len = Math.min(pd, c.days - at); at += len;
    const g = grossFor(c.amount, c.rate, len);
    out.push({ k, date: addDays(c.start, at), days: len, gross: g, net: net(c, g), final: at >= c.days });
  }
  return out;
}

export interface CdtView {
  c: Cdt; end: string; status: 'active' | 'matured' | 'closed'; daysLeft: number; progress: number;
  /** Interest over the whole term. */
  totalGross: number; totalNet: number; withheld: number;
  /** Net interest earned so far (paid out + building up now). */
  earned: number;
  /** What is inside the CDT today: the amount plus interest not yet paid out. */
  value: number;
  /** What it earns today (net). */
  perDay: number;
  /** Paid at maturity: the amount plus the last interest payment. */
  atMaturity: number;
  next?: Payout;
}

export function cdtView(c: Cdt, today = todayISO()): CdtView {
  const end = endOf(c), ps = payouts(c);
  const totalGross = ps.reduce((a, p) => a + p.gross, 0), totalNet = ps.reduce((a, p) => a + p.net, 0);
  const elapsed = Math.max(0, Math.min(c.days, daysBetween(c.start, today)));
  const done = ps.filter(p => p.date <= today && !p.final);
  const paidNet = done.reduce((a, p) => a + p.net, 0);
  const since = done.length ? daysBetween(done[done.length - 1].date, today) : elapsed;
  const building = net(c, grossFor(c.amount, c.rate, Math.max(0, Math.min(since, elapsed))));
  const last = ps[ps.length - 1];
  const status = c.closed ? 'closed' : today >= end ? 'matured' : 'active';
  const growing = status === 'active' ? net(c, c.amount * (Math.pow(1 + c.rate / 100, 1 / 365) - 1)) : 0;
  return {
    c, end, status, daysLeft: Math.max(0, daysBetween(today, end)), progress: c.days ? elapsed / c.days : 1,
    totalGross, totalNet, withheld: totalGross - totalNet,
    earned: status === 'closed' ? totalNet : paidNet + building,
    value: status === 'closed' ? 0 : c.amount + (status === 'matured' ? last.net : building),
    perDay: growing, atMaturity: c.amount + last.net,
    next: status === 'active' ? ps.find(p => p.date > today) : undefined
  };
}

/* ---------------- Popular CDTs ---------------- */
export type Term = 90 | 180 | 360;
export interface Offer { bank: string; hue: number; min?: number; rates: Partial<Record<Term, number>> }
/** When the reference rates below were gathered. */
export const OFFERS_AS_OF = 'October 2026';
/**
 * Reference rates (% E.A.) published for October 2026 from Superfinanciera reports and comparison sites.
 * Rates change every week, so they are a starting point to edit, not a quote.
 */
export const OFFERS: Offer[] = [
  { bank: 'Banco Pichincha', hue: 90, rates: { 360: 13.38 } },
  { bank: 'Coltefinanciera', hue: 210, rates: { 360: 13.2 } },
  { bank: 'Pibank', hue: 45, min: 100000, rates: { 360: 13.0 } },
  { bank: 'KOA', hue: 300, rates: { 360: 12.8 } },
  { bank: 'Iris', hue: 280, rates: { 360: 12.65 } },
  { bank: 'Banco Popular', hue: 150, rates: { 360: 12.42 } },
  { bank: 'AV Villas', hue: 20, rates: { 360: 12.22 } },
  { bank: 'Bancolombia', hue: 85, rates: { 90: 9.85, 180: 10.41, 360: 11.81 } },
  { bank: 'Banco de Bogotá', hue: 255, rates: { 90: 9.45, 180: 9.9, 360: 11.74 } },
  { bank: 'BBVA', hue: 240, rates: { 90: 9.84, 180: 10.07, 360: 11.04 } },
  { bank: 'Davivienda', hue: 25, rates: { 90: 10.78, 180: 10.84, 360: 10.83 } }
];
export const hueFor = (bank: string) => OFFERS.find(o => o.bank.toLowerCase() === bank.trim().toLowerCase())?.hue ?? 175;

/* ---------------- Changes ---------------- */
const acctName = (d: Data, id?: string) => d.accounts.find(a => a.id === id)?.name ?? 'your account';
const move = (d: Data, id: string, delta: number) => d.accounts.map(a => (a.id === id ? { ...a, bal: a.type === 'card' ? a.bal - delta : a.bal + delta } : a));

/** Adds a CDT; with `fund`, takes its amount out of the linked account. */
export function addCdt(d: Data, c: Cdt, fund: boolean): Partial<Data> {
  const patch: Partial<Data> = { investments: { ...d.investments, cdts: [...cdtsOf(d), c] } };
  if (fund && c.acct) {
    const pay: Payment = { id: uid('cp'), ts: Date.now(), from: c.acct, to: `cdt:${c.id}`, amt: c.amount, date: c.start, cdt: c.id };
    patch.payments = [...d.payments, pay];
    patch.accounts = move(d, c.acct, -c.amount);
  }
  return patch;
}

/** Saves edits; if the money came from an account, the difference in amount is corrected there. */
export function updateCdt(d: Data, c: Cdt): Partial<Data> {
  const fund = d.payments.find(p => p.cdt === c.id && p.to === `cdt:${c.id}`);
  const patch: Partial<Data> = { investments: { ...d.investments, cdts: cdtsOf(d).map(x => (x.id === c.id ? c : x)) } };
  if (fund && fund.amt !== c.amount) {
    patch.accounts = move(d, fund.from, fund.amt - c.amount);
    patch.payments = d.payments.map(p => (p === fund ? { ...p, amt: c.amount, date: c.start } : p));
  }
  return patch;
}

/** Removes a CDT added by mistake and undoes everything it moved in your accounts. */
export function deleteCdt(d: Data, id: string): Partial<Data> {
  let accounts = d.accounts;
  d.payments.filter(p => p.cdt === id).forEach(p => {
    if (p.to === `cdt:${id}`) accounts = accounts.map(a => (a.id === p.from ? { ...a, bal: a.type === 'card' ? a.bal - p.amt : a.bal + p.amt } : a));
    else accounts = accounts.map(a => (a.id === p.to ? { ...a, bal: a.type === 'card' ? a.bal + p.amt : a.bal - p.amt } : a));
  });
  d.incomes.filter(t => t.id.startsWith(`cdt:${id}:`)).forEach(t => { accounts = accounts.map(a => (a.id === t.a ? { ...a, bal: a.type === 'card' ? a.bal + t.amt : a.bal - t.amt } : a)); });
  return {
    accounts,
    payments: d.payments.filter(p => p.cdt !== id),
    incomes: d.incomes.filter(t => !t.id.startsWith(`cdt:${id}:`)),
    notifications: d.notifications.filter(n => !n.id.includes(`:${id}`)),
    investments: { ...d.investments, cdts: cdtsOf(d).filter(x => x.id !== id) }
  };
}

const interestIncome = (c: Cdt, k: number | 'end', acct: string, amt: number, date: string): Income =>
  ({ id: `cdt:${c.id}:${k}`, ts: Date.now(), a: acct, amt, note: `CDT interest · ${c.bank}`, date });

/** At maturity: the amount comes back to `acct` and the last interest payment arrives as income. */
export function cashOutCdt(d: Data, id: string, acct: string, today = todayISO()): Partial<Data> {
  const c = cdtsOf(d).find(x => x.id === id)!;
  const v = cdtView(c, today), last = lastOf(payouts(c));
  const closed = { date: today, how: 'cashout' as const, amt: v.atMaturity };
  const cdts = cdtsOf(d).map(x => (x.id === id ? { ...x, closed } : x));
  if (!acct) return { investments: { ...d.investments, cdts } };
  const pay: Payment = { id: uid('cp'), ts: Date.now(), from: `cdt:${id}`, to: acct, amt: c.amount, date: today, cdt: id };
  return {
    investments: { ...d.investments, cdts },
    payments: [...d.payments, pay],
    incomes: [interestIncome(c, 'end', acct, last.net, today), ...d.incomes],
    accounts: move(d, acct, c.amount + last.net)
  };
}

/** Starts a new CDT on the maturity day. 'all' reinvests the interest too; 'capital' sends the interest to the account. */
export function renewCdt(d: Data, id: string, mode: 'all' | 'capital', rate: number, days: number): { patch: Partial<Data>; next: Cdt } {
  const c = cdtsOf(d).find(x => x.id === id)!;
  const end = endOf(c), last = lastOf(payouts(c));
  const amount = mode === 'all' ? c.amount + last.net : c.amount;
  const next: Cdt = { ...c, id: uid('cdt'), ts: Date.now(), amount, rate, days, start: end, paid: 0, closed: undefined, renewedFrom: c.id };
  const cdts = [...cdtsOf(d).map(x => (x.id === id ? { ...x, closed: { date: end, how: 'renew' as const, amt: amount } } : x)), next];
  const patch: Partial<Data> = { investments: { ...d.investments, cdts } };
  if (mode === 'capital' && c.acct) {
    patch.incomes = [interestIncome(c, 'end', c.acct, last.net, end), ...d.incomes];
    patch.accounts = move(d, c.acct, last.net);
  }
  return { patch, next };
}

/**
 * Daily: pays periodic interest into the linked account, and reminds you when a CDT is about to mature or has matured.
 * Idempotent: each payment and notice has a stable id.
 */
export function runCdts(d: Data, today = todayISO()): Partial<Data> | null {
  const list = cdtsOf(d);
  if (!list.some(c => !c.closed)) return null;
  let incomes = d.incomes, accounts = d.accounts, changed = false;
  const known = new Set(d.notifications.map(n => n.id)), have = new Set(d.incomes.map(t => t.id)), fresh: Notif[] = [];
  const notify = (id: string, title: string, body: string) => {
    if (known.has(id)) return; known.add(id);
    fresh.push({ id, date: today, ts: Date.now() + fresh.length, kind: 'income', title, body, read: false, dismissed: false, bannered: false });
  };
  const cdts = list.map(c => {
    if (c.closed) return c;
    let paid = c.paid ?? 0;
    payouts(c).forEach(p => {
      if (p.final || p.date > today || p.k <= paid) return;
      paid = p.k;
      if (!c.acct || have.has(`cdt:${c.id}:${p.k}`)) return;
      incomes = [interestIncome(c, p.k, c.acct, p.net, p.date), ...incomes];
      accounts = accounts.map(a => (a.id === c.acct ? { ...a, bal: a.type === 'card' ? a.bal - p.net : a.bal + p.net } : a));
      notify(`cdtpay:${c.id}:${p.k}`, `CDT interest from ${c.bank}`, `+${fmt(p.net)} added to ${acctName(d, c.acct)}.`);
    });
    const end = endOf(c), left = daysBetween(today, end);
    if (left > 0 && left <= 3) notify(`cdtsoon:${c.id}`, `Your ${c.bank} CDT matures ${left === 1 ? 'tomorrow' : `in ${left} days`}`, `On ${shortDate(end)} you get ${fmt(cdtView(c, today).atMaturity)}. Decide if you'll renew it or cash it out.`);
    if (left <= 0) notify(`cdtdue:${c.id}`, `Your ${c.bank} CDT matured`, `${fmt(cdtView(c, today).atMaturity)} is ready. Open Investments to cash it out or renew it.`);
    if (paid !== (c.paid ?? 0)) { changed = true; return { ...c, paid }; }
    return c;
  });
  if (!changed && !fresh.length) return null;
  const notifications = [...fresh, ...d.notifications].sort((x, y) => (y.date > x.date ? 1 : y.date < x.date ? -1 : y.ts - x.ts));
  return { investments: { ...d.investments, cdts }, incomes, accounts, notifications };
}

export const newCdtId = () => uid('cdt');
/** What all open CDTs hold today. */
export const cdtTotal = (d: Data) => cdtsOf(d).filter(c => !c.closed).reduce((a, c) => a + cdtView(c).value, 0);
