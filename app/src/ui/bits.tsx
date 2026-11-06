import type { CSSProperties, ReactNode } from 'react';
import type { Data, Expense } from '../lib/types';
import { LINE, TEXT, ink, tint } from '../lib/constants';
import { catOf, curSymbol, fmt, fxText, initialOf, pocketStats, type PocketStats } from '../lib/derive';
import { relDay, type Ctx } from '../lib/dates';
import { MoneyInput } from './MoneyInput';

export const s = (o: CSSProperties) => o;

export function SectionHead({ title, right, onRight, muted }: { title: string; right?: ReactNode; onRight?: () => void; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 4px 0' }}>
      <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</span>
      {right != null && (
        <span onClick={onRight} style={onRight && !muted ? { fontSize: 13, color: 'var(--color-accent-700)', fontWeight: 600, cursor: 'pointer' } : { fontSize: 13, color: 'var(--color-neutral-700)' }}>{right}</span>
      )}
    </div>
  );
}

export const ListCard = ({ children, pad = '6px 16px', radius = 24, style }: { children: ReactNode; pad?: string; radius?: number; style?: CSSProperties }) => (
  <div style={{ background: 'var(--surface)', borderRadius: radius, padding: pad, ...style }}>{children}</div>
);

export const FieldLabel = ({ children, m = '16px 4px 8px' }: { children: ReactNode; m?: string }) => (
  <span style={{ margin: m, fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{children}</span>
);

export function Bar({ pct, h = 10, track = 'var(--surface)', fill, ease = '.5s' }: { pct: string; h?: number; track?: string; fill: string; ease?: string }) {
  return (
    <div style={{ height: h, borderRadius: 999, background: track, overflow: 'hidden' }}>
      <div style={{ height: h, borderRadius: 999, width: pct, background: fill, transition: `width ${ease} ease` }} />
    </div>
  );
}

export function PrimaryBtn({ children, onClick, disabled, mt = 14, h = 56, fs = 16, bg = 'var(--color-accent)', hover = 'hv-acc600' }: { children: ReactNode; onClick: () => void; disabled?: boolean; mt?: number; h?: number; fs?: number; bg?: string; hover?: string }) {
  return (
    <button onClick={() => !disabled && onClick()} disabled={disabled} className={hover}
      style={{ marginTop: mt, height: h, borderRadius: 999, border: 0, background: bg, color: '#fff', fontSize: fs, fontWeight: 700, cursor: 'pointer', opacity: disabled ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {children}
    </button>
  );
}

export function GhostDanger({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="hv-acc100" style={{ marginTop: 8, height: 48, borderRadius: 999, border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{children}</button>;
}

/** The big "$ 0" amount field used by add, move, pay and goal sheets. */
export function BigAmount({ value, onChange, autoFocus, mt = 12 }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; mt?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: mt, background: 'var(--surface)', borderRadius: 24, padding: '16px 20px' }}>
      <span style={{ fontSize: 40, fontWeight: 700, color: 'var(--color-neutral-400)' }}>{curSymbol()}</span>
      <MoneyInput value={value} onChange={onChange} autoFocus={autoFocus}
        style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', color: TEXT, padding: 0, outline: 'none' }} />
    </div>
  );
}

export function SmallAmount({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, background: 'var(--surface)', borderRadius: 18, padding: '13px 18px' }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-neutral-400)' }}>{curSymbol()}</span>
      <MoneyInput value={value} onChange={onChange}
        style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 18, fontWeight: 700, color: TEXT, padding: 0, outline: 'none' }} />
    </div>
  );
}

export const textInput: CSSProperties = { border: 0, borderRadius: 18, background: 'var(--surface)', fontSize: 16, color: TEXT, padding: '15px 18px', outline: 'none', minWidth: 0 };

/** Circle with a pocket's emoji/initial, or its photo. */
/** A photo filling its round or rounded box. It's a real <img> (not a CSS background) so a new photo shows right away
 *  at the right size; React can drop a background image when the box's color changes at the same time. */
export function Fill({ src }: { src?: string | null }) {
  const url = src?.startsWith('url(') ? src.slice(4, -1).replace(/^["']|["']$/g, '') : src;
  if (!url || url === 'none') return null;
  return <img src={url} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', pointerEvents: 'none' }} />;
}

export function PocketDot({ st, size, fs, bg, color, radius = 999 }: { st: { initial: string; photoBg: string }; size: number; fs: number; bg: string; color: string; radius?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: radius, backgroundColor: bg, position: 'relative', overflow: 'hidden', color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: fs, flex: 'none' }}>{st.initial}<Fill src={st.photoBg} /></span>
  );
}

