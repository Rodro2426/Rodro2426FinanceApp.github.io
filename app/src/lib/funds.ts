// Investment funds (fondos de inversión colectiva, voluntary pension and severance funds): what you put in, what you
// took out, the balance your statement shows, and an estimate of today's value from the fund's recent return.
import type { Data, Fund, FundKind, FundMove, FundRisk, Payment } from './types';
import { daysBetween, todayISO } from './dates';
import { uid } from './derive';
import { convert } from './invest';

export const FUND_KINDS: [FundKind, string, string][] = [
  ['vista', 'Money market', 'On demand, low risk (a la vista)'],
  ['fixed', 'Fixed income', 'Bonds and CDTs (renta fija)'],
  ['stocks', 'Stocks', 'Shares, goes up and down (renta variable)'],
  ['balanced', 'Balanced', 'A mix of bonds and stocks'],
  ['realestate', 'Real estate', 'Buildings and rents (inmobiliario)'],
  ['pension', 'Voluntary pension', 'Pensión voluntaria, tax benefits'],
  ['severance', 'Severance', 'Cesantías'],
  ['other', 'Other', '']
];
export const KIND_LABEL = Object.fromEntries(FUND_KINDS.map(([k, l]) => [k, l])) as Record<FundKind, string>;
export const RISK_LABEL: Record<FundRisk, string> = { low: 'Conservative', medium: 'Moderate', high: 'Aggressive' };
/** The usual risk for each kind of fund (the fund's fact sheet has the exact one). */
export const RISK_FOR: Record<FundKind, FundRisk> = { vista: 'low', fixed: 'low', severance: 'low', balanced: 'medium', pension: 'medium', realestate: 'medium', stocks: 'high', other: 'medium' };
export const KIND_HUE: Record<FundKind, number> = { vista: 195, fixed: 230, stocks: 150, balanced: 260, realestate: 50, pension: 300, severance: 25, other: 175 };
/** Companies that manage funds in Colombia, to fill the manager quickly. */
export const MANAGERS = ['Fiduciaria Bancolombia', 'Fiduciaria Davivienda', 'Fiduciaria de Occidente', 'Fiduciaria Bogotá', 'Alianza Fiduciaria', 'Credicorp Capital', 'BTG Pactual', 'Itaú', 'Porvenir', 'Protección', 'Colfondos', 'Skandia'];

export const fundsOf = (d: Data) => d.investments.funds ?? [];
const growth = (rate: number | undefined, days: number) => (rate ? Math.pow(1 + rate / 100, Math.max(0, days) / 365) : 1);

export interface FundView {
  f: Fund;
  /** Estimated value today, in the fund's currency: the last statement balance (or the money put in) grown at the fund's return. */
  value: number;
  /** Money put in minus money taken out. */
  invested: number;
  gain: number; gainPct: number;
  /** Last balance from a statement, and how old it is. */
  lastValue?: FundMove; daysSince: number;
  /** True when today's value is an estimate (grown from the last statement or contribution). */
  estimated: boolean;
  /** Pacto de permanencia: the first day money can be taken out without a penalty. */
  freeFrom?: string;
  /** Rough earnings per day at the current return. */
  perDay: number;
}

export function fundView(f: Fund, today = todayISO()): FundView {
  const moves = [...f.moves].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const invested = moves.reduce((a, m) => a + (m.kind === 'in' ? m.amt : m.kind === 'out' ? -m.amt : 0), 0);
  // Walk forward in time: growth between moves, a statement balance replaces the running estimate.
  let bal = 0, at = moves[0]?.date ?? today, lastValue: FundMove | undefined;
  for (const m of moves) {
    if (m.date > today) break;
    bal *= growth(f.rate, daysBetween(at, m.date)); at = m.date;
    if (m.kind === 'in') bal += m.amt; else if (m.kind === 'out') bal = Math.max(0, bal - m.amt); else { bal = m.amt; lastValue = m; }
  }
  const lastDate = moves.length ? at : today;
  const value = f.closed ? 0 : bal * growth(f.rate, daysBetween(lastDate, today));
  const gain = f.closed ? -invested : value - invested;
  const freeFrom = f.liquidity === 'lock' && f.lockDays ? addDaysIso(f.start, f.lockDays) : undefined;
  return {
    f, value, invested, gain, gainPct: invested > 0 ? gain / invested : 0, lastValue,
    daysSince: lastValue ? daysBetween(lastValue.date, today) : daysBetween(lastDate, today),
    estimated: !!f.rate && daysBetween(lastDate, today) > 0, freeFrom,
    perDay: f.closed ? 0 : value * (growth(f.rate, 1) - 1)
  };
}
const addDaysIso = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };

/** Value in your own currency (a dollar fund is converted at the app's dollar rate). */
export const localValue = (d: Data, f: Fund, v: number) => (f.currency === 'USD' ? convert(d.investments, v, 'USD', d.settings.currency) : v);
export const fundsTotal = (d: Data) => fundsOf(d).filter(f => !f.closed).reduce((a, f) => a + localValue(d, f, fundView(f).value), 0);

