// Categories hub: spending by category, and the list of your categories to add, edit or delete.
import { useState } from 'react';
import { useApp, openSheet, setData, setUI, flash } from '../lib/store';
import { HUES, LINE, RED, TEXT, ink, mid, tint } from '../lib/constants';
import { byDateDesc, catOf, ctxOf, fmt, monthExpenses, pctOf, plural, myExpenses } from '../lib/derive';
import { addDays, inRange, monthKey, monthName, prevMonthKey } from '../lib/dates';
import { Bar, ExpRow, expView, textInput } from '../ui/bits';
import * as I from '../ui/icons';
import { ReportIcon, SubPage } from './Reports';

export default function CategoriesPage() {
  return (
    <SubPage title="Categories" icon={<ReportIcon icon="pie" tone="#e5484d" size={30} />} back={() => setUI({ page: null })} backLabel="Back to insights">
      <CategoryTable />
      <ManageCategories />
    </SubPage>
  );
}

/** Your expense categories: open one to add or remove subcategories, delete it, or create a new one. */
function ManageCategories() {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [newCat, setNewCat] = useState('');
  const [newSub, setNewSub] = useState('');
  const month = monthExpenses(d, c);
  const spent = (k: string) => month.filter(e => catOf(e)[0] === k).reduce((a, e) => a + e.amt, 0);
  const hueOf = (k: string) => HUES[Math.max(0, d.cats.findIndex(x => x.name === k)) % HUES.length];
  const taken = (n: string) => d.cats.some(k => k.name.toLowerCase() === n.trim().toLowerCase());

  const addCat = () => {
    const n = newCat.trim();
    if (!n) return;
    if (taken(n)) { flash(`${n} already exists`); return; }
    setData(x => ({ cats: [...x.cats, { name: n, subs: ['General'] }] }));
    setNewCat(''); setOpen(n); flash(`${n} created`);
  };
  const addSub = (k: string) => {
    const n = newSub.trim();
    if (!n) return;
    if (d.cats.find(x => x.name === k)?.subs.some(s => s.toLowerCase() === n.toLowerCase())) { flash(`${n} already exists`); return; }
    setData(x => ({ cats: x.cats.map(y => (y.name === k ? { ...y, subs: [...y.subs, n] } : y)) }));
    setNewSub('');
  };
  const delSub = (k: string, sub: string) => setData(x => ({ cats: x.cats.map(y => (y.name === k ? { ...y, subs: y.subs.filter(s => s !== sub) } : y)) }));
  const delCat = (k: string) => {
    if (confirm !== k) { setConfirm(k); return; }
    setData(x => ({ cats: x.cats.filter(y => y.name !== k) }));
    setConfirm(null); setOpen(null); flash(`${k} deleted`);
  };
  const small = { height: 34, padding: '0 14px', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 4px 0', gap: 8 }}>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Your categories</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{plural(d.cats.length, 'category', 'categories')}</span>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 24, padding: '4px 16px' }}>
        {d.cats.map((k, i) => {
          const isOpen = open === k.name, h = hueOf(k.name), sp = spent(k.name);
          return (
            <div key={k.name} style={{ borderBottom: i === d.cats.length - 1 ? 0 : `1px solid ${LINE}` }}>
              <button onClick={() => { setOpen(isOpen ? null : k.name); setConfirm(null); setNewSub(''); }} aria-expanded={isOpen}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', border: 0, background: 'transparent', color: TEXT, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
                <span style={{ width: 12, height: 12, borderRadius: 999, background: mid(h), flex: 'none' }} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{plural(k.subs.length, 'subcategory', 'subcategories')}</span>
                </span>
                {sp > 0 && <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(sp)}</span>}
                <span style={{ display: 'flex', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s', color: 'var(--color-neutral-500)' }}><I.Chevron size={16} /></span>
              </button>
              {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 0 14px 22px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {k.subs.map(sub => (
                      <span key={sub} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 32, padding: '0 6px 0 12px', borderRadius: 999, background: tint(h), color: ink(h), fontSize: 13, fontWeight: 600 }}>
                        {sub}
                        <button onClick={() => delSub(k.name, sub)} aria-label={`Delete ${sub}`} style={{ width: 22, height: 22, borderRadius: 999, border: 0, background: 'transparent', color: ink(h), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><I.X size={12} sw={3} /></button>
                      </span>
                    ))}
                    {k.subs.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>No subcategories.</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={newSub} onChange={e => setNewSub(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSub(k.name); }} placeholder="New subcategory" aria-label={`New subcategory in ${k.name}`} style={{ ...textInput, flex: 1, padding: '9px 14px', fontSize: 14, background: 'var(--color-neutral-100)' }} />
                    <button onClick={() => addSub(k.name)} disabled={!newSub.trim()} style={{ ...small, background: TEXT, color: 'var(--on-text)', opacity: newSub.trim() ? 1 : 0.4 }}>Add</button>
                  </div>
                  <button onClick={() => delCat(k.name)} style={{ ...small, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-accent-100)', color: RED }}>
                    <I.Trash size={14} />{confirm === k.name ? 'Tap again to delete' : 'Delete category'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCat(); }} placeholder="New category, like Pets" aria-label="New category" style={{ ...textInput, flex: 1 }} />
        <button onClick={addCat} disabled={!newCat.trim()} style={{ ...small, height: 50, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-accent)', color: '#fff', opacity: newCat.trim() ? 1 : 0.4 }}><I.Plus size={16} />Create</button>
      </div>
      <span style={{ margin: '0 4px', fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>Deleting a category only removes it from this list. Expenses already in it keep their category, so your history doesn't change.</span>
    </>
  );
}

/* ---------------- Spending by category: the main table, filterable ---------------- */
type Period = 'week' | 'month' | 'last' | 'all';
export function CategoryTable() {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const [period, setPeriod] = useState<Period>('month');
  const [sel, setSel] = useState<string[]>([]);
  const inPeriod = (date: string) => period === 'week' ? inRange(date, c.weekStart, addDays(c.weekStart, 6))
    : period === 'month' ? monthKey(date) === c.month : period === 'last' ? monthKey(date) === prevMonthKey(c.month) : true;
  const exps = myExpenses(d).filter(e => inPeriod(e.date));
  const total = exps.reduce((a, e) => a + e.amt, 0);
  const order = d.cats.map(k => k.name);
  const hueOf = (k: string) => HUES[(order.indexOf(k) < 0 ? order.length : order.indexOf(k)) % HUES.length];
  const groups = new Map<string, { n: number; sum: number; subs: Map<string, { n: number; sum: number }> }>();
  exps.forEach(e => {
    const [k, sub] = catOf(e);
    const g = groups.get(k) ?? { n: 0, sum: 0, subs: new Map() };
    g.n++; g.sum += e.amt;
    const sg = g.subs.get(sub || '—') ?? { n: 0, sum: 0 }; sg.n++; sg.sum += e.amt; g.subs.set(sub || '—', sg);
    groups.set(k, g);
  });
  const rows = [...groups.entries()].map(([k, g]) => ({ k, ...g })).sort((a, b) => b.sum - a.sum);
  const active = sel.filter(k => groups.has(k));
  const shownRows = active.length ? rows.filter(r => active.includes(r.k)) : rows;
  const shownTotal = shownRows.reduce((a, r) => a + r.sum, 0), shownN = shownRows.reduce((a, r) => a + r.n, 0);
  const list = active.length ? exps.filter(e => active.includes(catOf(e)[0])).sort(byDateDesc) : [];
  const toggle = (k: string) => setSel(s0 => (s0.includes(k) ? s0.filter(x => x !== k) : [...s0, k]));
  const label = { week: 'this week', month: monthName(c.month), last: monthName(prevMonthKey(c.month)), all: 'all time' }[period];
  const th = { fontSize: 11.5, fontWeight: 700, color: 'var(--color-neutral-600)', textTransform: 'uppercase' as const, letterSpacing: '.04em' };
  const chip = (on: boolean) => ({ flex: 'none' as const, height: 34, padding: '0 12px', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const });

  return (
    <div aria-label="Spending by category" style={{ background: 'var(--surface)', borderRadius: 26, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>By category</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', background: 'var(--color-neutral-100)', borderRadius: 999, padding: 3, gap: 2 }}>
        {([['week', 'Week'], ['month', monthName(c.month).slice(0, 3)], ['last', monthName(prevMonthKey(c.month)).slice(0, 3)], ['all', 'All']] as [Period, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setPeriod(k)} style={{ flex: 1, height: 32, borderRadius: 999, border: 0, background: period === k ? 'var(--surface)' : 'transparent', boxShadow: period === k ? 'var(--shadow-sm)' : 'none', color: 'var(--color-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>
      <div className="noscroll" aria-label="Filter categories" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -18px', padding: '0 18px' }}>
        <button onClick={() => setSel([])} style={{ ...chip(!active.length), background: !active.length ? 'var(--color-text)' : 'var(--color-neutral-100)', color: !active.length ? 'var(--on-text)' : 'var(--color-text)' }}>All</button>
        {rows.map(r => {
          const on = active.includes(r.k), h = hueOf(r.k);
          return <button key={r.k} onClick={() => toggle(r.k)} aria-pressed={on} style={{ ...chip(on), background: on ? ink(h) : tint(h), color: on ? 'var(--on-text)' : ink(h) }}>{r.k}</button>;
        })}
      </div>

      <div role="table" style={{ display: 'flex', flexDirection: 'column' }}>
        <div role="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 34px 96px 40px', gap: 8, padding: '0 0 6px', borderBottom: `1px solid ${LINE}` }}>
          <span role="columnheader" style={th}>Category</span><span role="columnheader" style={{ ...th, textAlign: 'right' }}>#</span><span role="columnheader" style={{ ...th, textAlign: 'right' }}>Total</span><span role="columnheader" style={{ ...th, textAlign: 'right' }}>%</span>
        </div>
        {shownRows.map(r => {
          const h = hueOf(r.k), open = active.includes(r.k);
          const subs = [...r.subs.entries()].sort((a, b) => b[1].sum - a[1].sum);
          return (
            <div key={r.k} style={{ borderBottom: `1px solid ${LINE}` }}>
              <div role="row" onClick={() => toggle(r.k)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 34px 96px 40px', gap: 8, alignItems: 'center', padding: '10px 0 6px', cursor: 'pointer', fontSize: 14 }}>
                <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: mid(h), flex: 'none' }} />
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.k}</span>
                </span>
                <span role="cell" style={{ textAlign: 'right', color: 'var(--color-neutral-700)' }}>{r.n}</span>
                <span role="cell" style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(r.sum)}</span>
                <span role="cell" style={{ textAlign: 'right', color: 'var(--color-neutral-700)' }}>{total ? Math.round(r.sum / total * 100) : 0}%</span>
              </div>
              <div style={{ paddingBottom: open ? 4 : 10 }}><Bar h={6} pct={pctOf(r.sum, rows[0]?.sum || 1)} track="var(--color-neutral-100)" fill={mid(h)} /></div>
              {open && subs.map(([sn, sg]) => (
                <div key={sn} role="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 34px 96px 40px', gap: 8, padding: '5px 0', fontSize: 13, color: 'var(--color-neutral-700)' }}>
                  <span role="cell" style={{ paddingLeft: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sn}</span>
                  <span role="cell" style={{ textAlign: 'right' }}>{sg.n}</span>
                  <span role="cell" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(sg.sum)}</span>
                  <span role="cell" style={{ textAlign: 'right' }}>{r.sum ? Math.round(sg.sum / r.sum * 100) : 0}%</span>
                </div>
              ))}
              {open && <div style={{ height: 6 }} />}
            </div>
          );
        })}
        {rows.length === 0 && <span style={{ padding: '14px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>No expenses {period === 'all' ? 'yet' : `in ${label}`}.</span>}
        {rows.length > 0 && (
          <div role="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 34px 96px 40px', gap: 8, padding: '10px 0 0', fontSize: 14, fontWeight: 800 }}>
            <span role="cell">{active.length ? 'Selected' : 'Total'}</span>
            <span role="cell" style={{ textAlign: 'right' }}>{shownN}</span>
            <span role="cell" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(shownTotal)}</span>
            <span role="cell" style={{ textAlign: 'right' }}>{total ? Math.round(shownTotal / total * 100) : 0}%</span>
          </div>
        )}
      </div>
      {!active.length && rows.length > 0 && <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>Tap a category to see its subcategories and transactions. You can pick several.</span>}

      {active.length > 0 && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{plural(list.length, 'transaction')}</span>
          {active.length === 1 && <span onClick={() => openSheet({ name: 'search', cat: active[0] })} style={{ fontSize: 13, color: 'var(--color-accent-700)', fontWeight: 700, cursor: 'pointer' }}>Search in {active[0]}</span>}
        </div>
        <div style={{ margin: '-4px 0 0' }}>
          {list.slice(0, 40).map((e, i) => <ExpRow key={e.id} v={expView(d, e, c)} size={36} last={i === Math.min(list.length, 40) - 1} onClick={() => openSheet({ name: 'txn', kind: 'expense', id: e.id })} />)}
          {list.length > 40 && <span style={{ display: 'block', padding: '10px 0 0', fontSize: 12, color: 'var(--color-neutral-600)' }}>Showing the latest 40.</span>}
        </div>
      </>}
    </div>
  );
}
