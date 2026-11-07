import { getLang } from './i18n';
// Scheduled income, bills and subscriptions, plus the notifications they produce.
// `runSchedule` is idempotent: it can run any number of times a day and only
// applies or notifies what hasn't been handled yet.
import type { Account, Bill, Data, Expense, FxOrig, Income, Notif, NotifKind } from './types';
import { allStats, ctxOf, fmt, uid } from './derive';
import { addDays, daysInMonth, monthKey, prevMonthKey, shortDate, todayISO } from './dates';
import { fmtUsd, isUsd, latestRate, trmFor } from './trm';

/**
 * Local amount for one occurrence. Dollar items use the TRM of `date`; if that
 * lookup failed, the newest known rate. Returns null while the TRM is still loading.
 */
export function localAmount(d: Data, b: Bill, date: string): { amt: number; orig?: FxOrig } | null {
  if (isCardPay(b)) return { amt: Math.round(cardPayAmount(d, b)) };
  if (!isUsd(b)) return { amt: b.amt };
  const trm = trmFor(d, date);
  if (!trm && !d.fx?.tried[date]) return null;
  const rate = trm ?? latestRate(d);
  return { amt: Math.round(b.amt * rate), orig: { amt: b.amt, cur: 'USD', rate, official: !!trm } };
}
/** Text for a bill's amount: "$44.900" or "US$20,00". */
export const billAmount = (b: Bill) => (isCardPay(b) && b.payMode !== 'fixed' ? 'Full balance' : isUsd(b) ? fmtUsd(b.amt) : fmt(b.amt));
/** Approximate local value for totals and previews. */
export const approxLocal = (d: Data, b: Bill) => (isCardPay(b) ? cardPayAmount(d, b) : isUsd(b) ? b.amt * latestRate(d) : b.amt);

