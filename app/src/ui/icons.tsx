import type { CSSProperties, ReactNode } from 'react';

interface P { size?: number; sw?: number; color?: string; style?: CSSProperties }
const mk = (paths: ReactNode, defSw = 2.25) => ({ size = 18, sw = defSw, color = 'currentColor', style }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', flex: 'none', ...style }}>{paths}</svg>
);

export const Search = mk(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>);
export const Download = mk(<><path d="M12 15V3" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /></>);
export const Chevron = mk(<path d="m9 18 6-6-6-6" />);
export const Plus = mk(<><path d="M5 12h14" /><path d="M12 5v14" /></>);
export const X = mk(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const Check = mk(<path d="M20 6 9 17l-5-5" />, 3);
export const Bulb = mk(<><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></>, 2);
export const Sparkle = mk(<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />, 2);
export const Arrow = mk(<><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>);
export const ArrowUp = mk(<><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></>, 2.5);
export const Mic = mk(<><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 19v3" /></>);
export const Home = mk(<><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>, 2);
export const Card = mk(<><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></>, 2);
export const Wallet = mk(<><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>, 2);
export const Chart = mk(<><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></>, 2);
export const Pencil = mk(<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />);
export const Swap = mk(<><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></>);
export const Target = mk(<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="5" /></>, 2.5);
export const Image = mk(<><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></>);
