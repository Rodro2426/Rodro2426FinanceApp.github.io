// Edit layout: any main page is a list of blocks. In edit mode each block gets an invisible box with a handle, arrows and a
// remove button; the block's own design never changes. The order and hidden blocks are saved in settings (so they sync).
import { useRef, useState, type ReactNode } from 'react';
import { setData, useApp } from '../lib/store';
import * as I from './icons';

export interface Block { id: string; name: string; node: ReactNode; /** Shown in the hidden list. */ desc?: string }
type Layout = { order: string[]; hidden: string[] };

/** The saved order applied to today's blocks: unknown ids dropped, new blocks added where they are by default. */
export function arrange(ids: string[], saved?: Layout): { shown: string[]; hidden: string[] } {
  if (!saved) return { shown: ids, hidden: [] };
  const known = saved.order.filter(id => ids.includes(id));
  ids.forEach((id, i) => { if (!known.includes(id)) { const prev = ids.slice(0, i).reverse().find(p => known.includes(p)); known.splice(prev ? known.indexOf(prev) + 1 : 0, 0, id); } });
  const hidden = saved.hidden.filter(id => ids.includes(id));
  return { shown: known.filter(id => !hidden.includes(id)), hidden };
}

const save = (page: string, l: Layout | undefined) => setData(x => {
  const layouts = { ...(x.settings.layouts ?? {}) };
  if (l) layouts[page] = l; else delete layouts[page];
  return { settings: { ...x.settings, layouts } };
});

