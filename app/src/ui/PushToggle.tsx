// Profile > Lock-screen notifications: on or off for this phone.
import { dateLocale } from '../lib/i18n';
import { useEffect, useState } from 'react';
import { flash, useApp } from '../lib/store';
import { useSync } from '../sheets/CloudSheet';
import { disablePush, enablePush, pushOn, pushStatus, pushSupport, sendTestPush, syncRemindersNow, type PushStatus } from '../lib/push';
import { removePushSub, savePushSub } from '../lib/social';
import { FieldLabel, Toggle } from './bits';

export function PushToggle() {
  const { data: d } = useApp();
  const sync = useSync();
  const [on, setOn] = useState(pushOn());
  const [busy, setBusy] = useState(false);
  const support = pushSupport();
  if (support === 'off') return null; // the server isn't set up yet
  const sub = !sync.uid ? 'Sign in to Pockets first: notifications use your account.'
    : support === 'install' ? 'On iPhone, open Pockets from its home-screen icon to turn these on.'
    : support === 'old' ? 'This browser can\'t show notifications (iPhone needs iOS 16.4 or newer).'
    : on ? 'On for this phone: friends\' messages and expenses, and reminders the day before bills are due.'
    : 'Get friends\' messages and expenses, and bill reminders, even when Pockets is closed.';
  const can = !!sync.uid && support === 'ok' && !busy;
  const flip = async (v: boolean) => {
    setBusy(true);
    if (v) { const e = await enablePush(savePushSub, d); setOn(!e); flash(e ?? 'Notifications on for this phone'); }
    else { await disablePush(removePushSub); setOn(false); flash('Notifications off for this phone'); }
    setBusy(false);
  };
  return (<>
    <FieldLabel m="18px 4px 0">Notifications</FieldLabel>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', borderRadius: 20, padding: '14px 16px', marginTop: 8 }}>
      <span style={{ fontSize: 22 }}>🔔</span>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Lock-screen notifications</span>
        <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>{busy ? 'One moment…' : sub}</span>
      </span>
      <span style={{ opacity: can ? 1 : 0.4, pointerEvents: can ? 'auto' : 'none' }}><Toggle on={on} onChange={flip} label="Lock-screen notifications" /></span>
    </div>
    {on && can && <PushCheck />}
  </>);
}

/** Shows whether reminders reached the server and lets you send yourself a test notification. */
function PushCheck() {
  const { data: d } = useApp();
  const [st, setSt] = useState<PushStatus | null | 'loading'>('loading');
  const [msg, setMsg] = useState<string | null>(null);
  const load = () => { setSt('loading'); pushStatus().then(setSt); };
  useEffect(load, []);
  const when = (t: number) => new Date(t).toLocaleString(dateLocale(), { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const line = st === 'loading' ? 'Checking the notification server…'
    : !st ? 'Couldn\'t reach the notification server. Check that the Worker is deployed.'
    : st.kv === false ? 'Reminders aren\'t set up on the server (the KV binding SCHED is missing).'
    : !st.saved ? 'No reminders saved for this phone yet. Tap "Send reminders now".'
    : `${st.items} reminder${st.items === 1 ? '' : 's'} waiting${st.next && st.next > 0 ? ` · next ${when(st.next)}` : ''}${st.sent ? ` · ${st.sent} sent` : ''}`;
  const warn = st && st !== 'loading' && st.overdue ? `⚠️ ${st.overdue} reminder${st.overdue === 1 ? ' is' : 's are'} late: the server isn't sending on schedule. Check the cron trigger in Cloudflare (Settings → Trigger events → */5 * * * *).` : null;
  const btn = { flex: 1, height: 38, borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: 'var(--color-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' } as const;
  return (
    <div style={{ marginTop: 8, background: 'var(--surface)', borderRadius: 20, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>{line}</span>
      {warn && <span role="alert" style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-accent-700)', fontWeight: 600 }}>{warn}</span>}
      {msg && <span style={{ fontSize: 12.5, lineHeight: 1.4, fontWeight: 600 }}>{msg}</span>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={btn} onClick={async () => { setMsg('Sending…'); const r = await sendTestPush(); setMsg(!r ? 'Couldn\'t reach the notification server.' : r.ok ? 'Sent. Lock your phone: it should arrive in a few seconds.' : r.gone ? 'Apple says this phone turned notifications off. Turn the switch off and on again.' : `Not sent${r.status ? ` (Apple answered ${r.status})` : ''}${r.error ? `: ${r.error}` : ''}.`); }}>Send a test</button>
        <button style={btn} onClick={async () => { setMsg('Sending reminders…'); const r = await syncRemindersNow(d); setMsg(r.saved ? `Saved ${r.items} reminder${r.items === 1 ? '' : 's'} on the server.` : r.error ?? 'Not saved.'); load(); }}>Send reminders now</button>
      </div>
    </div>
  );
}