const pad = (n: number) => String(n).padStart(2, '0');
/** Date of the item in month `m`; days past the month's end fall on its last day. */
export const dueDate = (b: Bill, m: string) => `${m}-${pad(Math.min(b.dueDay, daysInMonth(m)))}`;
export const isIncome = (b: Bill) => b.kind === 'Income';
export const isCardPay = (b: Bill) => b.kind === 'CardPayment';
export const KIND_LABEL: Record<Bill['kind'], string> = { Income: 'Income', Bill: 'Bill', Subscription: 'Subscription', CardPayment: 'Card payment' };
/** Bills or subscriptions someone else pays. */
export const notMine = (b: Bill) => !!b.notMine && b.kind !== 'Income' && b.kind !== 'CardPayment';
export const isAuto = (b: Bill, d: Data) => !notMine(b) && !!(b.auto && b.acct && d.accounts.some(a => a.id === b.acct) && (!isCardPay(b) || d.accounts.some(a => a.id === b.toCard && a.type === 'card')));
/** How much a card payment would pay right now: the full balance owed, or the fixed amount (never more than owed or than the account has). */
export function cardPayAmount(d: Data, b: Bill) {
  const card = d.accounts.find(a => a.id === b.toCard), from = d.accounts.find(a => a.id === b.acct);
  if (!card) return 0;
  const want = b.payMode === 'fixed' ? Math.min(b.amt, Math.max(0, card.bal)) : Math.max(0, card.bal);
  return Math.max(0, Math.min(want, from ? Math.max(0, from.bal) : want));
}
const nextMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`; };

/** Balance change for money in (+) or out (−) of an account; cards owe less when money comes in. */
function move(accts: Account[], id: string, amt: number, incoming: boolean) {
  return accts.map(a => (a.id !== id ? a : { ...a, bal: a.type === 'card' ? a.bal + (incoming ? -amt : amt) : a.bal + (incoming ? amt : -amt) }));
}

/** Applies one occurrence of `b` for month `m`, dated `date`. Returns the data patch. */
export function applyOccurrence(d: Data, b: Bill, m: string, date: string): Partial<Data> {
  const markPaid = (x: Bill) => (x.id !== b.id ? x : { ...x, paidMonths: [...x.paidMonths.filter(y => y !== m), m], skipMonths: (x.skipMonths || []).filter(y => y !== m) });
  if (notMine(b)) return {};
  if (!isAuto(b, d)) return { bills: d.bills.map(markPaid) };
  const ts = Date.now();
  const { amt, orig } = localAmount(d, b, date) ?? { amt: Math.round(b.amt * (isUsd(b) ? latestRate(d) : 1)) };
  if (isCardPay(b)) {
    if (!(amt > 0)) return { bills: d.bills.map(markPaid) };
    const pay = { id: uid('pay'), ts, from: b.acct!, to: b.toCard!, amt, date, ruleId: b.id, ruleMonth: m };
    return { payments: [...d.payments, pay], accounts: d.accounts.map(a => (a.id === b.acct || a.id === b.toCard ? { ...a, bal: a.bal - amt } : a)), bills: d.bills.map(markPaid) };
  }
  if (isIncome(b)) {
    const inc: Income = { id: uid('in'), ts, a: b.acct!, amt, note: b.name, date, ruleId: b.id, ruleMonth: m, orig };
    return { incomes: [inc, ...d.incomes], accounts: move(d.accounts, b.acct!, amt, true), bills: d.bills.map(markPaid) };
  }
  const exp: Expense = { id: uid('e'), ts, p: b.pocket && d.pockets.some(p => p.id === b.pocket) ? b.pocket : '', a: b.acct!, amt, note: b.name, date, tags: [], cat: b.cat || (b.kind === 'Bill' ? 'Home' : 'Entertainment'), sub: b.sub || '', ruleId: b.id, ruleMonth: m, orig };
  return { expenses: [exp, ...d.expenses], accounts: move(d.accounts, b.acct!, amt, false), bills: d.bills.map(markPaid) };
}

/** Reverses a handled month: removes the money it moved and stops it from running again. */
export function undoOccurrence(d: Data, b: Bill, m: string): Partial<Data> {
  const bills = d.bills.map(x => (x.id !== b.id ? x : { ...x, paidMonths: x.paidMonths.filter(y => y !== m), skipMonths: [...(x.skipMonths || []).filter(y => y !== m), m] }));
  const pay = d.payments.find(t => t.ruleId === b.id && t.ruleMonth === m);
  if (pay) return { bills, payments: d.payments.filter(t => t !== pay), accounts: d.accounts.map(a => (a.id === pay.from || a.id === pay.to ? { ...a, bal: a.bal + pay.amt } : a)) };
  const inc = d.incomes.find(t => t.ruleId === b.id && t.ruleMonth === m);
  if (inc) return { bills, incomes: d.incomes.filter(t => t !== inc), accounts: move(d.accounts, inc.a, inc.amt, false) };
  const exp = d.expenses.find(t => t.ruleId === b.id && t.ruleMonth === m);
  if (exp) return { bills, expenses: d.expenses.filter(t => t !== exp), accounts: move(d.accounts, exp.a, exp.amt, true) };
  return { bills };
}

/** "Nov 15" → ISO date in the current or next year (whichever is not in the past). */
export function parseShortDate(s: string | undefined, today: string): string | null {
  const m = /^\s*([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})\s*$/.exec(s || '');
  if (!m) return null;
  const mi = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[1].toLowerCase());
  if (mi < 0) return null;
  let y = Number(today.slice(0, 4));
  let iso = `${y}-${pad(mi + 1)}-${pad(Math.min(Number(m[2]), 31))}`;
  if (iso < addDays(today, -1)) { y++; iso = `${y}-${pad(mi + 1)}-${pad(Math.min(Number(m[2]), 31))}`; }
  return iso;
}

export function runSchedule(d0: Data, today = todayISO()): Partial<Data> | null {
  let d = d0;
  let changed = false;
  const apply = (patch: Partial<Data>) => { d = { ...d, ...patch }; changed = true; };
  const fresh: Notif[] = [];
  const known = new Set(d.notifications.map(n => n.id));
  const notify = (id: string, date: string, kind: NotifKind, title: string, body: string) => {
    if (known.has(id)) return;
    known.add(id);
    fresh.push({ id, date, ts: Date.now() + fresh.length, kind, title, body, read: false, dismissed: false, bannered: false });
  };
  const acctName = (id?: string) => d.accounts.find(a => a.id === id)?.name || 'your account';

  // 1. Run automatic items whose day has come (catching up on missed months).
  for (const b0 of d0.bills) {
    if (!isAuto(b0, d)) continue;
    const start = b0.start || today;
    for (let m = monthKey(start); m <= monthKey(today); m = nextMonth(m)) {
      const b = d.bills.find(x => x.id === b0.id)!;
      const due = dueDate(b, m);
      if (due < start || due > today || b.paidMonths.includes(m) || (b.skipMonths || []).includes(m)) continue;
      const local = localAmount(d, b, due);
      if (!local) continue; // waiting for that day's TRM; runs again once it arrives
      apply(applyOccurrence(d, b, m, due));
      const how = local.orig ? ` (${fmtUsd(b.amt)} at ${local.orig.official ? 'TRM' : 'about'} ${fmt(local.orig.rate)})` : '';
      if (isCardPay(b)) {
        const card = acctName(b.toCard);
        if (local.amt > 0) notify(`ran:${b.id}:${m}`, due, 'card', `${card} paid`, `−${fmt(local.amt)} from ${acctName(b.acct)} to your card.`);
        else notify(`ran:${b.id}:${m}`, due, 'card', `${card} payment skipped`, d.accounts.find(a => a.id === b.toCard)?.bal ? `${acctName(b.acct)} didn't have enough money.` : 'Nothing was owed on the card.');
      } else if (isIncome(b)) notify(`ran:${b.id}:${m}`, due, 'income', `${b.name} received`, `+${fmt(local.amt)}${how} added to ${acctName(b.acct)}.`);
      else notify(`ran:${b.id}:${m}`, due, 'bill', `${b.name} paid`, `−${fmt(local.amt)}${how} from ${acctName(b.acct)}.`);
    }
  }

  // 2. Reminders for tomorrow and for manual bills due today.
  const tomorrow = addDays(today, 1);
  for (const b of d.bills) {
    const handled = (m: string) => b.paidMonths.includes(m) || (b.skipMonths || []).includes(m);
    const tm = monthKey(tomorrow);
    if (dueDate(b, tm) === tomorrow && !handled(tm) && (!b.start || tomorrow >= b.start)) {
      const auto = isAuto(b, d);
      if (isCardPay(b)) notify(`soon:${b.id}:${tomorrow}`, today, 'card', `${acctName(b.toCard)} payment tomorrow`, `${b.payMode === 'fixed' ? fmt(b.amt) : `The full balance (now ${fmt(d.accounts.find(a => a.id === b.toCard)?.bal || 0)})`}${auto ? ` will be paid from ${acctName(b.acct)}` : ''}.`);
      else if (isIncome(b)) notify(`soon:${b.id}:${tomorrow}`, today, 'income', `${b.name} arrives tomorrow`, `+${billAmount(b)}${auto ? ` will be added to ${acctName(b.acct)}` : ''}.`);
      else if (notMine(b)) notify(`soon:${b.id}:${tomorrow}`, today, 'bill', `${b.name} is due tomorrow`, `${billAmount(b)}, paid by someone else. Nothing is taken from your accounts.`);
      else notify(`soon:${b.id}:${tomorrow}`, today, 'bill', `${b.name} is due tomorrow`, `${billAmount(b)}${isUsd(b) ? ' (converted with that day\'s TRM)' : ''}${auto ? ` will be paid automatically from ${acctName(b.acct)}` : '. Remember to pay it'}.`);
    }
    const m = monthKey(today);
    if (!isAuto(b, d) && !isIncome(b) && dueDate(b, m) === today && !handled(m)) notify(`today:${b.id}:${today}`, today, 'bill', `${b.name} is due today`, notMine(b) ? `${billAmount(b)}, paid by someone else. Nothing is taken from your accounts.` : `${billAmount(b)}. Tick it off in Insights once it's paid.`);
  }

  // 3. Credit card payment dates.
  for (const a of d.accounts) {
    if (a.type !== 'card' || a.bal <= 0) continue;
    const due = parseShortDate(a.due, today);
    if (due === tomorrow) notify(`card:${a.id}:${due}`, today, 'card', `${a.name} payment is due tomorrow`, `You owe ${fmt(a.bal)}.`);
    if (due === today) notify(`card0:${a.id}:${due}`, today, 'card', `${a.name} payment is due today`, `You owe ${fmt(a.bal)}.`);
  }

  // 4. Budget warnings for this week.
  const c = ctxOf(d);
  const stats = allStats(d, c);
  for (const s of stats) {
    if (s.budget > 0 && s.left < 0) notify(`over:${s.id}:${c.weekStart}`, today, 'budget', `${s.name} is over budget`, `You've spent ${fmt(-s.left)} more than planned this week.`);
  }
  const budget = stats.reduce((a, s) => a + s.budget, 0), left = stats.reduce((a, s) => a + s.left, 0);
  if (budget > 0 && left / budget < 0.3 && c.daysLeft >= 2) {
    notify(`low:${c.weekStart}`, today, 'budget', 'Running low this week', `Only ${fmt(Math.max(0, left))} (${Math.round(Math.max(0, left) / budget * 100)}%) is safe to spend, with ${c.daysLeft} days to go.`);
  }

  // 5. Monthly backup reminder on the chosen day, unless a backup was made since that day.
  const last = d.settings.lastBackup, bday = Math.min(28, Math.max(1, d.settings.backupDay || 1));
  const due = `${monthKey(today)}-${pad(bday)}`;
  if (d.settings.backupReminder !== false && (d.expenses.length || d.accounts.length) && today >= due && (!last || last < due)) {
    notify(`backup:${monthKey(today)}`, today, 'backup', 'Time for your monthly backup', `${last ? `Last backup: ${shortDate(last)}.` : "You haven't made a backup yet."} Tap Back up now and save it to your folder in Files.`);
  }

  // Keep the last ~2 months of notifications.
  const cutoff = prevMonthKey(prevMonthKey(monthKey(today))) + '-01';
  const kept = [...fresh, ...d.notifications].filter(n => n.date >= cutoff);
  if (kept.length !== d.notifications.length) changed = true;
  if (!changed) return null;
  return { incomes: d.incomes, expenses: d.expenses, payments: d.payments, accounts: d.accounts, bills: d.bills, notifications: kept.sort((x, y) => (y.date > x.date ? 1 : y.date < x.date ? -1 : y.ts - x.ts)) };
}

