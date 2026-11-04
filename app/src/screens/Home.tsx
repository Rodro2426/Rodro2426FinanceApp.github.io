import { useApp, openSheet, setUI } from '../lib/store';
import { LINE, RED, ink, tint } from '../lib/constants';
import { allStats, ctxOf, fmt, monthExpenses, num, pctOf, sortedExpenses, weekExpenses } from '../lib/derive';
import { fmtDay, monthName } from '../lib/dates';
import { billRows } from '../lib/bills';
import { BillBadge, ExpRow, ListCard, SectionHead, expView } from '../ui/bits';
import * as I from '../ui/icons';
import { billAmount } from '../lib/schedule';

const C = 100.53; // ring circumference (r=16)

/** Light tones for the "Safe to spend" card: >50% left green, 30–50% yellow, under 30% red. */
const SAFE_TONES = {
  green: { bg: 'oklch(0.95 0.045 155)', label: 'oklch(0.42 0.09 155)', amount: 'oklch(0.3 0.07 155)', bar: 'oklch(0.68 0.13 155)' },
  yellow: { bg: 'oklch(0.96 0.055 92)', label: 'oklch(0.46 0.09 75)', amount: 'oklch(0.33 0.07 70)', bar: 'oklch(0.8 0.14 82)' },
  red: { bg: 'var(--color-accent-100)', label: 'var(--color-accent-800)', amount: 'var(--color-accent-900)', bar: 'var(--color-accent)' }
};

