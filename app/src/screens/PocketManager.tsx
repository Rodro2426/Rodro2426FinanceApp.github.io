import { useState, type CSSProperties } from 'react';
import { useApp, setData, setUI, openSheet, flash } from '../lib/store';
import { TEXT } from '../lib/constants';
import { ctxOf, editMove, fmt, myExpenses, isHalf, isMonthly, num, pocketStats, roundAmt, undoMove } from '../lib/derive';
import { ctxAt, monthLabel, monthName, shortDate } from '../lib/dates';
import { NEXT, borrowNext, transferLeftover } from '../lib/plan';
import { monthFlow, type Link, type PeriodRow } from '../lib/monthFlow';
import { ExpRow, PickChip, expView } from '../ui/bits';
import { MoneyInput } from '../ui/MoneyInput';
import { SubPage } from './Reports';
import * as I from '../ui/icons';

const shiftMonth = (m: string, n: number) => { const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 15); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const pillBtn: CSSProperties = { height: 40, padding: '0 16px', borderRadius: 999, border: 0, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--color-neutral-100)', color: TEXT };

/**
 * Pocket manager: a pocket's month period by period, with what moved from one to the next (sent on by hand,
 * taken from the next one, carried by itself, or left untouched), so mistakes are easy to spot and fix.
 */
export function PocketManager({ id }: { id: string }) {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const [month, setMonth] = useState(c.month);
  const [open, setOpen] = useState<string | null>(null);
  const [list, setList] = useState<string | null>(null);
  const p = d.pockets.find(x => x.id === id) ?? d.pockets[0];
  const back = () => setUI({ page: null });
  if (!p) return <SubPage title="Pocket manager" back={back} backLabel="Back"><span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>Add a pocket first.</span></SubPage>;
  const mon = isMonthly(p), half = isHalf(p);
  const rows = monthFlow(d, p.id, month, c.today);
  const name = (i: number) => mon ? monthName(month).replace(/^./, x => x.toUpperCase()) : half ? (i === 0 ? '1st quincena' : '2nd quincena') : `Week ${i + 1}`;
  // Where money from period i goes: the next row, or past the end of the month.
  const target = (i: number) => i + 1 < rows.length ? (half ? 'the 2nd quincena' : `week ${i + 2}`) : mon ? 'the next month' : half ? 'the next quincena' : 'the next week';
  const pick = (pid: string) => { setOpen(null); setUI({ page: `pockets:${pid}` }); };
  return (
    <SubPage title="Pocket manager" back={back} backLabel="Back">
      <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -18px', padding: '0 18px' }}>
        {d.pockets.map(x => { const st = pocketStats(d, x.id, c)!; return <div key={x.id} style={{ flex: 'none', whiteSpace: 'nowrap' }}><PickChip st={st} on={x.id === p.id} hue={x.hue} onClick={() => pick(x.id)} /></div>; })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
        <button onClick={() => { setOpen(null); setMonth(shiftMonth(month, -1)); }} aria-label="Previous month" className="hv-n200" style={{ ...pillBtn, width: 40, padding: 0, justifyContent: 'center', background: 'var(--surface)' }}><I.ChevronLeft size={18} /></button>
        <span style={{ fontSize: 16, fontWeight: 800 }}>{monthLabel(month)}</span>
        <button onClick={() => { setOpen(null); setMonth(shiftMonth(month, 1)); }} disabled={month >= c.month} aria-label="Next month" className="hv-n200" style={{ ...pillBtn, width: 40, padding: 0, justifyContent: 'center', background: 'var(--surface)', opacity: month >= c.month ? 0.35 : 1 }}><I.Chevron size={18} /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((r, i) => (
          <div key={r.from} style={{ display: 'flex', flexDirection: 'column' }}>
            <Period r={r} title={name(i)} count={myExpenses(d).filter(e => e.p === p.id && e.date >= r.from && e.date <= r.to).length} open={list === r.from} toggle={() => setList(list === r.from ? null : r.from)} />
            {list === r.from && <Spent pid={p.id} r={r} />}
            {r.links.map((l, k) => <LinkRow key={l.move?.id ?? l.kind + k} l={l} r={r} pid={p.id} to={target(i)} open={open === `${r.from}${k}`} toggle={() => setOpen(open === `${r.from}${k}` ? null : `${r.from}${k}`)} />)}
            {i < rows.length - 1 && <div style={{ height: 12 }} />}
          </div>
        ))}
      </div>
    </SubPage>
  );
}

