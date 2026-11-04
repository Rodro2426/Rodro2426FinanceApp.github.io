export type Currency = 'COP' | '$' | '€' | '£';
export type AcctType = 'bank' | 'savings' | 'cash' | 'card';

export interface Pocket { id: string; name: string; emoji?: string; photo?: string | null; weeklyStr: string; hue: number }
/**
 * `rate` is an annual return (% E.A.) for bank/savings accounts, like Nu's Cajitas.
 * Interest is added daily (compound) up to `accruedTo`; `earned` is the total so far.
 */
export interface Account { id: string; name: string; kind: string; type: AcctType; bal: number; limit?: number; due?: string; hue: number; photo?: string | null; rate?: number; accruedTo?: string; earned?: number }
/** `p` is '' for expenses that don't belong to a weekly pocket (e.g. a scheduled bill). */
/** `orig` keeps the dollar amount and the TRM used when a USD subscription was converted. */
export interface FxOrig { amt: number; cur: 'USD'; rate: number; official: boolean }
export interface Expense { id: string; ts: number; p: string; a: string; amt: number; note: string; date: string; tags: string[]; cat: string; sub: string; ruleId?: string; ruleMonth?: string; orig?: FxOrig }
/** Money received into an account (from a scheduled income). */
export interface Income { id: string; ts: number; a: string; amt: number; note: string; date: string; ruleId?: string; ruleMonth?: string; interest?: boolean; orig?: FxOrig }
export interface Move { id: string; week: string; from: string; to: string; amt: number }
export interface Payment { id: string; ts: number; from: string; to: string; amt: number; date: string; ruleId?: string; ruleMonth?: string }
export type ScheduleKind = 'Income' | 'Bill' | 'Subscription' | 'CardPayment';
/**
 * Something that happens every month on `dueDay`: income, a bill or a subscription.
 * With `auto` and an account, it moves the money on the day; otherwise it is a reminder you tick off.
 * `paidMonths` are months already handled; `skipMonths` were undone and must not run again.
 */
export interface Bill {
  id: string; name: string; kind: ScheduleKind; amt: number; dueDay: number; hue: number; paidMonths: string[];
  acct?: string; auto?: boolean; start?: string; pocket?: string; cat?: string; sub?: string; skipMonths?: string[]; photo?: string | null;
  /** 'USD' = amount is in dollars and is converted with that day's TRM. */
  currency?: 'USD' | 'COP';
  /** Card payments: the card to pay (`acct` is the account it's paid from) and how much. */
  toCard?: string;
  payMode?: 'full' | 'fixed';
}
export type NotifKind = 'bill' | 'income' | 'budget' | 'card' | 'backup';
/** `id` is a stable key, so the same event never notifies twice. */
export interface Notif { id: string; date: string; ts: number; kind: NotifKind; title: string; body: string; read: boolean; dismissed: boolean; bannered: boolean }
export interface Goal { id: string; name: string; saved: number; target: number; months: number; hue: number }
export interface Category { name: string; subs: string[] }

export interface Settings { name: string; currency: Currency; weeks: 4 | 5; voiceLang: 'es-CO' | 'en-US'; profilePhoto: string | null; finnhubKey?: string; lastBackup?: string; backupDay?: number; backupReminder?: boolean }

/** One buy or sell of a stock/ETF. Prices are in the stock's own currency. */
export interface Trade { id: string; ts: number; ticker: string; name: string; currency: 'USD' | 'COP'; side: 'buy' | 'sell'; qty: number; price: number; fee: number; date: string }
/** Last known price per ticker (from Finnhub, or typed in when `manual`). */
export interface Quote { price: number; change: number; changePct: number; at: number; manual?: boolean; name?: string; logo?: string }
export interface Investments { trades: Trade[]; quotes: Record<string, Quote>; usdRate: number; usdRateAt: number; usdManual?: boolean; sim?: { amt: string; rate: string; months: string; deposit: string } }

export interface Data {
  version: 1;
  settings: Settings;
  incomeStr: string;
  pockets: Pocket[];
  accounts: Account[];
  expenses: Expense[];
  incomes: Income[];
  notifications: Notif[];
  investments: Investments;
  /** TRM per date (COP per USD), and dates whose lookup failed. */
  fx: { trm: Record<string, number>; tried: Record<string, number> };
  moves: Move[];
  payments: Payment[];
  bills: Bill[];
  goals: Goal[];
  cats: Category[];
  tags: string[];
}

export type Tab = 'home' | 'accounts' | 'budget' | 'insights' | 'calendar';

export type Sheet =
  | { name: 'search'; tag?: string | null }
  | { name: 'add'; pocket?: string }
  | { name: 'pocket'; id: string }
  | { name: 'saved'; id: string }
  | { name: 'move'; id: string; to?: string }
  | { name: 'editPocket'; id: string | null }
  | { name: 'export'; acct: string }
  | { name: 'acct'; id: string }
  | { name: 'editAcct'; id: string }
  | { name: 'addAcct' }
  | { name: 'pay'; id: string }
  | { name: 'goal'; id: string }
  | { name: 'newGoal' }
  | { name: 'settings' }
  | { name: 'schedule'; id: string | null; day?: number; kind?: ScheduleKind }
  | { name: 'notifications' }
  | { name: 'trade'; ticker?: string; side?: 'buy' | 'sell' }
  | { name: 'holding'; ticker: string }
  | { name: 'priceSettings' }
  | { name: 'txn'; kind: 'expense' | 'income'; id: string; back?: Sheet };

export interface UI {
  tab: Tab;
  sheet: Sheet | null;
  toast: string | null;
  lastAdd: { pocket: string; acct: string };
  /** A full-screen page shown over the tabs. */
  page?: 'investments' | null;
  /** First open on this device: choose sample data, a fresh start or a backup. */
  welcome?: boolean;
}
