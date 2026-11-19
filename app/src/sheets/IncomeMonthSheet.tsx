// "This month was different": what really came in this month, and which pockets give up (or get) the difference.
// Only this month changes; the next one goes back to the normal monthly income.
import { useState } from 'react';
import { closeSheet, flash, setData, useApp } from '../lib/store';
import { allStats, ctxOf, fmt, moneyScale, monthPlanOf, monthStats, num } from '../lib/derive';
import { monthName } from '../lib/dates';
import { setMonthIncome } from '../lib/salary';
import { largestRemainder } from '../lib/split';
import { SheetFrame } from './Sheet';
import { FieldLabel, SmallAmount } from '../ui/bits';
import { MoneyInput } from '../ui/MoneyInput';
import { RED, TEXT, ink, tint } from '../lib/constants';

type How = 'spread' | 'one' | 'mine' | 'none';

export function IncomeMonthSheet() {
  const { data: d } = useApp();
  const c = ctxOf(d), normal = num(d.incomeStr), set = d.monthIncome?.[c.month];
  const [amtStr, setAmtStr] = useState(String(set?.amt ?? normal));
  const [how, setHow] = useState<How>('spread');
  const [mine, setMine] = useState<Record<string, string>>({});
  const amt = num(amtStr), diff = Math.round((amt - normal) * moneyScale()) / moneyScale(), gap = Math.abs(diff);
  const stats = allStats(d, c), month = monthName(c.month), Month = month.replace(/^./, x => x.toUpperCase());
  // A cut comes only out of what each pocket still has this month (never below zero); more is shared by the plan.
  const room = Object.fromEntries(d.pockets.map(p => [p.id, Math.max(0, monthStats(d, p.id, c).left)]));
  const roomAll = Object.values(room).reduce((a, v) => a + v, 0), take = diff < 0 ? Math.min(gap, roomAll) : gap;
  // Less: the pocket with the most left this month gives it all, if it can.
  const biggest = [...stats].sort((a, b) => (room[b.id] ?? 0) - (room[a.id] ?? 0))[0];
  const spread = () => {
    const parts = largestRemainder(take, d.pockets.map(p => (diff < 0 ? room[p.id] : monthPlanOf(p, c))), moneyScale());
    return Object.fromEntries(d.pockets.map((p, i) => [p.id, parts[i] ?? 0]));
  };
  const chosen: Record<string, number> = how === 'spread' ? spread() : how === 'one' && biggest ? { [biggest.id]: gap } : how === 'mine' ? Object.fromEntries(Object.entries(mine).map(([k, v]) => [k, num(v)])) : {};
  const sign = diff < 0 ? -1 : 1, picked = Object.values(chosen).reduce((a, v) => a + v, 0);
  const over = how === 'mine' && diff < 0 && Object.entries(chosen).some(([k, v]) => v > (room[k] ?? 0) + 0.004);
  const cant = !(amt >= 0) || over || (how === 'mine' && Math.abs(picked - take) > 0.004);

  const save = () => {
    if (cant) return;
    const adj = Object.fromEntries(Object.entries(chosen).map(([k, v]) => [k, sign * v]));
    setData(x => (diff === 0 ? setMonthIncome(x, c.month, undefined) : setMonthIncome(x, c.month, amt, adj, c.today)));
    closeSheet();
    flash(diff === 0 ? `${Month} is back to your normal income` : `${Month}: ${fmt(amt)} · pockets updated`);
  };
  const reset = () => { setData(x => setMonthIncome(x, c.month, undefined)); closeSheet(); flash(`${Month} is back to your normal income`); };

  const opt = (k: How, label: string) => (
    <button key={k} onClick={() => setHow(k)} aria-pressed={how === k} className="pr97" style={{ textAlign: 'left', minHeight: 44, padding: '10px 14px', borderRadius: 16, border: 0, background: how === k ? TEXT : 'var(--surface)', color: how === k ? 'var(--on-text)' : TEXT, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
  );

  return (
    <SheetFrame title="This month was different" action={{ label: 'Save', onClick: save, disabled: cant }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FieldLabel m="6px 4px 2px">{`How much came in for ${month}?`}</FieldLabel>
        <SmallAmount value={amtStr} onChange={setAmtStr} />
        <span style={{ margin: '0 4px', fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{`Your normal income is ${fmt(normal)}. Only ${month} changes.`}</span>

        {diff !== 0 && <>
          <div style={{ marginTop: 6, background: diff < 0 ? 'var(--color-accent-100)' : 'oklch(0.95 0.05 150)', borderRadius: 18, padding: '12px 14px' }}>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: diff < 0 ? RED : 'oklch(0.38 0.1 150)' }}>{diff < 0 ? `${fmt(gap)} less came in` : `${fmt(gap)} more came in`}</span>
            <span style={{ fontSize: 13, color: diff < 0 ? RED : 'oklch(0.38 0.1 150)' }}>{diff < 0 ? 'Which pockets give it up?' : 'What do we do with the extra?'}</span>
          </div>
          {opt('spread', diff < 0 ? 'Share the cut among all pockets' : 'Share it among all pockets')}
          {diff < 0 && biggest && (room[biggest.id] ?? 0) >= gap && opt('one', `Take it from ${biggest.name} (it has ${fmt(room[biggest.id])} left)`)}
          {opt('mine', 'Let me choose')}
          {opt('none', diff < 0 ? "Don't change my pockets" : 'Keep it saved, pockets stay the same')}
          {how === 'mine' && <div style={{ background: 'var(--surface)', borderRadius: 18, padding: '6px 12px' }}>
            {stats.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{s.name}</span>
                <div style={{ width: 130, background: tint(s.hue), borderRadius: 12, padding: '6px 10px' }}>
                  <MoneyInput value={mine[s.id] ?? ''} onChange={v => setMine(m => ({ ...m, [s.id]: v }))} ariaLabel={`${s.name} amount`} style={{ width: '100%', border: 0, background: 'transparent', fontSize: 15, fontWeight: 700, color: ink(s.hue), textAlign: 'right', outline: 'none' }} />
                </div>
              </div>
            ))}
            <span style={{ display: 'block', padding: '4px 0 6px', fontSize: 12.5, color: over || Math.abs(picked - take) > 0.004 ? RED : 'var(--color-neutral-700)' }}>{over ? 'A pocket can give up at most what it has left this month.' : `${fmt(picked)} of ${fmt(take)}`}</span>
          </div>}
          {diff < 0 && take < gap && how !== 'none' && <span style={{ margin: '0 4px', fontSize: 12.5, lineHeight: 1.4, color: RED }}>{`Your pockets only have ${fmt(roomAll)} left this month, so that's all they can give up. The other ${fmt(gap - take)} comes out of what's in your accounts.`}</span>}
          {how !== 'none' && <span style={{ margin: '0 4px', fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>{`Spread over the weeks left in ${month}. Next month goes back to normal.`}</span>}
        </>}
        {set && <button onClick={reset} style={{ marginTop: 8, height: 44, borderRadius: 999, border: 0, background: 'transparent', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Back to my normal income</button>}
      </div>
    </SheetFrame>
  );
}
