// Background color: the user's own color for the app's page background, one for light mode and one for dark mode.
export type Mode = 'light' | 'dark';
export const DEFAULT_BG: Record<Mode, string> = { light: '#f7f5f3', dark: '#0e0e0d' };
const TEXT: Record<Mode, string> = { light: '#201e1d', dark: '#f2efea' };

export const PRESETS: Record<Mode, [string, string][]> = {
  light: [['#f7f5f3', 'Pockets cream'], ['#fbf3e4', 'Sand'], ['#f1ede4', 'Linen'], ['#fff7e0', 'Butter'], ['#eef4ec', 'Sage'], ['#e8f5f1', 'Mint'], ['#eaf2f9', 'Sky'], ['#eef0fb', 'Lavender'], ['#fcefef', 'Blush'], ['#f4f4f5', 'Grey']],
  dark: [['#0e0e0d', 'Pockets black'], ['#000000', 'True black'], ['#0b1020', 'Navy'], ['#0f1a14', 'Forest'], ['#0d1719', 'Teal'], ['#15111d', 'Plum'], ['#1a1012', 'Wine'], ['#1a1510', 'Coffee'], ['#121417', 'Slate'], ['#18181b', 'Graphite']]
};

/** "#abc", "abc", "#AABBCC" → "#aabbcc"; anything else → null. */
export function normHex(v: string): string | null {
  const m = v.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(m)) return '#' + m.split('').map(c => c + c).join('');
  if (/^[0-9a-f]{6}$/.test(m)) return '#' + m;
  return null;
}

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16), ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
/** WCAG contrast ratio between two hex colors (1 to 21). */
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** Whether the app's text stays easy to read on this background in this mode. */
export const readable = (hex: string, mode: Mode) => contrast(hex, TEXT[mode]) >= 4.5;

/** Puts the chosen background on the page and the iPhone status bar. */
export function applyBg(bg: { light?: string; dark?: string } | undefined, mode: Mode) {
  const c = bg?.[mode];
  const root = document.documentElement;
  if (c) root.style.setProperty('--page', c); else root.style.removeProperty('--page');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c ?? DEFAULT_BG[mode]);
  try { if (bg && (bg.light || bg.dark)) localStorage.setItem('pockets-bg', JSON.stringify(bg)); else localStorage.removeItem('pockets-bg'); } catch { /* not saved */ }
}
