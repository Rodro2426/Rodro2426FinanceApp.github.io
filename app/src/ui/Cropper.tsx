import { useEffect, useRef, useState } from 'react';
import * as I from './icons';

/**
 * Full-screen editor shown after picking a photo: drag to move, pinch / slider /
 * wheel to zoom, "Fit" to show the whole image, and a background for empty space.
 * Resolves to a 400×400 data URL (PNG when the background is transparent).
 */
type Bg = 'white' | 'black' | 'none';
/** Card mode: a credit-card-shaped frame (85.6 × 54 mm), with rotate and straighten for photos of a real card. */
export interface CropOpts { card?: boolean }
interface Req { src: string; resolve: (url: string | null) => void; opts: CropOpts }
let openCropper: ((r: Req) => void) | null = null;

export function requestCrop(src: string, opts: CropOpts = {}): Promise<string | null> {
  return new Promise(resolve => {
    if (!openCropper) return resolve(null);
    openCropper({ src, resolve, opts });
  });
}

export const CARD_RATIO = 85.6 / 54;

export function CropperHost() {
  const [req, setReq] = useState<Req | null>(null);
  useEffect(() => { openCropper = r => setReq(r); return () => { openCropper = null; }; }, []);
  if (!req) return null;
  return <Cropper key={req.src} req={req} done={url => { req.resolve(url); setReq(null); }} />;
}

