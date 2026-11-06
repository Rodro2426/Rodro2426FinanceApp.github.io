// Picking a category for a transaction: your last 3 categories, a search box that finds categories and
// subcategories as you type, and "Create" when nothing matches. Once chosen, it shows as one clear row.
import { useMemo, useState } from 'react';
import { setData, useApp } from '../lib/store';
import { catOf } from '../lib/derive';
import { TEXT, ink, tint } from '../lib/constants';
import * as I from './icons';

export type CatPick = [string, string];
/** A steady color per category name, so the same category always looks the same. */
export const catHue = (name: string) => { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };

/** The last categories used (newest first, no repeats). */
export function recentCats(expenses: { ts: number; cat: string; sub: string; p: string }[], n = 3): CatPick[] {
  const out: CatPick[] = [], seen = new Set<string>();
  for (const e of [...expenses].sort((a, b) => b.ts - a.ts)) {
    const [c, s] = catOf(e as Parameters<typeof catOf>[0]);
    if (!c || seen.has(c)) continue;
    seen.add(c); out.push([c, s]);
    if (out.length >= n) break;
  }
  return out;
}

export function CategoryPicker({ value, onChange, compact }: { value: CatPick; onChange: (v: CatPick) => void; compact?: boolean }) {
  const { data: d } = useApp();
  const [cat, sub] = value;
  const [editing, setEditing] = useState(!cat);
  const [q, setQ] = useState('');
  const [newSub, setNewSub] = useState<string | null>(null);
  const recent = useMemo(() => { const r = recentCats(d.expenses); return r.length ? r : d.cats.slice(0, 3).map(k => [k.name, k.subs[0] || ''] as CatPick); }, [d.expenses, d.cats]);
  const qs = q.trim().toLowerCase();
  // Matches: categories by name, and subcategories ("rest" finds Food & dining › Restaurants).
  const matches = useMemo(() => {
    if (!qs) return [] as CatPick[];
    const out: CatPick[] = [];
    d.cats.forEach(k => { if (k.name.toLowerCase().includes(qs)) out.push([k.name, k.subs[0] || '']); });
    d.cats.forEach(k => k.subs.forEach(s => { if (s.toLowerCase().includes(qs) && s !== 'General' && !out.some(([c, x]) => c === k.name && x === s)) out.push([k.name, s]); }));
    return out.slice(0, 7);
  }, [qs, d.cats]);
  const exact = d.cats.some(k => k.name.toLowerCase() === qs);
  const pick = (v: CatPick) => { onChange(v); setEditing(false); setQ(''); };
  const create = () => {
    const n = q.trim(); if (!n) return;
    if (!exact) setData(x => ({ cats: [...x.cats, { name: n, subs: ['General'] }] }));
    pick([n, 'General']);
  };
  const subs = d.cats.find(k => k.name === cat)?.subs ?? [];
  const addSub = () => {
    const n = (newSub ?? '').trim(); if (!n) { setNewSub(null); return; }
    setData(x => ({ cats: x.cats.map(k => (k.name === cat && !k.subs.includes(n) ? { ...k, subs: [...k.subs, n] } : k)) }));
    onChange([cat, n]); setNewSub(null);
  };

  const row = (v: CatPick, key: string, label?: string) => {
    const h = catHue(v[0]);
    return (
      <button key={key} onClick={() => pick(v)} className="hv-n100" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 8px', border: 0, borderRadius: 14, background: 'transparent', color: TEXT, cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ width: 30, height: 30, borderRadius: 10, background: tint(h), color: ink(h), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flex: 'none' }}>{v[0].charAt(0).toUpperCase()}</span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v[0]}</span>
          {(label || (v[1] && v[1] !== 'General')) && <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{label ?? v[1]}</span>}
        </span>
      </button>
    );
  };

  if (cat && !editing) {
    const h = catHue(cat);
    return (
      <div style={{ background: 'var(--surface)', borderRadius: compact ? 16 : 20, padding: compact ? 8 : 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 36, height: 36, borderRadius: 12, background: tint(h), color: ink(h), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, flex: 'none' }}>{cat.charAt(0).toUpperCase()}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat}</span>
          <button onClick={() => setEditing(true)} style={{ height: 32, padding: '0 12px', borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Change</button>
        </div>
        {/* Subcategory: a simple list to choose from, plus "New…" */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-700)', width: 92, flex: 'none' }}>Subcategory</span>
          {newSub === null ? (
            <select value={sub} onChange={e => (e.target.value === '__new' ? setNewSub('') : onChange([cat, e.target.value]))} aria-label="Subcategory"
              style={{ flex: 1, minWidth: 0, height: 38, borderRadius: 12, border: 0, background: 'var(--color-neutral-100)', color: TEXT, fontSize: 15, fontWeight: 600, padding: '0 10px' }}>
              {subs.map(s => <option key={s} value={s}>{s}</option>)}
              {!subs.includes(sub) && sub && <option value={sub}>{sub}</option>}
              <option value="__new">+ New subcategory…</option>
            </select>
          ) : (
            <span style={{ flex: 1, display: 'flex', gap: 6 }}>
              <input autoFocus value={newSub} onChange={e => setNewSub(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSub(); }} placeholder="New subcategory" aria-label="New subcategory"
                style={{ flex: 1, minWidth: 0, height: 38, borderRadius: 12, border: 0, background: 'var(--color-neutral-100)', color: TEXT, fontSize: 16, padding: '0 10px', outline: 'none' }} />
              <button onClick={addSub} style={{ height: 38, padding: '0 12px', borderRadius: 12, border: 0, background: TEXT, color: 'var(--on-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add</button>
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: compact ? 16 : 20, padding: compact ? 8 : 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-neutral-100)', borderRadius: 14, padding: '0 12px' }}>
        <I.Search size={16} color="var(--color-neutral-600)" />
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (matches.length) pick(matches[0]); else create(); } }}
          placeholder="Search or create a category" aria-label="Search categories" autoFocus={!!cat}
          style={{ flex: 1, minWidth: 0, height: 42, border: 0, background: 'transparent', color: TEXT, fontSize: 16, outline: 'none' }} />
        {cat && <button onClick={() => { setEditing(false); setQ(''); }} style={{ border: 0, background: 'transparent', color: 'var(--color-neutral-700)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 4 }}>Cancel</button>}
      </div>
      {!qs ? <>
        <span style={{ margin: '4px 8px 0', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Recent</span>
        {recent.map((v, i) => row(v, `r${i}`))}
      </> : <>
        {matches.map((v, i) => row(v, `m${i}`))}
        {!exact && <button onClick={create} className="hv-n100" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 8px', border: 0, borderRadius: 14, background: 'transparent', color: TEXT, cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ width: 30, height: 30, borderRadius: 10, border: '2px dashed var(--color-neutral-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><I.Plus size={14} sw={2.5} /></span>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Create “{q.trim()}”</span>
        </button>}
      </>}
    </div>
  );
}
