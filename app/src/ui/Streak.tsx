// "Stamp of the month": the streak strip and "nothing spent" button on the Calendar tab, the stamp that drops when today is stamped, and the Achievements page.
import { flash, getData, getState, onPersist, setData, setUI, useApp } from '../lib/store';
import { ACHIEVEMENTS, bestStreak, currentStreak, newlyEarned, sealedDays, spendDays, toggleZero, type Group } from '../lib/achievements';
import { shortDate, todayISO } from '../lib/dates';
import { getLang, tr } from '../lib/i18n';
import { useId } from 'react';
import { SubPage } from '../screens/Reports';
import { haptic } from './haptic';
import { TapLabel } from './bits';
import * as I from './icons';
import type { Data } from '../lib/types';

/** Watches every saved change: the first time today gets stamped it drops the stamp, and new achievements are saved. */
export function startStreakWatch() {
  let was = sealedDays(getData()).has(todayISO());
  let timer: ReturnType<typeof setTimeout> | undefined;
  return onPersist(() => {
    const d = getData(), ui = getState().ui, t = todayISO();
    if (ui.welcome || ui.setup) return;
    const now = sealedDays(d).has(t);
    if (now && !was && d.stampDay !== t) {
      // Runs inside the tap that saved, so the iPhone haptic is allowed.
      haptic('success');
      setData({ stampDay: t });
      setUI({ stamp: currentStreak(d, t) });
      setTimeout(() => setUI({ stamp: null }), 2400);
    }
    was = now;
    clearTimeout(timer);
    timer = setTimeout(checkTrophies, 700);
  });
}
function checkTrophies() {
  const d = getData(), t = todayISO(), fresh = newlyEarned(d, t);
  // Nothing earned yet: still mark the first check as done, so the first real achievement later gets its toast.
  if (!fresh.length) { if (!d.trophies) setData({ trophies: {} }); return; }
  // The first time (old data, or just after this feature arrived) everything already earned is saved quietly.
  const quiet = !d.trophies;
  setData({ trophies: { ...d.trophies, ...Object.fromEntries(fresh.map(a => [a.id, t])) } });
  if (quiet) return;
  haptic('success');
  flash(`New achievement: ${tr(fresh[0].name)}`);
}

/** Teeth of the stamp's serrated edge, as polygon points on a 200×200 box. */
const TEETH = Array.from({ length: 88 }, (_, i) => { const r = i % 2 ? 92 : 99, a = (i * Math.PI) / 44; return `${(100 + r * Math.cos(a)).toFixed(1)},${(100 + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
const star = (x: number, y: number, s: number) => Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? s * 0.45 : s, a = -Math.PI / 2 + (i * Math.PI) / 5; return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`; }).join(' ');

/**
 * The rubber stamp: serrated edge, "AL DÍA" / "POCKETS" around, the days on a band and little stars, with worn ink
 * (an SVG filter roughens the edges and leaves small gaps). `small`: just the edge and the number, for the Calendar strip.
 */
