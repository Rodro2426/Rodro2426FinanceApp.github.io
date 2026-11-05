// Chat photos and GIFs: the bubble image, the full-screen viewer, the GIF search panel and the attachment preview.
import { useEffect, useRef, useState } from 'react';
import { flash, setData, useApp } from '../lib/store';
import { TEXT } from '../lib/constants';
import { bubbleSize, GIPHY_KEY, searchGifs, type GifHit } from '../lib/chatMedia';
import { loadMedia, type Message } from '../lib/social';
import * as I from '../ui/icons';

/** A photo or GIF inside a chat bubble. Its box is sized before it loads, so the chat doesn't jump. */
export function BubbleMedia({ m, onOpen }: { m: Message; onOpen: () => void }) {
  const src = m.gif?.url ?? m.img?.thumb ?? '';
  const w = m.gif?.w ?? m.img?.w ?? 1, h = m.gif?.h ?? m.img?.h ?? 1;
  const size = bubbleSize(w, h);
  const isGif = !!m.gif || !!m.img?.gif;
  return (
    <button onClick={onOpen} aria-label={isGif ? 'Open GIF' : 'Open photo'} style={{ position: 'relative', padding: 0, border: 0, borderRadius: 18, overflow: 'hidden', cursor: 'zoom-in', background: 'var(--color-neutral-200)', ...size, display: 'block' }}>
      <img src={src} alt={isGif ? 'GIF' : 'Photo'} width={size.width} height={size.height} loading="lazy" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
      {isGif && <span style={{ position: 'absolute', left: 8, bottom: 8, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em', color: '#fff', background: 'rgba(0,0,0,.45)', borderRadius: 6, padding: '2px 6px' }}>GIF</span>}
    </button>
  );
}

/** Full-screen photo or GIF. Full photos are downloaded only now. */
export function MediaViewer({ tripId, m, mine, onClose, onDelete }: { tripId: string; m: Message; mine: boolean; onClose: () => void; onDelete: () => void }) {
  const [full, setFull] = useState<string | null>(m.gif?.big ?? m.gif?.url ?? (m.img?.media ? null : m.img?.thumb ?? null));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!m.img?.media) return;
    let on = true;
    loadMedia(tripId, m.img.media).then(d => { if (on) { if (d) setFull(d); else setFailed(true); } }).catch(() => on && setFailed(true));
    return () => { on = false; };
  }, [tripId, m.img?.media]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const shown = full ?? m.img?.thumb;
  const btn = { height: 40, padding: '0 14px', borderRadius: 999, border: 0, background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 } as const;
  return (
    <div role="dialog" aria-label={m.gif ? 'GIF' : 'Photo'} style={{ position: 'absolute', inset: 0, zIndex: 60, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(var(--top) + 2px) 14px 10px', color: '#fff' }}>
        <button onClick={onClose} aria-label="Close" style={{ ...btn, width: 40, padding: 0, justifyContent: 'center' }}><I.X size={18} sw={2.5} /></button>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{mine ? 'You' : m.name}</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{new Date(m.createdAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
        </span>
        {mine && <button onClick={onDelete} style={btn}><I.Trash size={16} /> Delete</button>}
      </div>
      <div onClick={onClose} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, position: 'relative' }}>
        {shown && <img src={shown} alt={m.text || (m.gif ? 'GIF' : 'Photo')} onClick={e => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, filter: full ? 'none' : 'blur(6px)', transition: 'filter .25s' }} />}
        {!full && !failed && <span style={{ position: 'absolute', color: '#fff', fontSize: 13, fontWeight: 700, background: 'rgba(0,0,0,.5)', padding: '6px 12px', borderRadius: 999 }}>Loading full photo…</span>}
        {failed && <span style={{ position: 'absolute', bottom: 20, color: '#fff', fontSize: 13 }}>The full photo isn't available anymore.</span>}
      </div>
      {m.text && <div style={{ padding: '10px 18px calc(var(--tb) + 10px)', color: '#fff', fontSize: 15, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{m.text}</div>}
      {!m.text && <div style={{ height: 'calc(var(--tb) + 8px)' }} />}
      {!mine && <span style={{ position: 'absolute', right: 16, bottom: 'calc(var(--tb) + 8px)', fontSize: 11.5, color: 'rgba(255,255,255,.6)' }}>Press and hold the photo to save it</span>}
    </div>
  );
}

/** GIF search above the message box. Needs a free GIPHY key (built in, or the user's own). */
export function GifPanel({ onPick, onClose, onFile }: { onPick: (g: GifHit) => void; onClose: () => void; onFile: () => void }) {
  const { data: d } = useApp();
  const key = d.settings.giphyKey || GIPHY_KEY;
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<GifHit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!key) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setErr(null); searchGifs(key, q).then(setHits).catch(e => { setErr((e as Error).message); setHits([]); }); }, q ? 350 : 0);
    return () => clearTimeout(timer.current);
  }, [key, q]);
  return (
    <div style={{ borderTop: '1px solid var(--color-neutral-200)', background: 'var(--page)', padding: '10px 12px 0', display: 'flex', flexDirection: 'column', gap: 8, height: 320 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={key ? 'Search GIFs' : 'GIF search is off'} disabled={!key} aria-label="Search GIFs" autoFocus={!!key}
          style={{ flex: 1, minWidth: 0, height: 40, border: 0, borderRadius: 999, background: 'var(--surface)', color: TEXT, padding: '0 16px', fontSize: 16, outline: 'none' }} />
        <button onClick={onFile} title="Send a GIF from your phone" style={{ height: 40, padding: '0 12px', borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>From phone</button>
        <button onClick={onClose} aria-label="Close GIFs" style={{ width: 40, height: 40, borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}><I.X size={16} sw={2.5} /></button>
      </div>
      {!key ? (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 4px 12px' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Turn on GIF search</span>
          <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>GIF search uses GIPHY, which needs a free key: create an account at developers.giphy.com, tap Create an App → API, and paste the key here. Until then you can send GIFs saved on your phone with "From phone".</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="GIPHY API key" aria-label="GIPHY API key" spellCheck={false} autoCapitalize="off"
              style={{ flex: 1, minWidth: 0, height: 42, border: 0, borderRadius: 14, background: 'var(--surface)', color: TEXT, padding: '0 14px', fontSize: 16, outline: 'none' }} />
            <button onClick={() => { if (draft.trim()) { setData(x => ({ settings: { ...x.settings, giphyKey: draft.trim() } })); flash('GIF search on'); } }} style={{ height: 42, padding: '0 16px', borderRadius: 14, border: 0, background: TEXT, color: 'var(--on-text)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Save</button>
          </div>
        </div>
      ) : (
        <div className="noscroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6, alignContent: 'flex-start', paddingBottom: 6 }}>
          {err && <span style={{ fontSize: 13, color: 'var(--color-accent-700)', padding: 6 }}>{err}</span>}
          {hits === null && <span style={{ fontSize: 13, color: 'var(--color-neutral-600)', padding: 6 }}>Loading GIFs…</span>}
          {hits?.length === 0 && !err && <span style={{ fontSize: 13, color: 'var(--color-neutral-600)', padding: 6 }}>No GIFs found.</span>}
          {hits?.map(g => (
            <button key={g.id} onClick={() => onPick(g)} aria-label="Send this GIF" style={{ padding: 0, border: 0, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', height: 100, flexGrow: g.pw / g.ph, width: Math.round(100 * g.pw / g.ph), background: 'var(--color-neutral-200)' }}>
              <img src={g.preview} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}
      {key && <span style={{ alignSelf: 'flex-end', fontSize: 10.5, fontWeight: 700, color: 'var(--color-neutral-500)', padding: '0 4px 6px' }}>Powered by GIPHY</span>}
    </div>
  );
}

/** What's about to be sent: the photo or GIF with a remove button. The message box becomes its caption. */
export function AttachPreview({ src, label, busy, onRemove }: { src: string; label: string; busy?: boolean; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 0' }}>
      <span style={{ position: 'relative', width: 56, height: 56, borderRadius: 14, overflow: 'hidden', background: 'var(--color-neutral-200)', flex: 'none' }}>
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: busy ? 0.5 : 1 }} />
      </span>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--color-neutral-700)' }}>{busy ? 'Preparing…' : `${label} ready · add a caption or tap send`}</span>
      <button onClick={onRemove} aria-label="Remove attachment" style={{ width: 32, height: 32, borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}><I.X size={14} /></button>
    </div>
  );
}
