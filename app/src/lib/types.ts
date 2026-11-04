export type Currency = 'COP' | '$' | '€' | '£';
export type AcctType = 'bank' | 'savings' | 'cash' | 'card';

export interface Pocket { id: string; name: string; emoji?: string; photo?: string | null; weeklyStr: string; hue: number }
export interface Account { id: string; name: string; kind: string; type: AcctType; bal: number; limit?: number; due?: string; hue: number; photo?: string | null }
export interface Expense { id: string; ts: number; p: string; a: string; amt: number; note: string; date: string; tags: string[]; cat: string; sub: string }
export interface Move { id: string; week: string; from: string; to: string; amt: number }
export interface Payment { id: string; ts: number; from: string; to: string; amt: number; date: string }
export interface Bill { id: string; name: string; kind: 'Subscription' | 'Bill'; amt: number; dueDay: number; hue: number; paidMonths: string[] }
export interface Goal { id: string; name: string; saved: number; target: number; months: number; hue: number }
export interface Category { name: string; subs: string[] }

export interface Settings { name: string; currency: Currency; weeks: 4 | 5; voiceLang: 'es-CO' | 'en-US'; profilePhoto: string | null }

export interface Data {
  version: 1;
  settings: Settings;
  incomeStr: string;
  pockets: Pocket[];
  accounts: Account[];
  expenses: Expense[];
  moves: Move[];
  payments: Payment[];
  bills: Bill[];
  goals: Goal[];
  cats: Category[];
  tags: string[];
}

export type Tab = 'home' | 'accounts' | 'budget' | 'insights';

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
  | { name: 'settings' };

export interface UI {
  tab: Tab;
  sheet: Sheet | null;
  toast: string | null;
  lastAdd: { pocket: string; acct: string };
}
