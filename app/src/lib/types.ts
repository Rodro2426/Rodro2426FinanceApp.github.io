export type Currency = 'COP' | '$' | '€' | '£';
export type AcctType = 'bank' | 'savings' | 'cash' | 'card';

/** `days` are the weekdays the pocket is spent on (0 = Monday … 6 = Sunday); missing = every day. */
/**
 * `weeklyStr` is the budget for one period: a week (Monday–Sunday), or with `period: 'half'` a quincena (1st–15th, 16th–end).
 * `start`: a pocket created partway through a period gets `amt` for that first period only (`from` = that period's first day).
 */
export interface Pocket { id: string; name: string; emoji?: string; photo?: string | null; weeklyStr: string; hue: number; days?: number[]; period?: 'week' | 'half'; start?: { from: string; amt: number }; /** Carry over: the first day of the period in which the switch was turned on. What's left (or overspent) in each period then moves into the next one. Missing = off. */ carry?: string }
/**
 * `rate` is an annual return (% E.A.) for bank/savings accounts, like Nu's Cajitas.
 * Interest is added daily (compound) up to `accruedTo`; `earned` is the total so far.
 */
export interface Account { id: string; name: string; kind: string; type: AcctType; bal: number; limit?: number; due?: string; hue: number; photo?: string | null; rate?: number; accruedTo?: string; earned?: number; /** Credit card: a photo of the card's design, used as its background (card-shaped). */ cardImg?: string | null; /** Text on the card design: white or dark. */ cardText?: 'light' | 'dark'; /** Someone else's account or card: left out of net worth, and what's paid with it isn't your spending. */ notMine?: boolean }
/** `p` is '' for expenses that don't belong to a weekly pocket (e.g. a scheduled bill). */
/** `orig` keeps the dollar amount and the TRM used when a USD subscription was converted. */
export interface FxOrig { amt: number; cur: 'USD'; rate: number; official: boolean }
export interface Expense { id: string; ts: number; p: string; a: string; amt: number; note: string; date: string; tags: string[]; cat: string; sub: string; ruleId?: string; ruleMonth?: string; orig?: FxOrig; /** One purchase split across categories: every part shares this id. */ split?: string }
/** Money received into an account (from a scheduled income). */
/** `inBase`: an extra income already counted in the typed monthly income, so it isn't added again. */
export interface Income { id: string; ts: number; a: string; amt: number; note: string; date: string; ruleId?: string; ruleMonth?: string; interest?: boolean; orig?: FxOrig; inBase?: boolean; /** Income category (Salary, Freelance…). */ cat?: string }
/**
 * Money moved into or out of a pocket for one week (`week` = its Monday).
 * With `month`, it was income split for the whole month: it's spread evenly over `spread` weeks starting at `week`.
 */
export interface Move { id: string; week: string; /** The day it was made (pockets that reset every 15 days use it). */ day?: string; from: string; to: string; amt: number; month?: string; spread?: number; /** The income it was split from. */ income?: string; /** "Send to next week": `from` and `to` are both the pocket. It leaves the pocket in the period it was made and arrives in the pocket's following period. */ next?: boolean }
/** A transfer between accounts (card payments), or into/out of a CDT when `cdt` is set (then `from`/`to` is 'cdt:<id>'). */
export interface Payment { id: string; ts: number; from: string; to: string; amt: number; date: string; ruleId?: string; ruleMonth?: string; cdt?: string; /** Money into or out of an investment fund. */ fund?: string }
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
  /** Lock-screen notifications for this event: a time ("HH:MM") the day before and on the day; null = off. Missing = 09:00 the day before and 08:00 on the day. */
  notify?: { before?: string | null; day?: string | null };
}
export type NotifKind = 'bill' | 'income' | 'budget' | 'card' | 'backup' | 'trip' | 'dm' | 'reminder';
/** Your own reminder (lib/customReminders.ts). `time` is "HH:MM"; `days` are weekdays, 0 = Monday … 6 = Sunday. */
export interface CustomReminder { id: string; title: string; body: string; time: string; days: number[]; on: boolean }
/** `id` is a stable key, so the same event never notifies twice. */
export interface Notif { id: string; date: string; ts: number; kind: NotifKind; title: string; body: string; read: boolean; dismissed: boolean; bannered: boolean; /** Trip or direct-message activity: tapping opens the chat, the expense or the conversation (dm = friend's id). */ link?: { trip?: string; chat?: boolean; item?: string; dm?: string } }
export interface Goal { id: string; name: string; saved: number; target: number; months: number; hue: number }
export interface Category { name: string; subs: string[] }