/** Rounded pill used to pick a pocket or goal. */
export function PickChip({ st, on, hue, onClick, icon }: { st: { name: string; initial?: string; photoBg?: string }; on: boolean; hue: number; onClick: () => void; icon?: ReactNode }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 8px 8px', borderRadius: 999, border: `2px solid ${on ? ink(hue) : 'var(--surface)'}`, background: on ? ink(hue) : 'var(--surface)', color: on ? 'var(--on-text)' : TEXT, cursor: 'pointer', transition: 'all .15s' }}>
      <span style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: on ? 'rgba(255,255,255,.25)' : tint(hue), position: 'relative', overflow: 'hidden', color: on ? 'var(--on-text)' : ink(hue), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{icon ?? st.initial}<Fill src={st.photoBg} /></span>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{st.name}</span>
    </button>
  );
}

export function Segmented<K extends string>({ items, value, onPick, h = 38, mt = 14 }: { items: [K, string][]; value: K; onPick: (k: K) => void; h?: number; mt?: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: mt, background: 'var(--color-neutral-200)', borderRadius: 999, padding: 4 }}>
      {items.map(([k, label]) => (
        <button key={k} onClick={() => onPick(k)} style={{ flex: 1, height: h, borderRadius: 999, border: 0, background: value === k ? 'var(--surface)' : 'transparent', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: value === k ? 'var(--shadow-sm)' : 'none', transition: 'all .15s' }}>{label}</button>
      ))}
    </div>
  );
}

export interface ExpView { key: string; initial: string; photoBg: string; tint: string; ink: string; note: string; meta: string; amtFmt: string; tagLine: string; amtColor?: string }
export function expView(d: Data, e: Expense, c: Ctx, stats?: Map<string, PocketStats>): ExpView {
  const p = stats?.get(e.p) || pocketStats(d, e.p, c), a = d.accounts.find(x => x.id === e.a);
  return {
    key: e.id, initial: p ? p.initial : initialOf(e.note), photoBg: p ? p.photoBg : 'none', tint: tint(p ? p.hue : 0), ink: ink(p ? p.hue : 0), note: e.note,
    meta: [e.split ? `${catOf(e)[0]} (split)` : catOf(e)[0], p ? p.name : e.ruleId ? 'Scheduled' : 'No pocket', a && a.name, relDay(e.date, c.today), fxText(e.orig) || ''].filter(Boolean).join(' · '), amtFmt: '−' + fmt(e.amt),
    tagLine: (e.tags || []).map(t => '#' + t).join('  ')
  };
}

export function ExpRow({ v, last, size = 40, onClick }: { v: ExpView; last: boolean; size?: number; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${last ? 'transparent' : LINE}`, cursor: onClick ? 'pointer' : 'default' }}>
      <PocketDot st={v} size={size} fs={size > 38 ? 15 : 14} bg={v.tint} color={v.ink} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{v.note}</span>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.meta}</span>
        {v.tagLine && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent-700)' }}>{v.tagLine}</span>}
      </div>
      <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', color: v.amtColor }}>{v.amtFmt}</span>
    </div>
  );
}

/** Square-ish tile with an account's photo or initial. */
export function AcctBadge({ photo, initial, size, radius, bg, color, fs }: { photo?: string | null; initial: string; size: number; radius: number; bg: string; color: string; fs: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: radius, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: fs, flex: 'none', overflow: 'hidden', position: 'relative' }}>
      {photo ? <Fill src={photo} /> : <span>{initial}</span>}
    </span>
  );
}

/** iOS-style on/off switch. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} style={{ width: 52, height: 32, borderRadius: 999, border: 0, padding: 3, background: on ? 'oklch(0.62 0.12 160)' : 'var(--color-neutral-300)', cursor: 'pointer', flex: 'none', transition: 'background .2s' }}>
      <span style={{ display: 'block', width: 26, height: 26, borderRadius: 999, background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', transform: on ? 'translateX(20px)' : 'none', transition: 'transform .2s' }} />
    </button>
  );
}

/** Logo (uploaded image) or first letter for a scheduled income, bill or subscription. */
export function BillBadge({ b, size = 40, radius = 14 }: { b: { name: string; hue: number; kind: string; photo?: string | null }; size?: number; radius?: number }) {
  const hue = b.kind === 'Income' ? 150 : b.hue;
  return (
    <div style={{ width: size, height: size, borderRadius: radius, backgroundColor: b.photo ? '#fff' : tint(hue), position: 'relative', overflow: 'hidden', boxShadow: b.photo ? 'inset 0 0 0 1px var(--color-neutral-200)' : 'none', color: ink(hue), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.38, flex: 'none' }}>
      {b.photo ? <Fill src={b.photo} /> : b.name.trim().charAt(0).toUpperCase() || '·'}
    </div>
  );
}
