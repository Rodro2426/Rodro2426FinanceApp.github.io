// Profile > Face ID lock: on or off for this device, and how long Pockets can stay in the background before it locks.
import { useEffect, useState } from 'react';
import { flash } from '../lib/store';
import { useSync } from '../sheets/CloudSheet';
import { bioName, biometricAvailable, disableLock, enableLock, lockConfig, setLockAfter, unlockWithBiometrics } from '../lib/lock';
import { Segmented, Toggle } from './bits';

export function LockSetting() {
  const sync = useSync();
  const [cfg, setCfg] = useState(lockConfig());
  const [avail, setAvail] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { biometricAvailable().then(setAvail); }, []);
  const name = bioName();
  const can = !!sync.uid && avail === true && !busy;
  const sub = !sync.uid ? 'Sign in first: if Face ID ever fails, your Pockets password unlocks it.'
    : avail === false ? `${name} isn't available here (iPhone needs iOS 16+ and iCloud Keychain on).`
    : cfg ? `Pockets asks for ${name} when you come back.` : `Ask for ${name} when you open Pockets, so nobody else can see your money.`;
  const flip = async (on: boolean) => {
    setBusy(true);
    if (on) { const e = await enableLock(60); if (e) flash(e); else flash(`${name} lock on`); }
    // Turning it off also asks for Face ID, so someone holding your unlocked phone can't just switch it off.
    else if (await unlockWithBiometrics()) { disableLock(); flash(`${name} lock off`); }
    setCfg(lockConfig()); setBusy(false);
  };
  return (
    <div style={{ marginTop: 8, background: 'var(--surface)', borderRadius: 20, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 22 }}>🔒</span>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{name} lock</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>{busy ? 'One moment…' : sub}</span>
        </span>
        <span style={{ opacity: can || cfg ? 1 : 0.4, pointerEvents: can || (cfg && !busy) ? 'auto' : 'none' }}><Toggle on={!!cfg} onChange={flip} label={`${name} lock`} /></span>
      </div>
      {cfg && <>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Lock after leaving Pockets for</span>
        <Segmented items={[['0', 'Immediately'], ['60', '1 minute'], ['300', '5 minutes']]} value={String(cfg.after) as '0' | '60' | '300'} onPick={v => { setLockAfter(Number(v)); setCfg(lockConfig()); }} mt={0} />
      </>}
    </div>
  );
}
