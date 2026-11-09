// Phone swipes, like a native iPhone app:
// - from the left edge to the right: go back (presses the back or close button on screen);
// - anywhere else, left or right on a main tab: the next or previous tab.
// Swipes that start on something that scrolls sideways, a slider, a text box or a chart are left alone.
import { useEffect } from 'react';
import { getState, setUI } from '../lib/store';
import type { Tab } from '../lib/types';

const EDGE = 28;       // px from the left edge that counts as an edge swipe
const MIN_DX = 70;     // how far the finger must travel sideways
const MAX_MS = 700;    // a swipe, not a slow drag

/** True if the element (or a parent) scrolls sideways or handles its own touches. */
function ownsSwipe(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.matches('input, textarea, select, svg, [contenteditable="true"], [data-noswipe]')) return true;
    const st = getComputedStyle(n);
    if ((st.overflowX === 'auto' || st.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 2) return true;
  }
  return false;
}

/** The back (or close) button on top: the open sheet's, or the open page's. */
function backButton(): HTMLElement | null {
  const { ui } = getState();
  const scope = ui.sheet ? document.querySelector('[role=dialog].sheet-panel') : document;
  const all = scope ? scope.querySelectorAll<HTMLElement>('[data-back]') : [];
  return all.length ? all[all.length - 1] : null;
}

export function useSwipeNav(tabs: Tab[], enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number; t: number; edge: boolean; free: boolean } | null = null;
    const down = (e: TouchEvent) => {
      if (e.touches.length !== 1) { start = null; return; }
      const p = e.touches[0];
      start = { x: p.clientX, y: p.clientY, t: Date.now(), edge: p.clientX <= EDGE, free: !ownsSwipe(e.target as Element) };
    };
    const up = (e: TouchEvent) => {
      const s = start; start = null;
      if (!s || e.changedTouches.length !== 1) return;
      const p = e.changedTouches[0], dx = p.clientX - s.x, dy = p.clientY - s.y;
      if (Date.now() - s.t > MAX_MS || Math.abs(dx) < MIN_DX || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      const { ui } = getState();
      if (ui.tour || ui.welcome || ui.install || document.querySelector('[data-modal]')) return;
      if (s.edge && dx > 0) {
        const b = backButton();
        if (b) { b.click(); return; }
      }
      if (!s.free || ui.sheet || ui.page) return;
      const i = tabs.indexOf(ui.tab), j = i + (dx < 0 ? 1 : -1);
      if (i >= 0 && j >= 0 && j < tabs.length) setUI({ tab: tabs[j] });
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchend', up, { passive: true });
    window.addEventListener('touchcancel', () => { start = null; }, { passive: true });
    return () => { window.removeEventListener('touchstart', down); window.removeEventListener('touchend', up); };
  }, [enabled, tabs.join()]);
}