/** Something you own (or owe) that isn't a bank account, valued by hand: an apartment, a car, a mortgage. */
export interface AssetItem { id: string; name: string; value: number; debt?: boolean; note?: string; updated: string }
/** A custom group in Accounts, like Real estate or Vehicles. */
export interface AssetGroup { id: string; name: string; emoji: string; hue: number; inNetWorth: boolean; items: AssetItem[] }

export interface Settings { /** Count what people owe you in net worth (Friends & trips → Debts). */ owedInNetWorth?: boolean; name: string; currency: Currency; weeks: 4 | 5; voiceLang: 'es-CO' | 'en-US'; profilePhoto: string | null; finnhubKey?: string; lastBackup?: string; backupDay?: number; backupReminder?: boolean; tourSeen?: boolean; /** Leave stocks and CDTs out of net worth. */ excludeInvestments?: boolean; /** Appearance: follow the iPhone, or always light/dark. */ theme?: 'system' | 'light' | 'dark'; /** Edit layout: block order and hidden blocks per page. */ layouts?: Record<string, { order: string[]; hidden: string[] }>; /** Folded section titles (e.g. on Accounts). */ folded?: string[]; /** Background color chosen by the user, one for light and one for dark mode (hex). */ bg?: { light?: string; dark?: string }; /** Your own GIPHY key for GIF search in trip chats. */ giphyKey?: string }

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
/** Kind of investment fund (in Colombia, a "fondo de inversión colectiva", voluntary pension or severance fund). */
export type FundKind = 'vista' | 'fixed' | 'stocks' | 'balanced' | 'realestate' | 'pension' | 'severance' | 'other';
export type FundRisk = 'low' | 'medium' | 'high';
/** Money in or out of a fund, or a balance read from the fund's statement ('value'). */
export interface FundMove { id: string; date: string; kind: 'in' | 'out' | 'value'; amt: number; acct?: string; note?: string }
export interface Fund {
  id: string; ts: number; name: string; manager: string; kind: FundKind; risk: FundRisk; currency: 'COP' | 'USD'; hue: number;
  /** Recent yearly return, % effective annual, after the fund's fee (what statements and fact sheets show). Used to estimate growth between statements. */
  rate?: number;
  /** Yearly management fee (comisión de administración), %. Informational: the reported return already has it taken out. */
  fee?: number;
  /** 'vista' = withdraw any day; 'lock' = minimum stay (pacto de permanencia) of lockDays. */
  liquidity: 'vista' | 'lock'; lockDays?: number;
  /** Business days until a withdrawal reaches your account. */
  settleDays?: number;
  minAmount?: number; units?: number; notes?: string;
  start: string; moves: FundMove[]; closed?: string;
}
export interface Investments { funds?: Fund[]; cdts?: Cdt[]; trades: Trade[]; quotes: Record<string, Quote>; usdRate: number; usdRateAt: number; /** Euros and pounds per US dollar (for apps in € or £). */ fxPerUsd?: { EUR: number; GBP: number }; usdManual?: boolean; sim?: { amt: string; rate: string; months: string; deposit: string } }

