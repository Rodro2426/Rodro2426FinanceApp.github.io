// "Add Pockets to your Home Screen": shown in iPhone Safari (and right away after Start free on the website, ?install=1).
// Same look as the first-time setup (screens/Setup.tsx): the glowing flower, glass cards, mint and lavender light,
// light or dark with the app's theme. The account is made in the installed app, so it's only signed into once.

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

/** `icon`: where the app icon sits in the screenshot (%), so today's icon is drawn over the old one in the picture. */
const STEPS: { title: string; body: string; img: string; w: number; h: number; icon?: { left: number; top: number; size: number } }[] = [
  { title: 'Open the Safari menu', body: 'Tap the ☰ button on the left of the address bar.', img: 'step1.jpg', w: 640, h: 166 },
  { title: 'Tap Share', body: 'It’s in the list that opens.', img: 'step2.jpg', w: 520, h: 891 },
  { title: 'Tap View More', body: 'Swipe up if you don’t see it, then tap the arrow.', img: 'step3.jpg', w: 640, h: 218 },
  { title: 'Tap Add to Home Screen', body: 'Scroll down a little if it’s not visible.', img: 'step4.jpg', w: 640, h: 273 },
  { title: 'Keep "Open as Web App" on and tap Add', body: 'You can rename it, but leave the switch green.', img: 'step5.jpg', w: 640, h: 546, icon: { left: 3.3, top: 30.2, size: 15.9 } }
];

const INK = 'var(--su-ink)', SOFT = 'var(--su-soft)';

export default function InstallGuide({ onClose, fromProfile }: { onClose: () => void; fromProfile?: boolean }) {
  // Cards come in one after another, once (setup-in in styles.css; none with reduced motion).
  const enter = (i: number) => ({ animation: 'setup-in .5s cubic-bezier(0.23, 1, 0.32, 1) both', animationDelay: `${120 + i * 60}ms` });
  return (
    <div className="noscroll setup" role="dialog" aria-label="Install Pockets" style={{ position: 'absolute', inset: 0, zIndex: 85, overflowY: 'auto', overflowX: 'hidden', background: 'var(--su-bg)', color: INK }}>
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1100, overflow: 'hidden', pointerEvents: 'none' }}>
        <div className="setup-glow open"><i /><i /><i /></div>
      </div>
      <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto', padding: 'calc(var(--top) + 18px) 18px calc(var(--tb) + 40px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, ...enter(0) }}>
          <div className="setup-logo" style={{ width: 72, height: 72 }}>
            <span style={{ display: 'block' }}><img className="su-mark-dark" src="./pockets-mark-dark.svg" alt="" width={72} height={72} /><img className="su-mark-light" src="./pockets-mark.svg" alt="" width={72} height={72} /></span>
          </div>
          <span style={{ marginTop: 6, fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>Add Pockets to your Home Screen</span>
          <span style={{ fontSize: 15, lineHeight: 1.45, color: SOFT, maxWidth: 340 }}>It opens full screen like an app. You create your account there, once.</span>
          <span style={{ marginTop: 4, padding: '6px 14px', borderRadius: 999, background: 'var(--su-good)', color: 'var(--su-accent)', fontSize: 13, fontWeight: 700 }}>5 taps · about a minute</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 26 }}>
          {STEPS.map((s, i) => (
            <div key={s.img} style={{ background: 'var(--su-panel)', borderRadius: 26, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 0 0 1px var(--su-line)', ...enter(i + 1) }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--su-accent)', color: 'var(--su-on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flex: 'none' }}>{i + 1}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 3 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{s.title}</span>
                  <span style={{ fontSize: 13.5, lineHeight: 1.4, color: SOFT }}>{s.body}</span>
                </div>
              </div>
              <div style={{ position: 'relative', width: '100%', maxWidth: s.w > 600 ? '100%' : '78%', alignSelf: 'center' }}>
                <img src={`./install/${s.img}`} alt={s.title} loading="lazy" width={s.w} height={s.h}
                  style={{ width: '100%', height: 'auto', borderRadius: 16, display: 'block', boxShadow: '0 0 0 1px var(--su-line)' }} />
                {s.icon && <img src="./icon-180.png" alt="" style={{ position: 'absolute', left: `${s.icon.left}%`, top: `${s.icon.top}%`, width: `${s.icon.size}%`, aspectRatio: '1', borderRadius: '22%' }} />}
              </div>
            </div>
          ))}
          <div style={{ background: 'var(--su-accent)', color: 'var(--su-on-accent)', borderRadius: 26, padding: 16, display: 'flex', gap: 12, alignItems: 'center', ...enter(STEPS.length + 1) }}>
            <span style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--su-on-accent)', color: 'var(--su-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flex: 'none' }}>6</span>
            <span style={{ fontSize: 15, lineHeight: 1.45 }}><b>Open Pockets from your Home Screen</b> and create your account there. Safari keeps a separate copy, so there's no need to sign in here.</span>
          </div>
        </div>

        <button onClick={() => { if (!fromProfile) skipInstallGuide(); onClose(); }}
          style={{ display: 'block', margin: '20px auto 0', border: 0, background: 'transparent', color: SOFT, fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
          {fromProfile ? 'Close' : 'Continue in the browser instead'}
        </button>
      </div>
    </div>
  );
}
