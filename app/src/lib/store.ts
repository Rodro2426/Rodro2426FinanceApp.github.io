import { useSyncExternalStore } from 'react';
import { get, set } from 'idb-keyval';
import type { Data, UI } from './types';
import { sampleData } from './seed';

const KEY = 'pockets-data-v1';

export interface State { data: Data; ui: UI }

let state: State = {
  data: sampleData(),
  ui: { tab: 'home', sheet: null, toast: null, lastAdd: { pocket: 'groc', acct: 'a1' } }
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { set(KEY, state.data).catch(err => console.warn('Could not save data', err)); }, 300);
}

export const getState = () => state;
export const getData = () => state.data;

type Patch<T> = Partial<T> | ((s: T) => Partial<T>);
export function setData(p: Patch<Data>) {
  const patch = typeof p === 'function' ? p(state.data) : p;
  state = { ...state, data: { ...state.data, ...patch } };
  persist(); emit();
}
export function setUI(p: Patch<UI>) {
  const patch = typeof p === 'function' ? p(state.ui) : p;
  state = { ...state, ui: { ...state.ui, ...patch } };
  emit();
}
export function replaceData(d: Data) { state = { ...state, data: normalize(d) }; persist(); emit(); }

export function useApp(): State {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, getState);
}

/** Fill in fields added after a user's data was first saved, so older data keeps working. */
export function normalize(d: Data): Data {
  return { ...d, fx: { trm: {}, tried: {}, ...((d as Partial<Data>).fx || {}) }, incomes: d.incomes ?? [], notifications: d.notifications ?? [], investments: { ...{ trades: [], quotes: {}, usdRate: 4000, usdRateAt: 0 }, ...((d as Partial<Data>).investments || {}) }, bills: (d.bills ?? []).map(b => ({ ...b, paidMonths: b.paidMonths ?? [] })) };
}

/** Load saved data, or keep the sample data on first run. */
export async function loadData() {
  try {
    const saved = await get<Data>(KEY);
    if (saved && saved.version === 1) state = { ...state, data: normalize(saved) };
    else await set(KEY, state.data);
  } catch (err) { console.warn('Could not load saved data', err); }
  const d = state.data;
  state.ui.lastAdd = { pocket: d.pockets[0]?.id ?? '', acct: (d.accounts.find(a => a.type === 'bank') || d.accounts[0])?.id ?? '' };
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function flash(t: string) {
  clearTimeout(toastTimer);
  setUI({ toast: t });
  toastTimer = setTimeout(() => setUI({ toast: null }), 2600);
}
export const openSheet = (sheet: UI['sheet']) => setUI({ sheet });
export const closeSheet = () => setUI({ sheet: null });
