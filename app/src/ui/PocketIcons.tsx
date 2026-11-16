import type { ReactNode } from 'react';

/** Pockets' own line icons. A pocket stores one as `pk:<id>` in its `emoji` field; anything else there is a real emoji. */
const P: [id: string, name: string, svg: string][] = [
  ['money', 'Money', '<rect x="3" y="6" width="18" height="12" rx="2.5"/><circle cx="12" cy="12" r="3"/><path d="M6.5 9.5v0M17.5 14.5v0"/>'],
  ['cart', 'Groceries', '<path d="M6.4 9h13.4l-1.5 7H8z"/><path d="M3 5h2.2L8 16h10.3L20 9H6.4"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>'],
  ['bus', 'Transport', '<rect x="5" y="4" width="14" height="14" rx="3"/><path d="M5 11h14M5 15h14M8 18v2M16 18v2"/>'],
  ['home', 'Home', '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M9.5 21v-5.5h5V21"/>'],
  ['beach', 'Vacation', '<circle cx="16.5" cy="7.5" r="3.5"/><path d="M3 15c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M3 19.5c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0"/>'],
  ['ticket', 'Tickets', '<circle cx="9" cy="12" r="2"/><path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M14 7.5v1.5M14 11.25v1.5M14 15v1.5"/>'],
  ['plate', 'Eating out', '<circle cx="14" cy="12" r="3.5"/><circle cx="14" cy="12" r="6.5"/><path d="M4 4v16M2.5 4v4a1.5 1.5 0 0 0 3 0V4"/>'],
  ['bottle', 'Personal care', '<path d="M7 12h10M7 17h10"/><path d="M9.5 3h5v3h-5zM8 6h8l1 3v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9z"/>'],
  ['coffee', 'Coffee', '<path d="M5.2 12.5h10.6"/><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M9 3v3M12 3v3"/>'],
  ['fuel', 'Fuel', '<rect x="4" y="4" width="10" height="17" rx="2"/><rect x="6.5" y="6.5" width="5" height="4" rx="1"/><path d="M14 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"/>'],
  ['plane', 'Flights', '<path d="M21 3 3 10.5l7 2.5 2.5 7zM10 13 21 3"/>'],
  ['sprout', 'Savings', '<path d="M12 21v-9M12 12C12 7.5 9 5 4.5 5c0 4.5 3 7 7.5 7zM12 14c0-4 3-6 7-6 0 4-3 6-7 6z"/>'],
  ['burger', 'Fast food', '<path d="M4 11a8 6 0 0 1 16 0zM5 18h14v.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18.5z"/><rect x="3.5" y="13" width="17" height="2.5" rx="1.25"/>'],
  ['beer', 'Drinks', '<path d="M6 11h10"/><path d="M6 8h10v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM16 10.5h2a2 2 0 0 1 2 2v2.5a2 2 0 0 1-2 2h-2M6 8a2.5 2.5 0 0 1 3-3 3 3 0 0 1 5 0 2.5 2.5 0 0 1 2 3"/>'],
  ['gift', 'Gifts', '<rect x="4.5" y="11" width="15" height="10" rx="1.5"/><rect x="3" y="7.5" width="18" height="3.5" rx="1"/><path d="M12 7.5V21M12 7.5C11 4.5 7 4.5 7 6.2s3 1.3 5 1.3zm0 0c1-3 5-3 5-1.3s-3 1.3-5 1.3z"/>'],
  ['film', 'Movies', '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9v6l5-3z"/>'],
  ['game', 'Games', '<circle cx="16" cy="12" r="1.5"/><path d="M7 8h10a4 4 0 0 1 4 4v2.5a2.5 2.5 0 0 1-4.5 1.5L15 14H9l-1.5 2A2.5 2.5 0 0 1 3 14.5V12a4 4 0 0 1 4-4zM8 10.5v3M6.5 12h3"/>'],
  ['music', 'Music', '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'],
  ['paw', 'Pets', '<ellipse cx="12" cy="16" rx="4" ry="3.5"/><circle cx="5.5" cy="10.5" r="1.8"/><circle cx="9.3" cy="6.3" r="1.8"/><circle cx="14.7" cy="6.3" r="1.8"/><circle cx="18.5" cy="10.5" r="1.8"/>'],
  ['shirt', 'Clothes', '<path d="M8.5 3.5 4 6l-1.5 4.5L6 12v9h12v-9l3.5-1.5L20 6l-4.5-2.5a3.5 3.5 0 0 1-7 0z"/>'],
  ['lipstick', 'Beauty', '<rect x="8" y="12" width="8" height="9" rx="1.2"/><path d="M9 12V8l5-4v8"/>'],
  ['pill', 'Health', '<g transform="rotate(-45 12 12)"><rect x="3" y="8.5" width="18" height="7" rx="3.5"/><path d="M12 8.5v7"/></g>'],
  ['gym', 'Gym', '<rect x="5" y="6.5" width="3" height="11" rx="1"/><rect x="16" y="6.5" width="3" height="11" rx="1"/><path d="M3 9.5v5M21 9.5v5M8 12h8"/>'],
  ['book', 'Education', '<rect x="8" y="7" width="7" height="3" rx=".75"/><path d="M4 5a2 2 0 0 1 2-2h12v15H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 2h12v-4"/>'],
  ['car', 'Car', '<circle cx="7.5" cy="14" r="1.3"/><circle cx="16.5" cy="14" r="1.3"/><path d="M5 11l1.8-4.2A2 2 0 0 1 8.6 5.5h6.8a2 2 0 0 1 1.8 1.3L19 11"/><rect x="3" y="11" width="18" height="6" rx="2"/><path d="M6.5 17v2M17.5 17v2"/>'],
  ['people', 'Friends', '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M14 20a4 4 0 0 1 7.5-2"/><circle cx="16.5" cy="9" r="2.6"/>'],
  ['receipt', 'Bills', '<rect x="9" y="14.5" width="6" height="2.5" rx="1"/><path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21zM9 7.5h6M9 11h6"/>'],
  ['card', 'Card', '<rect x="5.5" y="13.5" width="5" height="2.5" rx="1"/><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19"/>'],
  ['phone', 'Phone & internet', '<rect x="9" y="5.5" width="6" height="9" rx="1"/><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>'],
  ['pocket', 'Pocket', '<path d="M4 4h16v8a8 8 0 0 1-16 0zM4 8h16"/><circle cx="12" cy="13" r="3"/>'],
  ['chart', 'Investments', '<circle cx="18" cy="8" r="2.2"/><path d="M4 20h16M5 16l4-4 3 3 6-7"/>'],
];
export const POCKET_ICONS = P.map(([id, name]) => ({ code: 'pk:' + id, name }));
/** Icons the app uses for its own rows and buttons, kept out of the pocket picker. */
const UI: [id: string, svg: string][] = [
  ['bank', '<path d="M3 9.5 12 4l9 5.5M4 20h16M6 10.5V17M10 10.5V17M14 10.5V17M18 10.5V17"/>'],
  ['bars', '<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="6" rx="1"/><rect x="10.5" y="6" width="3" height="11" rx="1"/><rect x="15.5" y="9" width="3" height="8" rx="1"/>'],
  ['lock', '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2"/>'],
  ['bell', '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2 2 0 0 0 4 0"/>'],
  ['cloud', '<path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.5a4 4 0 0 1-.5 8z"/>'],
  ['chat', '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17H6.5A2.5 2.5 0 0 1 4 14.5z"/><path d="M8.5 10.5v0M12 10.5v0M15.5 10.5v0"/>'],
  ['compass', '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'],
  ['sparkle', '<path d="M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5zM18.5 15.5c.3 1.8 1 2.5 2.5 2.8-1.5.3-2.2 1-2.5 2.7-.3-1.7-1-2.4-2.5-2.7 1.5-.3 2.2-1 2.5-2.8z"/>'],
  ['flask', '<path d="M9.5 3.5h5M10.5 3.5v5.5L5 18.5A1.5 1.5 0 0 0 6.3 21h11.4a1.5 1.5 0 0 0 1.3-2.5L13.5 9V3.5M7.5 15h9"/>'],
  ['folder', '<path d="M3.5 7A2 2 0 0 1 5.5 5h4l2 2.5h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'],
];
const BY = new Map([...P.map(([id, , svg]) => ['pk:' + id, svg] as const), ...UI.map(([id, svg]) => ['pk:' + id, svg] as const)]);

/** One of our icons drawn in the current text colour, sized to the font. */
export function PkIcon({ code }: { code: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" width="1.15em" height="1.15em" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: BY.get(code) ?? '' }} />;
}

/** What a pocket's emoji/initial slot shows: our icon for a `pk:` code, otherwise the text as-is. */
export const glyph = (s: string | null | undefined): ReactNode => (s && BY.has(s) ? <PkIcon code={s} /> : s);

/** The last emoji in what was typed (flags, skin tones and joined emojis count as one), or '' if there is none. Letters are ignored. */
export function lastEmoji(s: string): string {
  const m = s.match(/\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic}️?)*|\p{Regional_Indicator}{2}/gu);
  return m ? m[m.length - 1] : '';
}