/* ---------------- Changes ---------------- */
const move = (d: Data, id: string, delta: number) => d.accounts.map(a => (a.id === id ? { ...a, bal: a.type === 'card' ? a.bal - delta : a.bal + delta } : a));
const save = (d: Data, funds: Fund[]) => ({ ...d.investments, funds });

/** Adds a fund. With an account on the first contribution, that money leaves the account. */
export function addFund(d: Data, f: Omit<Fund, 'id' | 'ts' | 'moves'>, first: { amt: number; date: string; acct?: string } | null, statement: { amt: number; date: string } | null): Partial<Data> {
  const id = uid('fund');
  const moves: FundMove[] = [];
  if (first && first.amt > 0) moves.push({ id: uid('fm'), date: first.date, kind: 'in', amt: first.amt, ...(first.acct ? { acct: first.acct } : {}) });
  if (statement && statement.amt > 0) moves.push({ id: uid('fm'), date: statement.date, kind: 'value', amt: statement.amt });
  const fund: Fund = { ...f, id, ts: Date.now(), moves };
  const patch: Partial<Data> = { investments: save(d, [...fundsOf(d), fund]) };
  const m = moves.find(x => x.kind === 'in' && x.acct);
  if (m) Object.assign(patch, payFor(d, fund, m));
  return patch;
}

/** The account side of a contribution or withdrawal: a transfer between the account and the fund. */
function payFor(d: Data, f: Fund, m: FundMove): Partial<Data> {
  if (!m.acct || m.kind === 'value') return {};
  const local = localValue(d, f, m.amt);
  const pay: Payment = { id: `fp:${m.id}`, ts: Date.now(), from: m.kind === 'in' ? m.acct : `fund:${f.id}`, to: m.kind === 'in' ? `fund:${f.id}` : m.acct, amt: local, date: m.date, fund: f.id };
  return { payments: [...d.payments, pay], accounts: move(d, m.acct, m.kind === 'in' ? -local : local) };
}

/** Adds money, takes money out, or records the balance from a statement. */
export function addFundMove(d: Data, fundId: string, m: Omit<FundMove, 'id'>): Partial<Data> {
  const f = fundsOf(d).find(x => x.id === fundId);
  if (!f || !(m.amt > 0)) return {};
  const full: FundMove = { ...m, id: uid('fm') };
  const funds = fundsOf(d).map(x => (x.id === fundId ? { ...x, moves: [...x.moves, full] } : x));
  return { investments: save(d, funds), ...payFor(d, f, full) };
}

/** Removes one entry and undoes what it did to your account. */
export function deleteFundMove(d: Data, fundId: string, moveId: string): Partial<Data> {
  const f = fundsOf(d).find(x => x.id === fundId);
  const m = f?.moves.find(x => x.id === moveId);
  if (!f || !m) return {};
  const pay = d.payments.find(p => p.id === `fp:${moveId}`);
  const accounts = pay && m.acct ? move(d, m.acct, m.kind === 'in' ? pay.amt : -pay.amt) : d.accounts;
  return {
    investments: save(d, fundsOf(d).map(x => (x.id === fundId ? { ...x, moves: x.moves.filter(y => y.id !== moveId) } : x))),
    payments: d.payments.filter(p => p.id !== `fp:${moveId}`), accounts
  };
}

export function updateFund(d: Data, f: Fund): Partial<Data> {
  return { investments: save(d, fundsOf(d).map(x => (x.id === f.id ? f : x))) };
}

/** Deletes a fund added by mistake and gives back to your accounts everything it moved. */
export function deleteFund(d: Data, fundId: string): Partial<Data> {
  let accounts = d.accounts;
  d.payments.filter(p => p.fund === fundId).forEach(p => {
    if (p.to === `fund:${fundId}`) accounts = accounts.map(a => (a.id === p.from ? { ...a, bal: a.type === 'card' ? a.bal - p.amt : a.bal + p.amt } : a));
    else accounts = accounts.map(a => (a.id === p.to ? { ...a, bal: a.type === 'card' ? a.bal + p.amt : a.bal - p.amt } : a));
  });
  return { accounts, payments: d.payments.filter(p => p.fund !== fundId), investments: save(d, fundsOf(d).filter(x => x.id !== fundId)) };
}

/** Takes everything out (to an account, optional) and marks the fund closed. */
export function closeFund(d: Data, fundId: string, acct: string | undefined, today = todayISO()): Partial<Data> {
  const f = fundsOf(d).find(x => x.id === fundId);
  if (!f) return {};
  const v = fundView(f, today).value;
  const out: FundMove = { id: uid('fm'), date: today, kind: 'out', amt: Math.round(v * 100) / 100, ...(acct ? { acct } : {}), note: 'Closed' };
  const closedFund: Fund = { ...f, moves: [...f.moves, out], closed: today };
  return { investments: save(d, fundsOf(d).map(x => (x.id === fundId ? closedFund : x))), ...payFor(d, f, out) };
}
