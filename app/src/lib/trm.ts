// Colombia's official dollar rate (TRM) from the government's open-data portal,
// cached per day. Weekends and holidays use the TRM in force that day.
import type { Bill, Data } from './types';
import { getData, setData } from './store';

const DATASET = 'https://www.datos.gov.co/resource/32sa-8pi3.json';

/** Bills priced in dollars are converted only when the app itself is in pesos. */
export const isUsd = (b: Bill) => b.currency === 'USD' && getData().settings.currency === 'COP';

/** TRM for a date, if already fetched. */
export const trmFor = (d: Data, date: string): number | undefined => d.fx?.trm[date];
/** Best rate available right now: newest cached TRM, else the investments rate. */
export function latestRate(d: Data) {
  const days = Object.keys(d.fx?.trm || {}).sort();
  return days.length ? d.fx.trm[days[days.length - 1]] : d.investments.usdRate;
}

export async function fetchTrm(date: string): Promise<number | null> {
  const t = `${date}T00:00:00.000`;
  const where = `vigenciadesde <= '${t}' AND vigenciahasta >= '${t}'`;
  try {
    const r = await fetch(`${DATASET}?$where=${encodeURIComponent(where)}&$limit=1`);
    if (!r.ok) return null;
    const j = await r.json();
    const v = parseFloat(j?.[0]?.valor);
    return v > 0 ? v : null;
  } catch { return null; }
}

const inFlight = new Set<string>();
/** Fetches and caches the TRM for each date; dates that fail are marked tried so they fall back. */
export async function ensureTrm(dates: string[]) {
  const d = getData();
  const todo = [...new Set(dates)].filter(x => !d.fx.trm[x] && !d.fx.tried[x] && !inFlight.has(x));
  if (!todo.length) return;
  todo.forEach(x => inFlight.add(x));
  const got = await Promise.all(todo.map(async x => [x, await fetchTrm(x)] as const));
  todo.forEach(x => inFlight.delete(x));
  setData(cur => {
    const trm = { ...cur.fx.trm }, tried = { ...cur.fx.tried };
    got.forEach(([x, v]) => { if (v) trm[x] = v; else tried[x] = Date.now(); });
    return { fx: { trm, tried } };
  });
}

/** "US$20,00" */
export const fmtUsd = (n: number) => 'US$' + n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
