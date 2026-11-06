// Profile > Lock-screen notifications: on or off for this phone.
import { useState } from 'react';
import { flash, useApp } from '../lib/store';
import { useSync } from '../sheets/CloudSheet';
import { disablePush, enablePush, pushOn, pushSupport } from '../lib/push';
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
  </>);
}
