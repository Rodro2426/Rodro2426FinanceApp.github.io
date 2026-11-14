// Money between you and one person: what people owe you (you lent, or paid for them) and what you owe (you borrowed).
// Lending and borrowing move account balances, but they are never spending or income: they don't touch your
// categories, pockets or month income. They change two things: net worth (with the "count what people owe me"
// switch) and the pockets' real shortfall, depending on whether the money comes back before you need it.
import type { Account, Data, Debt, DebtPay } from './types';
import { daysInMonth, shortDate } from './dates';
import { cardDueFor } from './cards';

const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
const EPS = 0.004;

export const debtsOf = (d: Data): Debt[] => d.debts ?? [];
export const paidOf = (x: Debt) => sum(x.pays.map(p => p.amt));
/** What is still owed (never below 0). */
export const leftOf = (x: Debt) => Math.max(0, Math.round((x.amt - paidOf(x)) * 100) / 100);
export const isOpen = (x: Debt) => leftOf(x) > EPS;
/** Paid back in full: the date of the last payment. */
export const settledOn = (x: Debt) => (isOpen(x) ? null : x.pays.map(p => p.date).sort().pop() ?? x.date);

/** Totals of what's still open: people owe you, and you owe. */
export function debtTotals(d: Data) {
  const open = debtsOf(d).filter(isOpen);
  return {
    owedToMe: sum(open.filter(x => x.dir === 'owed').map(leftOf)),
    iOwe: sum(open.filter(x => x.dir === 'owe').map(leftOf)),
    owedCount: open.filter(x => x.dir === 'owed').length,
    oweCount: open.filter(x => x.dir === 'owe').length
  };
}

/* ---------------- Account balances ---------------- */
/** Money coming into an account (`amt` > 0) or leaving it (`amt` < 0): banks hold more, cards owe less. */
const moneyIn = (accts: Account[], id: string | undefined, amt: number) =>
  !id || !amt ? accts : accts.map(a => (a.id !== id ? a : { ...a, bal: Math.round((a.type === 'card' ? a.bal - amt : a.bal + amt) * 100) / 100 }));
/** Lending is money out; borrowing is money in. Paying back goes the other way. */
const startFlow = (x: Debt) => (x.dir === 'owe' ? 1 : -1);

/** Applies (k = 1) or undoes (k = −1) everything a debt did to your accounts: the loan itself and every payment. */
function applyDebt(accts: Account[], x: Debt, k: 1 | -1) {
  let out = moneyIn(accts, x.acct, k * startFlow(x) * x.amt);
  for (const p of x.pays) out = moneyIn(out, p.acct, -k * startFlow(x) * p.amt);
  return out;
}

/** Saves a new or edited debt, moving the account balances to match. */
export function saveDebt(d: Data, x: Debt): Partial<Data> {
  const old = debtsOf(d).find(y => y.id === x.id);
  const accounts = applyDebt(old ? applyDebt(d.accounts, old, -1) : d.accounts, x, 1);
  return { accounts, debts: old ? debtsOf(d).map(y => (y.id === x.id ? x : y)) : [x, ...debtsOf(d)] };
}
/** Deletes a debt and undoes what it did to your accounts. */
export function deleteDebt(d: Data, id: string): Partial<Data> {
  const old = debtsOf(d).find(y => y.id === id);
  if (!old) return {};
  return { accounts: applyDebt(d.accounts, old, -1), debts: debtsOf(d).filter(y => y.id !== id) };
}
/** Records a payment back (never more than what's left). */
export function addDebtPay(d: Data, id: string, p: DebtPay): Partial<Data> | null {
  const old = debtsOf(d).find(y => y.id === id);
  if (!old || !(p.amt > 0) || p.amt > leftOf(old) + EPS) return null;
  return saveDebt(d, { ...old, pays: [...old.pays, p] });
}
export function deleteDebtPay(d: Data, id: string, payId: string): Partial<Data> {
  const old = debtsOf(d).find(y => y.id === id);
  return old ? saveDebt(d, { ...old, pays: old.pays.filter(p => p.id !== payId) }) : {};
}