function Period({ r, title, count, open, toggle }: { r: PeriodRow; title: string; count: number; open: boolean; toggle: () => void }) {
  const over = r.result < -0.004, now = r.state === 'now', future = r.state === 'future';
  const tone = over ? 'r' : 'g';
  const label = `var(--safe-${tone}-label)`, amt = `var(--safe-${tone}-amt)`;
  const had = r.budget !== r.base || r.carry !== 0;
  const pct = r.budget > 0 ? Math.min(100, (r.spent / r.budget) * 100) : r.spent > 0 ? 100 : 0;
  return (
    <div onClick={future ? undefined : toggle} role={future ? undefined : 'button'} aria-expanded={future ? undefined : open} className={future ? undefined : 'pr97'} style={{ cursor: future ? 'default' : 'pointer', transition: 'transform .15s ease', borderRadius: 26, padding: '20px 20px 18px', display: 'flex', flexDirection: 'column', background: future ? 'transparent' : now && !over ? 'var(--safe-g-now)' : `var(--safe-${tone}-bg)`, border: future ? '2px dashed var(--color-neutral-300)' : 0, color: future ? TEXT : amt, boxShadow: now ? '0 4px 14px rgba(0,0,0,.08)' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>{title}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: future ? 'var(--color-neutral-700)' : label, whiteSpace: 'nowrap' }}>{`${shortDate(r.from)} – ${shortDate(r.to)}`}</span>
      </div>
      {now && <span style={{ alignSelf: 'flex-start', marginTop: 8, fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: 'var(--glass)', color: label }}>This week</span>}
      <span style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: future ? 'var(--color-neutral-700)' : label }}>{future ? 'Starts with' : over ? 'You went over' : now ? 'You have left' : 'Left over'}</span>
      <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{fmt(future ? r.budget : r.result)}</span>
      {!future && <>
        <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Spent" style={{ marginTop: 14, height: 10, borderRadius: 9, background: 'var(--glass)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 9, background: `var(--safe-${tone}-bar)` }} />
        </div>
        <span style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5, fontWeight: 600, color: label, display: 'flex', flexWrap: 'wrap', columnGap: 4 }}>
          {had ? <>
            <span>{now ? `You have ${fmt(r.base)}` : `You had ${fmt(r.base)}`}</span>
            {r.carry > 0.004 && <span>{`+ ${fmt(r.carry)} from before`}</span>}
            {r.carry < -0.004 && <span>{`− ${fmt(-r.carry)} from before`}</span>}
            {r.fromPrev > 0.004 && <span>{`+ ${fmt(r.fromPrev)} that arrived`}</span>}
            {r.repaid > 0.004 && <span>{`− ${fmt(r.repaid)} taken off`}</span>}
            {r.otherIn > 0.004 && <span>{`+ ${fmt(r.otherIn)} from other pockets`}</span>}
            {r.otherOut > 0.004 && <span>{`− ${fmt(r.otherOut)} to other pockets`}</span>}
            <span>{now ? `= ${fmt(r.budget)} and you've spent ${fmt(r.spent)}` : `= ${fmt(r.budget)} and you spent ${fmt(r.spent)}`}</span>
          </> : <span>{now ? `You have ${fmt(r.budget)} and you've spent ${fmt(r.spent)}` : `You had ${fmt(r.budget)} and you spent ${fmt(r.spent)}`}</span>}
        </span>
        <span style={{ marginTop: 12, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 999, background: 'var(--glass)', color: label, fontSize: 13, fontWeight: 700 }}>
          {open ? 'Hide expenses' : !count ? 'No expenses' : count === 1 ? 'See 1 expense' : `See ${count} expenses`}
          <I.Chevron size={14} style={{ transform: `rotate(${open ? -90 : 90}deg)`, transition: 'transform .2s ease' }} />
        </span>
      </>}
    </div>
  );
}

