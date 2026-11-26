// "Do your accounts cover your pockets?" in detail: the pockets' promise, each account, debts, and two what-ifs.
import { useState } from 'react';
import { useApp, openSheet } from '../lib/store';
import { LINE, RED } from '../lib/constants';
import { allStats, ctxOf, fmt } from '../lib/derive';
import { addDays, monthName } from '../lib/dates';
import { monthSummary } from '../lib/plan';
import { baseIncome } from '../lib/salary';
import { debtOutlook } from '../lib/debts';
import { Toggle } from '../ui/bits';
import { SheetFrame } from './Sheet';

const GOOD = 'var(--safe-g-label)';

function Row({ label, sub, value, color, bold, first }: { label: string; sub?: string; value: string; color?: string; bold?: boolean; first?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: first ? 0 : `1px solid ${LINE}` }}>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: bold ? 700 : 500 }}>{label}</span>
        {sub && <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{sub}</span>}
      </span>
      <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', color: color ?? 'var(--color-text)' }}>{value}</span>
    </div>
  );
}

function WhatIf({ on, onChange, title, sub }: { on: boolean; onChange: (v: boolean) => void; title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: `1px solid ${LINE}` }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', lineHeight: 1.35 }}>{sub}</span>
      </span>
      <Toggle on={on} onChange={onChange} label={title} />
    </div>
  );
}

export function MoneyCheckSheet() {
  const { data: d } = useApp();
  const c = ctxOf(d), sum = monthSummary(d, c), debts = debtOutlook(d, c.today);
  const next = addDays(c.month + '-28', 7).slice(0, 7), nextIncome = baseIncome(d, next);
  // What-ifs only change this screen: the plan and Home keep counting what you actually have.
  const [withNext, setWithNext] = useState(false), [withOwed, setWithOwed] = useState(false);
  const extra = (withNext ? nextIncome : 0) + (withOwed ? debts.late : 0);
  const real = sum.real - extra, short = real > 0.004;
  const accts = d.accounts.filter(a => !a.notMine);
  // Next month starts with its income minus what this month borrows from it to cover the pockets.
  const borrowed = Math.min(nextIncome, Math.max(0, sum.real - (withOwed ? debts.late : 0))), startNext = nextIncome - borrowed;
  const tone = short ? { bg: 'var(--color-accent-100)', label: 'var(--color-accent-800)', amt: 'var(--color-accent-900)' } : { bg: 'var(--safe-g-bg)', label: 'var(--safe-g-label)', amt: 'var(--safe-g-amt)' };
  return (
    <SheetFrame title="Do your accounts cover your pockets?">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: tone.bg, borderRadius: 24, padding: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: tone.label }}>{short ? 'Missing to cover your pockets' : 'Your accounts cover every pocket'}</span>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em', color: tone.amt }}>{fmt(Math.abs(real))}</span>
          <span style={{ fontSize: 13, color: tone.label }}>{short ? (extra > 0 ? 'Even counting what you turned on below.' : 'Your pockets promise more than your accounts have.') : (extra > 0 ? 'Left over, counting what you turned on below.' : 'Left over after every pocket.')}</span>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 22, padding: '4px 16px' }}>
          <Row label="Left to spend in pockets" sub="what your pockets still promise this month" value={fmt(sum.toSpend)} bold first />
          {accts.map(a => <Row key={a.id} label={a.name} sub={a.type === 'card' ? 'Card debt' : undefined} value={a.type === 'card' ? (a.bal > 0 ? '−' + fmt(a.bal) : fmt(0)) : fmt(a.bal)} color={a.type === 'card' && a.bal > 0 ? RED : undefined} />)}
          {debts.backInTime > 0.004 && <Row label="Friends pay you back in time" value={'+' + fmt(debts.backInTime)} color={GOOD} />}
          {debts.oweSoon > 0.004 && <Row label="You pay back this month" value={'−' + fmt(debts.oweSoon)} color={RED} />}
          <Row label="In your accounts" sub="debit, savings and cash, minus card debt" value={fmt(sum.balance)} bold />
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 22, padding: '4px 16px' }}>
          <div style={{ padding: '12px 0 8px', fontSize: 13, fontWeight: 700, color: 'var(--color-neutral-700)' }}>What if…</div>
          <WhatIf on={withNext} onChange={setWithNext} title={`Count ${monthName(next)}'s income`} sub={nextIncome > 0 ? `Adds ${fmt(nextIncome)}, the income you expect next month.` : 'You have no monthly income set yet.'} />
          {withNext && nextIncome > 0 && <div style={{ margin: '0 0 12px', background: 'var(--safe-g-bg)', color: 'var(--safe-g-label)', borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{`In ${monthName(next)} you'll start with`}</span>
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--safe-g-amt)' }}>{fmt(startNext)}</span>
            <span style={{ fontSize: 12.5 }}>{borrowed <= 0.004 ? "This month doesn't need any of it." : startNext <= 0.004 ? 'This month uses all of it.' : `Your ${fmt(nextIncome)} income minus ${fmt(borrowed)} that covers this month.`}</span>
          </div>}
          <WhatIf on={withOwed} onChange={setWithOwed} title="Count what people owe you" sub={debts.late > 0.004 ? `Adds ${fmt(debts.late)} that friends owe you with no date or after this month.` : 'Nobody owes you money that is late or has no date.'} />
          {extra > 0 && <Row label="Counted from what-ifs" value={'+' + fmt(extra)} color={GOOD} />}
          {extra > 0 && <Row label={short ? 'Still missing' : 'Left over with this'} value={fmt(Math.abs(real))} color={short ? RED : GOOD} bold />}
        </div>

        {sum.real > 0.004 && allStats(d, c).some(p => p.left > 0.004) && <button onClick={() => openSheet({ name: 'cover' })} style={{ height: 48, borderRadius: 999, border: 0, background: 'var(--action)', color: 'var(--action-ink)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Cover it with this week's leftovers</button>}
        <span style={{ margin: '0 6px', fontSize: 12.5, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>The switches only change this screen, to see how it would look. Your plan keeps counting the money you have today.</span>
      </div>
    </SheetFrame>
  );
}
