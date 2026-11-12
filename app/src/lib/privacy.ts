// Hide amounts: with the eye switched off, every money value shows as $***** (per device, remembered).
import { setUI } from './store';

let hidden = (() => { try { return localStorage.getItem('pockets-hide') === '1'; } catch { return false; } })();
export const moneyHidden = () => hidden;
export function setMoneyHidden(v: boolean) {
  hidden = v;
  try { if (v) localStorage.setItem('pockets-hide', '1'); else localStorage.removeItem('pockets-hide'); } catch { /* not saved */ }
  // Amounts blur into $***** (and back) instead of swapping in one frame; see .eye-flip in styles.css.
  const shell = typeof document !== 'undefined' ? document.querySelector('.shell') : null;
  if (shell) { shell.classList.remove('eye-flip'); void (shell as HTMLElement).offsetWidth; shell.classList.add('eye-flip'); setTimeout(() => shell.classList.remove('eye-flip'), 260); }
  setUI({}); // re-draw everything with the new look
}
export const STARS = '*****';