export function Seal({ n, small }: { n: number; small?: boolean }) {
  const id = 'seal' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const es = getLang() === 'es';
  const ink = 'var(--stamp)', bg = 'var(--surface-solid)';
  const label = es ? (n === 1 ? 'DÍA' : 'DÍAS') : (n === 1 ? 'DAY' : 'DAYS');
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" role="img" aria-label={n === 1 ? '1 day in a row' : `${n} days in a row`} style={{ overflow: "visible", display: "block" }}>
      <defs>
        <filter id={id} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={4} result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale={small ? 2 : 2.6} xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves={2} seed={9} result="grain" />
          <feColorMatrix in="grain" type="matrix" values={small ? '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4 0 0 0 3.2' : '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4 0 0 0 2.75'} result="holes" />
          <feComposite in="rough" in2="holes" operator="in" />
        </filter>
        <path id={id + 't'} d="M 36 100 A 64 64 0 0 1 164 100" fill="none" />
        <path id={id + 'b'} d="M 28 100 A 72 72 0 0 0 172 100" fill="none" />
      </defs>
      {/* A solid backing under the worn ink, so its gaps don't show what's behind the stamp. */}
      <g transform="rotate(-14 100 100)" fill={bg}>
        <circle cx="100" cy="100" r="95" />
        {!small && <rect x="6" y="80" width="188" height="42" />}
      </g>
      <g filter={`url(#${id})`} transform="rotate(-14 100 100)" style={{ fontFamily: 'inherit', fontWeight: 800 }} fill={ink}>
        <polygon points={TEETH} fill={ink} />
        <circle cx="100" cy="100" r="86" fill={bg} />
        <circle cx="100" cy="100" r="80" fill="none" stroke={ink} strokeWidth={small ? 5 : 3} />
        {small ? (
          <text x="100" y={n > 99 ? 120 : 128} textAnchor="middle" fontSize={n > 99 ? 58 : 80} letterSpacing="-3">{n}</text>
        ) : <>
          <circle cx="100" cy="100" r="54" fill="none" stroke={ink} strokeWidth="2.5" />
          <text fontSize="15" letterSpacing="3"><textPath href={`#${id}t`} startOffset="50%" textAnchor="middle">{es ? 'AL DÍA' : 'UP TO DATE'}</textPath></text>
          <text fontSize="15" letterSpacing="3"><textPath href={`#${id}b`} startOffset="50%" textAnchor="middle">POCKETS</textPath></text>
          <rect x="6" y="80" width="188" height="42" fill={bg} />
          <rect x="6" y="80" width="188" height="42" fill="none" stroke={ink} strokeWidth="3" />
          <text x="100" y={n > 99 ? 110 : 112} textAnchor="middle" fontSize={n > 99 ? 24 : 32} letterSpacing="1">{`${n} ${label}`}</text>
          <polygon points={star(72, 66, 5)} /><polygon points={star(100, 60, 6)} /><polygon points={star(128, 66, 5)} />
          <polygon points={star(80, 140, 5)} /><polygon points={star(120, 140, 5)} />
        </>}
      </g>
    </svg>
  );
}

/** The stamp that drops in the middle of the screen, with a note at the bottom. */
export function StreakStamp({ n }: { n: number }) {
  return (
    <div aria-live="polite" style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="stamp-drop" style={{ width: 210, height: 210 }}><Seal n={n} /></div>
      <div role="status" className="stamp-note" style={{ position: 'absolute', left: 18, right: 18, bottom: 'calc(var(--tb) + 82px)', maxWidth: 460, margin: '0 auto', background: 'var(--color-text)', color: 'var(--on-text)', padding: '14px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-lg)' }}>
        <I.Check size={16} sw={2.5} />
        <span>{n === 1 ? 'Day stamped. Your streak starts today.' : `Day stamped. ${n} days in a row.`}</span>
      </div>
    </div>
  );
}

/** Calendar: the streak strip above the month (stamp, days in a row, best, link to Achievements). */
export function StreakStrip() {
  const { data: d } = useApp();
  const t = todayISO(), n = currentStreak(d, t), best = bestStreak(d, t);
  const earned = Object.keys(d.trophies ?? {}).length;
  return (
    <button type="button" onClick={() => setUI({ page: 'trophies' })} className="hv-n100" style={{ background: 'var(--surface)', borderRadius: 24, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, border: 0, font: 'inherit', color: 'var(--color-text)', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
      <span aria-hidden="true" style={{ width: 52, height: 52, flex: 'none' }}><Seal n={n} small /></span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{n > 0 ? (n === 1 ? '1 day in a row up to date' : `${n} days in a row up to date`) : 'Start your streak today'}</span>
        <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{best > 0 ? (best === 1 ? 'Best streak: 1 day' : `Best streak: ${best} days`) : 'Log an expense or tap "I spent nothing"'}</span>
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 2 }}>{`Achievements ${earned}/${ACHIEVEMENTS.length}`}<I.Chevron size={14} /></span>
    </button>
  );
}

