// Quick add from an iPhone Shortcut. The Shortcut asks for a pocket and an amount (iPhone pop-ups, no app opened) and
// drops the expense in a private inbox on the Pockets Worker. When Pockets opens it collects the inbox and saves each
// item as a normal expense. The inbox is locked by a long random key that only this person's devices know.
import type { Data, Expense } from './types';
import { iso } from './dates';
import { catOf, chargeAccount } from './derive';

export interface InboxItem { id: string; amt: number; pocket?: string; note?: string; account?: string; category?: string; ts: number }

/** A new private key: 32 random hex characters. */
export function newQuickKey(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/** What the Shortcut shows in its lists: pocket names (plus "no pocket"), account names and categories. */
export function quickMenu(d: Data, lang: 'en' | 'es') {
  return {
    pockets: [...d.pockets.map(p => p.name), lang === 'es' ? 'Sin bolsillo' : 'No pocket'],
    accounts: d.accounts.filter(a => !a.notMine).map(a => a.name),
    cats: d.cats.map(k => k.name),
    lang
  };
}

const same = (a = '', b = '') => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The account Shortcut expenses are paid from: the chosen one, else the first bank account, else the first account. */
export function quickAccount(d: Data): string {
  const chosen = d.settings.quickAdd?.acct;
  if (chosen && d.accounts.some(a => a.id === chosen)) return chosen;
  return (d.accounts.find(a => a.type === 'bank' && !a.notMine) ?? d.accounts.find(a => !a.notMine) ?? d.accounts[0])?.id ?? '';
}

/**
 * Turns inbox items into expenses, exactly like adding one by hand (the account is charged).
 * - Pocket: matched by name; "No pocket" or an unknown name saves it without a pocket.
 * - Category: the one sent if it exists; else the last category used in that pocket; else the last one used anywhere.
 * - Date: the day it was sent, in this phone's time zone.
 * Items already imported (same id) are skipped, so a repeated collect never doubles an expense.
 */
export function importInbox(d: Data, items: InboxItem[]): { patch: Partial<Data> | null; added: Expense[] } {
  const known = new Set(d.expenses.map(e => e.id));
  const latest = [...d.expenses].sort((a, b) => b.ts - a.ts);
  let accounts = d.accounts;
  const added: Expense[] = [];
  for (const it of [...items].sort((a, b) => a.ts - b.ts)) {
    const id = `eq-${it.id}`, amt = Math.round(Number(it.amt) * 100) / 100;
    if (known.has(id) || !(amt > 0)) continue;
    const p = d.pockets.find(x => same(x.name, it.pocket))?.id ?? '';
    const a = d.accounts.find(x => same(x.name, it.account))?.id ?? quickAccount(d);
    const sent = d.cats.find(k => same(k.name, it.category));
    const prev = latest.find(e => e.p === p && p) ?? latest[0];
    const [cat, sub] = sent ? [sent.name, ''] : prev ? catOf(prev) : [d.cats[0]?.name ?? 'Other', ''];
    const note = (it.note || '').trim() || (sub && sub !== 'General' ? sub : cat);
    added.push({ id, ts: it.ts, p, a, amt, note, date: iso(new Date(it.ts)), tags: [], cat, sub });
    accounts = chargeAccount(accounts, a, amt);
    known.add(id);
  }
  return added.length ? { patch: { expenses: [...added.reverse(), ...d.expenses], accounts }, added } : { patch: null, added };
}
