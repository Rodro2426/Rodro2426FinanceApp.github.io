import { useEffect, useRef, useState } from 'react';
import * as I from './icons';

/**
 * Full-screen editor shown after picking a photo: drag to move, pinch / slider /
 * wheel to zoom, "Fit" to show the whole image, and a background for empty space.
 * Resolves to a 400×400 data URL (PNG when the background is transparent).
 */
type Bg = 'white' | 'black' | 'none';
interface Req { src: string; resolve: (url: string | null) => void }
let openCropper: ((r: Req) => void) | null = null;

export function requestCrop(src: string): Promise<string | null> {
  return new Promise(resolve => {
    if (!openCropper) return resolve(null);
    openCropper({ src, resolve });
  });
}

const F = 280; // frame size on screen (px)
const OUT = 400; // saved image size (px)

export function CropperHost() {
  const [req, setReq] = useState<Req | null>(null);
  useEffect(() => { openCropper = r => setReq(r); return () => { openCropper = null; }; }, []);
  if (!req) return null;
  return <Cropper key={req.src} req={req} done={url => { req.resolve(url); setReq(null); }} />;
}

function Cropper({ req, done }: { req: Req; done: (url: string | null) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [s, setS] = useState(1); // screen px per image px
  const [pos, setPos] = useState({ x: 0, y: 0 }); // image top-left inside the frame
  const [bg, setBg] = useState<Bg>('white');
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; s: number; mid: { x: number; y: number }; pos: { x: number; y: number } } | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => {
      setImg(i);
      const cover = Math.max(F / i.width, F / i.height);
      setS(cover); setPos({ x: (F - i.width * cover) / 2, y: (F - i.height * cover) / 2 });
    };
    i.src = req.src;
  }, [req.src]);

  if (!img) return null;
  const cover = Math.max(F / img.width, F / img.height), contain = Math.min(F / img.width, F / img.height);
  const minS = contain * 0.5, maxS = cover * 5;
  const clampS = (v: number) => Math.min(maxS, Math.max(minS, v));

  /** Zoom to `ns` keeping the frame point (fx, fy) fixed. */
  const zoomAt = (ns: number, fx = F / 2, fy = F / 2, base = { s, pos }) => {
    ns = clampS(ns);
    const ix = (fx - base.pos.x) / base.s, iy = (fy - base.pos.y) / base.s;
    setS(ns); setPos({ x: fx - ix * ns, y: fy - iy * ns });
  };
  const local = (e: { clientX: number; clientY: number }) => { const r = frame.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const fit = (mode: 'fit' | 'fill') => {
    const ns = mode === 'fit' ? contain : cover;
    setS(ns); setPos({ x: (F - img.width * ns) / 2, y: (F - img.height * ns) / 2 });
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), s, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, pos };
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const g = gesture.current, mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const ns = clampS(g.s * (Math.hypot(a.x - b.x, a.y - b.y) / (g.dist || 1)));
      const ix = (g.mid.x - g.pos.x) / g.s, iy = (g.mid.y - g.pos.y) / g.s;
      setS(ns); setPos({ x: mid.x - ix * ns, y: mid.y - iy * ns });
    } else if (pointers.current.size === 1) {
      setPos(q => ({ x: q.x + p.x - prev.x, y: q.y + p.y - prev.y }));
    }
  };
  const onUp = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) gesture.current = null; };

  const save = () => {
    const c = document.createElement('canvas'); c.width = OUT; c.height = OUT;
    const ctx = c.getContext('2d')!, k = OUT / F;
    if (bg !== 'none') { ctx.fillStyle = bg === 'white' ? '#ffffff' : '#000000'; ctx.fillRect(0, 0, OUT, OUT); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, pos.x * k, pos.y * k, img.width * s * k, img.height * s * k);
    done(bg === 'none' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9));
  };

  const checker = 'repeating-conic-gradient(#e7e4e2 0% 25%, #f7f5f3 0% 50%) 50% / 20px 20px';
  const bgCss = bg === 'white' ? '#fff' : bg === 'black' ? '#000' : checker;
  const pill = (on: boolean) => ({ height: 36, padding: '0 14px', borderRadius: 999, border: 0, background: on ? '#fff' : 'rgba(255,255,255,.14)', color: on ? '#201e1d' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }) as const;

  return (
    <div role="dialog" aria-label="Edit image" style={{ position: 'absolute', inset: 0, zIndex: 70, background: '#1b1a19', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--top) 20px calc(var(--tb) + 12px)', gap: 16, touchAction: 'none' }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => done(null)} style={{ border: 0, background: 'transparent', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', padding: 8 }}>Cancel</button>
        <span style={{ fontSize: 17, fontWeight: 700 }}>Move and scale</span>
        <button onClick={save} style={{ border: 0, background: 'var(--surface)', color: '#201e1d', fontSize: 15, fontWeight: 700, cursor: 'pointer', padding: '8px 16px', borderRadius: 999 }}>Done</button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div ref={frame} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onWheel={e => { const p = local(e); zoomAt(s * (e.deltaY < 0 ? 1.08 : 1 / 1.08), p.x, p.y); }}
          style={{ position: 'relative', width: F, height: F, borderRadius: 64, overflow: 'hidden', background: bgCss, boxShadow: '0 0 0 2px var(--glass)', cursor: 'grab', touchAction: 'none' }}>
          <img src={req.src} alt="" draggable={false} style={{ position: 'absolute', left: pos.x, top: pos.y, width: img.width * s, height: img.height * s, maxWidth: 'none', userSelect: 'none', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 999, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.55)', pointerEvents: 'none' }} />
        </div>
      </div>
      <span style={{ fontSize: 13, color: 'var(--glass)', textAlign: 'center' }}>Drag to move, pinch to zoom. The circle shows how round icons will look.</span>
      <div style={{ width: '100%', maxWidth: 320, display: 'flex', alignItems: 'center', gap: 10 }}>
        <I.Image size={14} />
        <input type="range" aria-label="Zoom" min={0} max={1000} value={Math.round(((Math.log(s) - Math.log(minS)) / (Math.log(maxS) - Math.log(minS))) * 1000)}
          onChange={e => zoomAt(Math.exp(Math.log(minS) + (Number(e.target.value) / 1000) * (Math.log(maxS) - Math.log(minS))))} style={{ flex: 1, accentColor: '#fff' }} />
        <I.Image size={20} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => fit('fit')} style={pill(Math.abs(s - contain) < 1e-6)}>Fit whole image</button>
        <button onClick={() => fit('fill')} style={pill(Math.abs(s - cover) < 1e-6)}>Fill</button>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--glass)' }}>Background</span>
        {(['white', 'black', 'none'] as Bg[]).map(b => <button key={b} onClick={() => setBg(b)} style={pill(bg === b)}>{b === 'none' ? 'Clear' : b === 'white' ? 'White' : 'Black'}</button>)}
      </div>
    </div>
  );
}
