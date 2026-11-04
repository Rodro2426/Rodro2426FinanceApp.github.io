// Splitting money into whole units (pesos, or cents for other currencies) so the parts add up exactly.

/** Units per currency unit: COP has no cents. */
export const unitsFor = (currency: string) => (currency === 'COP' ? 1 : 100);

/**
 * Largest-remainder split of `total` by `weights`. Every part is a whole unit and the parts add up to
 * exactly `total`. Leftover units go to the parts with the biggest fractions (ties: the earlier part).
 * All-zero weights split evenly.
 */
export function largestRemainder(total: number, weights: number[], scale = 1): number[] {
  const n = weights.length;
  if (!n) return [];
  const T = Math.round(total * scale);
  const w = weights.map(x => Math.max(0, x)), W = w.reduce((a, x) => a + x, 0);
  const ws = W > 0 ? w : w.map(() => 1), WS = W > 0 ? W : n;
  const raw = ws.map(x => (T * x) / WS);
  const out = raw.map(Math.floor);
  let rest = T - out.reduce((a, x) => a + x, 0);
  const order = raw.map((x, i) => ({ i, f: x - Math.floor(x) })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) out[order[k].i]++;
  return out.map(x => x / scale);
}

/** One move spread over `n` weeks: whole-unit shares that add up to the move; earlier weeks take the leftover units. */
export const weekShares = (amt: number, n: number, scale = 1) => largestRemainder(amt, Array(Math.max(1, n)).fill(1), scale);
