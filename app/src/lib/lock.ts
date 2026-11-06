// Face ID lock. A home-screen web app can't call Face ID directly, so Pockets uses a passkey: iPhone asks for
// Face ID (or the phone's passcode) to use it, and Pockets only checks that you passed. Nothing leaves the phone.
// It's a privacy lock: it keeps others from opening Pockets on your unlocked phone; it doesn't encrypt the data.
const KEY = 'pockets-lock';
export interface LockConfig { id: string; after: number /* seconds away before it locks */ }
const ls = { get: () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') as LockConfig | null; } catch { return null; } }, set: (v: LockConfig | null) => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* not saved */ } } };

export const lockConfig = () => ls.get();
export const lockOn = () => !!ls.get();
export const setLockAfter = (after: number) => { const c = ls.get(); if (c) ls.set({ ...c, after }); };

const b64u = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** Face ID / Touch ID available on this device (through passkeys). */
export async function biometricAvailable() {
  try { return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
}

const isApple = () => /iP(hone|ad|od)|Mac/.test(navigator.userAgent);
export const bioName = () => (/iP(hone|od)/.test(navigator.userAgent) ? 'Face ID' : isApple() ? 'Touch ID' : 'Fingerprint or face');

/** Turns the lock on: iPhone asks for Face ID once and keeps a passkey just for unlocking Pockets. */
export async function enableLock(after = 60): Promise<string | null> {
  if (!(await biometricAvailable())) return `${bioName()} isn't available here. On iPhone it needs iOS 16 or newer and iCloud Keychain.`;
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: random(32), rp: { name: 'Pockets', id: location.hostname },
        user: { id: random(16), name: 'Pockets lock', displayName: 'Pockets lock' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000, attestation: 'none'
      }
    }) as PublicKeyCredential | null;
    if (!cred) return 'It wasn\'t turned on.';
    ls.set({ id: b64u(cred.rawId), after });
    return null;
  } catch (e) {
    const n = (e as Error).name;
    return n === 'NotAllowedError' ? 'It wasn\'t turned on (cancelled).' : (e as Error).message || 'Couldn\'t turn on the lock.';
  }
}
export const disableLock = () => ls.set(null);

/** Asks for Face ID. True when it passed (the passkey confirms the person was verified). */
export async function unlockWithBiometrics(): Promise<boolean> {
  const c = ls.get(); if (!c) return true;
  try {
    const a = await navigator.credentials.get({
      publicKey: { challenge: random(32), rpId: location.hostname, allowCredentials: [{ type: 'public-key', id: unb64u(c.id), transports: ['internal'] }], userVerification: 'required', timeout: 60000 }
    }) as PublicKeyCredential | null;
    if (!a) return false;
    // Flags byte of the authenticator data: bit 2 = the person was verified (Face ID, Touch ID or passcode).
    const data = new Uint8Array((a.response as AuthenticatorAssertionResponse).authenticatorData);
    return !!(data[32] & 0x04) && b64u(a.rawId) === c.id;
  } catch { return false; }
}

/* ---------------- When to lock ---------------- */
let hiddenAt = 0;
/** Call when the app goes to the background. */
export const markHidden = () => { hiddenAt = Date.now(); };
/** Whether coming back now needs Face ID. */
export const needsUnlock = () => { const c = ls.get(); return !!c && (Date.now() - hiddenAt) / 1000 >= c.after; };
