// Apple Pay purchases from an iPhone Shortcut. An iPhone "Transaction" automation runs when you pay with Apple Pay, asks
// which pocket (an iPhone pop-up) and drops the amount, store and card in a private inbox on the Pockets Worker. When
// Pockets opens it collects the inbox and saves each item as a normal expense. The inbox is locked by a long random key
// that only this person's devices know.
import type { Data, Expense } from './types';
import { iso } from './dates';
import { catOf, chargeAccount } from './derive';
import { tr } from './i18n';

export interface InboxItem { id: string; amt: number; pocket?: string; note?: string; account?: string; category?: string; /** The Wallet card's name. */ card?: string; ts: number }

/** A new private key: 32 random hex characters. */
export function newQuickKey(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * The categories the Shortcut offers after the pocket: the pinned ones (in the order pinned), else the last 6 used,
 * else the first 6. A short list, because it pops up at the checkout.
 */
export function shortcutCats(d: Data): string[] {
  const names = d.cats.map(k => k.name);
  const pinned = (d.settings.quickAdd?.pins ?? []).filter(n => names.includes(n));
  if (pinned.length) return pinned;
  const used: string[] = [];
  for (const e of [...d.expenses].sort((a, b) => b.ts - a.ts)) {
    const c = catOf(e)[0];
    if (names.includes(c) && !used.includes(c)) used.push(c);
    if (used.length === 6) break;
  }
  return used.length ? used : names.slice(0, 6);
}

/** What the Shortcut shows in its lists: pocket names (plus "no pocket"), account names and the short category list. */
export function quickMenu(d: Data, lang: 'en' | 'es') {
  return {
    // Names as the person sees them in the app (built-in names are stored in English); importInbox matches both.
    pockets: [...d.pockets.map(p => shown(p.name, lang)), lang === 'es' ? 'Sin bolsillo' : 'No pocket'],
    accounts: d.accounts.filter(a => !a.notMine).map(a => shown(a.name, lang)),
    cats: shortcutCats(d).map(n => shown(n, lang)),
    lang
  };
}

const shown = (name: string, lang: 'en' | 'es') => (lang === 'es' ? tr(name) : name);
const same = (a = '', b = '') => a.trim().toLowerCase() === b.trim().toLowerCase();
/** A stored name matches what the Shortcut sent, in English or as shown in Spanish. */
const named = (name: string, sent = '') => same(name, sent) || same(tr(name), sent);

/** The account a purchase is paid from when its card isn't linked yet: the chosen one, else the first bank account, else the first account. */
export function quickAccount(d: Data): string {
  const chosen = d.settings.quickAdd?.acct;
  if (chosen && d.accounts.some(a => a.id === chosen)) return chosen;
  return (d.accounts.find(a => a.type === 'bank' && !a.notMine) ?? d.accounts.find(a => !a.notMine) ?? d.accounts[0])?.id ?? '';
}

/**
 * Turns inbox items into expenses, exactly like adding one by hand (the account is charged).
 * - Pocket: matched by name; "No pocket" or an unknown name saves it without a pocket.
 * - Account: the one sent by name; else the Wallet card's account (cardAccount). New cards are remembered so they can be
 *   linked to another account in the Apple Pay screen.
 * - Category: the one sent if it exists; else the last one used at the same store; else the last one used in that
 *   pocket; else the last one used anywhere.
 * - Date: the day it was sent, in this phone's time zone.
 * Items already imported (same id) are skipped, so a repeated collect never doubles an expense.
 */
/**
 * The account for a Wallet card: the one it was linked to; else an account whose name is in the card's name or the
 * other way round ("Visa Davivienda" → "Davivienda"); else the default account.
 */
export function cardAccount(d: Data, card = ''): string {
  const linked = d.settings.quickAdd?.cards?.[card.trim()];
  if (linked && d.accounts.some(a => a.id === linked)) return linked;
  const c = card.trim().toLowerCase();
  const byName = c ? d.accounts.find(a => !a.notMine && a.name.trim() && (c.includes(a.name.trim().toLowerCase()) || a.name.trim().toLowerCase().includes(c))) : undefined;
  return byName?.id ?? quickAccount(d);
}

export function importInbox(d: Data, items: InboxItem[]): { patch: Partial<Data> | null; added: Expense[] } {
  const known = new Set(d.expenses.map(e => e.id));
  const latest = [...d.expenses].sort((a, b) => b.ts - a.ts);
  let accounts = d.accounts;
  const cards = { ...(d.settings.quickAdd?.cards ?? {}) };
  const added: Expense[] = [];
  for (const it of [...items].sort((a, b) => a.ts - b.ts)) {
    const id = `eq-${it.id}`, amt = Math.round(Number(it.amt) * 100) / 100;
    if (known.has(id) || !(amt > 0)) continue;
    const p = d.pockets.find(x => named(x.name, it.pocket))?.id ?? '';
    const a = d.accounts.find(x => named(x.name, it.account))?.id ?? cardAccount(d, it.card);
    const card = (it.card || '').trim();
    if (card && !cards[card]) cards[card] = a;
    const sent = d.cats.find(k => named(k.name, it.category));
    const prev = (it.note ? latest.find(e => same(e.note, it.note)) : undefined) ?? latest.find(e => e.p === p && p) ?? latest[0];
    const [cat, sub] = sent ? [sent.name, ''] : prev ? catOf(prev) : [d.cats[0]?.name ?? 'Other', ''];
    const note = (it.note || '').trim() || (sub && sub !== 'General' ? sub : cat);
    added.push({ id, ts: it.ts, p, a, amt, note, date: iso(new Date(it.ts)), tags: [], cat, sub });
    accounts = chargeAccount(accounts, a, amt);
    known.add(id);
  }
  if (!added.length) return { patch: null, added };
  const qa = d.settings.quickAdd;
  const settings = qa && Object.keys(cards).length !== Object.keys(qa.cards ?? {}).length ? { ...d.settings, quickAdd: { ...qa, cards } } : undefined;
  return { patch: { expenses: [...added.reverse(), ...d.expenses], accounts, ...(settings ? { settings } : {}) }, added };
}