/** The pocket's expenses on the period's days, newest first; tapping one opens it to edit. */
function Spent({ pid, r }: { pid: string; r: PeriodRow }) {
  const { data: d } = useApp(), c = ctxOf(d);
  const items = myExpenses(d).filter(e => e.p === pid && e.date >= r.from && e.date <= r.to).sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  return (
    <div style={{ marginTop: 8, background: 'var(--surface)', borderRadius: 22, padding: '2px 16px' }}>
      {items.map((e, i) => <ExpRow key={e.id} v={expView(d, e, c)} size={36} last={i === items.length - 1} onClick={() => openSheet({ name: 'txn', kind: 'expense', id: e.id })} />)}
      {!items.length && <div style={{ padding: '14px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>No expenses in these days.</div>}
    </div>
  );
}

const CHIP: Record<Link['kind'], [string, string, string]> = {
  next: ['var(--ok-bg)', 'var(--ok-ink)', 'transparent'],
  auto: ['var(--ok-bg)', 'var(--ok-ink)', 'transparent'],
  borrow: ['var(--safe-r-bg)', 'var(--safe-r-amt)', 'transparent'],
  idle: ['transparent', 'var(--color-neutral-700)', 'var(--color-neutral-300)'],
  uncovered: ['transparent', 'var(--safe-r-amt)', 'var(--safe-r-bar)']
};

function LinkRow({ l, r, pid, to, open, toggle }: { l: Link; r: PeriodRow; pid: string; to: string; open: boolean; toggle: () => void }) {
  const { data: d } = useApp();
  const [amt, setAmt] = useState(String(l.amt));
  const [bg, fg, line] = CHIP[l.kind];
  const auto = l.kind === 'auto', back = auto && l.amt < 0;
  const text = l.kind === 'next' ? `${fmt(l.amt)} moved on to ${to}`
    : l.kind === 'borrow' ? `${fmt(l.amt)} was taken from ${to}`
    : auto ? (back ? `${fmt(-l.amt)} over, taken from ${to} by itself` : `${fmt(l.amt)} carried on to ${to} by itself`)
    : l.kind === 'idle' ? `${fmt(l.amt)} was left and didn't move` : `${fmt(l.amt)} over and nothing covered it`;
  const m = l.move;
  // A move can grow up to what the period has left (sent on) or how far it went over (taken from the next one).
  const max = m ? m.amt + Math.max(0, m.next ? r.left : -r.left) : 0;
  const save = () => {
    if (!m) return;
    const v = roundAmt(num(amt));
    if (v > max + 0.004) { flash(`The most this can be is ${fmt(max)}`); return; }
    setData(x => editMove(x, m.id, v)); toggle(); flash(v > 0 ? `Move changed to ${fmt(v)}` : 'Move undone');
  };
  const undo = () => { if (!m) return; setData(x => undoMove(x, m.id)); toggle(); flash('Move undone'); };
  const fix = () => {
    const c = ctxAt(r.to);
    const patch = l.kind === 'idle' ? transferLeftover(d, c, pid, { [NEXT]: l.amt }) : borrowNext(d, c, pid, l.amt);
    if (!patch) { flash("That can't be done anymore"); return; }
    setData(patch); toggle(); flash(l.kind === 'idle' ? `${fmt(l.amt)} moved on to ${to}` : `${fmt(l.amt)} was taken from ${to}`);
  };
  const otherPocket = () => { if (!m) return; setData(x => undoMove(x, m.id)); openSheet({ name: 'refill', id: pid }); };
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0 8px 26px' }}>
        <div aria-hidden="true" style={{ width: 3, alignSelf: 'stretch', minHeight: 40, background: 'var(--color-neutral-300)', borderRadius: 3, flex: 'none' }} />
        <button onClick={toggle} aria-expanded={open} className="pr97" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 14px', borderRadius: 999, border: line === 'transparent' ? 0 : `1.5px dashed ${line}`, background: bg, color: fg, fontSize: 13.5, fontWeight: 800, cursor: 'pointer', textAlign: 'left', lineHeight: 1.3, minHeight: 44 }}>
          <span style={{ flex: 'none', display: 'flex', transform: auto ? 'none' : 'rotate(90deg)' }}>{auto ? <I.Refresh size={14} /> : <I.Arrow size={15} />}</span>
          <span>{text}</span>
          <span style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--surface)', display: 'grid', placeItems: 'center', flex: 'none', color: TEXT }}>{m ? <I.Pencil size={13} /> : auto ? <I.Gear size={13} /> : <I.Plus size={14} />}</span>
        </button>
      </div>
      {open && (
        <div style={{ margin: '0 0 8px 38px', background: 'var(--surface)', borderRadius: 20, padding: '14px 16px', boxShadow: '0 6px 24px rgba(0,0,0,.12)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {m ? <>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{m.next ? `How much moves on to ${to}?` : `How much to take from ${to}?`}</span>
            <MoneyInput value={amt} onChange={setAmt} ariaLabel="Amount" style={{ height: 46, borderRadius: 14, background: 'var(--color-neutral-100)', border: 0, padding: '0 14px', fontSize: 18, fontWeight: 800, color: TEXT, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={save} className="hv-acc600" style={{ ...pillBtn, background: 'var(--action)', color: 'var(--action-ink)' }}>Save</button>
              {m.borrow && r.state === 'now' && <button onClick={otherPocket} className="hv-n200" style={pillBtn}><I.Swap size={14} />Cover it with another pocket</button>}
            </div>
            <button onClick={undo} className="hv-acc100r" style={{ ...pillBtn, background: 'transparent', color: 'var(--color-accent-700)', alignSelf: 'flex-start', padding: '0 4px' }}>{m.next ? 'Undo · the money comes back to this period' : 'Undo · this period goes back to being over'}</button>
          </> : auto ? <>
            <span style={{ fontSize: 14, lineHeight: 1.45 }}>Carry over is on for this pocket: what's left or overspent moves to the next period by itself. You can turn it off in Edit pocket.</span>
            <button onClick={() => openSheet({ name: 'editPocket', id: pid })} className="hv-n200" style={{ ...pillBtn, alignSelf: 'flex-start' }}><I.Pencil size={14} />Edit pocket</button>
          </> : <>
            <span style={{ fontSize: 14, lineHeight: 1.45 }}>{l.kind === 'idle' ? `Nothing moved this money. You can send it on to ${to}.` : `Nobody covered this. You can take it from ${to}.`}</span>
            <button onClick={fix} className="hv-acc600" style={{ ...pillBtn, alignSelf: 'flex-start', background: 'var(--action)', color: 'var(--action-ink)' }}>{l.kind === 'idle' ? `Move it to ${to}` : `Take it from ${to}`}</button>
          </>}
        </div>
      )}
    </>
  );
}
