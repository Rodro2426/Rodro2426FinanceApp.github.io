// Calendar → a day up to today: "How that week went". Each pocket's period that holds the day (spent, budget, left),
// or just that day (spent vs the day's allowance), with a one-line verdict on top.
import { useState } from 'react';
import { useApp } from '../lib/store';
import { dayStats, fmt, myExpenses, pocketStats } from '../lib/derive';
import { ctxAt, shortDate, todayISO } from '../lib/dates';
import { RED, ink, tint } from '../lib/constants';
import { PocketDot, SectionHead, Segmented } from './bits';

export function DaySummary({ day }: { day: string }) {
  const { data: d } = useApp();
  const [view, setView] = useState<'day' | 'week'>('week');
  const today = todayISO();
  if (day > today || !d.pockets.length) return null;
  const c = ctxAt(day), ended = c.weekEnd < today;
  const rows = d.pockets.map(p => {
    const s = pocketStats(d, p.id, c)!, ds = dayStats(d, p.id, c, s);
    const onDay = myExpenses(d).filter(e => e.p === p.id && e.date === day).reduce((a, e) => a + e.amt, 0);
    return { s, onDay, allowance: ds.active ? ds.allowance : 0 };
  });
  const over = rows.filter(r => r.s.left < -0.005);
  const left = rows.reduce((a, r) => a + r.s.left, 0), spent = rows.reduce((a, r) => a + r.s.spent, 0), budget = rows.reduce((a, r) => a + r.s.budget, 0);
  const daySpent = rows.reduce((a, r) => a + r.onDay, 0), dayAllow = rows.reduce((a, r) => a + r.allowance, 0);
  const bad = view === 'week' ? over.length > 0 : dayAllow > 0 && daySpent > dayAllow + 0.005;
  const head = view === 'week'
    ? (over.length === 1 ? `${over[0].s.name} went over by ${fmt(-over[0].s.left)}` : over.length > 1 ? `${over.length} pockets went over` : ended ? `You had ${fmt(left)} left over` : `${fmt(left)} left so far`)
    : (daySpent > 0 ? `You spent ${fmt(daySpent)} that day` : 'Nothing spent that day');
  const note = view === 'week'
    ? (over.length ? `Spent ${fmt(spent)} of ${fmt(budget)} in all` : ended ? `Spent ${fmt(spent)} of ${fmt(budget)} · a clean week` : `Spent ${fmt(spent)} of ${fmt(budget)} so far`)
    : (dayAllow > 0 ? `That day's allowance was ${fmt(dayAllow)}` : 'No pocket had that day as a spending day');
  const tone = bad ? { bg: 'var(--color-accent-100)', fg: 'var(--color-accent-800)' } : { bg: 'var(--ok-bg)', fg: 'var(--ok-ink)' };
  return (
    <>
      <SectionHead title={ended ? 'How that week went' : 'How this week is going'} right={`${shortDate(c.weekStart)} – ${shortDate(c.weekEnd)}`} muted />
      <Segmented items={[['day', 'That day'], ['week', 'Whole week']]} value={view} onPick={setView} mt={0} h={36} />
      <div style={{ background: tone.bg, borderRadius: 22, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: tone.fg }}>{view === 'week' ? (over.length ? (over.length === 1 ? '1 pocket ended in the red' : `${over.length} pockets ended in the red`) : ended ? 'Every pocket ended in the green' : 'Every pocket is in the green') : day === today ? 'Today' : 'That day'}</span>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, color: 'var(--color-text)' }}>{head}</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{note}</span>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 24, padding: '4px 16px' }}>
        {rows.map(({ s, onDay, allowance }, i) => {
          const used = view === 'week' ? s.spent : onDay, of = view === 'week' ? s.budget : allowance;
          const red = view === 'week' ? s.left < -0.005 : of > 0 && used > of + 0.005;
          const pct = of > 0 ? Math.min(100, (used / of) * 100) : used > 0 ? 100 : 0;
          const line = view === 'week'
            ? (s.left < -0.005 ? `Went over by ${fmt(-s.left)} of ${fmt(s.budget)}` : ended || s.to < today ? `${fmt(s.left)} left over of ${fmt(s.budget)}` : `${fmt(s.left)} left of ${fmt(s.budget)}`)
            : (onDay > 0 ? (allowance > 0 ? `Spent ${fmt(onDay)} of ${fmt(allowance)} for the day` : `Spent ${fmt(onDay)} that day`) : 'Nothing that day');
          return (
            <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '11px 0', borderTop: i ? '1px solid var(--color-neutral-200)' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PocketDot st={s} size={30} fs={13} bg={tint(s.hue)} color={ink(s.hue)} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                {view === 'week' && s.period !== 'week' && <span style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>{`${shortDate(s.from)} – ${shortDate(s.to)}`}</span>}
              </div>
              <div role="progressbar" aria-label={`${s.name}: ${line}`} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} style={{ height: 7, borderRadius: 9, background: tint(s.hue), overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 9, background: red ? RED : ink(s.hue) }} />
              </div>
              <span style={{ fontSize: 12.5, color: red ? RED : 'var(--color-neutral-700)', fontWeight: red ? 700 : 500 }}>{line}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
