import { useApp, openSheet, setData } from '../lib/store';
import { RED, ink, tint } from '../lib/constants';
import { allStats, ctxOf, curSymbol, fmt, num, pctOf } from '../lib/derive';
import { monthLabel } from '../lib/dates';
import { Bar } from '../ui/bits';
import * as I from '../ui/icons';
import { MoneyInput } from '../ui/MoneyInput';

export default function Budget() {
  const { data: d } = useApp();
  const c = ctxOf(d), weeks = c.weeks, cur = curSymbol();
  const income = num(d.incomeStr);
  const all = allStats(d, c);
  const alloc = all.reduce((a, s) => a + s.weekly, 0) * weeks, unalloc = income - alloc;
  const setPocket = (id: string, patch: { name?: string; weeklyStr?: string }) => setData(x => ({ pockets: x.pockets.map(p => p.id === id ? { ...p, ...patch } : p) }));
  const removePocket = (id: string) => setData(x => ({ pockets: x.pockets.filter(p => p.id !== id), moves: x.moves.filter(m => m.from !== id && m.to !== id) }));
  const chipStyle = { fontSize: 13, fontWeight: 600, background: 'var(--color-neutral-200)', padding: '7px 12px', borderRadius: 999, whiteSpace: 'nowrap' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '4px 4px 0', display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{monthLabel(c.month)}</span>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>Budget</span>
      </div>
      <div style={{ background: '#fff', borderRadius: 28, padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>Monthly income</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 34, fontWeight: 700, color: 'var(--color-neutral-500)' }}>{cur}</span>
          <MoneyInput value={d.incomeStr} onChange={v => setData({ incomeStr: v })}
            style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-text)', padding: 0, outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          <span style={chipStyle}>{weeks} weeks</span>
          <span style={chipStyle}>{fmt(income / weeks)} per week</span>
        </div>
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
        <button onClick={() => openSheet({ name: 'editPocket', id: null })} className="hv-white" style={{ height: 50, borderRadius: 999, border: '2px dashed var(--color-neutral-400)', background: 'transparent', color: 'var(--color-text)', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <I.Plus size={18} />
          Add pocket
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 24, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Bar pct={pctOf(alloc, income)} track="var(--color-neutral-200)" fill={unalloc < 0 ? 'var(--color-accent)' : 'oklch(0.62 0.12 160)'} ease=".3s" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, gap: 8 }}>
          <span style={{ color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>Planned for {weeks} weeks</span><span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(alloc)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, gap: 8 }}>
          <span style={{ color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{unalloc < 0 ? 'Over your income by' : 'Free for bills and saving'}</span>
          <span style={{ fontWeight: 700, color: unalloc < 0 ? RED : 'var(--color-text)', whiteSpace: 'nowrap' }}>{fmt(Math.abs(unalloc))}</span>
        </div>
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
