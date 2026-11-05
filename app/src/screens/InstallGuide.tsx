import { TEXT } from '../lib/constants';

/** True when running as the installed home-screen app (not inside Safari). */
export const isInstalled = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const SKIP = 'pockets-install-skipped';
/** Show the guide in iPhone Safari until the person installs or chooses to stay in the browser. */
export function shouldShowInstallGuide() {
  if (isInstalled() || !isIOS()) return false;
  try { return localStorage.getItem(SKIP) !== '1'; } catch { return true; }
}
export function skipInstallGuide() { try { localStorage.setItem(SKIP, '1'); } catch { /* private mode */ } }

const STEPS: { title: string; body: string; img: string; w: number; h: number }[] = [
  { title: 'Open the Safari menu', body: 'Tap the ☰ button on the left of the address bar.', img: 'step1.jpg', w: 640, h: 166 },
  { title: 'Tap Share', body: 'It’s in the list that opens.', img: 'step2.jpg', w: 520, h: 891 },
  { title: 'Tap View More', body: 'Swipe up if you don’t see it, then tap the arrow.', img: 'step3.jpg', w: 640, h: 218 },
  { title: 'Tap Add to Home Screen', body: 'Scroll down a little if it’s not visible.', img: 'step4.jpg', w: 640, h: 273 },
  { title: 'Keep "Open as Web App" on and tap Add', body: 'You can rename it, but leave the switch green.', img: 'step5.jpg', w: 640, h: 546 }
];

export default function InstallGuide({ onClose, fromProfile }: { onClose: () => void; fromProfile?: boolean }) {
  return (
    <div className="noscroll force-light" role="dialog" aria-label="Install Pockets" style={{ position: 'absolute', inset: 0, zIndex: 85, overflowY: 'auto', background: 'linear-gradient(180deg, #f8f5ee 0%, #ebe3d2 100%)', padding: 'calc(var(--top) + 18px) 20px calc(var(--tb) + 24px)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
        <img src="./icon-180.png" alt="" width={72} height={72} style={{ borderRadius: 18, boxShadow: '0 8px 20px rgba(27,36,102,.22)' }} />
        <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', color: '#232e7a' }}>Install Pockets</span>
        <span style={{ fontSize: 15, lineHeight: 1.4, color: '#3d4784', maxWidth: 310 }}>Add it to your home screen so it opens like an app, full screen, and keeps your data safe in one place.</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22 }}>
        {STEPS.map((s, i) => (
          <div key={s.img} style={{ background: 'var(--surface)', borderRadius: 24, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ width: 30, height: 30, borderRadius: 999, background: '#232e7a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flex: 'none' }}>{i + 1}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{s.title}</span>
                <span style={{ fontSize: 13, lineHeight: 1.35, color: 'var(--color-neutral-700)' }}>{s.body}</span>
              </div>
            </div>
            <img src={`./install/${s.img}`} alt={s.title} loading="lazy" width={s.w} height={s.h}
              style={{ width: '100%', height: 'auto', maxWidth: s.w > 600 ? '100%' : '78%', alignSelf: 'center', borderRadius: 16, display: 'block' }} />
          </div>
        ))}
        <div style={{ background: '#232e7a', color: '#fff', borderRadius: 24, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--surface)', color: '#232e7a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flex: 'none' }}>6</span>
          <span style={{ fontSize: 15, lineHeight: 1.4 }}><b>Open Pockets from your home screen.</b> Start there, not from Safari, because Safari keeps its own separate copy of your data.</span>
        </div>
      </div>

      <button onClick={() => { if (!fromProfile) skipInstallGuide(); onClose(); }}
        style={{ display: 'block', margin: '18px auto 0', border: 0, background: 'transparent', color: '#232e7a', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
        {fromProfile ? 'Close' : 'Continue in the browser instead'}
      </button>
    </div>
  );
}
