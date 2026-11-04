import { useState } from 'react';
import { useApp, openSheet } from '../lib/store';
import { LINE, TEXT, tint } from '../lib/constants';
import { ctxOf, fmt } from '../lib/derive';
import { daysInMonth, fmtDay, monthLabel, parse, prevMonthKey, relDay } from '../lib/dates';
import { dueDate, eventsOn, ordinal } from '../lib/schedule';
import { BillBadge, ListCard, SectionHead, expView } from '../ui/bits';
import * as I from '../ui/icons';
import { approxLocal, billAmount } from '../lib/schedule';

const GREEN = 'oklch(0.62 0.12 160)', GREEN_TEXT = 'oklch(0.5 0.12 150)', BILL = 'var(--color-accent)', SPEND = 'var(--color-neutral-400)';
const pad = (n: number) => String(n).padStart(2, '0');
const nextMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`; };

export default function CalendarScreen() {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const [month, setMonth] = useState(c.month);
  const [sel, setSel] = useState(c.today);

  const n = daysInMonth(month);
  const lead = (parse(month + '-01').getDay() + 6) % 7; // Monday first
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => `${month}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);

  const spentOn = (date: string) => d.expenses.filter(e => e.date === date);
  const incomeOn = (date: string) => (d.incomes || []).filter(t => t.date === date);
  const scheduled = d.bills.filter(b => !b.start || dueDate(b, month) >= b.start);
  const incomeTotal = scheduled.filter(b => b.kind === 'Income').reduce((a, b) => a + approxLocal(d, b), 0);
  const billTotal = scheduled.filter(b => b.kind !== 'Income').reduce((a, b) => a + approxLocal(d, b), 0);

  const selEvents = eventsOn(d, sel);
  const selSpent = spentOn(sel).sort((x, y) => y.ts - x.ts).map(e => expView(d, e, c));
  const selIncome = incomeOn(sel).filter(t => !selEvents.some(ev => ev.b.id === t.ruleId && ev.paid));
  const selDay = Number(sel.slice(8, 10));
  const chipStyle = { fontSize: 13, fontWeight: 600, padding: '7px 12px', borderRadius: 999, whiteSpace: 'nowrap' } as const;

  const go = (m: string) => { setMonth(m); setSel(m === c.month ? c.today : `${m}-01`); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '4px 4px 0', display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Income, bills and spending by day</span>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>Calendar</span>
      </div>

      <div style={{ background: '#fff', borderRadius: 28, padding: '16px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button onClick={() => go(prevMonthKey(month))} aria-label="Previous month" className="hv-n200" style={{ width: 36, height: 36, borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><I.ChevronLeft size={18} /></button>
          <span onClick={() => go(c.month)} style={{ fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>{monthLabel(month)}</span>
          <button onClick={() => go(nextMonth(month))} aria-label="Next month" className="hv-n200" style={{ width: 36, height: 36, borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><I.Chevron size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 2 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => <span key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--color-neutral-500)', padding: '2px 0 4px' }}>{w}</span>)}
          {cells.map((date, i) => {
            if (!date) return <span key={i} />;
            const ev = eventsOn(d, date), on = date === sel, isToday = date === c.today;
            const dots = [
              ...(ev.some(e => e.b.kind === 'Income') || incomeOn(date).length ? [GREEN] : []),
              ...(ev.some(e => e.b.kind !== 'Income') ? [BILL] : []),
              ...(spentOn(date).some(e => !e.ruleId) ? [SPEND] : [])
            ];
            return (
              <button key={date} onClick={() => setSel(date)} aria-label={fmtDay(date, { weekday: 'long', month: 'long', day: 'numeric' })}
                style={{ height: 46, borderRadius: 14, border: 0, padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                  background: on ? TEXT : isToday ? 'var(--color-accent-100)' : 'transparent', color: on ? '#fff' : isToday ? 'var(--color-accent-700)' : date < c.today ? 'var(--color-neutral-600)' : TEXT, transition: 'background .15s' }}>
                <span style={{ fontSize: 15, fontWeight: isToday || on ? 700 : 600, lineHeight: 1 }}>{Number(date.slice(8))}</span>
                <span style={{ display: 'flex', gap: 3, height: 5 }}>{dots.map((col, j) => <span key={j} style={{ width: 5, height: 5, borderRadius: 999, background: on && col === SPEND ? 'rgba(255,255,255,.6)' : col }} />)}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--color-neutral-600)', paddingTop: 2 }}>
          {[[GREEN, 'Income'], [BILL, 'Bills'], [SPEND, 'Spending']].map(([col, l]) => <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: col }} />{l}</span>)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...chipStyle, background: 'oklch(0.95 0.045 155)', color: 'oklch(0.42 0.09 155)' }}>Income +{fmt(incomeTotal)}</span>
        <span style={{ ...chipStyle, background: 'var(--color-accent-100)', color: 'var(--color-accent-800)' }}>Bills −{fmt(billTotal)}</span>
      </div>

      <SectionHead title={relDay(sel, c.today) === 'Today' ? 'Today' : fmtDay(sel, { weekday: 'long', month: 'short', day: 'numeric' })} right="Add here" onRight={() => openSheet({ name: 'schedule', id: null, day: selDay })} />
      <ListCard>
        {selEvents.map(({ b, paid, auto, past }, i) => {
          const inc = b.kind === 'Income';
          const status = paid ? (inc ? 'Received' : 'Paid') : past ? (auto ? 'Skipped' : 'Not ticked off') : auto ? (inc ? 'Will be added automatically' : 'Will be paid automatically') : 'Reminder';
          const acct = d.accounts.find(a => a.id === b.acct)?.name;
          return (
            <div key={b.id} onClick={() => openSheet({ name: 'schedule', id: b.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${i === selEvents.length - 1 && !selSpent.length && !selIncome.length ? 'transparent' : LINE}`, cursor: 'pointer' }}>
              <BillBadge b={b} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{b.name}</span>
                <span style={{ fontSize: 12, color: paid ? GREEN_TEXT : 'var(--color-neutral-700)' }}>{[b.kind, status, acct].filter(Boolean).join(' · ')}</span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', color: inc ? GREEN_TEXT : TEXT }}>{inc ? '+' : '−'}{billAmount(b)}</span>
            </div>
          );
        })}
        {selIncome.map((t, i) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${i === selIncome.length - 1 && !selSpent.length ? 'transparent' : LINE}` }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, background: tint(150), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flex: 'none' }}>💰</div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{t.note}</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Income · {d.accounts.find(a => a.id === t.a)?.name || ''}</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', color: GREEN_TEXT }}>+{fmt(t.amt)}</span>
          </div>
        ))}
        {selSpent.map((v, i) => (
          <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${i === selSpent.length - 1 ? 'transparent' : LINE}` }}>
            <span style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: v.tint, backgroundImage: v.photoBg, backgroundSize: 'cover', backgroundPosition: 'center', color: v.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flex: 'none' }}>{v.initial}</span>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{v.note}</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{v.meta}</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap' }}>{v.amtFmt}</span>
          </div>
        ))}
        {!selEvents.length && !selSpent.length && !selIncome.length && <div style={{ padding: '14px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>Nothing on this day.</div>}
      </ListCard>

      <SectionHead title="Every month" right={`${scheduled.length} scheduled`} muted />
      <ListCard>
        {[...d.bills].sort((a, b) => a.dueDay - b.dueDay).map((b, i, arr) => {
          const inc = b.kind === 'Income', acct = d.accounts.find(a => a.id === b.acct)?.name;
          return (
            <div key={b.id} onClick={() => openSheet({ name: 'schedule', id: b.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${i === arr.length - 1 ? 'transparent' : LINE}`, cursor: 'pointer' }}>
              <BillBadge b={b} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{b.name}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {`Every ${ordinal(b.dueDay)} · `}{b.auto && acct ? <><I.Repeat size={11} />{`Auto · ${acct}`}</> : 'Reminder'} · next {fmtDay(dueDate(b, dueDate(b, c.month) >= c.today ? c.month : nextMonth(c.month)), { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', color: inc ? GREEN_TEXT : TEXT }}>{inc ? '+' : '−'}{billAmount(b)}</span>
            </div>
          );
        })}
        {d.bills.length === 0 && <div style={{ padding: '14px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>Nothing scheduled yet. Add your salary, rent or subscriptions.</div>}
      </ListCard>
      <button onClick={() => openSheet({ name: 'schedule', id: null, day: selDay })} className="hv-white" style={{ height: 50, borderRadius: 999, border: '2px dashed var(--color-neutral-400)', background: 'transparent', color: TEXT, fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <I.Plus size={18} />
        Add income, bill or subscription
      </button>
    </div>
  );
}
