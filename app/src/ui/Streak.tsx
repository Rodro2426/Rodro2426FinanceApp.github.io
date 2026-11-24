// "Stamp of the month": the streak card on Home, the stamp that drops when today is stamped, and the Achievements page.
import { flash, getData, getState, onPersist, setData, setUI, useApp } from '../lib/store';
import { ACHIEVEMENTS, bestStreak, currentStreak, newlyEarned, sealedDays, spendDays, toggleZero, type Group } from '../lib/achievements';
import { addDays, daysInMonth, monthName, shortDate, todayISO } from '../lib/dates';
import { weekdayOf, DAY_LETTERS } from '../lib/derive';
import { tr } from '../lib/i18n';
import { SubPage } from '../screens/Reports';
import { haptic } from './haptic';
import * as I from './icons';
import type { Data } from '../lib/types';

const days = (n: number) => (n === 1 ? '1 day in a row' : `${n} days in a row`);

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

/** The stamp that drops in the middle of the screen, with a note at the bottom. */
export function StreakStamp({ n }: { n: number }) {
  return (
    <div aria-live="polite" style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="stamp-drop" style={{ width: 168, height: 168, borderRadius: 999, border: '6px solid var(--stamp)', color: 'var(--stamp)', background: 'color-mix(in srgb, var(--surface-solid) 80%, transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, boxShadow: 'var(--shadow-lg)' }}>
        <span style={{ fontSize: 50, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
        <span style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>{n === 1 ? 'day up to date' : 'days up to date'}</span>
      </div>
      <div role="status" className="stamp-note" style={{ position: 'absolute', left: 18, right: 18, bottom: 'calc(var(--tb) + 82px)', maxWidth: 460, margin: '0 auto', background: 'var(--color-text)', color: 'var(--on-text)', padding: '14px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-lg)' }}>
        <I.Check size={16} sw={2.5} />
        <span>{n === 1 ? 'Day stamped. Your streak starts today.' : `Day stamped. ${n} days in a row.`}</span>
      </div>
    </div>
  );
}

/** Home: this month as a calendar, stamped days filled, and the "I spent nothing today" button. */
export function StreakCard() {
  const { data: d } = useApp();
  const t = todayISO(), month = t.slice(0, 7);
  const spent = spendDays(d), zero = new Set(d.zeroDays ?? []);
  const streak = currentStreak(d, t);
  const todayCount = d.expenses.filter(e => e.date === t).length;
  const first = month + '-01', lead = weekdayOf(first), n = daysInMonth(month);
  const cells = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => addDays(first, i))];
  const markZero = (day: string) => {
    if (spent.has(day) || day > t) return;
    const on = !zero.has(day);
    // Stamping today for the first time already plays the bigger haptic (startStreakWatch).
    if (on && (day !== t || d.stampDay === t)) haptic('tap');
    setData(x => toggleZero(x, day));
    if (day !== t) flash(on ? `${shortDate(day)} marked as nothing spent` : `${shortDate(day)} unmarked`);
  };
  const earned = Object.keys(d.trophies ?? {}).length;
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 24, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', textTransform: 'capitalize' }}>{monthName(month)}</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{streak > 0 ? days(streak) : 'Start your streak today'}</span>
      </div>
      <div role="grid" aria-label="Days stamped this month" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 5 }}>
        {DAY_LETTERS.map((l, i) => <span key={'h' + i} aria-hidden="true" style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-neutral-600)', textAlign: 'center' }}>{l}</span>)}
        {cells.map((day, i) => {
          if (!day) return <span key={'b' + i} />;
          const kind = spent.has(day) ? 'spent' : zero.has(day) ? 'zero' : day === t ? 'today' : day < t ? 'missed' : 'future';
          const canTap = !spent.has(day) && day <= t;
          const label = `${shortDate(day)}: ${kind === 'spent' ? 'expenses logged' : kind === 'zero' ? 'nothing spent' : kind === 'future' ? 'coming up' : 'not stamped'}`;
          return (
            <button key={day} type="button" className={`stamp-day ${kind}`} disabled={!canTap} onClick={() => markZero(day)} aria-label={label} aria-pressed={kind === 'zero'} translate="no">
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
      {todayCount > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: 'var(--color-neutral-700)', minHeight: 44, justifyContent: 'center' }}>
          <I.Check size={16} sw={2.5} />
          <span>{todayCount === 1 ? 'Today is stamped: you logged 1 expense' : `Today is stamped: you logged ${todayCount} expenses`}</span>
        </div>
      ) : zero.has(t) ? (
        <button type="button" onClick={() => markZero(t)} className="hv-n200" style={btn('var(--color-neutral-100)', 'var(--color-neutral-700)')}>
          <span>Nothing spent today</span><span style={{ color: 'var(--brand)' }}>Undo</span>
        </button>
      ) : (
        <button type="button" onClick={() => markZero(t)} style={btn('var(--action)', 'var(--action-ink)')}>
          <I.Check size={18} sw={2.5} /> I spent nothing today
        </button>
      )}
      <button type="button" onClick={() => setUI({ page: 'trophies' })} className="sec-link" style={{ border: 0, background: 'none', padding: '2px 0', cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 32 }}>
        <span>{`Achievements: ${earned} of ${ACHIEVEMENTS.length}`}</span><I.Chevron size={14} />
      </button>
    </div>
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
    <SubPage title="Achievements" back={() => setUI({ page: null })} backLabel="Back to home">
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
