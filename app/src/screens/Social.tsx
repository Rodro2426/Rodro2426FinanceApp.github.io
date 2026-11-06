import { useEffect, useState, useSyncExternalStore } from 'react';
import { useApp, setUI, openSheet, flash } from '../lib/store';
import { LINE, RED, TEXT, ink, tint } from '../lib/constants';
import { fmt } from '../lib/derive';
import { shortDate } from '../lib/dates';
import { auth, checkVerified, resendVerification } from '../lib/cloud';
import { useSync } from '../sheets/CloudSheet';
import {
  acceptFriend, addFriendByEmail, deleteTrip, ensureProfile, getSocial, hasUnread, myUid, refreshSocial, removeFriend, saveItem, subscribeSocial, tripMembers, updateTrip,
  type Trip
} from '../lib/social';
import { balances, personTotals, settleUp, sharesOf } from '../lib/settle';
import { Segmented, textInput } from '../ui/bits';
import * as I from '../ui/icons';

export const useSocial = () => useSyncExternalStore(subscribeSocial, getSocial);
const GREEN = 'oklch(0.45 0.11 150)';
const hueOf = (s: string) => [20, 60, 150, 220, 280, 320, 100, 190][[...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 8];
/** A person's round picture: their profile photo if they shared one, otherwise their initial on a color. */
export function Avatar({ name, size = 34, uid }: { name: string; size?: number; uid?: string }) {
  const so = useSocial();
  const { data: d } = useApp();
  const photo = uid ? (uid === myUid() ? d.settings.profilePhoto : so.photos[uid]) : null;
  const h = hueOf(name);
  if (photo) return <span role="img" aria-label={name} style={{ display: 'inline-block', width: size, height: size, borderRadius: 999, flex: 'none', backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: tint(h) }} />;
  return <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 999, background: tint(h), color: ink(h), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.42, flex: 'none' }}>{name.trim().charAt(0).toUpperCase() || '?'}</span>;
}
const page = (children: React.ReactNode, title: string, back: () => void, right?: React.ReactNode) => (
  <div className="page noscroll scroller" style={{ position: 'absolute', inset: 0, zIndex: 25, background: 'var(--page)' }}>
    <div className="scroll-body" style={{ padding: 'var(--top) 18px calc(var(--tb) + 30px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 0' }}>
        <button onClick={back} aria-label="Back" className="hv-n200" style={{ width: 40, height: 40, borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}><I.ChevronLeft size={20} /></button>
        <span style={{ flex: 1, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15 }}>{title}</span>
        {right}
      </div>
      {children}
    </div>
  </div>
);
const card = { background: 'var(--surface)', borderRadius: 24, padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 10 };

/* ---------------- Trips & friends ---------------- */
export default function SocialPage() {
  const sync = useSync();
  const so = useSocial();
  const [tab, setTab] = useState<'trips' | 'friends'>('trips');
  useEffect(() => { if (sync.uid) refreshSocial(); }, [sync.uid]);
  const refresh = <button onClick={() => refreshSocial()} aria-label="Refresh" className="hv-n200" style={{ height: 40, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: so.loading ? 0.5 : 1 }}>{so.loading ? 'Loading…' : 'Refresh'}</button>;
  if (!sync.uid) return page(
    <div style={card}>
      <span style={{ fontSize: 17, fontWeight: 700 }}>Share trips with friends</span>
      <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>Add friends by email, create a trip, and everyone adds what they paid. Pockets works out who owes whom so everyone ends up even. You need a Pockets account for this.</span>
      <button onClick={() => openSheet({ name: 'cloud' })} style={{ height: 48, borderRadius: 999, border: 0, background: TEXT, color: 'var(--surface)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Sign in or create an account</button>
    </div>, 'Trips & friends', () => setUI({ page: null }));
  return page(<>
    <VerifyBanner />
    <Segmented items={[['trips', `Trips${so.trips.length ? ` · ${so.trips.length}` : ''}`], ['friends', `Friends${so.friends.filter(f => f.status === 'pending' && f.incoming).length ? ' · new' : ''}`]]} value={tab} onPick={setTab} mt={0} />
    {so.error && <div role="alert" style={{ background: 'var(--color-accent-100)', color: 'var(--color-accent-900)', borderRadius: 16, padding: '10px 12px', fontSize: 13 }}>{so.error}</div>}
    {tab === 'trips' ? <TripList /> : <FriendList />}
  </>, 'Trips & friends', () => setUI({ page: null }), refresh);
}

function VerifyBanner() {
  const u = auth.currentUser;
  const [sent, setSent] = useState(false);
  const [, force] = useState(0);
  if (!u || u.emailVerified) return null;
  return (
    <div style={{ background: 'oklch(0.96 0.055 92)', borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, color: 'oklch(0.33 0.07 70)' }}>
      <span style={{ fontSize: 14.5, fontWeight: 700 }}>Confirm your email so friends can find you</span>
      <span style={{ fontSize: 13, lineHeight: 1.4 }}>We sent a link to <b>{u.email}</b>. Tap it, then come back and tap "I confirmed it". Check spam if you don't see it.</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={async () => { const ok = await checkVerified(); if (ok) { await ensureProfile(); flash('Email confirmed · friends can find you now'); force(x => x + 1); } else flash('Not confirmed yet. Tap the link in the email first.'); }} style={{ flex: 1, height: 40, borderRadius: 999, border: 0, background: 'oklch(0.33 0.07 70)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>I confirmed it</button>
        <button onClick={async () => { const e = await resendVerification(); setSent(!e); flash(e ?? 'Email sent again'); }} disabled={sent} style={{ flex: 1, height: 40, borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', opacity: sent ? 0.5 : 1 }}>{sent ? 'Sent' : 'Send it again'}</button>
      </div>
    </div>
  );
}

function FriendList() {
  const so = useSocial();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const incoming = so.friends.filter(f => f.status === 'pending' && f.incoming), outgoing = so.friends.filter(f => f.status === 'pending' && !f.incoming), friends = so.friends.filter(f => f.status === 'accepted');
  const add = async () => { setBusy(true); setMsg(null); const e = await addFriendByEmail(email); setBusy(false); if (e) setMsg(e); else { flash('Friend request sent'); setEmail(''); } };
  const uidOf = new Map(so.friends.map(f => [f.id, f.uid]));
  const row = (key: string, name: string, sub: string, actions: React.ReactNode, last: boolean) => (
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${last ? 'transparent' : LINE}` }}>
      <Avatar name={name} uid={uidOf.get(key)} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{name}</span>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
      </span>
      {actions}
    </div>
  );
  const small = (label: string, onClick: () => void, primary?: boolean) => <button onClick={onClick} style={{ height: 32, padding: '0 12px', borderRadius: 999, border: 0, background: primary ? TEXT : 'var(--color-neutral-100)', color: primary ? 'var(--surface)' : TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>;
  return <>
    <div style={card}>
      <span style={{ fontSize: 15, fontWeight: 700 }}>Add a friend</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="email" inputMode="email" autoCapitalize="off" value={email} onChange={e => setEmail(e.target.value)} placeholder="friend@email.com" aria-label="Friend's email" style={{ ...textInput, flex: 1, background: 'var(--color-neutral-100)', padding: '12px 14px' }} />
        <button onClick={add} disabled={busy || !email.includes('@')} style={{ height: 48, padding: '0 16px', borderRadius: 16, border: 0, background: TEXT, color: 'var(--surface)', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: busy || !email.includes('@') ? 0.5 : 1 }}>{busy ? '…' : 'Add'}</button>
      </div>
      {msg && <span role="alert" style={{ fontSize: 13, lineHeight: 1.4, color: RED }}>{msg}</span>}
      <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>They need a Pockets account with a confirmed email. They'll see your request in their Friends tab.</span>
    </div>
    {incoming.length > 0 && <div style={card}><span style={{ fontSize: 15, fontWeight: 700 }}>Requests for you</span>
      {incoming.map((f, i) => row(f.id, f.name, f.email || 'Wants to be your friend', <div style={{ display: 'flex', gap: 6 }}>{small('Accept', async () => { const e = await acceptFriend(f.id); flash(e ?? `${f.name} is now your friend`); }, true)}{small('Decline', async () => { await removeFriend(f.id); })}</div>, i === incoming.length - 1))}</div>}
    <div style={card}>
      <span style={{ fontSize: 15, fontWeight: 700 }}>Friends{friends.length ? ` · ${friends.length}` : ''}</span>
      {friends.map((f, i) => row(f.id, f.name, f.email, small('Remove', async () => { if (confirm(`Remove ${f.name} from your friends? Shared trips stay.`)) await removeFriend(f.id); }), i === friends.length - 1 && !outgoing.length))}
      {outgoing.map((f, i) => row(f.id, f.name, `Request sent${f.email ? ` · ${f.email}` : ''}`, small('Cancel', async () => { await removeFriend(f.id); }), i === outgoing.length - 1))}
      {!friends.length && !outgoing.length && <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>No friends yet. Add one by email above.</span>}
    </div>
  </>;
}

/** Your balance in a trip, in words. */
export function myBalance(t: Trip, items = getSocial().items[t.id] ?? []) {
  const b = balances(tripMembers(t), items)[myUid()] ?? 0;
  return { value: b, text: b > 0.004 ? `You're owed ${fmt(b)}` : b < -0.004 ? `You owe ${fmt(-b)}` : 'You\'re even', color: b > 0.004 ? GREEN : b < -0.004 ? RED : 'var(--color-neutral-700)' };
}

function TripList() {
  const so = useSocial();
  return <>
    {so.trips.map(t => {
      const mb = myBalance(t, so.items[t.id]), total = (so.items[t.id] ?? []).filter(i => i.kind === 'expense').reduce((a, i) => a + i.amount, 0);
      return (
        <button key={t.id} onClick={() => setUI({ page: `trip:${t.id}` })} className="pr98" style={{ ...card, border: 0, cursor: 'pointer', textAlign: 'left', color: TEXT, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 48, height: 48, borderRadius: 16, background: tint(hueOf(t.name)), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flex: 'none' }}>{t.emoji}</span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{t.name}</span>
            <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tripMembers(t).map(m => (m.id === myUid() ? 'You' : m.name)).join(', ')} · {fmt(total)} total</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: mb.color }}>{mb.text}</span>
            {hasUnread(t.id) && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent-700)' }}>● New messages</span>}
          </span>
          <I.Chevron size={16} color="var(--color-neutral-500)" />
        </button>
      );
    })}
    {!so.trips.length && !so.loading && <div style={card}><span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>No shared trips yet. Create one for a trip, a dinner or a shared apartment, and add your friends.</span></div>}
    <button onClick={() => openSheet({ name: 'tripNew' })} className="hv-white" style={{ height: 54, borderRadius: 999, border: '2px dashed var(--color-neutral-400)', background: 'transparent', color: TEXT, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><I.Plus size={18} />New shared trip</button>
  </>;
}

/* ---------------- One trip ---------------- */
export function TripPage({ id }: { id: string }) {
  const so = useSocial();
  const { data: d } = useApp();
  const t = so.trips.find(x => x.id === id);
  if (!t) return page(<div style={card}>{so.loading ? 'Loading…' : 'This trip was deleted or you are no longer in it.'}</div>, 'Trip', () => setUI({ page: 'social' }));
  const items = so.items[t.id] ?? [], members = tripMembers(t), uid = myUid();
  const nameOf = (x: string) => (x === uid ? 'You' : members.find(m => m.id === x)?.name ?? 'Someone');
  const bal = balances(members, items), plan = settleUp(bal), mb = myBalance(t, items);
  const mine = personTotals(uid, items), total = items.filter(i => i.kind === 'expense').reduce((a, i) => a + i.amount, 0);
  const logged = new Set(d.tripLogged ?? []);

  return page(<>
    <div style={{ ...card, background: tint(hueOf(t.name)), gap: 4 }}>
      <span style={{ fontSize: 13, color: ink(hueOf(t.name)) }}>{t.emoji} {members.length} people · {fmt(total)} spent</span>
      <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', color: mb.value < -0.004 ? RED : ink(hueOf(t.name)) }}>{mb.text}</span>
      <span style={{ fontSize: 13, color: ink(hueOf(t.name)) }}>Your share {fmt(mine.share)} · you paid {fmt(mine.paid)}</span>
    </div>

    <div style={card}>
      <span style={{ fontSize: 15, fontWeight: 700 }}>Settle up</span>
      {plan.length ? plan.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: i ? `1px solid ${LINE}` : 0 }}>
          <span style={{ flex: 1, fontSize: 14 }}><b>{nameOf(p.from)}</b> {p.from === uid ? 'pay' : 'pays'} <b>{nameOf(p.to)}</b></span>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{fmt(p.amount)}</span>
          <button onClick={() => openSheet({ name: 'tripItem', trip: t.id, id: null, payment: p })} style={{ height: 32, padding: '0 11px', borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: TEXT, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Mark paid</button>
        </div>
      )) : <span style={{ fontSize: 14, color: GREEN, fontWeight: 600 }}>Everyone is even 🎉</span>}
      {plan.length > 0 && <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>The fewest payments that make everyone even.</span>}
    </div>

    <div style={card}>
      <span style={{ fontSize: 15, fontWeight: 700 }}>Balances</span>
      {members.map(m => {
        const v = bal[m.id] ?? 0;
        return <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={m.name} size={30} uid={m.id} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{m.id === uid ? 'You' : m.name}{m.id.startsWith('g:') && <span style={{ fontWeight: 500, color: 'var(--color-neutral-600)' }}> · guest</span>}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: v > 0.004 ? GREEN : v < -0.004 ? RED : 'var(--color-neutral-600)' }}>{v > 0.004 ? `gets ${fmt(v)}` : v < -0.004 ? `owes ${fmt(-v)}` : 'even'}</span>
        </div>;
      })}
      <button onClick={() => openSheet({ name: 'tripPeople', trip: t.id })} className="hv-n200" style={{ marginTop: 4, height: 42, borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <I.Plus size={16} /> Add people{t.guests.length ? ' or link a guest' : ''}
      </button>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <button onClick={() => setUI({ page: `tripchat:${t.id}` })} className="pr98" style={{ ...card, border: 0, cursor: 'pointer', color: TEXT, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, position: 'relative' }}>
        <span style={{ fontSize: 22 }}>💬</span><span style={{ fontSize: 15, fontWeight: 700 }}>Chat</span>
        {hasUnread(t.id) && <span aria-label="New messages" style={{ position: 'absolute', top: 12, right: 12, width: 10, height: 10, borderRadius: 99, background: 'var(--color-accent)' }} />}
      </button>
      <button onClick={() => setUI({ page: `tripstats:${t.id}` })} className="pr98" style={{ ...card, border: 0, cursor: 'pointer', color: TEXT, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
        <span style={{ fontSize: 22 }}>📊</span><span style={{ fontSize: 15, fontWeight: 700 }}>Spending</span>
      </button>
    </div>

    <button onClick={() => openSheet({ name: 'tripItem', trip: t.id, id: null })} className="hv-acc600" style={{ height: 54, borderRadius: 999, border: 0, background: 'var(--color-accent)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><I.Plus size={18} sw={2.5} />Add an expense</button>

    <div style={card}>
      <span style={{ fontSize: 15, fontWeight: 700 }}>Activity</span>
      {items.map((it, i) => {
        const share = sharesOf(it)[uid] ?? 0, key = `${t.id}:${it.id}`;
        return (
          <div key={it.id} onClick={() => openSheet({ name: 'tripItem', trip: t.id, id: it.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? `1px solid ${LINE}` : 0, cursor: 'pointer' }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, background: it.kind === 'payment' ? 'oklch(0.95 0.045 155)' : 'var(--color-neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flex: 'none' }}>{it.kind === 'payment' ? '🤝' : '🧾'}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.kind === 'payment' ? `${nameOf(it.paidBy)} paid ${nameOf(it.to ?? '')}` : it.desc}</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{it.kind === 'payment' ? shortDate(it.date) : `${nameOf(it.paidBy)} paid · ${shortDate(it.date)}`}{share > 0 ? ` · your share ${fmt(share)}` : ''}{share > 0 && logged.has(key) ? ' · in your budget' : ''}</span>
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(it.amount)}</span>
          </div>
        );
      })}
      {!items.length && <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>Nothing yet. Add the first expense.</span>}
    </div>
    <span style={{ margin: '0 4px', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-600)' }}>Tap Refresh on the Trips page to see what others added. Tap an expense to edit it or add your share to your budget.</span>
    {t.owner === uid && <button onClick={async () => { if (!confirm(`Delete "${t.name}" for everyone? This can't be undone.`)) return; const e = await deleteTrip(t.id); flash(e ?? 'Trip deleted'); if (!e) setUI({ page: 'social' }); }} style={{ border: 0, background: 'transparent', color: RED, fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 10 }}>Delete trip</button>}
    {t.owner !== uid && <button onClick={async () => { if (!confirm(`Leave "${t.name}"? Your expenses stay so the balances stay right.`)) return; const e = await updateTrip(t.id, { members: t.members.filter(m => m !== uid) }); if (!e) { flash('You left the trip'); setUI({ page: 'social' }); await refreshSocial(); } }} style={{ border: 0, background: 'transparent', color: RED, fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 10 }}>Leave trip</button>}
  </>, t.name, () => setUI({ page: 'social' }), <button onClick={() => refreshSocial()} className="hv-n200" style={{ height: 40, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: so.loading ? 0.5 : 1 }}>{so.loading ? '…' : 'Refresh'}</button>);
}

export { saveItem };
