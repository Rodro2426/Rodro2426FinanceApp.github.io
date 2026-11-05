// Small SVG charts for the reports. Light surface only (the app has no dark mode).
// Specs: bars <= 24px with a 4px rounded data end, 2px lines, >= 8px end dots with a 2px surface ring,
// hairline grid, text in ink colors (never the series color), a legend for 2+ series, and tap/drag readouts.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** True while the app is in dark mode. */
export const isDark = () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';
/**
 * Chart colors. Dark mode uses its own validated steps of the same hues (checked against the dark surface),
 * not an automatic flip.
 */
export const VIZ = {
  get surface() { return isDark() ? '#1d1c1b' : '#ffffff'; },
  get ink() { return isDark() ? '#f0efec' : '#0b0b0b'; },
  get ink2() { return isDark() ? '#c3c2b7' : '#52514e'; },
  muted: '#898781',
  get grid() { return isDark() ? '#2c2c2a' : '#e1e0d9'; },
  get axis() { return isDark() ? '#383835' : '#c3c2b7'; },
  get series() { return isDark() ? ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'] : ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']; },
  /** Sequential blue, faint -> strong (for heat tables). */
  get seq() { return isDark() ? ['#0d2a4d', '#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec'] : ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf']; },
  get neg() { return isDark() ? '#e66767' : '#e34948'; },
  get track() { return isDark() ? '#1c2a3d' : '#e8f0fb'; }
};

/** Clean axis numbers: 0 / 500K / 1M / 1,5M. */
export function compactNum(n: number) {
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e9) return s + (a / 1e9).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + 'B';
  if (a >= 1e6) return s + (a / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + 'M';
  if (a >= 1e3) return s + Math.round(a / 1e3).toLocaleString('es-CO') + 'K';
  return s + Math.round(a).toLocaleString('es-CO');
}
/** 3–5 round ticks covering [min, max] (always including 0). */
function niceTicks(min: number, max: number) {
  const lo = Math.min(0, min), hi = Math.max(0, max), span = hi - lo || 1;
  const raw = span / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => span / x <= 5) ?? 10 * mag;
  const start = Math.floor(lo / step) * step, end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(320);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 320)); ro.observe(el); setW(el.clientWidth || 320);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface Series { name: string; values: number[]; color: string }

export function Legend({ series, line }: { series: { name: string; color: string }[]; line?: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 12.5, color: VIZ.ink2 }}>
      {series.map(s => (
        <span key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {line ? <span style={{ width: 14, height: 2, borderRadius: 2, background: s.color }} /> : <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />}
          {s.name}
        </span>
      ))}
    </div>
  );
}

