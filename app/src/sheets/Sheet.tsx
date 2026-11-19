import { useRef, type PointerEvent, type ReactNode } from 'react';
import { EASE, FLICK } from '../ui/swipe';
import { closeSheet } from '../lib/store';
import { tr } from '../lib/i18n';
import * as I from '../ui/icons';

/** `action`: the sheet's main button (Save, Add…), shown at the top right next to the close button. */
export function SheetFrame({ title, children, topOnFocus, action }: { title: string; children: ReactNode; topOnFocus?: boolean; action?: { label: string; onClick: () => void; disabled?: boolean } }) {
  const panel = useRef<HTMLDivElement>(null);
  // Keep the top of the sheet in view while the keyboard slides up.
  const toTop = () => { if (!topOnFocus) return; [0, 120, 350].forEach(t => setTimeout(() => panel.current?.scrollTo({ top: 0 }), t)); };
  // Dragging the bar on top: the sheet follows the finger down; let go past a third of it, or with a quick
  // flick, and it slides away and closes; otherwise it slides back. Moved directly, no re-render per frame.
  const drag = useRef<{ y: number; lastY: number; lastT: number; v: number } | null>(null);
  const scrim = () => panel.current?.previousElementSibling as HTMLElement | null;
  const down = (e: PointerEvent) => {
    const p = panel.current; if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    p.style.animation = 'none'; p.style.transition = 'none';
  };
  const move = (e: PointerEvent) => {
    const g = drag.current, p = panel.current; if (!g || !p) return;
    const dt = e.timeStamp - g.lastT; if (dt > 0) g.v = 0.6 * ((e.clientY - g.lastY) / dt) + 0.4 * g.v;
    g.lastY = e.clientY; g.lastT = e.timeStamp;
    const dy = e.clientY - g.y, y = dy > 0 ? dy : Math.max(-24, dy / 4); // a little give upwards, like iOS
    p.style.transform = `translateY(${y}px)`;
    const s = scrim(); if (s) s.style.opacity = String(Math.max(0, 1 - Math.max(0, y) / p.offsetHeight));
  };
  const up = (e: PointerEvent) => {
    const g = drag.current, p = panel.current; drag.current = null; if (!g || !p) return;
    const dy = e.clientY - g.y, h = p.offsetHeight, s = scrim();
    if (e.type === 'pointerup' && (dy > h / 3 || (dy > 10 && g.v > FLICK))) {
      const ms = Math.round(Math.min(300, Math.max(140, (h - dy) / Math.max(g.v, 1.2))));
      p.style.transition = `transform ${ms}ms ${EASE}`; p.style.transform = `translateY(${h + 40}px)`;
      if (s) { s.style.transition = `opacity ${ms}ms ease`; s.style.opacity = '0'; }
      setTimeout(closeSheet, ms);
      return;
    }
    p.style.transition = `transform 300ms ${EASE}`; p.style.transform = 'translateY(0)';
    if (s) { s.style.transition = 'opacity 300ms ease'; s.style.opacity = ''; }
    setTimeout(() => { if (!drag.current) { p.style.transition = ''; p.style.transform = ''; } }, 320);
  };
  return (
    <div data-sheet style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div className="sheet-scrim" onClick={closeSheet} style={{ position: 'absolute', inset: 0, background: 'rgba(32,30,29,.3)' }} />
      <div ref={panel} onFocus={toTop} className="sheet-panel noscroll" role="dialog" aria-label={title} style={{ position: 'relative', background: 'var(--page)', borderRadius: '32px 32px 0 0', padding: '10px 20px calc(24px + var(--tb))', maxHeight: '88%', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
        <div className="grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-hidden="true"
          style={{ margin: '-10px -20px 0', padding: '10px 0 10px', display: 'flex', justifyContent: 'center', touchAction: 'none', cursor: 'grab', flex: 'none' }}>
          <div className="grabber" style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--color-neutral-300)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 10, ...(action ? { position: 'sticky', top: -10, zIndex: 3, background: 'var(--page)', margin: '0 -20px 6px', padding: '10px 20px 8px' } : {}) }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: tr(title).length > 16 ? 21 : 24, lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.025em', overflowWrap: 'break-word' }}>{title}</span>
          {action && <button onClick={action.onClick} disabled={action.disabled} className="pr97" style={{ flex: 'none', height: 34, padding: '0 16px', borderRadius: 999, border: 0, background: 'var(--action)', color: 'var(--action-ink)', fontSize: 15, fontWeight: 700, cursor: action.disabled ? 'default' : 'pointer', opacity: action.disabled ? 0.4 : 1, transition: 'opacity .15s' }}>{action.label}</button>}
          <button onClick={closeSheet} aria-label="Close" data-back style={{ width: 34, height: 34, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, background: 'var(--color-neutral-200)', color: 'var(--color-text)', cursor: 'pointer', padding: 0, flex: 'none' }}>
            <I.X size={16} sw={2.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