const round: React.CSSProperties = { width: 40, height: 40, borderRadius: 999, border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' };

export function Blocks({ page, title, blocks, gap = 14, footer }: { page: string; title: string; blocks: Block[]; gap?: number; /** Shown after the blocks (not movable), e.g. Add buttons. */ footer?: ReactNode }) {
  const { data: d } = useApp();
  const [editing, setEditing] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLDivElement>());
  const ids = blocks.map(b => b.id);
  const saved = d.settings.layouts?.[page];
  const arranged = arrange(ids, saved), hidden = arranged.hidden;
  // While dragging, the order lives here and is saved once when you let go.
  const [live, setLive] = useState<string[] | null>(null);
  const shown = live ?? arranged.shown;
  const byId = new Map(blocks.map(b => [b.id, b]));
  const put = (s: string[], h: string[]) => save(page, { order: [...s, ...h], hidden: h });
  const moved = (s: string[], id: string, to: number) => { const r = s.filter(x => x !== id); r.splice(Math.max(0, Math.min(r.length, to)), 0, id); return r; };
  const move = (id: string, to: number) => put(moved(shown, id, to), hidden);

  // Drag by the handle: the block takes the place of whichever block your finger is over; near the edges the page scrolls.
  const onDown = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    const sc = (e.currentTarget as HTMLElement).closest('.scroller') as HTMLElement | null;
    let order = shown;
    setDrag(id); setLive(order);
    const mv = (ev: PointerEvent) => {
      if (sc) { if (ev.clientY < 110) sc.scrollBy(0, -14); else if (ev.clientY > window.innerHeight - 140) sc.scrollBy(0, 14); }
      // Swap only once the finger passes the middle of the neighbour, so tall and short blocks don't flicker back and forth.
      const at = order.indexOf(id);
      const over = order.find((x, k) => {
        if (x === id) return false;
        const r = refs.current.get(x)?.getBoundingClientRect(); if (!r) return false;
        const mid = r.top + r.height / 2;
        return k > at ? ev.clientY > mid && ev.clientY <= r.bottom + 8 : ev.clientY < mid && ev.clientY >= r.top - 8;
      });
      if (over) { order = moved(order, id, order.indexOf(over)); setLive(order); }
    };
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      setDrag(null); setLive(null); put(order, hidden);
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };

  if (!editing) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {shown.map(id => <div key={id} style={{ display: 'flex', flexDirection: 'column', gap }}>{byId.get(id)!.node}</div>)}
      {footer}
      <button onClick={() => setEditing(true)} className="hv-n200" style={{ alignSelf: 'center', marginTop: 6, height: 40, padding: '0 16px', borderRadius: 999, border: 0, background: 'var(--surface)', color: 'var(--color-neutral-700)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        Edit layout
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      <div style={{ position: 'sticky', top: 'calc(var(--top) - 6px)', zIndex: 5, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 18px', borderRadius: 999, background: 'var(--color-text)', color: 'var(--on-text)', boxShadow: '0 8px 24px rgba(0,0,0,.18)' }}>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Edit {title}</span>
          <span style={{ fontSize: 11.5, opacity: 0.75 }}>Drag ⋮⋮ or use the arrows · − hides a block</span>
        </span>
        <button onClick={() => setEditing(false)} style={{ height: 40, padding: '0 18px', borderRadius: 999, border: 0, background: 'var(--surface)', color: 'var(--color-text)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Done</button>
      </div>

      {shown.map((id, i) => {
        const b = byId.get(id)!, on = drag === id;
        return (
          <div key={id} ref={el => { if (el) refs.current.set(id, el); else refs.current.delete(id); }} aria-label={b.name}
            style={{ borderRadius: 28, padding: '4px 6px 8px', margin: '0 -6px', outline: `2px dashed ${on ? 'var(--color-accent)' : 'var(--color-neutral-300)'}`, background: on ? 'var(--color-accent-100)' : 'transparent', transition: 'background .15s', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span onPointerDown={onDown(id)} aria-hidden="true"
                style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-neutral-600)', cursor: on ? 'grabbing' : 'grab', touchAction: 'none', flex: 'none' }}>
                <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor"><circle cx="4" cy="4" r="1.8" /><circle cx="10" cy="4" r="1.8" /><circle cx="4" cy="10" r="1.8" /><circle cx="10" cy="10" r="1.8" /><circle cx="4" cy="16" r="1.8" /><circle cx="10" cy="16" r="1.8" /></svg>
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</span>
              <button onClick={() => move(id, i - 1)} disabled={i === 0} aria-label={`Move ${b.name} up`} style={{ ...round, background: 'var(--surface)', color: 'var(--color-text)', opacity: i === 0 ? 0.35 : 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
              </button>
              <button onClick={() => move(id, i + 1)} disabled={i === shown.length - 1} aria-label={`Move ${b.name} down`} style={{ ...round, background: 'var(--surface)', color: 'var(--color-text)', opacity: i === shown.length - 1 ? 0.35 : 1 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              <button onClick={() => put(shown.filter(x => x !== id), [...hidden, id])} aria-label={`Hide ${b.name}`} style={{ ...round, background: 'var(--color-accent-200)', color: 'var(--color-accent-800)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
              </button>
            </div>
            {/* The block itself, unchanged; taps are off while editing so nothing opens by accident. */}
            <div inert style={{ display: 'flex', flexDirection: 'column', gap, pointerEvents: 'none' }}>{b.node}</div>
          </div>
        );
      })}

      {hidden.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
          <span style={{ padding: '0 4px', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>Hidden blocks</span>
          {hidden.map(id => {
            const b = byId.get(id)!;
            return (
              <div key={id} style={{ borderRadius: 22, border: '2px dashed var(--color-neutral-300)', padding: '10px 10px 10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{b.name}</span>
                  {b.desc && <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{b.desc}</span>}
                </span>
                <button onClick={() => put([...shown, id], hidden.filter(x => x !== id))} style={{ height: 40, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--color-text)', color: 'var(--on-text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <I.Plus size={14} /> Add
                </button>
              </div>
            );
          })}
        </div>
      )}
      {saved && <button onClick={() => save(page, undefined)} style={{ alignSelf: 'center', height: 44, padding: '0 16px', border: 0, background: 'transparent', color: 'var(--color-neutral-700)', fontSize: 14, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>Reset to the default layout</button>}
    </div>
  );
}

/** A section title with a little arrow that folds the section; the fold is remembered (and synced). */
export function useFolded() {
  const { data: d } = useApp();
  const folded = d.settings.folded ?? [];
  const toggle = (key: string) => setData(x => { const f = x.settings.folded ?? []; return { settings: { ...x.settings, folded: f.includes(key) ? f.filter(k => k !== key) : [...f, key] } }; });
  return { isFolded: (key: string) => folded.includes(key), toggle };
}

export function FoldHead({ title, open, onToggle, summary, right }: { title: ReactNode; open: boolean; onToggle: () => void; summary?: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px 0' }}>
      <button onClick={onToggle} aria-expanded={open} style={{ flex: 1, minWidth: 0, minHeight: 40, border: 0, background: 'transparent', color: 'var(--color-text)', padding: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', textAlign: 'left' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', transition: 'transform .2s', transform: `rotate(${open ? 90 : 0}deg)`, color: 'var(--color-neutral-600)' }}><path d="m9 6 6 6-6 6" /></svg>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        {!open && summary && <span style={{ marginLeft: 'auto', paddingLeft: 8, fontSize: 13, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{summary}</span>}
      </button>
      {open && right}
    </div>
  );
}