/** The value readout above a chart: values lead, names follow, keyed by a short stroke of the series color. */
function Readout({ title, rows, fmt }: { title: string; rows: { name: string; color: string; value: number }[]; fmt: (n: number) => string }) {
  return (
    <div aria-live="polite" style={{ minHeight: 40, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, color: VIZ.muted, fontWeight: 600 }}>{title}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
        {rows.map(r => (
          <span key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ width: 12, height: 2, borderRadius: 2, background: r.color }} />
            <b style={{ color: VIZ.ink, fontVariantNumeric: 'tabular-nums' }}>{fmt(r.value)}</b>
            {rows.length > 1 && <span style={{ color: VIZ.ink2 }}>{r.name}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ranked horizontal bars, one hue, largest first; value at the tip. */
export function RankedBars({ rows, color, fmt, onPick }: { rows: { label: string; value: number; note?: string }[]; color: string; fmt: (n: number) => string; onPick?: (label: string) => void }) {
  const max = Math.max(1, ...rows.map(r => Math.abs(r.value)));
  return (
    <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(r => {
        const w = Math.abs(r.value) / max * 100, neg = r.value < 0;
        return (
          <div key={r.label} role="listitem" onClick={() => onPick?.(r.label)} style={{ display: 'flex', flexDirection: 'column', gap: 4, cursor: onPick ? 'pointer' : 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
              <span style={{ color: VIZ.ink, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}{r.note && <span style={{ color: VIZ.muted, fontWeight: 500 }}> · {r.note}</span>}</span>
              <span style={{ color: VIZ.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(r.value)}</span>
            </div>
            <div style={{ height: 14, background: 'transparent' }}>
              <div style={{ width: `${Math.max(w, r.value ? 1.5 : 0)}%`, height: 14, background: neg ? VIZ.neg : color, borderRadius: '0 4px 4px 0' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Columns over time; 1–2 series side by side, negatives grow down from zero. Tap a month to read it. */
export function Columns({ labels, series, fmt, initial }: { labels: string[]; series: Series[]; fmt: (n: number) => string; initial?: number }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [sel, setSel] = useState<number>(initial ?? labels.length - 1);
  const H = 190, padL = 42, padB = 22, padT = 8, iw = W - padL - 4, ih = H - padB - padT;
  const all = series.flatMap(s => s.values), ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all));
  const lo = ticks[0], hi = ticks[ticks.length - 1], y = (v: number) => padT + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const band = iw / Math.max(1, labels.length), k = series.length, gap = 2;
  const bw = Math.min(24, Math.max(4, (band * 0.7 - gap * (k - 1)) / k));
  const every = Math.ceil(labels.length / Math.max(1, Math.floor(iw / 44)));
  const i = Math.min(sel, labels.length - 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Readout title={labels[i] ?? ''} rows={series.map(s => ({ name: s.name, color: s.color, value: s.values[i] ?? 0 }))} fmt={fmt} />
      <div ref={ref} style={{ width: '100%' }}>
        <svg width={W} height={H} role="img" aria-label={series.map(s => s.name).join(', ')} style={{ display: 'block', touchAction: 'pan-y' }}
          onPointerMove={e => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); setSel(Math.max(0, Math.min(labels.length - 1, Math.floor((e.clientX - r.left - padL) / band)))); }}>
          {ticks.map(t => <g key={t}><line x1={padL} x2={W - 4} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} strokeWidth={1} /><text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={VIZ.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>{compactNum(t)}</text></g>)}
          {labels.map((l, j) => {
            const x0 = padL + j * band + (band - (bw * k + gap * (k - 1))) / 2;
            return (
              <g key={l + j} opacity={j === i ? 1 : 0.55} onClick={() => setSel(j)} style={{ cursor: 'pointer' }}>
                <rect x={padL + j * band} y={padT} width={band} height={ih} fill="transparent" />
                {series.map((s, si) => {
                  const v = s.values[j] ?? 0, top = y(Math.max(0, v)), bot = y(Math.min(0, v)), h = Math.max(v ? 1 : 0, bot - top);
                  const r = Math.min(4, h, bw / 2), x = x0 + si * (bw + gap);
                  // Rounded data end only (top for positive, bottom for negative); square at the zero line.
                  const d = v >= 0
                    ? `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${top + h} Z`
                    : `M${x},${top} V${bot - r} Q${x},${bot} ${x + r},${bot} H${x + bw - r} Q${x + bw},${bot} ${x + bw},${bot - r} V${top} Z`;
                  return <path key={s.name} d={d} fill={v < 0 && series.length === 1 ? VIZ.neg : s.color} />;
                })}
                {j % every === 0 && <text x={padL + j * band + band / 2} y={H - 6} textAnchor="middle" fontSize={11} fill={VIZ.muted}>{l}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      {series.length > 1 && <Legend series={series} />}
    </div>
  );
}

/** Lines over time with a crosshair that snaps to the nearest month. One series gets a 10% area wash. */
export function Lines({ labels, series, fmt }: { labels: string[]; series: Series[]; fmt: (n: number) => string }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [sel, setSel] = useState(labels.length - 1);
  const H = 200, padL = 46, padR = 10, padB = 22, padT = 10, iw = W - padL - padR, ih = H - padB - padT;
  const all = series.flatMap(s => s.values), mn = Math.min(...all, 0), mx = Math.max(...all, 0);
  const ticks = niceTicks(mn, mx), lo = ticks[0], hi = ticks[ticks.length - 1];
  const x = (j: number) => padL + (labels.length <= 1 ? iw / 2 : (j / (labels.length - 1)) * iw);
  const y = (v: number) => padT + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const every = Math.ceil(labels.length / Math.max(1, Math.floor(iw / 48)));
  const i = Math.min(sel, labels.length - 1);
  const pick = (clientX: number, el: SVGSVGElement) => { const r = el.getBoundingClientRect(); const j = labels.length <= 1 ? 0 : Math.round(((clientX - r.left - padL) / iw) * (labels.length - 1)); setSel(Math.max(0, Math.min(labels.length - 1, j))); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Readout title={labels[i] ?? ''} rows={series.map(s => ({ name: s.name, color: s.color, value: s.values[i] ?? 0 }))} fmt={fmt} />
      <div ref={ref} style={{ width: '100%' }}>
        <svg width={W} height={H} role="img" aria-label={series.map(s => s.name).join(', ')} style={{ display: 'block', touchAction: 'pan-y' }}
          onPointerDown={e => pick(e.clientX, e.currentTarget)} onPointerMove={e => pick(e.clientX, e.currentTarget)}>
          {ticks.map(t => <g key={t}><line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} strokeWidth={1} /><text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={VIZ.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>{compactNum(t)}</text></g>)}
          {labels.map((l, j) => j % every === 0 && <text key={l + j} x={x(j)} y={H - 6} textAnchor={j === 0 ? 'start' : 'middle'} fontSize={11} fill={VIZ.muted}>{l}</text>)}
          {series.length === 1 && labels.length > 1 && <path d={`M${x(0)},${y(0)} ${series[0].values.map((v, j) => `L${x(j)},${y(v)}`).join(' ')} L${x(labels.length - 1)},${y(0)} Z`} fill={series[0].color} opacity={0.1} />}
          {series.map(s => <path key={s.name} d={s.values.map((v, j) => `${j ? 'L' : 'M'}${x(j)},${y(v)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
          <line x1={x(i)} x2={x(i)} y1={padT} y2={padT + ih} stroke={VIZ.axis} strokeWidth={1} />
          {series.map(s => <circle key={s.name} cx={x(i)} cy={y(s.values[i] ?? 0)} r={4.5} fill={s.color} stroke={VIZ.surface} strokeWidth={2} />)}
        </svg>
      </div>
      {series.length > 1 && <Legend series={series} line />}
    </div>
  );
}

/** Planned vs used, one meter per row: the track is a light step of the fill's ramp; over budget is flagged with text, not color alone. */
export function Meters({ rows, fmt }: { rows: { label: string; used: number; total: number }[]; fmt: (n: number) => string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map(r => {
        const over = r.used > r.total + 0.004, pct = r.total > 0 ? Math.min(100, (r.used / r.total) * 100) : r.used > 0 ? 100 : 0;
        return (
          <div key={r.label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: VIZ.ink }}>{r.label}</span>
              <span style={{ color: VIZ.ink2, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}><b style={{ color: VIZ.ink }}>{fmt(r.used)}</b> of {fmt(r.total)}{over && <b style={{ color: '#b42318' }}> · ⚠ over by {fmt(r.used - r.total)}</b>}</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: over ? '#fbe3e3' : VIZ.track, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: 10, borderRadius: 999, background: over ? '#d03b3b' : VIZ.series[0] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A plain data table: the accessible view of every chart. */
export function DataTable({ head, rows, foot }: { head: ReactNode[]; rows: ReactNode[][]; foot?: ReactNode[] }) {
  const cell = (i: number) => ({ padding: '7px 4px', textAlign: (i ? 'right' : 'left') as 'right' | 'left', whiteSpace: 'nowrap' as const, fontVariantNumeric: 'tabular-nums' as const });
  return (
    <div className="noscroll" style={{ overflowX: 'auto', margin: '0 -4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, color: VIZ.ink }}>
        <thead><tr>{head.map((h, i) => <th key={i} style={{ ...cell(i), fontSize: 11, color: VIZ.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em', borderBottom: `1px solid ${VIZ.grid}`, position: i ? undefined : 'sticky', left: 0, background: 'var(--surface)' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((v, i) => <td key={i} style={{ ...cell(i), borderBottom: `1px solid ${VIZ.grid}`, fontWeight: i ? 500 : 600, position: i ? undefined : 'sticky', left: 0, background: 'var(--surface)' }}>{v}</td>)}</tr>)}</tbody>
        {foot && <tfoot><tr>{foot.map((v, i) => <td key={i} style={{ ...cell(i), fontWeight: 800, position: i ? undefined : 'sticky', left: 0, background: 'var(--surface)' }}>{v}</td>)}</tr></tfoot>}
      </table>
    </div>
  );
}

/** Background for a heat-table cell: one hue, more is darker; white or near-black text by the fill. */
export function heat(v: number, max: number) {
  if (!(v > 0) || !(max > 0)) return { background: 'transparent', color: VIZ.ink };
  const k = Math.min(VIZ.seq.length - 1, Math.floor((v / max) * (VIZ.seq.length - 1)));
  return { background: VIZ.seq[k], color: isDark() ? (k >= 7 ? '#0b0b0b' : '#fff') : k >= 6 ? '#fff' : VIZ.ink };
}

/**
 * Pie for part-to-whole. Slices keep their caller-given order and colors (color follows the category),
 * a 2px surface gap separates them, and tapping a slice (or its legend row) reads it out.
 */
export function Pie({ slices, fmt }: { slices: { label: string; value: number; color: string }[]; fmt: (n: number) => string }) {
  const total = slices.reduce((a, s) => a + Math.max(0, s.value), 0);
  const [sel, setSel] = useState<number | null>(null);
  const S = 220, R = 104, C = S / 2;
  let a0 = -Math.PI / 2;
  const arcs = slices.map((s, i) => {
    const frac = total ? Math.max(0, s.value) / total : 0, a1 = a0 + frac * Math.PI * 2;
    const mid = (a0 + a1) / 2, big = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number, r = R) => `${C + r * Math.cos(a)},${C + r * Math.sin(a)}`;
    const d = frac >= 0.9999 ? `M${C - R},${C} A${R},${R} 0 1 1 ${C + R},${C} A${R},${R} 0 1 1 ${C - R},${C} Z` : `M${C},${C} L${p(a0)} A${R},${R} 0 ${big} 1 ${p(a1)} Z`;
    const out = { ...s, i, d, frac, mid };
    a0 = a1;
    return out;
  }).filter(a => a.frac > 0);
  const cur = sel != null ? arcs.find(a => a.i === sel) : null;
  const share = (f: number) => `${(f * 100).toLocaleString('es-CO', { maximumFractionDigits: f < 0.1 ? 1 : 0 })}%`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div aria-live="polite" style={{ minHeight: 40, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 12, color: VIZ.muted, fontWeight: 600 }}>{cur ? cur.label : 'Tap a slice'}</span>
        <span style={{ fontSize: 13 }}>{cur ? <><b style={{ color: VIZ.ink }}>{fmt(cur.value)}</b> <span style={{ color: VIZ.ink2 }}>· {share(cur.frac)} of {fmt(total)}</span></> : <b style={{ color: VIZ.ink }}>{fmt(total)}</b>}</span>
      </div>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} role="img" aria-label={arcs.map(a => `${a.label} ${share(a.frac)}`).join(', ')} style={{ alignSelf: 'center', display: 'block', overflow: 'visible' }}>
        {arcs.map(a => {
          const lift = cur?.i === a.i ? 6 : 0;
          return <path key={a.label} d={a.d} fill={a.color} stroke={VIZ.surface} strokeWidth={2} strokeLinejoin="round"
            transform={`translate(${lift * Math.cos(a.mid)},${lift * Math.sin(a.mid)})`} opacity={cur && cur.i !== a.i ? 0.45 : 1}
            onClick={() => setSel(s => (s === a.i ? null : a.i))} style={{ cursor: 'pointer', transition: 'transform .15s, opacity .15s' }} />;
        })}
      </svg>
      <div role="list" style={{ display: 'flex', flexDirection: 'column' }}>
        {arcs.map(a => (
          <button key={a.label} role="listitem" onClick={() => setSel(s => (s === a.i ? null : a.i))} aria-pressed={cur?.i === a.i}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 2px', border: 0, background: cur?.i === a.i ? 'var(--color-neutral-100)' : 'transparent', borderRadius: 10, cursor: 'pointer', fontSize: 13.5, color: VIZ.ink, textAlign: 'left' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: a.color, flex: 'none' }} />
            <span style={{ flex: 1, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</span>
            <span style={{ color: VIZ.ink2, fontVariantNumeric: 'tabular-nums' }}>{share(a.frac)}</span>
            <span style={{ width: 92, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(a.value)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
