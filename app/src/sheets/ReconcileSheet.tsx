import { useState } from 'react';
import { useApp, setData, flash } from '../lib/store';
import { LINE, RED, TEXT } from '../lib/constants';
import { ctxOf, fmt, incomeMoves } from '../lib/derive';
import { monthKey, monthName, shortDate } from '../lib/dates';
import { isExtraIncome, findMismatches, markIncluded, markNotIncluded, monthSummary, undoMoves } from '../lib/plan';
import type { Move } from '../lib/types';
import { Toggle } from '../ui/bits';
import { SheetFrame } from './Sheet';

/** Finds "New income" pocket money that isn't backed by an income, or is already in the typed monthly income. */
export function ReconcileSheet() {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const mm = findMismatches(d, c), s = monthSummary(d, c);
  const [confirm, setConfirm] = useState(false);
  const extras = d.incomes.filter(t => isExtraIncome(t) && monthKey(t.date) === c.month);
  const pocket = (id: string) => d.pockets.find(p => p.id === id)?.name ?? 'Deleted pocket';
  const all = [...mm.orphan, ...mm.included];
  const total = all.reduce((a, m) => a + m.amt, 0);

  const undo = (ms: Move[], what: string) => { setData(x => undoMoves(x, ms.map(m => m.id))); flash(`${what} undone · ${fmt(ms.reduce((a, m) => a + m.amt, 0))} taken out of pockets`); setConfirm(false); };
  const list = (ms: Move[], why: string) => ms.map((m, i) => (
    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: `1px solid ${i === ms.length - 1 ? 'transparent' : LINE}` }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>New income → {pocket(m.to)}</span>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Week of {shortDate(m.week)}{m.month && (m.spread ?? 1) > 1 ? ` · over ${m.spread} weeks` : ''} · {why}</span>
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>+{fmt(m.amt)}</span>
      <button onClick={() => undo([m], 'Move')} style={{ height: 32, padding: '0 12px', borderRadius: 999, border: 0, background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Undo</button>
    </div>
  ));

  return (
    <SheetFrame title="Review mismatches">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ margin: '0 4px', fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>
          Pocket money that came from income ("New income") should be backed by an income you registered, and not already be part of your typed monthly income. Otherwise it's counted twice.
        </span>

        <div style={{ background: '#fff', borderRadius: 22, padding: '12px 16px' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>No income behind it</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 2 }}>Usually from an income that was deleted before splits were linked to it.</span>
          {mm.orphan.length ? list(mm.orphan, 'no income') : <div style={{ padding: '10px 0 2px', fontSize: 13, color: 'oklch(0.45 0.11 150)', fontWeight: 600 }}>None found.</div>}
        </div>

        <div style={{ background: '#fff', borderRadius: 22, padding: '12px 16px' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Already in your typed income</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-700)', marginTop: 2 }}>Splits of income you marked as already included below.</span>
          {mm.included.length ? list(mm.included, 'already included') : <div style={{ padding: '10px 0 2px', fontSize: 13, color: 'oklch(0.45 0.11 150)', fontWeight: 600 }}>None found.</div>}
        </div>

        <div style={{ background: '#fff', borderRadius: 22, padding: '12px 16px' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Extra income in {monthName(c.month)}</span>
          <span style={{ display: 'block', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)', marginTop: 2 }}>Turn on if you already added it to the monthly income you typed in Budget, so it isn't added again.</span>
          {extras.map((t, i) => {
            const split = incomeMoves(d.moves, t).reduce((a, m) => a + m.amt, 0);
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: `1px solid ${i === extras.length - 1 ? 'transparent' : LINE}` }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{t.note} · {fmt(t.amt)}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{shortDate(t.date)}{split ? ` · ${fmt(split)} in pockets` : ' · all saved'}{t.inBase ? ' · already included' : ''}</span>
                </div>
                <Toggle on={!!t.inBase} onChange={on => setData(x => (on ? markIncluded(x, [t.id], [t.id]) : markNotIncluded(x, t.id)))} label={`${t.note} already included`} />
              </div>
            );
          })}
          {extras.length === 0 && <div style={{ padding: '10px 0 2px', fontSize: 13, color: 'var(--color-neutral-700)' }}>No extra income registered this month.</div>}
        </div>

        {all.length > 0 && (
          <button onClick={() => (confirm ? undo(all, `${all.length} moves`) : setConfirm(true))} style={{ height: 52, borderRadius: 999, border: 0, background: confirm ? 'var(--color-accent)' : 'var(--color-accent-100)', color: confirm ? '#fff' : 'var(--color-accent-800)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            {confirm ? `Tap again to undo all ${all.length} (${fmt(total)})` : `Undo all ${all.length} mismatches (${fmt(total)})`}
          </button>
        )}
        <div style={{ background: '#fff', borderRadius: 22, padding: '12px 16px', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-neutral-700)' }}>Plan vs income</span><b style={{ color: s.planGap < 0 ? RED : TEXT }}>{fmt(s.planGap, true)}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-neutral-700)' }}>Real shortfall</span><b style={{ color: s.real > 0 ? RED : TEXT }}>{fmt(Math.max(0, s.real))}</b></div>
        </div>
      </div>
    </SheetFrame>
  );
}