function Cropper({ req, done }: { req: Req; done: (url: string | null) => void }) {
  const card = !!req.opts.card;
  // Frame on screen and saved size: a 280px square (saved at 400px), or a card (saved at 1012 × 638).
  const FW = card ? Math.min(340, window.innerWidth - 40) : 280, FH = card ? Math.round(FW / CARD_RATIO) : 280;
  const OW = card ? 1012 : 400, OH = card ? Math.round(1012 / CARD_RATIO) : 400;
  const [rot, setRot] = useState(0); // quarter turns (0–3)
  const [tilt, setTilt] = useState(0); // straighten, degrees
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [s, setS] = useState(1); // screen px per image px
  const [pos, setPos] = useState({ x: 0, y: 0 }); // image top-left inside the frame
  const [bg, setBg] = useState<Bg>('white');
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; s: number; mid: { x: number; y: number }; pos: { x: number; y: number } } | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const raw = useRef({ x: 0, y: 0 }); // where the finger has dragged the image, before snapping
  const [snap, setSnap] = useState({ x: false, y: false });

  useEffect(() => {
    const i = new Image();
    i.onload = () => {
      setImg(i);
      const cover = Math.max(FW / i.width, FH / i.height);
      setS(cover); setPos({ x: (FW - i.width * cover) / 2, y: (FH - i.height * cover) / 2 });
    };
    i.src = req.src;
  }, [req.src]);

  if (!img) return null;
  // With a quarter turn the image's width and height swap places in the frame.
  const side = rot % 2 === 1, ew = side ? img.height : img.width, eh = side ? img.width : img.height;
  const cover = Math.max(FW / ew, FH / eh), contain = Math.min(FW / ew, FH / eh);
  const minS = contain * 0.5, maxS = cover * 5;
  const clampS = (v: number) => Math.min(maxS, Math.max(minS, v));

  /** Zoom to `ns` keeping the frame point (fx, fy) fixed. */
  const zoomAt = (ns: number, fx = FW / 2, fy = FH / 2, base = { s, pos }) => {
    ns = clampS(ns);
    const ix = (fx - base.pos.x) / base.s, iy = (fy - base.pos.y) / base.s;
    setS(ns); setPos({ x: fx - ix * ns, y: fy - iy * ns });
  };
  const local = (e: { clientX: number; clientY: number }) => { const r = frame.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const fitWith = (mode: 'fit' | 'fill', r = rot) => {
    const sd = r % 2 === 1, w = sd ? img.height : img.width, h = sd ? img.width : img.height;
    const ns = mode === 'fit' ? Math.min(FW / w, FH / h) : Math.max(FW / w, FH / h);
    // pos is the un-rotated top-left; the image turns around its own centre, which stays in the frame's centre.
    setS(ns); setPos({ x: (FW - img.width * ns) / 2, y: (FH - img.height * ns) / 2 });
  };
  const fit = (mode: 'fit' | 'fill') => fitWith(mode);
  const turn = () => { const r = (rot + 1) % 4; setRot(r); fitWith('fill', r); };
  const angle = rot * 90 + tilt;

  const SNAP = 10;
  /** Centred position for the current size, and a position pulled to the centre when it's close. */
  const centerOf = (sc: number) => ({ x: (FW - img.width * sc) / 2, y: (FH - img.height * sc) / 2 });
  const snapped = (q: { x: number; y: number }, sc: number) => {
    const c = centerOf(sc), sx = Math.abs(q.x - c.x) < SNAP, sy = Math.abs(q.y - c.y) < SNAP;
    setSnap({ x: sx, y: sy });
    return { x: sx ? c.x : q.x, y: sy ? c.y : q.y };
  };
  const center = () => { const c = centerOf(s); setPos(c); setSnap({ x: true, y: true }); };
  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    raw.current = { ...pos };
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
      raw.current = { x: raw.current.x + p.x - prev.x, y: raw.current.y + p.y - prev.y };
      setPos(snapped(raw.current, s));
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    raw.current = { ...pos };
    if (!pointers.current.size) setTimeout(() => setSnap({ x: false, y: false }), 600);
  };

  const save = () => {
    const c = document.createElement('canvas'); c.width = OW; c.height = OH;
    const ctx = c.getContext('2d')!, k = OW / FW;
    if (bg !== 'none') { ctx.fillStyle = bg === 'white' ? '#ffffff' : '#000000'; ctx.fillRect(0, 0, OW, OH); }
    ctx.imageSmoothingQuality = 'high';
    const w = img.width * s * k, h = img.height * s * k;
    ctx.translate(pos.x * k + w / 2, pos.y * k + h / 2);
    ctx.rotate(angle * Math.PI / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    done(bg === 'none' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', card ? 0.85 : 0.9));
  };

  const checker = 'repeating-conic-gradient(#e7e4e2 0% 25%, #f7f5f3 0% 50%) 50% / 20px 20px';
  const bgCss = bg === 'white' ? '#fff' : bg === 'black' ? '#000' : checker;
  const pill = (on: boolean) => ({ height: 36, padding: '0 14px', borderRadius: 999, border: 0, background: on ? '#fff' : 'rgba(255,255,255,.14)', color: on ? '#201e1d' : '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }) as const;

  return (
    <div role="dialog" aria-label="Edit image" style={{ position: 'absolute', inset: 0, zIndex: 70, background: '#1b1a19', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--top) 20px calc(var(--tb) + 12px)', gap: 16, touchAction: 'none' }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => done(null)} style={{ border: 0, background: 'transparent', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', padding: 8 }}>Cancel</button>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{card ? 'Line up your card' : 'Move and scale'}</span>
        <button onClick={save} style={{ border: 0, background: '#ffffff', color: '#201e1d', fontSize: 15, fontWeight: 700, cursor: 'pointer', padding: '8px 16px', borderRadius: 999 }}>Done</button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div ref={frame} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onWheel={e => { const p = local(e); zoomAt(s * (e.deltaY < 0 ? 1.08 : 1 / 1.08), p.x, p.y); }}
          style={{ position: 'relative', width: FW, height: FH, borderRadius: card ? Math.round(FW * 0.045) : 64, overflow: 'hidden', background: bgCss, boxShadow: '0 0 0 2px rgba(255,255,255,.25)', cursor: 'grab', touchAction: 'none' }}>
          <img src={req.src} alt="" draggable={false} style={{ position: 'absolute', left: pos.x, top: pos.y, width: img.width * s, height: img.height * s, maxWidth: 'none', userSelect: 'none', pointerEvents: 'none', transform: `rotate(${angle}deg)` }} />
          {!card && <div style={{ position: 'absolute', inset: 0, borderRadius: 999, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.55)', pointerEvents: 'none' }} />}
          {snap.x && <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: '#ffd84d', pointerEvents: 'none' }} />}
          {snap.y && <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: '#ffd84d', pointerEvents: 'none' }} />}
          {/* Card mode: thirds guides to line up the edges and the chip. */}
          {card && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)', backgroundSize: `${FW / 3}px ${FH / 3}px`, backgroundPosition: '-1px -1px', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.6)' }} />}
        </div>
      </div>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,.72)', textAlign: 'center' }}>{card ? 'Drag to move, pinch to zoom. Line the card\'s edges up with the frame; use Straighten if the photo is tilted.' : 'Drag to move, pinch to zoom. The circle shows how round icons will look.'}</span>
      {card && <div style={{ width: '100%', maxWidth: 340, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', width: 70 }}>Straighten</span>
        <input type="range" aria-label="Straighten" min={-200} max={200} value={Math.round(tilt * 10)} onChange={e => setTilt(Number(e.target.value) / 10)} style={{ flex: 1, accentColor: '#fff' }} />
        <span style={{ fontSize: 12, width: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{tilt > 0 ? '+' : ''}{tilt.toFixed(1)}°</span>
      </div>}
      <div style={{ width: '100%', maxWidth: 320, display: 'flex', alignItems: 'center', gap: 10 }}>
        <I.Image size={14} />
        <input type="range" aria-label="Zoom" min={0} max={1000} value={Math.round(((Math.log(s) - Math.log(minS)) / (Math.log(maxS) - Math.log(minS))) * 1000)}
          onChange={e => zoomAt(Math.exp(Math.log(minS) + (Number(e.target.value) / 1000) * (Math.log(maxS) - Math.log(minS))))} style={{ flex: 1, accentColor: '#fff' }} />
        <I.Image size={20} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => fit('fit')} style={pill(Math.abs(s - contain) < 1e-6)}>Fit whole image</button>
        <button onClick={() => fit('fill')} style={pill(Math.abs(s - cover) < 1e-6)}>Fill</button>
        <button onClick={center} style={pill(false)}>Center</button>
        {card && <button onClick={turn} style={pill(false)}>Rotate 90°</button>}
        {card && tilt !== 0 && <button onClick={() => setTilt(0)} style={pill(false)}>Reset tilt</button>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.72)' }}>Background</span>
        {(['white', 'black', 'none'] as Bg[]).map(b => <button key={b} onClick={() => setBg(b)} style={pill(bg === b)}>{b === 'none' ? 'Transparent' : b === 'white' ? 'White' : 'Black'}</button>)}
      </div>
    </div>
  );
}
