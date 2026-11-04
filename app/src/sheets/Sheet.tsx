import { useRef, type ReactNode } from 'react';
import { closeSheet } from '../lib/store';
import * as I from '../ui/icons';

export function SheetFrame({ title, children, topOnFocus }: { title: string; children: ReactNode; topOnFocus?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  // Keep the top of the sheet in view while the keyboard slides up.
  const toTop = () => { if (!topOnFocus) return; [0, 120, 350].forEach(t => setTimeout(() => panel.current?.scrollTo({ top: 0 }), t)); };
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div className="sheet-scrim" onClick={closeSheet} style={{ position: 'absolute', inset: 0, background: 'rgba(32,30,29,.3)' }} />
      <div ref={panel} onFocus={toTop} className="sheet-panel noscroll" role="dialog" aria-label={title} style={{ position: 'relative', background: '#f7f5f3', borderRadius: '32px 32px 0 0', padding: '10px 20px calc(24px + var(--tb))', maxHeight: '88%', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 999, background: 'var(--color-neutral-300)', marginBottom: 10, flex: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 10 }}>
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
          <button onClick={closeSheet} aria-label="Close" style={{ width: 34, height: 34, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, background: 'var(--color-neutral-200)', color: 'var(--color-text)', cursor: 'pointer', padding: 0, flex: 'none' }}>
            <I.X size={16} sw={2.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
