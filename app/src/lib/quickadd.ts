// Apple Pay purchases from an iPhone Shortcut. An iPhone "Transaction" automation runs when you pay with Apple Pay, asks
// which pocket (an iPhone pop-up) and drops the amount, store and card in a private inbox on the Pockets Worker. When
// Pockets opens it collects the inbox and saves each item as a normal expense. The inbox is locked by a long random key
// that only this person's devices know.
import type { Data, Expense, Notif } from './types';
import { iso } from './dates';
import { catOf, chargeAccount, fmt } from './derive';
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

/** "PAYU*EXITO 0123" and "PAYU*EXITO 0456" are the same store: lower case, without numbers or extra signs. */
export const storeKey = (raw: string) => raw.toLowerCase().replace(/[\d*#_-]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * The person's other purchases from the same store, renamed too. Only the ones still carrying a name Pockets gave
 * them (the name as it arrived, or the previously learned one); a purchase they named differently by hand stays.
 */
export function renameStorePurchases(expenses: Expense[], e: Expense, name: string, before?: string): Expense[] {
  const key = e.store ? storeKey(e.store) : '', clean = name.trim();
  if (!key || !clean) return expenses;
  return expenses.map(y => (y.id !== e.id && y.store && storeKey(y.store) === key && (y.note === y.store || (!!before && y.note === before)) ? { ...y, note: clean } : y));
}

/** Settings after the person renamed an Apple Pay expense: the next purchases from that store get the new name. */
export function learnStoreName(d: Data, e: Expense, name: string): Data['settings'] | null {
  const qa = d.settings.quickAdd, key = e.store ? storeKey(e.store) : '', clean = name.trim();
  if (!qa || !key || !clean || clean === e.note || qa.names?.[key] === clean) return null;
  return { ...d.settings, quickAdd: { ...qa, names: { ...qa.names, [key]: clean } } };
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
 * - Account: the one sent by name; else the Wallet card's account (cardAccount). A card Pockets doesn't know is saved
 *   with no account (nothing is charged) and remembered as not linked; one notice asks which account it is, and the
 *   answer applies to its next purchases (and, if chosen, to the ones waiting). No card name at all: no account either.
 * - Category: the one sent if it exists; else the last one used at the same store; else the last one used in that
 *   pocket; else the last one used anywhere.
 * - Date: the day it was sent, in this phone's time zone.
 * Items already imported (same id) are skipped, so a repeated collect never doubles an expense.
 */
/**
 * The account for a Wallet card: the one it was linked to; else an account whose name is in the card's name or the
 * other way round ("Visa Davivienda" → "Davivienda"); else "" (Pockets doesn't know the card yet).
 */
export function cardAccount(d: Data, card = ''): string {
  const linked = d.settings.quickAdd?.cards?.[card.trim()];
  if (linked && d.accounts.some(a => a.id === linked)) return linked;
  const c = card.trim().toLowerCase();
  const byName = c ? d.accounts.find(a => !a.notMine && a.name.trim() && (c.includes(a.name.trim().toLowerCase()) || a.name.trim().toLowerCase().includes(c))) : undefined;
  return byName?.id ?? '';
}

/** Purchases from a card that weren't put on an account yet (it wasn't known when they came in). */
export const waitingFor = (d: Data, card: string) => d.expenses.filter(e => e.card === card && !d.accounts.some(a => a.id === e.a));

/**
 * Says which account a Wallet card is: its next purchases go there. With `alsoWaiting`, the purchases already saved
 * from it without an account are put on it too (and the account is charged). Its "which account?" notice goes away.
 */
export function linkCard(d: Data, card: string, acct: string, alsoWaiting = true): Partial<Data> {
  const qa = d.settings.quickAdd;
  const waiting = alsoWaiting ? new Set(waitingFor(d, card).map(e => e.id)) : new Set<string>();
  let accounts = d.accounts;
  const expenses = d.expenses.map(e => { if (!waiting.has(e.id)) return e; accounts = chargeAccount(accounts, acct, e.amt); return { ...e, a: acct }; });
  return {
    accounts, expenses,
    notifications: d.notifications.map(n => (n.kind === 'applecard' && n.card === card ? { ...n, read: true, dismissed: true } : n)),
    ...(qa ? { settings: { ...d.settings, quickAdd: { ...qa, cards: { ...qa.cards, [card]: acct } } } } : {})
  };
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
    const card = (it.card || '').trim();
    const a = d.accounts.find(x => named(x.name, it.account))?.id ?? cardAccount(d, card);
    const raw = (it.note || '').trim(), learned = raw ? d.settings.quickAdd?.names?.[storeKey(raw)] : undefined;
    if (card && cards[card] === undefined) cards[card] = a; // "" = seen, waiting to be linked
    const sent = d.cats.find(k => named(k.name, it.category));
    const prev = (raw ? latest.find(e => same(e.note, learned ?? raw) || (!!e.store && storeKey(e.store) === storeKey(raw))) : undefined) ?? latest.find(e => e.p === p && p) ?? latest[0];
    const [cat, sub] = sent ? [sent.name, ''] : prev ? catOf(prev) : [d.cats[0]?.name ?? 'Other', ''];
    const note = learned || raw || (sub && sub !== 'General' ? sub : cat);
    added.push({ id, ts: it.ts, p, a, amt, note, date: iso(new Date(it.ts)), tags: [], cat, sub, ...(raw ? { store: raw } : {}), ...(card ? { card } : {}) });
    if (a) accounts = chargeAccount(accounts, a, amt);
    known.add(id);
  }
  if (!added.length) return { patch: null, added };
  const qa = d.settings.quickAdd;
  // One notice per purchase so the person can fix a store name like "PAYU*EXITO 0123" (unless they turned it off).
  const notes: Notif[] = qa?.review === false ? [] : added.map(e => ({
    id: `nq-${e.id}`, date: iso(new Date()), ts: Date.now(), kind: 'applepay', txn: e.id, read: false, dismissed: false, bannered: false,
    title: `Apple Pay · ${fmt(e.amt)}`, body: `${e.note}. Tap to check it or fix the name.`
  }));
  // One notice per card Pockets doesn't know yet (not one per purchase), unless one is already waiting.
  const asked = new Set(d.notifications.filter(n => n.kind === 'applecard' && !n.dismissed).map(n => n.card));
  const unknown = [...new Set(added.filter(e => e.card && !e.a).map(e => e.card!))].filter(c => !asked.has(c));
  const cardNotes: Notif[] = unknown.map(c => ({
    id: `nqc-${c}-${Date.now()}`, date: iso(new Date()), ts: Date.now(), kind: 'applecard', card: c, read: false, dismissed: false, bannered: false,
    title: `New card: ${c}`, body: 'A purchase was saved without an account. Tap to say which account this card is.'
  }));
  const allNotes = [...cardNotes, ...notes];
  const settings = qa && JSON.stringify(cards) !== JSON.stringify(qa.cards ?? {}) ? { ...d.settings, quickAdd: { ...qa, cards } } : undefined;
  return { patch: { expenses: [...added.reverse(), ...d.expenses], accounts, ...(settings ? { settings } : {}), ...(allNotes.length ? { notifications: [...allNotes, ...d.notifications] } : {}) }, added };
}
