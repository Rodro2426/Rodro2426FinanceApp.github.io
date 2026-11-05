export type Currency = 'COP' | '$' | '€' | '£';
export type AcctType = 'bank' | 'savings' | 'cash' | 'card';

/** `days` are the weekdays the pocket is spent on (0 = Monday … 6 = Sunday); missing = every day. */
export interface Pocket { id: string; name: string; emoji?: string; photo?: string | null; weeklyStr: string; hue: number; days?: number[] }
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
/** `inBase`: an extra income already counted in the typed monthly income, so it isn't added again. */
export interface Income { id: string; ts: number; a: string; amt: number; note: string; date: string; ruleId?: string; ruleMonth?: string; interest?: boolean; orig?: FxOrig; inBase?: boolean; /** Income category (Salary, Freelance…). */ cat?: string }
/**
 * Money moved into or out of a pocket for one week (`week` = its Monday).
 * With `month`, it was income split for the whole month: it's spread evenly over `spread` weeks starting at `week`.
 */
export interface Move { id: string; week: string; from: string; to: string; amt: number; month?: string; spread?: number; /** The income it was split from. */ income?: string }
/** A transfer between accounts (card payments), or into/out of a CDT when `cdt` is set (then `from`/`to` is 'cdt:<id>'). */
export interface Payment { id: string; ts: number; from: string; to: string; amt: number; date: string; ruleId?: string; ruleMonth?: string; cdt?: string }
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
  /** Someone else pays it (e.g. a shared plan): listed for reference, but never charged, reminded or counted. */
  notMine?: boolean;
}
export type NotifKind = 'bill' | 'income' | 'budget' | 'card' | 'backup';
/** `id` is a stable key, so the same event never notifies twice. */
export interface Notif { id: string; date: string; ts: number; kind: NotifKind; title: string; body: string; read: boolean; dismissed: boolean; bannered: boolean }
export interface Goal { id: string; name: string; saved: number; target: number; months: number; hue: number }
export interface Category { name: string; subs: string[] }

export interface Settings { name: string; currency: Currency; weeks: 4 | 5; voiceLang: 'es-CO' | 'en-US'; profilePhoto: string | null; finnhubKey?: string; lastBackup?: string; backupDay?: number; backupReminder?: boolean; tourSeen?: boolean }

/** One buy or sell of a stock/ETF. Prices are in the stock's own currency. */
export interface Trade { id: string; ts: number; ticker: string; name: string; currency: 'USD' | 'COP'; side: 'buy' | 'sell'; qty: number; price: number; fee: number; date: string }
/** Last known price per ticker (from Finnhub, or typed in when `manual`). */
export interface Quote { price: number; change: number; changePct: number; at: number; manual?: boolean; name?: string; logo?: string }
/**
 * A CDT (term deposit). `rate` is % E.A.; interest is paid at maturity or every `payout` days.
 * `acct` is where the money came from and where interest/maturity money goes.
 * `paid` counts periodic interest payments already made; `closed` is set once cashed out or renewed.
 */
export type CdtPayout = 'end' | 'monthly' | 'quarterly' | 'semiannual';
export interface Cdt { id: string; ts: number; bank: string; amount: number; rate: number; days: number; start: string; payout: CdtPayout; withholding: boolean; acct?: string; hue: number; paid?: number; closed?: { date: string; how: 'cashout' | 'renew'; amt: number }; renewedFrom?: string }
export interface Investments { cdts?: Cdt[]; trades: Trade[]; quotes: Record<string, Quote>; usdRate: number; usdRateAt: number; usdManual?: boolean; sim?: { amt: string; rate: string; months: string; deposit: string } }

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

export type PocketView = 'day' | 'week' | 'month';
export type Tab = 'home' | 'accounts' | 'budget' | 'insights' | 'calendar';

export type Sheet =
  | { name: 'search'; tag?: string | null; cat?: string | null }
  | { name: 'add'; pocket?: string; mode?: 'expense' | 'income' }
  | { name: 'pocket'; id: string; view?: PocketView }
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
  | { name: 'cdt'; id?: string | null }
  | { name: 'cdtInfo'; id: string }
  | { name: 'reconcile' }
  | { name: 'priceSettings' }
  | { name: 'txn'; kind: 'expense' | 'income'; id: string; back?: Sheet };

export interface UI {
  tab: Tab;
  sheet: Sheet | null;
  toast: string | null;
  lastAdd: { pocket: string; acct: string };
  /** A full-screen page shown over the tabs. */
  page?: 'investments' | `report:${string}` | null;
  /** First open on this device: choose sample data, a fresh start or a backup. */
  welcome?: boolean;
  /** Home-screen install guide: shown in iPhone Safari, or opened from Profile. */
  install?: false | 'auto' | 'profile';
  /** The guided tour, running on a practice copy of the data. */
  tour?: { step: number; mode: 'first' | 'replay' } | null;
}