/** Lines for an account's history: the loan and each payment back, with their effect on the balance. */
export function debtAcctLines(d: Data, acctId: string) {
  const card = d.accounts.find(a => a.id === acctId)?.type === 'card';
  const out: { id: string; debt: string; ts: number; date: string; note: string; show: number; effect: number }[] = [];
  for (const x of debtsOf(d)) {
    if (x.acct === acctId) {
      const flow = startFlow(x) * x.amt;
      out.push({ id: x.id, debt: x.id, ts: x.ts, date: x.date, note: x.dir === 'owed' ? `Lent to ${x.name}` : `Borrowed from ${x.name}`, show: flow, effect: card ? -flow : flow });
    }
    for (const p of x.pays) if (p.acct === acctId) {
      const flow = -startFlow(x) * p.amt;
      out.push({ id: p.id, debt: x.id, ts: p.ts, date: p.date, note: x.dir === 'owed' ? `${x.name} paid you back` : `You paid ${x.name} back`, show: flow, effect: card ? -flow : flow });
    }
  }
  return out;
}

/* ---------------- Net worth ---------------- */
/** What a debt is still worth on a date: + people owe you, − you owe (0 before it existed). */
export function debtValueAt(x: Debt, date: string) {
  if (x.date > date) return 0;
  const left = Math.max(0, x.amt - sum(x.pays.filter(p => p.date <= date).map(p => p.amt)));
  return x.dir === 'owed' ? left : -left;
}
/** Debts' part of net worth on a date. What you owe always counts; what people owe you only with the switch on. */
export const debtsWorthAt = (d: Data, date: string) =>
  sum(debtsOf(d).filter(x => x.dir === 'owe' || d.settings.owedInNetWorth).map(x => debtValueAt(x, date)));

/* ---------------- Pockets ---------------- */
const pad = (n: number) => String(n).padStart(2, '0');
export const monthEndOf = (today: string) => `${today.slice(0, 7)}-${pad(daysInMonth(today.slice(0, 7)))}`;

/**
 * The day you need the money you lent: the card's next payment date if you paid with a card,
 * otherwise the end of this month (the money already left your account).
 */
export function neededBy(d: Data, x: Debt, today: string) {
  const a = d.accounts.find(y => y.id === x.acct);
  return (a?.type === 'card' ? cardDueFor(d, a, x.date, today) : null) ?? monthEndOf(today);
}

export interface DebtOutlook {
  /** People who pay you back before you need the money: counted as yours. */ backInTime: number;
  /** People who pay back later (or with no date): your pockets have to cover it for now. */ late: number;
  /** What you have to pay back this month (or with no date): it isn't yours to spend. */ oweSoon: number;
  /** backInTime − oweSoon: added to your account money in the pockets' shortfall check. */ net: number;
}
/** How open debts change the money your pockets can count on this month. */
export function debtOutlook(d: Data, today: string): DebtOutlook {
  const end = monthEndOf(today);
  let backInTime = 0, late = 0, oweSoon = 0;
  for (const x of debtsOf(d).filter(isOpen)) {
    const left = leftOf(x);
    if (x.dir === 'owed') { if (x.due && x.due >= today && x.due <= neededBy(d, x, today)) backInTime += left; else late += left; }
    else if (!x.due || x.due <= end) oweSoon += left;
  }
  return { backInTime, late, oweSoon, net: backInTime - oweSoon };
}
/** One debt in words, for its row and screen: whether it changes your pockets. */
export function debtTiming(d: Data, x: Debt, today: string): { tone: 'ok' | 'warn' | 'none'; text: string } {
  if (!isOpen(x)) return { tone: 'none', text: '' };
  const a = d.accounts.find(y => y.id === x.acct), card = a?.type === 'card' ? a : null, need = neededBy(d, x, today);
  if (x.dir === 'owe') {
    if (x.due && x.due > monthEndOf(today)) return { tone: 'ok', text: 'Due after this month, so your pockets don\'t change yet.' };
    return { tone: 'warn', text: x.due ? 'Due this month: your pockets count it as money that isn\'t yours.' : 'No date to pay back: your pockets count it as money that isn\'t yours.' };
  }
  if (!x.due) return { tone: 'warn', text: `No pay-back date: your pockets cover it until ${x.name} pays.` };
  if (x.due < today) return { tone: 'warn', text: `${x.name} was due to pay you back on ${shortDate(x.due)}: your pockets cover it until ${x.name} pays.` };
  if (x.due <= need) return { tone: 'ok', text: card ? `Comes back before ${card.name} is due, so your pockets don't change.` : 'Comes back this month, so your pockets don\'t change.' };
  return { tone: 'warn', text: card ? `Comes back after ${card.name} is due: your pockets cover it for now.` : 'Comes back after this month: your pockets cover it for now.' };
}
