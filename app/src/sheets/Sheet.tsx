import { useRef, type ReactNode } from 'react';
import { closeSheet } from '../lib/store';
import * as I from '../ui/icons';

/** `action`: the sheet's main button (Save, Add…), shown at the top right next to the close button. */
export function SheetFrame({ title, children, topOnFocus, action }: { title: string; children: ReactNode; topOnFocus?: boolean; action?: { label: string; onClick: () => void; disabled?: boolean } }) {
  const panel = useRef<HTMLDivElement>(null);
  // Keep the top of the sheet in view while the keyboard slides up.
  const toTop = () => { if (!topOnFocus) return; [0, 120, 350].forEach(t => setTimeout(() => panel.current?.scrollTo({ top: 0 }), t)); };
  return (
    <div data-sheet style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div className="sheet-scrim" onClick={closeSheet} style={{ position: 'absolute', inset: 0, background: 'rgba(32,30,29,.3)' }} />
      <div ref={panel} onFocus={toTop} className="sheet-panel noscroll" role="dialog" aria-label={title} style={{ position: 'relative', background: 'var(--page)', borderRadius: '32px 32px 0 0', padding: '10px 20px calc(24px + var(--tb))', maxHeight: '88%', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
        <div className="grabber" style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 999, background: 'var(--color-neutral-300)', marginBottom: 10, flex: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 10, ...(action ? { position: 'sticky', top: -10, zIndex: 3, background: 'var(--page)', margin: '0 -20px 6px', padding: '10px 20px 8px' } : {}) }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
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
