// Stock portfolio: holdings from trades, live prices from Finnhub (free key), USD→COP rate.
import type { Data, Investments, Quote, Trade } from './types';
import { getData, setData } from './store';

export interface Holding {
  ticker: string; name: string; currency: 'USD' | 'COP'; qty: number; avgCost: number; invested: number; realized: number;
  price: number; value: number; gain: number; gainPct: number; dayChange: number; dayChangePct: number; quote?: Quote; firstTs: number;
  /** Value and figures converted to the app currency. */
  valueLocal: number; investedLocal: number; gainLocal: number; dayChangeLocal: number;
}

/** USD amount → app currency (only COP and USD are converted; others are shown as-is). */
export function toLocal(inv: Investments, amt: number, cur: 'USD' | 'COP') {
  const app = getData().settings.currency;
  if (app === 'COP') return cur === 'USD' ? amt * inv.usdRate : amt;
  if (app === '$') return cur === 'COP' ? amt / inv.usdRate : amt;
  return amt;
}

/** Average-cost holdings, in the order each ticker was first bought (so colors stay put). */
export function holdings(d: Data): Holding[] {
  const inv = d.investments, by = new Map<string, Trade[]>();
  [...inv.trades].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts - b.ts)).forEach(t => { by.set(t.ticker, [...(by.get(t.ticker) || []), t]); });
  const out: Holding[] = [];
  by.forEach((ts, ticker) => {
    let qty = 0, cost = 0, realized = 0;
    ts.forEach(t => {
      if (t.side === 'buy') { cost += t.qty * t.price + t.fee; qty += t.qty; }
      else { const avg = qty ? cost / qty : 0, q = Math.min(t.qty, qty); realized += q * (t.price - avg) - t.fee; cost -= avg * q; qty -= q; }
    });
    const q = inv.quotes[ticker], last = ts[ts.length - 1];
    const price = q?.price ?? last.price, value = qty * price, invested = cost;
    const dayChange = q && !q.manual ? qty * q.change : 0;
    const cur = last.currency;
    out.push({
      ticker, name: q?.name || last.name || ticker, currency: cur, qty, avgCost: qty ? cost / qty : 0, invested, realized,
      price, value, gain: value - invested, gainPct: invested ? (value - invested) / invested : 0, dayChange, dayChangePct: q && !q.manual ? q.changePct / 100 : 0, quote: q,
      firstTs: ts[0].ts, valueLocal: toLocal(inv, value, cur), investedLocal: toLocal(inv, invested, cur), gainLocal: toLocal(inv, value - invested, cur), dayChangeLocal: toLocal(inv, dayChange, cur)
    });
  });
  return out.filter(h => h.qty > 1e-9);
}

const API = 'https://finnhub.io/api/v1';
async function fh<T>(path: string, key: string): Promise<T> {
  const r = await fetch(`${API}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(key)}`);
  if (r.status === 401 || r.status === 403) throw new Error('key');
  if (r.status === 429) throw new Error('limit');
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}

export interface SymbolMatch { symbol: string; description: string; type: string }
export async function searchSymbols(q: string): Promise<SymbolMatch[]> {
  const key = getData().settings.finnhubKey;
  if (!key || q.trim().length < 1) return [];
  const r = await fh<{ result: SymbolMatch[] }>(`/search?q=${encodeURIComponent(q.trim())}`, key);
  return (r.result || []).filter(x => !x.symbol.includes('.') || x.symbol.endsWith('.CO')).slice(0, 8);
}

/** Refreshes prices (and names/logos the first time) for every held ticker without a manual price. */
export async function refreshQuotes(): Promise<{ ok: number; failed: string[]; error?: string }> {
  const d = getData(), key = d.settings.finnhubKey;
  const tickers = holdings(d).filter(h => !d.investments.quotes[h.ticker]?.manual).map(h => h.ticker);
  if (!key) return { ok: 0, failed: tickers, error: 'nokey' };
  const quotes: Record<string, Quote> = {}, failed: string[] = [];
  let error: string | undefined;
  await Promise.all(tickers.map(async t => {
    try {
      const q = await fh<{ c: number; d: number | null; dp: number | null }>(`/quote?symbol=${encodeURIComponent(t)}`, key);
      if (!q || !q.c) { failed.push(t); return; }
      const prev = d.investments.quotes[t];
      let name = prev?.name, logo = prev?.logo;
      if (!name) { try { const p = await fh<{ name?: string; logo?: string }>(`/stock/profile2?symbol=${encodeURIComponent(t)}`, key); name = p.name || undefined; logo = p.logo || undefined; } catch { /* optional */ } }
      quotes[t] = { price: q.c, change: q.d ?? 0, changePct: q.dp ?? 0, at: Date.now(), name, logo };
    } catch (e) { failed.push(t); error = (e as Error).message; }
  }));
  setData(x => ({ investments: { ...x.investments, quotes: { ...x.investments.quotes, ...quotes } } }));
  return { ok: Object.keys(quotes).length, failed, error };
}

/** Updates the USD→COP rate (free service, no key) at most every 6 hours, unless typed in. */
export async function refreshUsdRate(force = false) {
  const inv = getData().investments;
  if (inv.usdManual || (!force && Date.now() - inv.usdRateAt < 6 * 3600e3)) return;
  // Prefer Colombia's official TRM for today; fall back to a market rate.
  const { fetchTrm } = await import('./trm');
  const { todayISO } = await import('./dates');
  const trm = await fetchTrm(todayISO());
  if (trm) { setData(x => ({ investments: { ...x.investments, usdRate: trm, usdRateAt: Date.now() }, fx: { ...x.fx, trm: { ...x.fx.trm, [todayISO()]: trm } } })); return; }
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const j = await r.json();
    const cop = j?.rates?.COP;
    if (cop > 0) setData(x => ({ investments: { ...x.investments, usdRate: cop, usdRateAt: Date.now() } }));
  } catch { /* keep the last rate */ }
}

/** Categorical slots (validated reference palette), assigned by first-buy order. */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const OTHER = '#9b9797';
export function colorOf(all: Holding[], ticker: string) {
  const order = [...all].sort((a, b) => a.firstTs - b.firstTs).map(h => h.ticker);
  const i = order.indexOf(ticker);
  return i >= 0 && i < SERIES.length - 1 ? SERIES[i] : OTHER;
}
