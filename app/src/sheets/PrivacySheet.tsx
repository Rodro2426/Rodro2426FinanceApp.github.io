// "Your privacy": what stays on the phone, what leaves it and why, in plain words. Opened from Welcome and Profile.
import { SheetFrame } from './Sheet';
import { glyph } from '../ui/PocketIcons';

/** Each line is one whole sentence so it translates cleanly. Keep it true: change it when the app changes. */
const PARTS: [string, string, string[]][] = [
  ['pk:lock', 'On your phone', [
    'Your accounts, pockets, expenses and photos are saved on this phone.',
    'Without an account, nothing leaves your phone.',
    'We never sell your information, and Pockets has no ads.'
  ]],
  ['pk:cloud', 'If you turn on cloud backup', [
    'A copy of your data is kept in Google Firebase, linked to your account.',
    'It travels encrypted, and the app only lets your own account read it.',
    'You can sign out at any time and keep using Pockets on this phone.'
  ]],
  ['pk:people', 'With friends', [
    'Friends find you by your email, and they see your name and photo.',
    'A trip or a debt you share is seen only by the people in it.',
    'Your accounts and balances are never shared.'
  ]],
  ['pk:bell', 'Reminders', [
    'To reach your lock screen, the text of each reminder waits on our notification server until it is sent.',
    'That text can include the name and amount of a bill.'
  ]],
  ['pk:chart', 'Prices and exchange rates', [
    'Stock prices are asked for by ticker, like AAPL, and exchange rates by currency.',
    'Neither request carries your name or your money data.'
  ]]
];

export function PrivacyBody() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>Your money is personal. This is exactly what Pockets keeps, where, and who can see it.</span>
      {PARTS.map(([icon, title, lines]) => (
        <div key={title} style={{ background: 'var(--surface)', borderRadius: 22, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700 }}><span aria-hidden="true" style={{ display: 'flex', fontSize: 20, color: 'var(--brand)' }}>{glyph(icon)}</span>{title}</span>
          {lines.map(l => <span key={l} style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>{l}</span>)}
        </div>
      ))}
    </div>
  );
}

export function PrivacySheet() {
  return <SheetFrame title="Your privacy"><PrivacyBody /></SheetFrame>;
}
