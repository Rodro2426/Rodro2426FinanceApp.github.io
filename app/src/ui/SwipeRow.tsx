// Swipe a transaction row to the left to reveal Edit and Delete, like iPhone Mail.
// - While the finger is down the row follows it 1:1 (direct transform writes, no re-render per move),
//   with rubber-band resistance past the end.
// - Letting go opens or closes it by distance OR by a quick flick, finishing at the release speed.
// - Only one row is open at a time; tapping the row, scrolling or touching anywhere else closes it.
// - Delete asks once ("Delete?"), then the row folds away and the amounts update.
// The row is marked data-noswipe so the tab swipe in ui/swipe.ts leaves it alone.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getState, openSheet } from '../lib/store';
import type { Sheet } from '../lib/types';
import { deleteTxn } from '../sheets/EditTxn';

const ACTION = 76;          // width of each button
const OPEN = ACTION * 2;    // how far the row slides to show both
const LOCK = 8;             // px before deciding sideways vs. scrolling
const FLICK = 0.45;         // px/ms: a quick flick opens or closes even if short
const RUBBER = 0.2;         // how much the row follows past its ends
const EASE = 'cubic-bezier(.32,.72,0,1)';

/** The row that's open now, if any (one handle per row, stable across renders). */
let openRow: { close: () => void } | null = null;

export function SwipeRow({ kind, id, back, children }: { kind: 'expense' | 'income'; id: string; back?: Sheet; children: ReactNode }) {
  const front = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const x = useRef(0);
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState(false);
  const [gone, setGone] = useState(false);
  const moved = useRef(false);
  const handle = useRef({ close: () => {} }).current;

  const place = (to: number, ms = 0) => {
    const el = front.current; if (!el) return;
    x.current = to;
    el.style.transition = ms ? `transform ${ms}ms ${EASE}` : 'none';
    el.style.transform = to ? `translateX(${to}px)` : '';
  };
  const settle = (toOpen: boolean, speed = 0) => {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Faster release, shorter finish: the row leaves the finger at the speed it was moving.
    const ms = still ? 0 : Math.round(Math.max(180, Math.min(380, 380 - Math.abs(speed) * 160)));
    place(toOpen ? -OPEN : 0, ms);
    setOpen(toOpen);
    if (!toOpen) setAsk(false);
    if (toOpen) { if (openRow && openRow !== handle) openRow.close(); openRow = handle; }
    else if (openRow === handle) openRow = null;
  };
  const close = () => settle(false);
  handle.close = close;

  // Track the finger.
  useEffect(() => {
    const el = root.current; if (!el) return;
    let sx = 0, sy = 0, start = 0, axis: 'x' | 'y' | null = null, lastX = 0, lastT = 0, v = 0, id: number | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if ((e.target as Element).closest('.swipe-actions')) return;
      id = e.pointerId; sx = e.clientX; sy = e.clientY; start = x.current; axis = null; moved.current = false;
      lastX = e.clientX; lastT = e.timeStamp; v = 0;
      if (openRow && openRow !== handle) openRow.close();
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!axis) {
        if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (axis === 'x') { moved.current = true; try { el.setPointerCapture(e.pointerId); } catch { /* older Safari */ } }
      }
      if (axis !== 'x') return;
      let to = start + dx;
      if (to > 0) to = to * RUBBER;
      else if (to < -OPEN) to = -OPEN + (to + OPEN) * RUBBER;
      place(to);
      const dt = e.timeStamp - lastT;
      if (dt > 0) v = (e.clientX - lastX) / dt;
      lastX = e.clientX; lastT = e.timeStamp;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      if (axis !== 'x') return;
      const flickOpen = v < -FLICK, flickClose = v > FLICK;
      settle(flickOpen ? true : flickClose ? false : x.current < -OPEN / 2, v);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, []);

  // Close when the list scrolls, or on a touch anywhere outside this row.
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => { if (!root.current?.contains(e.target as Node)) close(); };
    const scrolled = () => close();
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('scroll', scrolled, true);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('scroll', scrolled, true); };
  }, [open]);
  useEffect(() => () => { if (openRow === handle) openRow = null; }, []);

  // A drag, or a tap while open, must not also open the transaction.
  const guard = (e: React.MouseEvent) => {
    if (moved.current || open) { e.stopPropagation(); e.preventDefault(); moved.current = false; if (open) close(); }
  };

  const edit = () => { close(); openSheet({ name: 'txn', kind, id, back }); };
  const del = () => {
    if (!ask) { setAsk(true); return; }
    setGone(true);
    // Let the row fold away, then remove it (the amounts above update at the same moment).
    setTimeout(() => { if (!deleteTxn(kind, id)) { setGone(false); close(); } }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
  };
  useEffect(() => { if (!ask) return; const t = setTimeout(() => setAsk(false), 3000); return () => clearTimeout(t); }, [ask]);

  // Interest is calculated, not entered: nothing to swipe.
  if (kind === 'income' && getState().data.incomes.find(x => x.id === id)?.interest) return <>{children}</>;

  return (
    <div ref={root} className={'swipe-row' + (gone ? ' gone' : '')} data-noswipe>
      <div className="swipe-clip">
        <div className="swipe-actions" aria-hidden={!open}>
          {!ask && <button type="button" className="swipe-edit" tabIndex={open ? 0 : -1} onClick={edit}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></svg>Edit
          </button>}
          <button type="button" className={'swipe-del' + (ask ? ' ask' : '')} tabIndex={open ? 0 : -1} onClick={del}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>{ask ? 'Delete?' : 'Delete'}
          </button>
        </div>
        <div ref={front} className="swipe-front" onClickCapture={guard}>{children}</div>
      </div>
    </div>
  );
}
