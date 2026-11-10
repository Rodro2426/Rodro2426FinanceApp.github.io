// Categories hub: spending by category, and your categories: create, rename (or merge), delete, and move
// transactions between them.
import { useState } from 'react';
import { useApp, openSheet, setData, setUI, flash } from '../lib/store';
import { HUES, LINE, RED, TEXT, ink, mid, tint } from '../lib/constants';
import { byDateDesc, catOf, ctxOf, fmt, monthExpenses, pctOf, plural, myExpenses } from '../lib/derive';
import { addDays, inRange, monthKey, monthName, prevMonthKey, shortDate } from '../lib/dates';
import { expenseCatClash, incomeCatClash, moveExpenses, moveIncomes, renameExpenseCat, renameIncomeCat, renameSub } from '../lib/categories';
import { incCatOf, incomeCatList } from '../lib/reports';
import { Bar, ExpRow, expView, textInput } from '../ui/bits';
import * as I from '../ui/icons';
import { ReportIcon, SubPage } from './Reports';

export default function CategoriesPage() {
  return (
    <SubPage title="Categories" icon={<ReportIcon icon="pie" tone="#e5484d" size={30} />} back={() => setUI({ page: null })} backLabel="Back to insights">
      <CategoryTable />
      <ManageCategories />
      <IncomeCategories />
    </SubPage>
  );
}

/** A name box with Save; when the new name already exists, the button merges instead. */
function NameEditor({ name, clash, onSave }: { name: string; clash: (to: string) => string | null; onSave: (to: string) => void }) {
  const [v, setV] = useState(name);
  const changed = v.trim() !== '' && v.trim() !== name, into = changed ? clash(v) : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && changed) onSave(v); }} aria-label={`Name of ${name}`} style={{ ...textInput, flex: 1, padding: '9px 14px', fontSize: 15, fontWeight: 600, background: 'var(--color-neutral-100)' }} />
        {changed && <button onClick={() => onSave(v)} style={{ ...small, background: into ? 'var(--color-accent)' : TEXT, color: into ? '#fff' : 'var(--on-text)' }}>{into ? 'Merge' : 'Save'}</button>}
      </div>
      {into && <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--color-accent-800)' }}>{`${into} already exists. Merging moves everything from ${name} into it.`}</span>}
    </div>
  );
}

const small = { height: 34, padding: '0 14px', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const };
const selectStyle = { flex: 1, minWidth: 0, height: 38, borderRadius: 12, border: 0, background: 'var(--color-neutral-100)', color: TEXT, fontSize: 14, fontWeight: 600, padding: '0 10px' } as const;

/**
 * A category's transactions, newest first. Tick some, pick where they go, tap Move.
 * Tapping a transaction opens its full edit screen.
 */
function TxnMover({ rows, kind, targets, subsOf, onMove }: {
  rows: { id: string; date: string; ts: number; note: string; meta: string; amt: number }[];
  kind: 'expense' | 'income';
  targets: string[]; subsOf?: (cat: string) => string[];
  onMove: (ids: string[], cat: string, sub: string) => void;
}) {
  const [sel, setSel] = useState<string[]>([]);
  const [all, setAll] = useState(false);
  const [to, setTo] = useState(targets[0] ?? '');
  const subs = subsOf ? subsOf(to) : [];
  const [sub, setSub] = useState('');
  const list = [...rows].sort(byDateDesc);
  const shown = all ? list : list.slice(0, 15);
  const live = sel.filter(id => rows.some(r => r.id === id));
  const toggle = (id: string) => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  const move = () => { onMove(live, to, subsOf ? (subs.includes(sub) ? sub : subs[0] ?? '') : ''); setSel([]); };
  if (!rows.length) return <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{kind === 'expense' ? 'No expenses in this category yet.' : 'No incomes in this category yet.'}</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{kind === 'expense' ? plural(rows.length, 'expense') : plural(rows.length, 'income')}</span>
        <button onClick={() => setSel(live.length === rows.length ? [] : rows.map(r => r.id))} style={{ border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 }}>{live.length === rows.length ? 'Select none' : 'Select all'}</button>
      </div>
      {live.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--color-neutral-100)', borderRadius: 16, padding: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{live.length === 1 ? 'Move 1 transaction to' : `Move ${live.length} transactions to`}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={to} onChange={e => { setTo(e.target.value); setSub(''); }} aria-label="Move to category" style={{ ...selectStyle, background: 'var(--surface)' }}>
              {targets.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {subsOf && subs.length > 0 && <select value={subs.includes(sub) ? sub : subs[0]} onChange={e => setSub(e.target.value)} aria-label="Move to subcategory" style={{ ...selectStyle, background: 'var(--surface)' }}>
              {subs.map(t => <option key={t} value={t}>{t}</option>)}
            </select>}
          </div>
          <button onClick={move} style={{ ...small, alignSelf: 'flex-start', background: 'var(--color-accent)', color: '#fff' }}>Move</button>
        </div>
      )}
      <div>
        {shown.map((r, i) => {
          const on = live.includes(r.id);
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i === shown.length - 1 ? 0 : `1px solid ${LINE}` }}>
              <button onClick={() => toggle(r.id)} aria-pressed={on} aria-label={`Select ${r.note}`} style={{ width: 26, height: 26, borderRadius: 999, border: `2px solid ${on ? 'var(--color-accent)' : 'var(--color-neutral-300)'}`, background: on ? 'var(--color-accent)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}>{on && <I.Check size={13} sw={3} />}</button>
              <button onClick={() => openSheet({ name: 'txn', kind, id: r.id })} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, border: 0, background: 'transparent', color: TEXT, textAlign: 'left', cursor: 'pointer', padding: 0, font: 'inherit' }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.note}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.meta}</span>
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{kind === 'income' ? '+' : ''}{fmt(r.amt)}</span>
              </button>
            </div>
          );
        })}
      </div>
      {list.length > 15 && <button onClick={() => setAll(v => !v)} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}>{all ? 'Show less' : `See all ${list.length}`}</button>}
    </div>
  );
}

