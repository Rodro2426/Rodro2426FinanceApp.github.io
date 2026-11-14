// Builds the "For AI" sheet: one page with every budget and figure of the period,
// written so an AI assistant given the Excel file can answer questions about it.
import { cardDueLabel } from './cards';
import type { Data } from './types';
import { catOf, num, periodsInMonth, myExpenses, isHalf, roundAmt } from './derive';
import { addDays, daysInMonth, fmtDay, inRange, monthLabel, shortDate, todayISO, weekStart } from './dates';

export type Cell = string | number | { v: number; fmt: 'money' | 'pct' };
export interface AiSection { title: string; note?: string; header: string[]; rows: Cell[][] }
export interface AiSheet { title: string; intro: string[]; sections: AiSection[] }

const money = (v: number): Cell => ({ v, fmt: 'money' });
const pct = (v: number): Cell => ({ v, fmt: 'pct' });

export function buildAiSheet(d: Data, months: string[], acctId: string): AiSheet {
  const today = todayISO(), curMonth = today.slice(0, 7);
  const weeks = d.settings.weeks;
  const acc = (id: string) => d.accounts.find(a => a.id === id);
  const pocketName = (id: string) => (id ? d.pockets.find(p => p.id === id)?.name || 'Deleted pocket' : 'No pocket (scheduled bill)');
  const goalOrPocket = (id: string) => (id === '_income' ? 'New income' : id === '_cover' ? 'Covered the shortfall' : d.pockets.find(p => p.id === id)?.name || d.goals.find(g => g.id === id)?.name || 'Deleted');
  const period = months.length === 1 ? monthLabel(months[0]) : `${monthLabel(months[0])} to ${monthLabel(months[months.length - 1])}`;
  const acctLabel = acctId === 'all' ? 'All accounts' : acc(acctId)?.name || '';
  const cur = d.settings.currency;
  const curName = cur === 'COP' ? 'Colombian pesos (COP)' : cur === '€' ? 'euros' : cur === '£' ? 'pounds' : 'dollars';

  const exp = (acctId === 'all' ? myExpenses(d) : d.expenses).filter(e => months.includes(e.date.slice(0, 7)) && (acctId === 'all' || e.a === acctId));
  const total = exp.reduce((a, e) => a + e.amt, 0);
  const income = num(d.incomeStr);
  const weeklyTotal = d.pockets.reduce((a, p) => a + num(p.weeklyStr), 0);
  const plannedMonth = weeklyTotal * weeks;
  const incs = (d.incomes || []).filter(t => months.includes(t.date.slice(0, 7)) && (acctId === 'all' || t.a === acctId));
  const pays = d.payments.filter(p => !p.cdt && months.includes(p.date.slice(0, 7)) && (acctId === 'all' || p.from === acctId || p.to === acctId));
  const days = months.reduce((a, m) => a + (m === curMonth ? Number(today.slice(8, 10)) : daysInMonth(m)), 0);

  const intro = [
    `This workbook is an export from Pockets, ${d.settings.name}'s personal budgeting app. This sheet contains everything needed to answer questions about ${period}. Amounts are in ${curName}.`,
    'How the budget works: a monthly income is split into weekly budgets called "pockets". Weeks run Monday to Sunday. Money left in a pocket can be moved to another pocket or to a savings goal for that week. Card payments move money from a bank account to a credit card and are not spending. Scheduled items (income, bills, subscriptions) repeat every month on a set day; automatic ones add or take the money from their account on that day, and scheduled bills may not belong to any pocket.',
    `Spending figures cover ${period}${acctId === 'all' ? '' : ` and only the account "${acctLabel}"`}. Account balances, card limits, savings goals and pocket budgets are current values as of ${fmtDay(today, { month: 'long', day: 'numeric', year: 'numeric' })}.`,
    months.includes(curMonth) ? `${monthLabel(curMonth)} is still in progress, so its figures are partial (${Number(today.slice(8, 10))} of ${daysInMonth(curMonth)} days).` : '',
    'Other sheets: "Details" lists every expense (date, category, merchant, amount, pocket, account, tags), "Card payments" lists payments to cards, "Summary" has totals by month and category, and "Statement" (single account only) has the running balance.'
  ].filter(Boolean);

  const sections: AiSection[] = [];

  sections.push({
    title: 'Overview', header: ['Item', 'Value'], rows: [
      ['Period', period],
      ['Accounts included', acctLabel],
      ['Monthly income', money(income)],
      ['Weeks per month in the plan', weeks],
      ['Total of weekly pocket budgets', money(weeklyTotal)],
      [`Planned spending per month (weekly total × ${weeks})`, money(plannedMonth)],
      ['Income not assigned to pockets', money(income - plannedMonth)],
      ['Income received in the period', money(incs.reduce((a, t) => a + t.amt, 0))],
      ['Total spent in the period', money(total)],
      ['Number of expenses', exp.length],
      ['Average spent per day', money(days ? roundAmt(total / days) : 0)],
      ['Spent as % of monthly income', pct(income && months.length ? total / months.length / income : 0)],
      ['Card payments in the period (not spending)', money(pays.reduce((a, p) => a + p.amt, 0))]
    ]
  });

  // Pockets against their plan for the period.
  sections.push({
    title: 'Pockets (weekly budgets)', note: `"Planned" is the weekly budget × ${weeks} weeks × number of months.`,
    header: ['Pocket', 'Weekly budget', 'Planned for period', 'Spent', 'Left vs plan', '% used', 'Expenses', 'Top category'],
    rows: d.pockets.map(p => {
      const es = exp.filter(e => e.p === p.id), spent = es.reduce((a, e) => a + e.amt, 0);
      const planned = num(p.weeklyStr) * periodsInMonth(p, weeks) * months.length;
      const byCat: Record<string, number> = {};
      es.forEach(e => { const c = catOf(e)[0]; byCat[c] = (byCat[c] || 0) + e.amt; });
      const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
      return [p.name, money(num(p.weeklyStr)), money(planned), money(spent), money(planned - spent), pct(planned ? spent / planned : 0), es.length, top ? top[0] : ''];
    })
  });

  // Week-by-week, using the weeks (Mon–Sun) that overlap the period.
  const first = months[0] + '-01', lastM = months[months.length - 1], last = `${lastM}-${String(daysInMonth(lastM)).padStart(2, '0')}`;
  const weekRows: Cell[][] = [];
  for (let ws = weekStart(first); ws <= last && ws <= today; ws = addDays(ws, 7)) {
    const we = addDays(ws, 6), label = `${shortDate(ws)} – ${shortDate(we)}`;
    const moves = d.moves.filter(m => m.week === ws);
    d.pockets.forEach(p => {
      const nextIn = d.moves.filter(m => m.next && m.week === addDays(ws, -7) && m.to === p.id).reduce((a, m) => a + m.amt, 0);
      const budget = num(p.weeklyStr) + nextIn + moves.filter(m => m.to === p.id && !m.next).reduce((a, m) => a + m.amt, 0) - moves.filter(m => m.from === p.id).reduce((a, m) => a + m.amt, 0);
      const spent = myExpenses(d).filter(e => e.p === p.id && inRange(e.date, ws, we) && (acctId === 'all' || e.a === acctId)).reduce((a, e) => a + e.amt, 0);
      weekRows.push([label, p.name, money(budget), money(spent), money(budget - spent)]);
    });
  }
  sections.push({
    title: 'Pocket spending by week', note: 'Each week runs Monday to Sunday and counts all of its days, even ones in the next or previous month. Budget includes money moved in or out that week.',
    header: ['Week', 'Pocket', 'Budget', 'Spent', 'Left'], rows: weekRows
  });

  const group = (key: (e: (typeof exp)[number]) => string) => {
    const m: Record<string, { sum: number; n: number }> = {};
    exp.forEach(e => { const k = key(e); (m[k] ||= { sum: 0, n: 0 }); m[k].sum += e.amt; m[k].n++; });
    return Object.entries(m).sort((a, b) => b[1].sum - a[1].sum);
  };
  sections.push({
    title: 'Spending by category', header: ['Category', 'Subcategory', 'Spent', '% of period', 'Expenses'],
    rows: group(e => catOf(e).join('\u0001')).map(([k, x]) => { const [c, s] = k.split('\u0001'); return [c, s, money(x.sum), pct(total ? x.sum / total : 0), x.n]; })
  });

  const tagRows = d.tags.map(t => { const es = exp.filter(e => (e.tags || []).includes(t)); return { t, n: es.length, sum: es.reduce((a, e) => a + e.amt, 0) }; })
    .filter(x => x.n > 0).sort((a, b) => b.sum - a.sum);
  sections.push({ title: 'Spending by tag', note: 'An expense can have several tags, so these totals can overlap.', header: ['Tag', 'Spent', 'Expenses'], rows: tagRows.map(x => ['#' + x.t, money(x.sum), x.n]) });

  sections.push({
    title: 'Spending by account', header: ['Account', 'Spent', 'Expenses'],
    rows: group(e => acc(e.a)?.name || 'Deleted account').map(([k, x]) => [k, money(x.sum), x.n])
  });

  sections.push({
    title: 'Accounts and credit cards (current)', note: 'For credit cards, the balance is the amount owed.',
    header: ['Account', 'Type', 'Balance', 'Credit limit', 'Available credit', 'Payment due'],
    rows: d.accounts.map(a => a.type === 'card'
      ? [a.name, 'Credit card', money(a.bal), money(a.limit || 0), money((a.limit || 0) - a.bal), cardDueLabel(d, a, new Date().toISOString().slice(0, 10))]
      : [a.name, a.kind, money(a.bal), '', '', ''])
  });
  const assets = d.accounts.filter(a => a.type !== 'card').reduce((x, a) => x + a.bal, 0);
  const debt = d.accounts.filter(a => a.type === 'card').reduce((x, a) => x + a.bal, 0);
  sections[sections.length - 1].rows.push(['Net worth (accounts minus card debt)', '', money(assets - debt), '', '', '']);

  sections.push({
    title: 'Savings goals (current)', header: ['Goal', 'Saved', 'Target', 'Still needed', '% reached', 'Months to go', 'Needed per month'],
    rows: d.goals.map(g => { const rem = Math.max(0, g.target - g.saved); return [g.name, money(g.saved), money(g.target), money(rem), pct(g.target ? g.saved / g.target : 0), g.months, money(roundAmt(rem / Math.max(1, g.months)))]; })
  });

  sections.push({
    title: 'Scheduled income, bills and subscriptions (every month)', note: '"Automatic" items move the money on their day; the others are reminders ticked off by hand.',
    header: ['Name', 'Type', 'Amount', 'Currency', 'Day of month', 'Account', 'Automatic', 'Pocket', ...months.map(m => `Done in ${monthLabel(m)}`)],
    rows: d.bills.map(b => [b.kind === 'CardPayment' ? `${b.name} (to ${acc(b.toCard || '')?.name || 'card'})` : b.name, b.kind === 'CardPayment' ? 'Card payment' : b.kind, b.kind === 'CardPayment' && b.payMode !== 'fixed' ? 'Minimum payment' : b.currency === 'USD' ? b.amt : money(b.amt), b.currency === 'USD' ? 'USD (converted with the TRM of the day it runs)' : cur, b.dueDay, acc(b.acct || '')?.name || '', b.notMine ? 'No (paid by someone else)' : b.auto && b.acct ? 'Yes' : 'No', b.pocket ? pocketName(b.pocket) : '', ...months.map(m => (b.paidMonths.includes(m) ? 'Yes' : 'No'))])
  });
  sections.push({
    title: 'Income received', header: ['Date', 'Description', 'Account', 'Amount'],
    rows: [...incs].sort((a, b) => (a.date < b.date ? -1 : 1)).map(t => [t.date, t.note, acc(t.a)?.name || '', money(t.amt)])
  });

  const periodWeeks = new Set(weekRows.map(r => r[0]));
  const moves = d.moves.filter(m => periodWeeks.has(`${shortDate(m.week)} – ${shortDate(addDays(m.week, 6))}`));
  sections.push({
    title: 'Money moved between pockets and goals', header: ['Week', 'From', 'To', 'Amount'],
    rows: moves.map(m => [`${shortDate(m.week)} – ${shortDate(addDays(m.week, 6))}`, goalOrPocket(m.from), m.next ? `${goalOrPocket(m.to)} (${isHalf(d.pockets.find(p => p.id === m.to)) ? 'next quincena' : 'next week'})` : goalOrPocket(m.to), money(m.amt)])
  });

  sections.push({
    title: 'Largest expenses', note: 'The full list is on the "Details" sheet.', header: ['Date', 'Merchant / description', 'Pocket', 'Category', 'Account', 'Amount'],
    rows: [...exp].sort((a, b) => b.amt - a.amt).slice(0, 10).map(e => [e.date, e.note, pocketName(e.p), catOf(e).join(' › '), acc(e.a)?.name || '', money(e.amt)])
  });

  return { title: `For AI · everything about ${period}`, intro, sections };
}