/** Calendar, under the day's list: mark today as "nothing spent" when it has no expenses. */
export function ZeroDayButton({ day }: { day: string }) {
  const { data: d } = useApp();
  const t = todayISO();
  if (day > t || spendDays(d).has(day)) return null;
  const on = (d.zeroDays ?? []).includes(day);
  // Only today can be stamped: a past day missed is missed (one marked before can still be undone).
  if (day !== t && !on) return null;
  const mark = () => {
    // Stamping today for the first time already plays the bigger haptic (startStreakWatch).
    if (!on && day !== t) flash(`${shortDate(day)} marked as nothing spent`);
    setData(x => toggleZero(x, day));
  };
  if (on) return (
    <button type="button" onClick={mark} className="hv-n200" style={btn('var(--surface)', 'var(--color-neutral-700)')}>
      <span>{day === t ? 'Nothing spent today' : 'Nothing spent this day'}</span><span style={{ color: 'var(--brand)' }}>Undo</span>
    </button>
  );
  return (
    <TapLabel onClick={mark} style={btn('var(--action)', 'var(--action-ink)')}>
      <I.Check size={18} sw={2.5} /> {day === t ? 'I spent nothing today' : 'I spent nothing this day'}
    </TapLabel>
  );
}
const btn = (bg: string, fg: string): React.CSSProperties => ({ width: '100%', minHeight: 48, borderRadius: 999, border: 0, background: bg, color: fg, font: 'inherit', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' });

const GROUPS: [Group, string][] = [['streak', 'Streak'], ['start', 'First steps'], ['control', 'Control'], ['saving', 'Saving'], ['hidden', 'Hidden']];
const TONE: Record<Group, [string, string]> = {
  streak: ['var(--brand)', 'var(--action-ink)'], start: ['var(--brand)', 'var(--action-ink)'],
  control: ['var(--stamp)', 'var(--stamp-ink)'], saving: ['var(--gold)', 'var(--gold-ink)'], hidden: ['var(--stamp)', 'var(--stamp-ink)']
};

/** Every achievement, earned ones in colour with their date, locked ones grey with progress. */
export function TrophiesPage() {
  const { data: d } = useApp();
  const t = todayISO(), got = d.trophies ?? {};
  const earned = ACHIEVEMENTS.filter(a => got[a.id]).length;
  return (
    <SubPage title="Achievements" back={() => setUI({ page: null })} backLabel="Back">
      <div style={{ background: 'var(--surface)', borderRadius: 24, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, textAlign: 'center' }}>
        <Stat n={currentStreak(d, t)} label="Current streak" />
        <Stat n={bestStreak(d, t)} label="Best streak" />
        <Stat n={earned} label={`of ${ACHIEVEMENTS.length} earned`} />
      </div>
      {GROUPS.map(([g, title]) => (
        <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, padding: '6px 4px 0' }}>{title}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {ACHIEVEMENTS.filter(a => a.group === g).map(a => <Badge key={a.id} a={a} d={d} at={got[a.id]} today={t} />)}
          </div>
        </div>
      ))}
    </SubPage>
  );
}
function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
      <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', lineHeight: 1.25 }}>{label}</span>
    </div>
  );
}
function Badge({ a, d, at, today }: { a: (typeof ACHIEVEMENTS)[number]; d: Data; at?: string; today: string }) {
  const secret = a.hidden && !at;
  const [bg, fg] = TONE[a.group];
  const p = !at && a.progress ? a.progress(d, today) : 0;
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 14, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div className="hex" aria-hidden="true" style={{ background: at ? bg : 'var(--color-neutral-200)', color: at ? fg : 'var(--color-neutral-600)' }} translate="no">
        {secret ? '?' : a.mark}
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25, color: at ? 'var(--color-text)' : 'var(--color-neutral-700)' }}>{secret ? 'Hidden achievement' : a.name}</span>
      <span style={{ fontSize: 12.5, lineHeight: 1.35, color: 'var(--color-neutral-700)' }}>{secret ? 'Keep using POCKETS to find it' : a.desc}</span>
      {at ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)' }}>{`Earned ${shortDate(at)}`}</span>
        : p > 0 && <div role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${a.name} progress`} style={{ height: 6, borderRadius: 9, background: 'var(--color-neutral-200)', overflow: 'hidden', marginTop: 2 }}><div style={{ width: `${p * 100}%`, height: '100%', background: 'var(--brand)', borderRadius: 9 }} /></div>}
    </div>
  );
}
