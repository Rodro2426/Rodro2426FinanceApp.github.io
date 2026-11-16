// The Apple Pay tutorial video (public/tutorial/, made in mocks/applepay-tutorial): a button that opens it full screen.
import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

const SRC = './tutorial/applepay-en.mp4', POSTER = './tutorial/applepay-en.jpg';

export function TutorialVideoButton({ style }: { style?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open]);
  return <>
    <button onClick={() => setOpen(true)} className="pr97" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', height: 48, borderRadius: 24, border: 0, cursor: 'pointer', fontSize: 15, fontWeight: 700, ...style }}>
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor" /></svg>
      Watch the step-by-step video
    </button>
    {open && createPortal(
      <div role="dialog" aria-label="Apple Pay tutorial video" style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video src={SRC} poster={POSTER} controls autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
        <button onClick={() => setOpen(false)} aria-label="Close video" style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: 14, width: 44, height: 44, borderRadius: 22, border: 0, background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>, document.body)}
  </>;
}
