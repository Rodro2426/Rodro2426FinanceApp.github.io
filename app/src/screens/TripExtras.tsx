import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { setUI, flash } from '../lib/store';
import { LINE, TEXT } from '../lib/constants';
import { fmt } from '../lib/derive';
import { fmtDay, monthLabel, shortDate } from '../lib/dates';
import { deleteMessage, loadItems, loadMessages, loadPhotos, markRead, myUid, sendMessage, tripMembers, type Attachment, type Message } from '../lib/social';
import { prepGifFile, prepPhoto, type GifHit } from '../lib/chatMedia';
import { AttachPreview, BubbleMedia, GifPanel, MediaViewer } from './ChatMedia';
import { tripMonths, tripSpending, type TripItem } from '../lib/settle';
import { VIZ } from '../ui/charts';
import * as I from '../ui/icons';
import { Avatar, useSocial } from './Social';

const backBtn = (onClick: () => void) => <button onClick={onClick} aria-label="Back to trip" className="hv-n200" style={{ width: 40, height: 40, borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}><I.ChevronLeft size={20} /></button>;

/* ---------------- Spending summary ---------------- */
export function TripStatsPage({ id }: { id: string }) {
  const so = useSocial();
  const t = so.trips.find(x => x.id === id);
  const items = so.items[id] ?? [];
  const months = tripMonths(items);
  const [period, setPeriod] = useState<string>('all');
  if (!t) return null;
  const me = myUid(), members = tripMembers(t);
  const s = tripSpending(members, items, me, period);
  const mi = months.indexOf(period);
  const label = period === 'all' ? 'All-time spending' : `${monthLabel(period)} spending`;
  // Ring: your share vs everyone else's, with a 2px gap between the two parts.
  const R = 92, W = 22, C = 2 * Math.PI * R, mineLen = s.total ? s.pct * C : 0, gap = s.mine > 0 && s.mine < s.total ? 3 : 0;
  const S = VIZ.series[0];
  return (
    <div className="page noscroll scroller" style={{ position: 'absolute', inset: 0, zIndex: 26, background: 'var(--page)' }}>
      <div className="scroll-body" style={{ padding: 'var(--top) 18px calc(var(--tb) + 40px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
          {backBtn(() => setUI({ page: `trip:${id}` }))}
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15 }}>{t.emoji} {t.name}</span>
            <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>{label}</span>
          </span>
        </div>

        {/* Period: all time, or one month at a time. Part of the page, so it scrolls away with it. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', borderRadius: 999, padding: 5 }}>
          <button onClick={() => setPeriod('all')} style={{ height: 40, padding: '0 16px', borderRadius: 999, border: 0, background: period === 'all' ? TEXT : 'transparent', color: period === 'all' ? 'var(--on-text)' : TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>All time</button>
          <button aria-label="Previous month" disabled={!months.length || mi === 0} onClick={() => setPeriod(mi < 0 ? months[months.length - 1] : months[Math.max(0, mi - 1)])} style={{ width: 40, height: 40, borderRadius: 999, border: 0, background: 'transparent', color: TEXT, cursor: 'pointer', opacity: !months.length || mi === 0 ? 0.3 : 1 }}><I.ChevronLeft size={18} /></button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>{period === 'all' ? (months.length ? 'Pick a month' : 'No expenses yet') : monthLabel(period)}</span>
          <button aria-label="Next month" disabled={mi < 0 || mi === months.length - 1} onClick={() => setPeriod(months[Math.min(months.length - 1, mi + 1)])} style={{ width: 40, height: 40, borderRadius: 999, border: 0, background: 'transparent', color: TEXT, cursor: 'pointer', opacity: mi < 0 || mi === months.length - 1 ? 0.3 : 1 }}><I.Chevron size={18} /></button>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 28, padding: '22px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 230, height: 230 }}>
            <svg width="230" height="230" viewBox="0 0 230 230" role="img" aria-label={`Your share ${Math.round(s.pct * 100)}% of ${fmt(s.total)}`} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="115" cy="115" r={R} fill="none" stroke={VIZ.track} strokeWidth={W} />
              {s.total > 0 && <circle cx="115" cy="115" r={R} fill="none" stroke={S} strokeOpacity={0.35} strokeWidth={W} strokeDasharray={`${Math.max(0, C - mineLen - gap * 2)} ${C}`} strokeDashoffset={-(mineLen + gap)} />}
              {s.mine > 0 && <circle cx="115" cy="115" r={R} fill="none" stroke={S} strokeWidth={W} strokeLinecap="butt" strokeDasharray={`${Math.max(0, mineLen - gap)} ${C}`} />}
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmt(s.total)}</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{s.count === 1 ? '1 expense' : `${s.count} expenses`}</span>
            </div>
          </div>
          <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 6, height: 34, borderRadius: 99, background: S, opacity: 0.35 }} />
              <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Total spent by the group</span><span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{fmt(s.total)}</span></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 6, height: 34, borderRadius: 99, background: S }} />
              <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Your share</span><span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{fmt(s.mine)}</span><span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{Math.round(s.pct * 100)}% of the group's spending</span></span>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 24, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Everyone's share</span>
          {s.people.map(p => (
            <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={p.name} size={28} uid={p.id} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{p.id === me ? 'You' : p.name}</span>
                <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(p.share)}</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: 'var(--color-neutral-100)', overflow: 'hidden', marginLeft: 38 }}>
                <div style={{ width: `${s.total ? (p.share / s.total) * 100 : 0}%`, height: 8, borderRadius: 99, background: S, opacity: p.id === me ? 1 : 0.45 }} />
              </div>
              <span style={{ marginLeft: 38, fontSize: 12, color: 'var(--color-neutral-600)' }}>paid {fmt(p.paid)} · {s.total ? Math.round((p.share / s.total) * 100) : 0}% of spending</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

/* ---------------- Chat ---------------- */
/** Keeps the chat sized to the part of the screen the keyboard leaves visible. */
function useViewportHeight() {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return;
    const on = () => setH(vv.height);
    on(); vv.addEventListener('resize', on);
    return () => vv.removeEventListener('resize', on);
  }, []);
  return h;
}

type Row = { kind: 'msg'; m: Message } | { kind: 'event'; it: TripItem; at: number };

export function TripChatPage({ id }: { id: string }) {
  const so = useSocial();
  const t = so.trips.find(x => x.id === id);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // A photo or GIF waiting to be sent (the message box is its caption), the GIF panel, and the photo being viewed.
  const [att, setAtt] = useState<{ preview: string; label: string; busy: boolean; payload?: Attachment } | null>(null);
  const [gifs, setGifs] = useState(false);
  const [view, setView] = useState<Message | null>(null);
  const photoIn = useRef<HTMLInputElement>(null), gifIn = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const vh = useViewportHeight();
  const me = myUid();
  // While the chat is open, check for new messages every few seconds (and for new expenses less often).
  useEffect(() => {
    let n = 0;
    const tick = () => { if (document.visibilityState !== 'visible') return; loadMessages(id).then(() => markRead(id)).catch(() => {}); if (++n % 5 === 0) loadItems(id).catch(() => {}); };
    tick(); const h = setInterval(tick, 3000);
    return () => clearInterval(h);
  }, [id]);
  const memberKey = (so.trips.find(x => x.id === id)?.members ?? []).join(',');
  useEffect(() => { if (memberKey) loadPhotos(memberKey.split(',')).catch(() => {}); }, [memberKey]);
  const msgs = so.messages[id] ?? [], items = so.items[id] ?? [];
  const rows: Row[] = [...msgs.map(m => ({ kind: 'msg' as const, m })), ...items.map(it => ({ kind: 'event' as const, it, at: it.createdAt }))]
    .sort((a, b) => (a.kind === 'msg' ? a.m.createdAt : a.at) - (b.kind === 'msg' ? b.m.createdAt : b.at));
  useLayoutEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [rows.length]);
  if (!t) return null;
  const members = tripMembers(t), nameOf = (x: string) => (x === me ? 'You' : members.find(m => m.id === x)?.name ?? 'Someone');
  const canSend = !sending && !att?.busy && (!!text.trim() || !!att?.payload);
  const send = async () => {
    if (!canSend) return;
    setSending(true); const e = await sendMessage(id, text, att?.payload); setSending(false);
    if (e) flash(e); else { setText(''); setAtt(null); }
  };
  /** A file from the phone: GIFs stay animated (if small), everything else is shrunk as a photo. */
  const attachFile = async (f: File | undefined) => {
    if (!f) return;
    const local = URL.createObjectURL(f);
    const isGif = f.type === 'image/gif';
    setGifs(false); setAtt({ preview: local, label: isGif ? 'GIF' : 'Photo', busy: true });
    try {
      if (isGif) { const g = await prepGifFile(f); setAtt({ preview: local, label: 'GIF', busy: false, payload: { img: { thumb: g.data, w: g.w, h: g.h, gif: true } } }); }
      else { const p = await prepPhoto(f); setAtt({ preview: p.thumb.data, label: 'Photo', busy: false, payload: { img: { thumb: p.thumb.data, w: p.full.w, h: p.full.h }, full: p.full.data } }); }
    } catch (e) { setAtt(null); flash((e as Error).message || "Couldn't read that image"); }
  };
  const sendGif = async (g: GifHit) => {
    setGifs(false); setSending(true);
    const e = await sendMessage(id, '', { gif: { url: g.url, w: g.w, h: g.h, big: g.big } });
    setSending(false); if (e) flash(e);
  };
  let lastDay = '';
  return (
    <div className="chatpage" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: vh ? `${vh}px` : '100%', zIndex: 26, background: 'var(--page)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(var(--top) + 4px) 16px 10px', borderBottom: `1px solid ${LINE}`, background: 'var(--page)' }}>
        {backBtn(() => setUI({ page: `trip:${id}` }))}
        <span style={{ fontSize: 22 }}>{t.emoji}</span>
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{members.map(m => nameOf(m.id)).join(', ')}</span>
        </span>
      </div>
      <div ref={list} className="noscroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!rows.length && <span style={{ margin: 'auto', textAlign: 'center', fontSize: 14, color: 'var(--color-neutral-700)', maxWidth: 260 }}>Say hi 👋 Messages are only seen by the people in this trip.</span>}
        {rows.map((r, i) => {
          const at = r.kind === 'msg' ? r.m.createdAt : r.at, day = new Date(at).toDateString();
          const sep = day !== lastDay ? <div key={`d${i}`} style={{ alignSelf: 'center', margin: '8px 0 4px', fontSize: 11.5, fontWeight: 700, color: 'var(--color-neutral-600)' }}>{fmtDay(new Date(at).toISOString().slice(0, 10), { weekday: 'short', month: 'short', day: 'numeric' })}</div> : null;
          lastDay = day;
          if (r.kind === 'event') {
            const it = r.it;
            return <div key={`e${it.id}`} style={{ display: 'contents' }}>{sep}<div style={{ alignSelf: 'center', maxWidth: '86%', fontSize: 12.5, color: 'var(--color-neutral-700)', background: 'var(--color-neutral-100)', borderRadius: 999, padding: '5px 12px', textAlign: 'center' }}>{it.kind === 'payment' ? `🤝 ${nameOf(it.paidBy)} paid ${nameOf(it.to ?? '')} ${fmt(it.amount)}` : `🧾 ${nameOf(it.createdBy)} added ${it.desc} · ${fmt(it.amount)}`}</div></div>;
          }
          const m = r.m, mine = m.uid === me, prev = rows[i - 1], showName = !mine && !(prev && prev.kind === 'msg' && prev.m.uid === m.uid && !sep);
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {sep}
              <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              {!mine && <span style={{ width: 28, flex: 'none', alignSelf: 'flex-start', marginTop: showName ? 22 : 0, visibility: showName ? 'visible' : 'hidden' }}><Avatar name={m.name} size={28} uid={m.uid} /></span>}
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {showName && <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-neutral-600)', margin: '4px 10px 2px' }}>{m.name}</span>}
                {(m.img || m.gif) && <div style={{ marginBottom: m.text ? 3 : 0 }}><BubbleMedia m={m} onOpen={() => setView(m)} /></div>}
                {m.text && <div onClick={() => { if (mine && confirm('Delete this message for everyone?')) deleteMessage(id, m.id); }}
                  style={{ background: mine ? TEXT : 'var(--surface)', color: mine ? 'var(--on-text)' : TEXT, borderRadius: 20, borderBottomRightRadius: mine ? 6 : 20, borderBottomLeftRadius: mine ? 20 : 6, padding: '9px 13px', fontSize: 15, lineHeight: 1.35, whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: mine ? 'pointer' : 'default' }}>
                  {m.text}
                </div>}
                <span style={{ fontSize: 10.5, color: 'var(--color-neutral-500)', margin: '2px 8px 0' }}>{new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
              </div>
              </div>
            </div>
          );
        })}
      </div>
      {gifs && <GifPanel onPick={sendGif} onClose={() => setGifs(false)} onFile={() => gifIn.current?.click()} />}
      {att && <AttachPreview src={att.preview} label={att.label} busy={att.busy} onRemove={() => setAtt(null)} />}
      <input ref={photoIn} type="file" accept="image/*" hidden onChange={e => { attachFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={gifIn} type="file" accept="image/gif" hidden onChange={e => { attachFile(e.target.files?.[0]); e.target.value = ''; }} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, padding: `8px 12px ${vh && vh < window.innerHeight - 100 ? '8px' : 'calc(var(--tb) + 6px)'}`, borderTop: att || gifs ? 0 : `1px solid ${LINE}`, background: 'var(--page)' }}>
        <button onClick={() => photoIn.current?.click()} aria-label="Send a photo" style={{ width: 40, height: 44, borderRadius: 999, border: 0, background: 'transparent', color: 'var(--color-neutral-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0 }}><I.Image size={22} /></button>
        <button onClick={() => setGifs(g => !g)} aria-label="Send a GIF" aria-pressed={gifs} style={{ width: 40, height: 44, borderRadius: 999, border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.02em', color: gifs ? 'var(--color-accent-700)' : 'var(--color-neutral-700)' }}><span style={{ border: '2px solid currentColor', borderRadius: 6, padding: '1px 4px', lineHeight: 1.1 }}>GIF</span></button>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={1} placeholder={att ? 'Add a caption' : 'Message'} aria-label="Message"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ flex: 1, resize: 'none', maxHeight: 120, border: 0, borderRadius: 22, background: 'var(--surface)', color: TEXT, fontSize: 16, padding: '11px 16px', outline: 'none', fontFamily: 'inherit', lineHeight: 1.35 }} />
        <button onClick={send} disabled={!canSend} aria-label="Send" style={{ marginLeft: 4, width: 44, height: 44, borderRadius: 999, border: 0, background: 'var(--color-accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: canSend ? 1 : 0.4, flex: 'none' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      </div>
      {view && <MediaViewer tripId={id} m={view} mine={view.uid === me} onClose={() => setView(null)} onDelete={async () => { if (!confirm('Delete this for everyone?')) return; await deleteMessage(id, view.id); setView(null); }} />}
    </div>
  );
}

export const tripDateLabel = (iso: string) => shortDate(iso);
