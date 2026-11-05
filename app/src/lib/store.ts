import { useSyncExternalStore } from 'react';
import { get, set } from 'idb-keyval';
import type { Data, UI } from './types';
import { emptyData, sampleData } from './seed';

const KEY = 'pockets-data-v1';

export interface State { data: Data; ui: UI }

let state: State = {
  data: sampleData(),
  ui: { tab: 'home', sheet: null, toast: null, lastAdd: { pocket: 'groc', acct: 'a1' } }
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** Off until the welcome choice is made, so nothing is saved before the person picks. */
let persistOn = true;
/** Called on every change that will be saved (the cloud sync listens to this). */
const persistListeners = new Set<() => void>();
export const onPersist = (l: () => void) => { persistListeners.add(l); return () => { persistListeners.delete(l); }; };
/** False during the welcome screen and the practice tour: nothing is saved or synced then. */
export const isPersisting = () => persistOn;
function persist() {
  if (!persistOn) return;
  persistListeners.forEach(l => l());
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (persistOn) set(KEY, state.data).catch(err => console.warn('Could not save data', err)); }, 300);
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
  return { ...d, fx: { trm: {}, tried: {}, ...((d as Partial<Data>).fx || {}) }, incomes: d.incomes ?? [], groups: d.groups ?? [], notifications: d.notifications ?? [], investments: { ...{ cdts: [], trades: [], quotes: {}, usdRate: 4000, usdRateAt: 0 }, ...((d as Partial<Data>).investments || {}) }, bills: (d.bills ?? []).map(b => ({ ...b, paidMonths: b.paidMonths ?? [] })) };
}

/** Load saved data, or keep the sample data on first run. */
export async function loadData() {
  try {
    const saved = await get<Data>(KEY);
    if (saved && saved.version === 1) state = { ...state, data: normalize(saved) };
    else { persistOn = false; state = { ...state, ui: { ...state.ui, welcome: true } }; }
  } catch (err) { console.warn('Could not load saved data', err); }
  const d = state.data;
  state.ui.lastAdd = { pocket: d.pockets[0]?.id ?? '', acct: (d.accounts.find(a => a.type === 'bank') || d.accounts[0])?.id ?? '' };
}

/* ---------- Guided tour on a practice copy ---------- */
let realData: Data | null = null;
/** Starts the tour on an empty practice copy; nothing is saved until it ends. */
export function startTour(mode: 'first' | 'replay', name?: string) {
  realData = mode === 'replay' ? state.data : null;
  // Save the real data right now (a pending save could otherwise land after the switch), then stop saving.
  clearTimeout(saveTimer);
  if (mode === 'replay' && persistOn) set(KEY, state.data).catch(err => console.warn('Could not save data', err));
  persistOn = false;
  const base = emptyData(state.data);
  const practice: Data = { ...base, settings: { ...base.settings, name: name || state.data.settings.name, lastBackup: undefined } };
  state = { ...state, data: normalize(practice), ui: { ...state.ui, welcome: false, install: false, tab: 'home', sheet: null, page: null, lastAdd: { pocket: '', acct: '' }, tour: { step: 0, mode } } };
  emit();
}
/** Ends the tour: keep the practice data, start fresh, or (replay) go back to the real data. */
export async function endTour(choice: 'keep' | 'fresh' | 'restore') {
  const mode = state.ui.tour?.mode;
  // A replay never keeps practice data: it always goes back to the real data.
  if (mode === 'replay') choice = 'restore';
  let d: Data;
  if (choice === 'restore') {
    const saved = realData ?? await get<Data>(KEY).catch(() => undefined);
    if (!saved) { flash('Could not find your data. Close and reopen the app.'); return mode; }
    d = saved;
  }
  else if (choice === 'fresh') { const e = emptyData(state.data); d = { ...e, settings: { ...e.settings, tourSeen: true } }; }
  else d = { ...state.data, settings: { ...state.data.settings, tourSeen: true } };
  realData = null;
  persistOn = true;
  replaceData(d);
  setUI({ tour: null, sheet: null, page: null, tab: 'home', lastAdd: { pocket: d.pockets[0]?.id ?? '', acct: (d.accounts.find(a => a.type === 'bank') || d.accounts[0])?.id ?? '' } });
  return mode;
}
export const setTourStep = (step: number) => setUI(u => ({ tour: u.tour ? { ...u.tour, step } : u.tour }));

/** Ends the welcome screen with the chosen starting data and starts saving. */
export function finishWelcome(d: Data) {
  persistOn = true;
  replaceData(d);
  const nd = state.data;
  setUI({ welcome: false, tab: 'home', sheet: null, page: null, lastAdd: { pocket: nd.pockets[0]?.id ?? '', acct: (nd.accounts.find(a => a.type === 'bank') || nd.accounts[0])?.id ?? '' } });
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function flash(t: string) {
  clearTimeout(toastTimer);
  setUI({ toast: t });
  toastTimer = setTimeout(() => setUI({ toast: null }), 2600);
}
export const openSheet = (sheet: UI['sheet']) => setUI({ sheet });
export const closeSheet = () => setUI({ sheet: null });
// Development builds only: lets screenshot scripts open a page directly. Not in the live app.
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __setUI: setUI, __setData: setData });
