import { useApp, openSheet, setUI } from '../lib/store';
import { earnsInterest } from '../lib/interest';

const GREEN_TEXT = 'oklch(0.5 0.12 150)';
import { LINE, ink, tint } from '../lib/constants';
import { acctTxns, fmt, initialOf, pctOf, plural } from '../lib/derive';
import { AcctBadge, ListCard } from '../ui/bits';
import * as I from '../ui/icons';
import { cdtTotal } from '../lib/cdt';

export default function Accounts() {
  const { data: d } = useApp();
  // CDTs count as money you have: opening one moves money out of an account, not out of your net worth.
  const assets = d.accounts.filter(a => a.type !== 'card').reduce((x, a) => x + a.bal, 0) + cdtTotal(d);
  const debt = d.accounts.filter(a => a.type === 'card').reduce((x, a) => x + a.bal, 0);
  const cash = d.accounts.filter(a => a.type !== 'card');
  const cards = d.accounts.filter(a => a.type === 'card');
  const pos = 'oklch(0.62 0.12 160)', neg = 'oklch(0.9 0.05 25)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '4px 4px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>Accounts</span>
        <div style={{ display: 'flex', gap: 8 }}>
        <button data-tour="invest" onClick={() => setUI({ page: 'investments' })} aria-label="Investments" className="hv-n200" style={{ width: 38, height: 38, borderRadius: 999, border: 0, background: '#fff', color: GREEN_TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
          <I.TrendUp size={17} />
        </button>
        <button data-tour="excel" onClick={() => openSheet({ name: 'export', acct: 'all' })} className="hv-n200" style={{ height: 38, padding: '0 14px', borderRadius: 999, border: 0, background: '#fff', color: 'var(--color-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <I.Download size={15} color="oklch(0.5 0.12 150)" />
          Excel
        </button>
        </div>
      </div>
      <div style={{ background: '#fff', borderRadius: 28, padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>Net worth</span>
        <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05 }}>{fmt(assets - debt)}</span>
        <div style={{ marginTop: 12, height: 10, borderRadius: 999, background: neg, overflow: 'hidden' }}>
          <div style={{ height: 10, borderRadius: 999, width: pctOf(assets, assets + debt), background: pos }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4, gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: pos }} />You have {fmt(assets)}{cdtTotal(d) > 0 ? ' (with CDTs)' : ''}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: neg }} />You owe {fmt(debt)}</span>
        </div>
      </div>

      <div style={{ padding: '10px 4px 0', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Debit and Cash</div>
      <ListCard>
        {cash.map((a, i) => (
          <div key={a.id} onClick={() => openSheet({ name: 'acct', id: a.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${i === cash.length - 1 ? 'transparent' : LINE}`, cursor: 'pointer' }}>
            <AcctBadge photo={a.photo} initial={initialOf(a.name)} size={42} radius={14} bg={tint(a.hue)} color={ink(a.hue)} fs={16} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{a.name}</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{a.kind} · {plural(acctTxns(d, a.id).list.length, 'transaction')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(a.bal)}</span>
              {earnsInterest(a) && <span style={{ fontSize: 11.5, fontWeight: 700, color: GREEN_TEXT, whiteSpace: 'nowrap' }}>+{fmt(a.earned || 0)} · {String(a.rate).replace('.', ',')}%</span>}
            </div>
            <I.Chevron size={16} color="var(--color-neutral-400)" />
          </div>
        ))}
        {cash.length === 0 && <div style={{ padding: '14px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>No bank, savings or cash accounts yet.</div>}
      </ListCard>

      <div style={{ padding: '10px 4px 0', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Credit cards</div>
      {cards.map(a => {
        const k = ink(a.hue), lim = a.limit || 0;
        return (
          <div key={a.id} onClick={() => openSheet({ name: 'acct', id: a.id })} className="pr98" style={{ background: tint(a.hue), borderRadius: 28, padding: 20, display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer', transition: 'transform .15s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, fontSize: 15, fontWeight: 700, color: k }}>
                <AcctBadge photo={a.photo} initial={initialOf(a.name)} size={34} radius={12} bg="rgba(255,255,255,.75)" color={k} fs={14} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: k, background: 'rgba(255,255,255,.7)', padding: '5px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>Due {a.due || '—'}</span>
            </div>
            <span style={{ marginTop: 10, fontSize: 13, color: k }}>Balance owed</span>
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', color: k }}>{fmt(a.bal)}</span>
            <div style={{ marginTop: 10, height: 10, borderRadius: 999, background: 'rgba(255,255,255,.8)', overflow: 'hidden' }}>
              <div style={{ height: 10, borderRadius: 999, width: pctOf(a.bal, lim), background: k, transition: 'width .5s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 10 }}>
              <span style={{ fontSize: 12, color: k }}>{Math.round(lim ? a.bal / lim * 100 : 0)}% of {fmt(lim)} used</span>
              <button onClick={e => { e.stopPropagation(); openSheet({ name: 'pay', id: a.id }); }} className="hv-w75" style={{ height: 36, padding: '0 16px', borderRadius: 999, border: 0, background: '#fff', color: k, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Pay</button>
            </div>
          </div>
        );
      })}

      <button data-tour="add-account" onClick={() => openSheet({ name: 'addAcct' })} className="hv-white" style={{ height: 54, borderRadius: 999, border: '2px dashed var(--color-neutral-400)', background: 'transparent', color: 'var(--color-text)', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <I.Plus size={18} />
        Add account or card
      </button>
    </div>
  );
}