export default function Home() {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const all = allStats(d, c);
  const stats = new Map(all.map(x => [x.id, x]));
  const weekBudget = all.reduce((a, x) => a + x.budget, 0);
  const weekLeft = all.reduce((a, x) => a + x.left, 0);
  const weekSpent = weekExpenses(d, c).filter(e => stats.has(e.p)).reduce((a, e) => a + e.amt, 0);
  const assets = d.accounts.filter(a => a.type !== 'card').reduce((x, a) => x + a.bal, 0);
  const debt = d.accounts.filter(a => a.type === 'card').reduce((x, a) => x + a.bal, 0);
  const spent = monthExpenses(d, c).reduce((a, e) => a + e.amt, 0), income = num(d.incomeStr);
  const upcoming = billRows(d, c).filter(b => !b.paid).sort((a, b) => a.inDays - b.inDays).slice(0, 3);
  const recent = sortedExpenses(d).slice(0, 5).map(e => expView(d, e, c, stats));
  const photo = d.settings.profilePhoto;
  const unread = d.notifications.filter(n => !n.read && !n.dismissed).length;
  // Card colour follows how much of the week's budget is still safe to spend.
  const leftRatio = weekBudget > 0 ? weekLeft / weekBudget : 0;
  const tone = leftRatio > 0.5 ? SAFE_TONES.green : leftRatio >= 0.3 ? SAFE_TONES.yellow : SAFE_TONES.red;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 4px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{fmtDay(c.today, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Hi, {d.settings.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => openSheet({ name: 'notifications' })} aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'} className="hv-n200" style={{ position: 'relative', width: 44, height: 44, borderRadius: 999, background: '#fff', border: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <I.Bell size={19} />
            {unread > 0 && <span style={{ position: 'absolute', top: 6, right: 6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--color-accent)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #fff' }}>{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button onClick={() => openSheet({ name: 'search' })} aria-label="Search transactions" className="hv-n200" style={{ width: 44, height: 44, borderRadius: 999, background: '#fff', border: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <I.Search size={19} />
          </button>
          <button onClick={() => openSheet({ name: 'settings' })} aria-label="Profile and settings" style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--color-accent-200)', color: 'var(--color-accent-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, border: 0, padding: 0, cursor: 'pointer', overflow: 'hidden' }}>
            {photo ? <div style={{ width: '100%', height: '100%', backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center' }} /> : <span>{d.settings.name.trim().charAt(0).toUpperCase() || 'S'}</span>}
          </button>
        </div>
      </div>

      <div style={{ background: tone.bg, borderRadius: 28, padding: '22px 22px 20px', display: 'flex', flexDirection: 'column', gap: 6, transition: 'background .4s ease' }}>
        <span style={{ fontSize: 14, color: tone.label, fontWeight: 600 }}>Safe to spend this week</span>
        <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05, color: tone.amount }}>{fmt(weekLeft)}</span>
        <span style={{ fontSize: 13, color: tone.label }}>of {fmt(weekBudget)} · {c.daysLeft === 1 ? '1 day' : `${c.daysLeft} days`} left</span>
        <div style={{ marginTop: 10, height: 10, borderRadius: 999, background: '#fff', overflow: 'hidden' }}>
          <div style={{ height: 10, borderRadius: 999, width: pctOf(weekSpent, weekBudget), background: tone.bar, transition: 'width .5s ease, background .4s ease' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
        <div onClick={() => setUI({ tab: 'accounts' })} className="hv-n100" style={{ background: '#fff', borderRadius: 24, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Net worth</span>
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmt(assets - debt)}</span>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{d.accounts.length} accounts</span>
        </div>
        <div onClick={() => setUI({ tab: 'insights' })} className="hv-n100" style={{ background: '#fff', borderRadius: 24, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Spent in {monthName(c.month)}</span>
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmt(spent)}</span>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{income > 0 ? Math.round(spent / income * 100) + '%' : '—'} of income</span>
        </div>
      </div>

      <SectionHead title="Pockets" right={`Week ${c.weekNo} of ${c.weeks}`} muted />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
        {all.map(p => (
          <div key={p.id} onClick={() => openSheet({ name: 'pocket', id: p.id })} className="pr97" style={{ background: tint(p.hue), borderRadius: 24, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, transition: 'transform .15s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.85)', backgroundImage: p.photoBg, backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: ink(p.hue), flex: 'none' }}>{p.initial}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: ink(p.hue), lineHeight: 1.25 }}>{p.name}</span>
              </span>
              <svg width="34" height="34" viewBox="0 0 40 40" style={{ flex: 'none', transform: 'rotate(-90deg)' }}>
                <circle cx="20" cy="20" r="16" style={{ fill: 'none', stroke: 'rgba(255,255,255,.85)', strokeWidth: 6 }} />
                <circle cx="20" cy="20" r="16" style={{ fill: 'none', stroke: ink(p.hue), strokeWidth: 6, strokeLinecap: 'round', strokeDasharray: `${(p.budget > 0 ? Math.max(0, p.left) / p.budget : 0) * C} ${C}`, transition: 'stroke-dasharray .5s ease' }} />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', color: p.left < 0 ? RED : ink(p.hue) }}>{fmt(p.left)}</span>
              <span style={{ fontSize: 12, color: ink(p.hue), opacity: 0.8 }}>left of {fmt(p.budget)}</span>
            </div>
          </div>
        ))}
      </div>
      {all.length === 0 && <EmptyHint text="No pockets yet. Create them in the Budget tab." onClick={() => setUI({ tab: 'budget' })} />}

      <SectionHead title="Coming up" right="All bills" onRight={() => setUI({ tab: 'insights' })} />
      <ListCard>
        {upcoming.map((b, i) => (
          <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${i === upcoming.length - 1 ? 'transparent' : LINE}` }}>
            <BillBadge b={b} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{b.name}</span>
              <span style={{ fontSize: 12, color: b.dueColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.dueLabel}</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap' }}>{billAmount(b)}</span>
          </div>
        ))}
        {upcoming.length === 0 && <div style={{ padding: '14px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>All bills paid for {monthName(c.month)}.</div>}
      </ListCard>

      <SectionHead title="Recent" right="Search" onRight={() => openSheet({ name: 'search' })} />
      <ListCard>
        {recent.map((v, i) => <ExpRow key={v.key} v={v} last={i === recent.length - 1} onClick={() => openSheet({ name: 'txn', kind: 'expense', id: v.key })} />)}
        {recent.length === 0 && <div style={{ padding: '14px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>No expenses yet. Tap + to add one.</div>}
      </ListCard>
    </div>
  );
}

function EmptyHint({ text, onClick }: { text: string; onClick: () => void }) {
  return <div onClick={onClick} style={{ background: '#fff', borderRadius: 24, padding: 16, fontSize: 14, color: 'var(--color-neutral-700)', cursor: 'pointer' }}>{text}</div>;
}