/** Income categories: open one to rename it, see and move its incomes, or delete it. */
function IncomeCategories() {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [name, setName] = useState('');
  const list = incomeCatList(d);
  const got = (k: string) => d.incomes.filter(t => monthKey(t.date) === c.month && incCatOf(d, t) === k).reduce((a, t) => a + t.amt, 0);
  const acct = (id: string) => d.accounts.find(a => a.id === id)?.name ?? '';
  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (list.some(k => k.toLowerCase() === n.toLowerCase())) { flash(`${n} already exists`); return; }
    setData(x => ({ incCats: [...incomeCatList(x), n] }));
    setName(''); setOpen(n); flash(`${n} created`);
  };
  const del = (k: string) => {
    if (confirm !== k) { setConfirm(k); return; }
    setData(x => ({ incCats: incomeCatList(x).filter(y => y !== k) }));
    setConfirm(null); setOpen(null); flash(`${k} deleted`);
  };
  const rename = (k: string, to: string) => {
    const into = incomeCatClash(d, k, to), target = into ?? to.trim();
    setData(x => renameIncomeCat(x, k, to) ?? {});
    setOpen(target); flash(into ? `${k} merged into ${into}` : `Renamed to ${target}`);
  };
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 4px 0', gap: 8 }}>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Income categories</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{plural(list.length, 'category', 'categories')}</span>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 24, padding: '4px 16px' }}>
        {list.map((k, i) => {
          const g = got(k), isOpen = open === k;
          const rows = d.incomes.filter(t => incCatOf(d, t) === k && !t.interest).map(t => ({ id: t.id, date: t.date, ts: t.ts, note: t.note || k, meta: [shortDate(t.date), acct(t.a)].filter(Boolean).join(' · '), amt: t.amt }));
          return (
            <div key={k} style={{ borderBottom: i === list.length - 1 ? 0 : `1px solid ${LINE}` }}>
              <button onClick={() => { setOpen(isOpen ? null : k); setConfirm(null); }} aria-expanded={isOpen}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', border: 0, background: 'transparent', color: TEXT, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
                <span style={{ width: 12, height: 12, borderRadius: 999, background: 'oklch(0.62 0.12 160)', flex: 'none' }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</span>
                {g > 0 && <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', color: 'oklch(0.45 0.11 150)' }}>+{fmt(g)}</span>}
                <span style={{ display: 'flex', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s', color: 'var(--color-neutral-500)' }}><I.Chevron size={16} /></span>
              </button>
              {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 0 14px 22px' }}>
                  <NameEditor key={k} name={k} clash={to => incomeCatClash(d, k, to)} onSave={to => rename(k, to)} />
                  <TxnMover rows={rows} kind="income" targets={list.filter(x => x !== k)} onMove={(ids, to) => { setData(x => moveIncomes(x, ids, to)); flash(ids.length === 1 ? `Moved 1 income to ${to}` : `Moved ${ids.length} incomes to ${to}`); }} />
                  <button onClick={() => del(k)} style={{ ...small, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-accent-100)', color: RED }}>
                    <I.Trash size={14} />{confirm === k ? 'Tap again to delete' : 'Delete category'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && <span style={{ display: 'block', padding: '12px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>Create at least one so you can file your incomes.</span>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="New category, like Rent" aria-label="New income category" style={{ ...textInput, flex: 1 }} />
        <button onClick={add} disabled={!name.trim()} style={{ ...small, height: 50, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-accent)', color: '#fff', opacity: name.trim() ? 1 : 0.4 }}><I.Plus size={16} />Create</button>
      </div>
      <span style={{ margin: '0 4px', fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>Deleting a category only removes it from these lists. Expenses and incomes already in it keep their category, so your history doesn't change.</span>
    </>
  );
}

/** Your expense categories: open one to rename it, edit its subcategories, see and move its expenses, or delete it. */
function ManageCategories() {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [newCat, setNewCat] = useState('');
  const [newSub, setNewSub] = useState('');
  const [editSub, setEditSub] = useState<{ sub: string; v: string } | null>(null);
  const month = monthExpenses(d, c);
  const spent = (k: string) => month.filter(e => catOf(e)[0] === k).reduce((a, e) => a + e.amt, 0);
  const hueOf = (k: string) => HUES[Math.max(0, d.cats.findIndex(x => x.name === k)) % HUES.length];
  const taken = (n: string) => d.cats.some(k => k.name.toLowerCase() === n.trim().toLowerCase());
  const pocketName = (id: string) => d.pockets.find(p => p.id === id)?.name ?? '';

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
  const saveSub = (k: string) => {
    if (!editSub) return;
    const to = editSub.v.trim();
    if (to && to !== editSub.sub) { setData(x => renameSub(x, k, editSub.sub, to) ?? {}); flash(`Renamed to ${to}`); }
    setEditSub(null);
  };
  const delSub = (k: string, sub: string) => setData(x => ({ cats: x.cats.map(y => (y.name === k ? { ...y, subs: y.subs.filter(s => s !== sub) } : y)) }));
  const delCat = (k: string) => {
    if (confirm !== k) { setConfirm(k); return; }
    setData(x => ({ cats: x.cats.filter(y => y.name !== k) }));
    setConfirm(null); setOpen(null); flash(`${k} deleted`);
  };
  const rename = (k: string, to: string) => {
    const into = expenseCatClash(d, k, to), target = into ?? to.trim();
    setData(x => renameExpenseCat(x, k, to) ?? {});
    setOpen(target); flash(into ? `${k} merged into ${into}` : `Renamed to ${target}`);
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 4px 0', gap: 8 }}>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Expense categories</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{plural(d.cats.length, 'category', 'categories')}</span>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 24, padding: '4px 16px' }}>
        {d.cats.map((k, i) => {
          const isOpen = open === k.name, h = hueOf(k.name), sp = spent(k.name);
          const rows = isOpen ? d.expenses.filter(e => catOf(e)[0] === k.name).map(e => {
            const sub = catOf(e)[1];
            return { id: e.id, date: e.date, ts: e.ts, note: e.note || sub || k.name, meta: [shortDate(e.date), sub, pocketName(e.p)].filter(Boolean).join(' · '), amt: e.amt };
          }) : [];
          return (
            <div key={k.name} style={{ borderBottom: i === d.cats.length - 1 ? 0 : `1px solid ${LINE}` }}>
              <button onClick={() => { setOpen(isOpen ? null : k.name); setConfirm(null); setNewSub(''); setEditSub(null); }} aria-expanded={isOpen}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 0 14px 22px' }}>
                  <NameEditor key={k.name} name={k.name} clash={to => expenseCatClash(d, k.name, to)} onSave={to => rename(k.name, to)} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Subcategories</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {k.subs.map(sub => editSub?.sub === sub ? (
                        <input key={sub} autoFocus value={editSub.v} onChange={e => setEditSub({ sub, v: e.target.value })} onBlur={() => saveSub(k.name)} onKeyDown={e => { if (e.key === 'Enter') saveSub(k.name); if (e.key === 'Escape') setEditSub(null); }} aria-label={`New name for ${sub}`}
                          style={{ height: 32, width: 150, borderRadius: 999, border: `2px solid ${ink(h)}`, background: 'var(--surface)', color: TEXT, fontSize: 13, fontWeight: 600, padding: '0 12px', outline: 'none' }} />
                      ) : (
                        <span key={sub} style={{ display: 'flex', alignItems: 'center', gap: 2, height: 32, padding: '0 6px 0 4px', borderRadius: 999, background: tint(h), color: ink(h), fontSize: 13, fontWeight: 600 }}>
                          <button onClick={() => setEditSub({ sub, v: sub })} aria-label={`Rename ${sub}`} style={{ border: 0, background: 'transparent', color: ink(h), font: 'inherit', fontWeight: 600, cursor: 'pointer', padding: '0 4px 0 8px' }}>{sub}</button>
                          <button onClick={() => delSub(k.name, sub)} aria-label={`Delete ${sub}`} style={{ width: 22, height: 22, borderRadius: 999, border: 0, background: 'transparent', color: ink(h), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><I.X size={12} sw={3} /></button>
                        </span>
                      ))}
                      {k.subs.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>No subcategories.</span>}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>Tap a subcategory to rename it.</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={newSub} onChange={e => setNewSub(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSub(k.name); }} placeholder="New subcategory" aria-label={`New subcategory in ${k.name}`} style={{ ...textInput, flex: 1, padding: '9px 14px', fontSize: 14, background: 'var(--color-neutral-100)' }} />
                      <button onClick={() => addSub(k.name)} disabled={!newSub.trim()} style={{ ...small, background: TEXT, color: 'var(--on-text)', opacity: newSub.trim() ? 1 : 0.4 }}>Add</button>
                    </div>
                  </div>
                  <TxnMover rows={rows} kind="expense" targets={[k.name, ...d.cats.map(x => x.name).filter(n => n !== k.name)]} subsOf={t => d.cats.find(x => x.name === t)?.subs ?? []}
                    onMove={(ids, to, sub) => { setData(x => moveExpenses(x, ids, to, sub)); flash(ids.length === 1 ? `Moved 1 expense to ${to}` : `Moved ${ids.length} expenses to ${to}`); }} />
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