/** A payment back on a debt: money into your account (they paid you) or out of it (you paid them). */
export interface DebtPay { id: string; ts: number; amt: number; date: string; acct?: string }
/**
 * Money between you and one person. `owed`: they owe you (you lent it, or paid for them). `owe`: you owe them.
 * `acct` is the account the money left (owed) or arrived in (owe); none = no account changes.
 * `due` is when it should be paid back. `friend` links a friend with a Pockets account (their uid).
 */
export interface Debt {
  id: string; ts: number; dir: 'owed' | 'owe'; name: string; friend?: string; amt: number; date: string; due?: string; acct?: string; note?: string; pays: DebtPay[];
  /** Shared with `friend` (lib/debtShare.ts): waiting for them, accepted, declined, or no longer shared (they deleted it). */
  share?: 'pending' | 'accepted' | 'declined' | 'gone';
  /** When this phone last matched the shared copy (its updatedAt). */
  sync?: number;
}

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
  /** Custom groups of assets and debts. */
  groups?: AssetGroup[];
  /** Money between you and one person (Friends & trips → Debts). */
  debts?: Debt[];
  /** Your own reminders (Calendar → Reminders). */
  reminders?: CustomReminder[];
  /** Trip expenses already added to your budget ("tripId:itemId"). */
  tripLogged?: string[];
  /** TRM per date (COP per USD), and dates whose lookup failed. */
  fx: { trm: Record<string, number>; tried: Record<string, number> };
  moves: Move[];
  payments: Payment[];
  bills: Bill[];
  goals: Goal[];
  cats: Category[];
  /** Income categories you can pick (edited in the Categories hub). Missing = the built-in list, INCOME_CATS. */
  incCats?: string[];
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
  | { name: 'cover' }
  | { name: 'refill'; id: string }
  | { name: 'fund'; id: string | null }
  | { name: 'fundInfo'; id: string }
  | { name: 'fundMove'; id: string; kind: 'in' | 'out' | 'value' }
  | { name: 'editPocket'; id: string | null }
  | { name: 'export'; acct: string }
  | { name: 'acct'; id: string }
  | { name: 'editAcct'; id: string }
  | { name: 'addAcct' }
  | { name: 'debt'; id: string | null; dir?: 'owed' | 'owe'; friend?: { uid: string; name: string } }
  | { name: 'debtPay'; id: string }
  | { name: 'pay'; id: string }
  | { name: 'goal'; id: string }
  | { name: 'newGoal' }
  | { name: 'settings' }
  | { name: 'reminder'; id: string | null }
  | { name: 'schedule'; id: string | null; day?: number; kind?: ScheduleKind }
  | { name: 'notifications' }
  | { name: 'trade'; ticker?: string; side?: 'buy' | 'sell' }
  | { name: 'holding'; ticker: string }
  | { name: 'cdt'; id?: string | null }
  | { name: 'cdtInfo'; id: string }
  | { name: 'reconcile' }
  | { name: 'cloud' }
  | { name: 'tripNew' }
  | { name: 'tripPeople'; trip: string }
  | { name: 'tripItem'; trip: string; id: string | null; payment?: { from: string; to: string; amount: number } }
  | { name: 'group'; id: string | null }
  | { name: 'groupItem'; group: string; id: string | null }
  | { name: 'priceSettings' }
  | { name: 'txn'; kind: 'expense' | 'income'; id: string; back?: Sheet };

export interface UI {
  tab: Tab;
  sheet: Sheet | null;
  toast: string | null;
  lastAdd: { pocket: string; acct: string };
  /** A full-screen page shown over the tabs. */
  page?: 'investments' | 'social' | 'categories' | 'reports' | `report:${string}` | `trip:${string}` | `tripstats:${string}` | `tripchat:${string}` | `dm:${string}` | null;
  /** First open on this device: choose sample data, a fresh start or a backup. */
  welcome?: boolean;
  /** Home-screen install guide: shown in iPhone Safari, or opened from Profile. */
  install?: false | 'auto' | 'profile';
  /** The guided tour, running on a practice copy of the data. */
  tour?: { step: number; mode: 'first' | 'replay' } | null;
}
