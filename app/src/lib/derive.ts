import type { Account, Data, Expense } from './types';
import { POCKET_CAT } from './constants';
import { inRange, makeCtx, monthKey, type Ctx } from './dates';
import { getData } from './store';

export const num = (s: unknown) => { const n = parseFloat(String(s ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const isCOP = () => getData().settings.currency === 'COP';
export const curSymbol = () => (isCOP() ? '$' : getData().settings.currency);
export function fmt(n: number, sign?: boolean) {
  const cop = isCOP();
  const s = curSymbol() + Math.abs(n).toLocaleString(cop ? 'es-CO' : 'en-US', { minimumFractionDigits: cop ? 0 : 2, maximumFractionDigits: cop ? 0 : 2 });
  return n < 0 ? '−' + s : sign && n > 0 ? '+' + s : s;
}
export const roundAmt = (n: number) => (isCOP() ? Math.round(n) : Math.round(n * 100) / 100);
export const pctOf = (a: number, b: number) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0).toFixed(1) + '%';
export const uid = (p: string) => p + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

export const ctxOf = (d: Data) => makeCtx(d.settings.weeks);
export const catOf = (e: Expense): [string, string] => (e.cat ? [e.cat, e.sub || ''] : POCKET_CAT[e.p] || ['Other', 'Other']);
export const byDateDesc = (x: { date: string; ts: number }, y: { date: string; ts: number }) => (y.date > x.date ? 1 : y.date < x.date ? -1 : y.ts - x.ts);
export const sortedExpenses = (d: Data) => [...d.expenses].sort(byDateDesc);
export const weekExpenses = (d: Data, c: Ctx) => d.expenses.filter(e => inRange(e.date, c.weekStart, c.weekEnd));
export const monthExpenses = (d: Data, c: Ctx) => d.expenses.filter(e => monthKey(e.date) === c.month);

export interface PocketStats {
  id: string; name: string; hue: number; weekly: number; mIn: number; mOut: number; spent: number; budget: number; left: number;
  initial: string; photoBg: string; emoji: string; photo: string | null;
}
export function pocketStats(d: Data, id: string, c: Ctx = ctxOf(d)): PocketStats | null {
  const p = d.pockets.find(x => x.id === id);
  if (!p) return null;
  const weekly = num(p.weeklyStr);
  const moves = d.moves.filter(m => m.week === c.weekStart);
  const mIn = moves.filter(m => m.to === id).reduce((a, m) => a + m.amt, 0);
  const mOut = moves.filter(m => m.from === id).reduce((a, m) => a + m.amt, 0);
  const spent = weekExpenses(d, c).filter(e => e.p === id).reduce((a, e) => a + e.amt, 0);
  const budget = weekly + mIn - mOut;
  return {
    id, name: p.name, hue: p.hue, weekly, mIn, mOut, spent, budget, left: budget - spent,
    initial: p.photo ? '' : p.emoji || p.name.trim().charAt(0).toUpperCase() || '·',
    photoBg: p.photo ? `url(${p.photo})` : 'none', emoji: p.emoji || '', photo: p.photo || null
  };
}
export const allStats = (d: Data, c: Ctx = ctxOf(d)) => d.pockets.map(p => pocketStats(d, p.id, c)!);

export interface Txn {
  kind: 'expense' | 'payment' | 'income'; icon: string | null; photoBg: string; ts: number; date: string; note: string; pocket: string;
  hue: number; tags: string[]; category: string; show: number; effect: number; after: number;
}
/** Every movement on an account, newest first, with the running balance after each one. */
export function acctTxns(d: Data, id: string): { list: Txn[]; opening: number; card: boolean } {
  const a = d.accounts.find(x => x.id === id);
  if (!a) return { list: [], opening: 0, card: false };
  const card = a.type === 'card';
  const items: Txn[] = [
    ...d.expenses.filter(e => e.a === id).map(e => {
      const p = d.pockets.find(x => x.id === e.p);
      return {
        kind: 'expense' as const, icon: p ? (p.photo ? '' : p.emoji || p.name.charAt(0).toUpperCase()) : null,
        photoBg: p && p.photo ? `url(${p.photo})` : 'none', ts: e.ts, date: e.date, note: e.note, pocket: p ? p.name : '',
        hue: p ? p.hue : a.hue, tags: e.tags || [], category: catOf(e)[0], show: -e.amt, effect: card ? e.amt : -e.amt, after: 0
      };
    }),
    ...(d.incomes || []).filter(t => t.a === id).map(t => ({
      kind: 'income' as const, icon: '💰', photoBg: 'none', ts: t.ts, date: t.date, note: t.note, pocket: 'Income',
      hue: 150, tags: [], category: 'Income', show: t.amt, effect: card ? -t.amt : t.amt, after: 0
    })),
    ...d.payments.filter(p => p.from === id || p.to === id).map(p => {
      const out = p.from === id, other = d.accounts.find(x => x.id === (out ? p.to : p.from));
      return {
        kind: 'payment' as const, icon: null, photoBg: 'none', ts: p.ts, date: p.date,
        note: out ? `Payment to ${other ? other.name : 'card'}` : `Payment from ${other ? other.name : 'account'}`,
        pocket: 'Card payment', hue: 150, tags: [], category: 'Card payment', show: out ? -p.amt : p.amt, effect: -p.amt, after: 0
      };
    })
  ].sort(byDateDesc);
  let bal = a.bal;
  items.forEach(t => { t.after = bal; bal -= t.effect; });
  return { list: items, opening: bal, card };
}

/** Apply an expense's effect on the paying account (cards owe more, others hold less). */
export const chargeAccount = (accts: Account[], acctId: string, amt: number) =>
  accts.map(a => (a.id === acctId ? { ...a, bal: a.type === 'card' ? a.bal + amt : a.bal - amt } : a));

export const initialOf = (s: string) => s.trim().charAt(0).toUpperCase() || '·';
export const photoBg = (p?: string | null) => (p ? `url(${p})` : 'none');
export const plural = (n: number, one: string, many = one + 's') => (n === 1 ? `1 ${one}` : `${n} ${many}`);