/** What happens on a given day of a month, for the calendar. */
export function eventsOn(d: Data, date: string) {
  const m = monthKey(date);
  return d.bills.filter(b => dueDate(b, m) === date && (!b.start || date >= b.start || b.paidMonths.includes(m))).map(b => {
    const paid = b.paidMonths.includes(m);
    return { b, paid, auto: isAuto(b, d), past: date < todayISO() };
  });
}

export const describeDay = (b: Bill) => `Every month on the ${ordinal(b.dueDay)}${b.dueDay > 28 ? ' (or the last day)' : ''}`;
export function ordinal(n: number) { if (getLang() === 'es') return `día ${n}`; const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
export const shortDue = (b: Bill, m: string) => shortDate(dueDate(b, m));

/** Dates whose TRM is needed: today, plus any dollar item waiting to run. */
export function trmNeeded(d: Data, today = todayISO()): string[] {
  if (!d.bills.some(isUsd)) return [];
  const out = [today];
  for (const b of d.bills) {
    if (!isUsd(b) || !isAuto(b, d)) continue;
    const start = b.start || today;
    for (let m = monthKey(start); m <= monthKey(today); m = nextMonth(m)) {
      const due = dueDate(b, m);
      if (due >= start && due <= today && !b.paidMonths.includes(m) && !(b.skipMonths || []).includes(m)) out.push(due);
    }
  }
  return out;
}
