import type { Data } from './types';
import { acctTxns, catOf, num } from './derive';
import { fmtDay, monthLabel, todayISO } from './dates';
import { buildAiSheet, type AiSheet } from './aiSheet';

export interface ExportDetail { month: string; date: string; category: string; sub: string; merchant: string; amount: number; pocket: string; account: string; tags: string; id: string }
export interface ExportPayload {
  months: string[];
  details: ExportDetail[];
  payments: { month: string; date: string; desc: string; amount: number; from: string; to: string; id: string }[];
  pockets: { name: string; planned: number; spent: number }[] | null;
  statement: { account: string; card: boolean; opening: number; closing: number; rows: { date: string; desc: string; category: string; amount: number; after: number }[] } | null;
  notes: string[];
  ai: AiSheet;
  title: string; subtitle: string; filename: string; currency: string;
}

export function allMonths(d: Data) {
  const set = new Set<string>();
  d.expenses.forEach(e => set.add(e.date.slice(0, 7)));
  d.payments.forEach(p => set.add(p.date.slice(0, 7)));
  set.add(todayISO().slice(0, 7));
  return [...set].sort();
}

export function exportData(d: Data, month: string, acctId: string): ExportPayload {
  const weeks = d.settings.weeks, today = todayISO(), curMonth = today.slice(0, 7);
  const months = month === 'all' ? allMonths(d) : [month];
  const acc = (id: string) => d.accounts.find(a => a.id === id);
  const raw = d.expenses.map(e => { const [cat, sub] = catOf(e); return { e, date: e.date, month: e.date.slice(0, 7), cat, sub }; })
    .filter(x => months.includes(x.month) && (acctId === 'all' || x.e.a === acctId));
  const catTot: Record<string, number> = {};
  raw.forEach(x => { const k = x.month + '|' + x.cat; catTot[k] = (catTot[k] || 0) + x.e.amt; });
  raw.sort((x, y) => x.month !== y.month ? (x.month < y.month ? -1 : 1) : (catTot[y.month + '|' + y.cat] - catTot[x.month + '|' + x.cat]) || x.cat.localeCompare(y.cat) || y.e.amt - x.e.amt);
  const details = raw.map((x, i) => ({
    month: x.month, date: x.date, category: x.cat, sub: x.sub, merchant: x.e.note, amount: x.e.amt,
    pocket: d.pockets.find(p => p.id === x.e.p)?.name || '', account: acc(x.e.a)?.name || '',
    tags: (x.e.tags || []).map(t => '#' + t).join(' '), id: 'G' + String(i + 1).padStart(3, '0')
  }));
  const payments = d.payments.filter(p => !p.cdt).filter(p => months.includes(p.date.slice(0, 7)) && (acctId === 'all' || p.from === acctId || p.to === acctId))
    .sort((x, y) => (x.date < y.date ? -1 : 1))
    .map((p, i) => ({ month: p.date.slice(0, 7), date: p.date, desc: 'Payment to ' + (acc(p.to)?.name || 'card'), amount: -p.amt, from: acc(p.from)?.name || '', to: acc(p.to)?.name || '', id: 'P' + (i + 1) }));
  const pockets = months.length === 1 && acctId === 'all'
    ? d.pockets.map(p => ({ name: p.name, planned: num(p.weeklyStr) * weeks, spent: details.filter(x => x.pocket === p.name).reduce((a, x) => a + x.amount, 0) }))
    : null;
  let statement: ExportPayload['statement'] = null;
  const a = acctId !== 'all' ? acc(acctId) : undefined;
  if (a) {
    const full = acctTxns(d, a.id);
    const list = full.list.filter(t => months.includes(t.date.slice(0, 7)));
    const opening = list.length ? list[list.length - 1].after - list[list.length - 1].effect : a.bal;
    const closing = list.length ? list[0].after : a.bal;
    statement = { account: a.name, card: full.card, opening, closing, rows: [...list].reverse().map(t => ({ date: t.date, desc: t.note, category: t.category, amount: t.show, after: t.after })) };
  }
  const label = monthLabel(month), accLabel = acctId === 'all' ? 'All accounts' : a?.name || '';
  const cur = d.settings.currency;
  const curName = cur === 'COP' ? 'Colombian pesos (COP)' : cur === '€' ? 'Euros' : cur === '£' ? 'Pounds' : 'Dollars';
  const endOfMonth = fmtDay(curMonth + '-01', { month: 'short' }) + ' ' + new Date(+curMonth.slice(0, 4), +curMonth.slice(5, 7), 0).getDate();
  const notes = [
    'Card payments are listed on the "Card payments" sheet and are not counted as spending.',
    months.includes(curMonth) ? `${monthLabel(curMonth)} is still in progress (closes ${endOfMonth}), so its totals are partial.` : null,
    'Categories and subcategories come from what was picked when each expense was added.',
    'Totals on this sheet are live formulas over the Details sheet.'
  ].filter((x): x is string => !!x);
  return {
    months, details, payments, pockets, statement, notes, currency: cur, ai: buildAiSheet(d, months, acctId),
    title: 'Expense summary · ' + label,
    subtitle: `${curName} · ${accLabel} · Calendar month of each transaction · Generated ${fmtDay(today, { month: 'short', day: 'numeric', year: 'numeric' })}`,
    filename: ('Pockets ' + label + (acctId === 'all' ? '' : ' - ' + accLabel)).replace(/[\\/:*?"<>|]+/g, '').trim()
  };
}

export function downloadCSV(d: ExportPayload) {
  const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = ['Month,Date,Category,Subcategory,Merchant,Amount,Pocket,Account,Tags,ID',
    ...d.details.map(x => [x.month, x.date, x.category, x.sub, x.merchant, x.amount, x.pocket, x.account, x.tags, x.id].map(esc).join(','))];
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), el = document.createElement('a');
  el.href = url; el.download = d.filename + '.csv'; document.body.appendChild(el); el.click(); el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
