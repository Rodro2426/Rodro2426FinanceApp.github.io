import { useRef, useState } from 'react';
import { useApp, openSheet, setData, flash } from '../lib/store';
import { extraIncomes, findMismatches, markIncluded, monthSummary } from '../lib/plan';
import { incomeMoves } from '../lib/derive';
import { LINE, RED, TEXT, ink, tint } from '../lib/constants';
import { allStats, ctxOf, curSymbol, fmt, num, pctOf } from '../lib/derive';
import { monthLabel } from '../lib/dates';
import { Bar } from '../ui/bits';
import * as I from '../ui/icons';
import { MoneyInput } from '../ui/MoneyInput';

const line = (label: string, value: string, sub?: string, color?: string) => (
  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 14, gap: 8 }}>
    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <span style={{ color: 'var(--color-neutral-700)' }}>{label}</span>
      {sub && <span style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>{sub}</span>}
    </span>
    <span style={{ fontWeight: 700, color: color ?? 'var(--color-text)', whiteSpace: 'nowrap' }}>{value}</span>
  </div>
);

export default function Budget() {
  const { data: d } = useApp();
  const c = ctxOf(d), weeks = c.weeks, cur = curSymbol();
  const income = num(d.incomeStr);
  const all = allStats(d, c);
  const sum = monthSummary(d, c), extras = extraIncomes(d, c);
  const mm = findMismatches(d, c), issues = mm.orphan.length + mm.included.length;
  const splitFromExtra = sum.plan - all.reduce((a, s) => a + s.weekly, 0) * weeks;
  // Editing the typed income when this month already has extra income: ask whether it's already in there.
  const typedAtFocus = useRef(d.incomeStr);
  const [ask, setAsk] = useState<null | 'q' | 'pick'>(null);
  const [keep, setKeep] = useState<string[]>([]);
  const extraTotal = extras.reduce((a, t) => a + t.amt, 0);
  const onIncomeBlur = () => { if (d.incomeStr !== typedAtFocus.current && extras.length) { setKeep([]); setAsk('q'); } };
  const confirmIncluded = () => {
    setData(x => markIncluded(x, extras.map(t => t.id), keep));
    setAsk(null); flash(`Not added again · ${fmt(extraTotal)} of extra income is in your typed amount`);
  };
  const setPocket = (id: string, patch: { name?: string; weeklyStr?: string }) => setData(x => ({ pockets: x.pockets.map(p => p.id === id ? { ...p, ...patch } : p) }));
  const removePocket = (id: string) => setData(x => ({ pockets: x.pockets.filter(p => p.id !== id), moves: x.moves.filter(m => m.from !== id && m.to !== id) }));
  const chipStyle = { fontSize: 13, fontWeight: 600, background: 'var(--color-neutral-200)', padding: '7px 12px', borderRadius: 999, whiteSpace: 'nowrap' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '4px 4px 0', display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{monthLabel(c.month)}</span>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>Budget</span>
      </div>
      <div data-tour="income" style={{ background: '#fff', borderRadius: 28, padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>Monthly income</span>
        <div onFocus={() => { typedAtFocus.current = d.incomeStr; }} onBlur={onIncomeBlur} style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 34, fontWeight: 700, color: 'var(--color-neutral-500)' }}>{cur}</span>
          <MoneyInput value={d.incomeStr} onChange={v => setData({ incomeStr: v })} ariaLabel="Monthly income"
            style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-text)', padding: 0, outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          <span style={chipStyle}>{weeks} weeks</span>
          <span style={chipStyle}>{fmt(income / weeks)} per week</span>
          {sum.extra > 0 && <span style={{ ...chipStyle, background: 'oklch(0.95 0.045 155)', color: 'oklch(0.36 0.08 155)' }}>+{fmt(sum.extra)} extra this month</span>}
        </div>
        {sum.extra > 0 && <span style={{ marginTop: 4, fontSize: 13, color: 'var(--color-neutral-700)' }}>Month income: <b style={{ color: TEXT }}>{fmt(sum.income)}</b> ({fmt(sum.base)} typed + {fmt(sum.extra)} from {extras.length === 1 ? '1 extra income' : `${extras.length} extra incomes`})</span>}
        {ask === 'q' && (
          <div role="alertdialog" aria-label="Already included?" style={{ marginTop: 10, background: 'oklch(0.96 0.055 92)', borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35, color: 'oklch(0.33 0.07 70)' }}>Does this amount already include this month's extra income ({fmt(extraTotal)})?</span>
            <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'oklch(0.4 0.08 70)' }}>{extras.map(t => `${t.note} ${fmt(t.amt)}`).join(' · ')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAsk('pick')} style={{ flex: 1, height: 42, borderRadius: 999, border: 0, background: 'oklch(0.33 0.07 70)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Yes, it's included</button>
              <button onClick={() => { setAsk(null); flash(`Added on top: month income is ${fmt(sum.income)}`); }} style={{ flex: 1, height: 42, borderRadius: 999, border: 0, background: '#fff', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>No, add it on top</button>
            </div>
          </div>
        )}
        {ask === 'pick' && (
          <div role="alertdialog" aria-label="Which splits to keep" style={{ marginTop: 10, background: 'oklch(0.96 0.055 92)', borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'oklch(0.33 0.07 70)' }}>Then their pocket splits would count twice. Keep any of them?</span>
            {extras.map(t => {
              const split = incomeMoves(d.moves, t).reduce((a, m) => a + m.amt, 0), on = keep.includes(t.id);
              return (
                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: `1px solid ${LINE}`, fontSize: 13.5 }}>
                  <input type="checkbox" checked={on} onChange={() => setKeep(k => (on ? k.filter(x => x !== t.id) : [...k, t.id]))} style={{ width: 20, height: 20 }} />
                  <span style={{ flex: 1 }}>{t.note} · {fmt(t.amt)}</span>
                  <span style={{ color: 'var(--color-neutral-700)' }}>{split ? `${fmt(split)} in pockets` : 'not split'}</span>
                </label>
              );
            })}
            <span style={{ fontSize: 12, color: 'oklch(0.4 0.08 70)' }}>Ticked = keep its pocket split. The rest is taken back out of the pockets.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={confirmIncluded} style={{ flex: 1, height: 42, borderRadius: 999, border: 0, background: 'oklch(0.33 0.07 70)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Confirm</button>
              <button onClick={() => setAsk('q')} style={{ height: 42, padding: '0 16px', borderRadius: 999, border: 0, background: '#fff', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Back</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 4px 0' }}>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Weekly pockets</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>per week</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {all.map(s => {
          const p = d.pockets.find(x => x.id === s.id)!;
          return (
            <div key={s.id} style={{ background: '#fff', borderRadius: 22, padding: '10px 10px 10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => openSheet({ name: 'editPocket', id: s.id })} aria-label="Edit pocket" style={{ width: 40, height: 40, borderRadius: 999, border: 0, padding: 0, cursor: 'pointer', backgroundColor: tint(s.hue), backgroundImage: s.photoBg, backgroundSize: 'cover', backgroundPosition: 'center', color: ink(s.hue), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, flex: 'none' }}>{s.initial}</button>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <input value={p.name} onChange={e => setPocket(s.id, { name: e.target.value })} style={{ border: 0, background: 'transparent', fontSize: 16, fontWeight: 600, color: 'var(--color-text)', padding: '1px 0', outline: 'none', minWidth: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{fmt(s.weekly * weeks)} / month</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, background: tint(s.hue), borderRadius: 14, padding: '9px 12px', width: 116, flex: 'none' }}>
                <span style={{ fontSize: 14, color: ink(s.hue) }}>{cur}</span>
                <MoneyInput value={p.weeklyStr} onChange={v => setPocket(s.id, { weeklyStr: v })} style={{ width: '100%', minWidth: 0, border: 0, background: 'transparent', fontSize: 16, fontWeight: 700, color: ink(s.hue), padding: 0, outline: 'none', textAlign: 'right' }} />
              </div>
              <button onClick={() => removePocket(s.id)} aria-label="Remove pocket" className="hv-acc100r" style={{ width: 30, height: 30, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, background: 'transparent', color: 'var(--color-neutral-500)', cursor: 'pointer', padding: 0, flex: 'none' }}>
                <I.X size={15} />
              </button>
            </div>
          );
        })}
        <button data-tour="add-pocket" onClick={() => openSheet({ name: 'editPocket', id: null })} className="hv-white" style={{ height: 50, borderRadius: 999, border: '2px dashed var(--color-neutral-400)', background: 'transparent', color: 'var(--color-text)', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <I.Plus size={18} />
          Add pocket
        </button>
      </div>

      <div aria-label="Month plan" style={{ background: '#fff', borderRadius: 24, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Bar pct={pctOf(sum.plan, sum.income)} track="var(--color-neutral-200)" fill={sum.planGap < 0 ? 'var(--color-accent)' : 'oklch(0.62 0.12 160)'} ease=".3s" />
        {line('Month income', fmt(sum.income), sum.extra > 0 ? `${fmt(sum.base)} typed + ${fmt(sum.extra)} extra` : undefined)}
        {line(`Planned for ${weeks} weeks`, fmt(sum.plan), splitFromExtra > 0 ? `includes ${fmt(splitFromExtra)} split from extra income` : undefined)}
        {line(sum.planGap < 0 ? 'Over your income by' : 'Free for bills and saving', fmt(Math.abs(sum.planGap)), undefined, sum.planGap < 0 ? RED : undefined)}
        <div style={{ height: 1, background: LINE, margin: '2px 0' }} />
        {line('Left to spend in pockets', fmt(sum.toSpend), 'what your pockets still promise this month')}
        {line('In your accounts', fmt(sum.balance), 'debit, savings and cash, minus card debt')}
        {line(sum.real > 0 ? 'Real shortfall' : 'Covered by your accounts', fmt(Math.abs(sum.real)), sum.real > 0 ? 'the number that matters: it ignores what you already spent' : 'your accounts cover every pocket', sum.real > 0 ? RED : 'oklch(0.45 0.11 150)')}
        {sum.real > 0.004 && <div role="alert" style={{ background: 'var(--color-accent-100)', borderRadius: 14, padding: '10px 12px', fontSize: 13, lineHeight: 1.4, color: 'var(--color-accent-900)' }}>Your pockets add up to <b>{fmt(sum.real)}</b> more than you have in your accounts.</div>}
        <button onClick={() => openSheet({ name: 'reconcile' })} className="hv-n200" style={{ height: 42, borderRadius: 999, border: 0, background: issues ? 'oklch(0.96 0.055 92)' : 'var(--color-neutral-100)', color: issues ? 'oklch(0.33 0.07 70)' : TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {issues ? `Review mismatches (${issues})` : 'Review mismatches'}
        </button>
      </div>

      <div style={{ padding: '10px 4px 0', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Savings goals</div>
      {d.goals.map(g => {
        const k = ink(g.hue), rem = Math.max(0, g.target - g.saved);
        return (
          <div key={g.id} style={{ background: tint(g.hue), borderRadius: 26, padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: k }}>{g.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: k }}>{Math.round(g.saved / g.target * 100)}%</span>
            </div>
            <span style={{ fontSize: 13, color: k }}>{fmt(g.saved)} of {fmt(g.target)}</span>
            <div style={{ marginTop: 8 }}><Bar pct={pctOf(g.saved, g.target)} track="rgba(255,255,255,.8)" fill={k} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 10 }}>
              <span style={{ fontSize: 12, color: k }}>{rem <= 0 ? 'Goal reached' : `${fmt(rem / g.months)}/mo to finish in ${g.months} months`}</span>
              <button onClick={() => openSheet({ name: 'goal', id: g.id })} className="hv-w75" style={{ height: 36, padding: '0 16px', borderRadius: 999, border: 0, background: '#fff', color: k, fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Add money</button>
            </div>
          </div>
        );
      })}
      <button onClick={() => openSheet({ name: 'newGoal' })} className="hv-white" style={{ height: 50, borderRadius: 999, border: '2px dashed var(--color-neutral-400)', background: 'transparent', color: 'var(--color-text)', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <I.Plus size={18} />
        Add savings goal
      </button>
    </div>
  );
}
