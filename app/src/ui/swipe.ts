// Phone swipes that follow your finger, like a native iPhone app:
// - from the left edge to the right: the page or sheet on top slides away with your finger, then goes back
//   (it presses the back or close button on screen, so it goes exactly where that button would);
// - left or right on a main tab: the tab moves with your finger and the next one slides in beside it;
// - along the tab bar: a highlight follows your finger and letting go opens that tab (like Instagram).
// Swipes that start on something that scrolls sideways, a slider, a text box or a chart are left alone.
// While the finger is down, elements are moved directly (no React re-render per frame), so it stays smooth.
import { useEffect, type RefObject } from 'react';
import { getState, setUI } from '../lib/store';
import type { Tab } from '../lib/types';

const EDGE = 28;        // px from the left edge that counts as an edge swipe
const LOCK = 10;        // px of movement before deciding sideways vs. up-and-down
const COMMIT = 0.28;    // share of the width past which a released swipe completes
const FLICK = 0.5;      // px/ms: a quick flick completes even if short
const MS = 300;         // longest slide after letting go (a fast flick finishes sooner)
const EASE = 'cubic-bezier(.22,1,.36,1)'; // quick start, soft landing, like iOS

/** True once after a finger swipe changed the tab (so the App doesn't animate it a second time). */
let swiped = false;
export const tookSwipe = () => { const v = swiped; swiped = false; return v; };

export interface Peek { tab: Tab; side: 1 | -1 }

/** True if the element (or a parent) scrolls sideways or handles its own touches. */
function ownsSwipe(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.matches('input, textarea, select, svg, [contenteditable="true"], [data-noswipe], .tabbar')) return true;
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
/** What slides away on a back swipe: the sheet panel, or the top page. */
function backLayer(): HTMLElement | null {
  const { ui } = getState();
  if (ui.sheet) return document.querySelector<HTMLElement>('.sheet-panel');
  const pages = document.querySelectorAll<HTMLElement>('.page');
  return pages.length ? pages[pages.length - 1] : null;
}

const slide = (el: HTMLElement | null, x: string, animate: boolean, ms = MS) => {
  if (!el) return;
  el.style.transition = animate ? `transform ${ms}ms ${EASE}` : 'none';
  el.style.transform = x;
};
const clear = (el: HTMLElement | null) => { if (el) { el.style.transition = ''; el.style.transform = ''; el.style.boxShadow = ''; } };

export function useSwipeNav({ tabs, enabled, scroller, peek, setPeek }: {
  tabs: Tab[]; enabled: boolean; scroller: RefObject<HTMLDivElement | null>; peek: RefObject<HTMLDivElement | null>; setPeek: (p: Peek | null) => void;
}) {
  useEffect(() => {
    if (!enabled) return;
    type Mode = 'undecided' | 'none' | 'back' | 'tab' | 'bar';
    let s: { x: number; y: number; t: number; edge: boolean; free: boolean; mode: Mode; dx: number; layer: HTMLElement | null; side: 1 | -1; to: Tab | null; nav: HTMLElement | null; pill: HTMLElement | null } | null = null;
    let busy = false;

    const blocked = () => {
      const { ui } = getState();
      return busy || !!(ui.tour || ui.welcome || ui.install || document.querySelector('[data-modal]'));
    };

    /* ---- tab bar: a pill follows the finger ---- */
    const barTabAt = (nav: HTMLElement, x: number): Tab | null => {
      const btns = [...nav.querySelectorAll<HTMLElement>('button[data-tour^="tab-"]')];
      let best: HTMLElement | null = null, dist = Infinity;
      for (const b of btns) { const r = b.getBoundingClientRect(), d = Math.abs(x - (r.left + r.width / 2)); if (d < dist) { dist = d; best = b; } }
      return (best?.dataset.tour?.slice(4) as Tab) ?? null;
    };
    const moveBar = (x: number) => {
      if (!s?.nav) return;
      const r = s.nav.getBoundingClientRect();
      if (!s.pill) {
        s.pill = document.createElement('div');
        s.pill.className = 'tab-pill';
        s.nav.prepend(s.pill);
        s.nav.classList.add('dragging');
      }
      const w = 70, left = Math.max(5, Math.min(r.width - w - 5, x - r.left - w / 2));
      s.pill.style.transform = `translateX(${left}px)`;
      const t = barTabAt(s.nav, x);
      s.to = t;
      s.nav.querySelectorAll<HTMLElement>('button[data-tour^="tab-"]').forEach(b => b.toggleAttribute('data-hover', b.dataset.tour === `tab-${t}`));
    };
    const endBar = (g: NonNullable<typeof s>, pick: boolean) => {
      if (!g.nav) return;
      g.pill?.remove();
      g.nav.classList.remove('dragging');
      g.nav.querySelectorAll('[data-hover]').forEach(b => b.removeAttribute('data-hover'));
      if (pick && g.to && g.to !== getState().ui.tab) setUI({ tab: g.to });
    };

    const down = (e: TouchEvent) => {
      if (e.touches.length !== 1 || blocked()) { s = null; return; }
      const p = e.touches[0], target = e.target as Element;
      const nav = target.closest?.('.tabbar nav') as HTMLElement | null;
      s = { x: p.clientX, y: p.clientY, t: Date.now(), edge: p.clientX <= EDGE, free: !ownsSwipe(target), mode: 'undecided', dx: 0, layer: null, side: 1, to: null, nav, pill: null };
    };

    const move = (e: TouchEvent) => {
      if (!s || e.touches.length !== 1) return;
      const p = e.touches[0], dx = p.clientX - s.x, dy = p.clientY - s.y;
      if (s.mode === 'undecided') {
        if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.2) { s.mode = 'none'; return; }
        const { ui } = getState();
        if (s.nav) s.mode = 'bar';
        else if (s.edge && dx > 0 && backButton()) { s.mode = 'back'; s.layer = backLayer(); }
        else if (s.free && !ui.sheet && !ui.page) {
          const side: 1 | -1 = dx < 0 ? 1 : -1, i = tabs.indexOf(ui.tab), to = tabs[i + side];
          if (i >= 0 && to) { s.mode = 'tab'; s.side = side; s.to = to; setPeek({ tab: to, side }); }
          else if (i >= 0) { s.mode = 'tab'; s.side = side; s.to = null; } // first or last tab: it stretches a little and springs back
          else s.mode = 'none';
        } else s.mode = 'none';
      }
      if (s.mode === 'none') return;
      e.preventDefault();
      if (s.mode === 'bar') { moveBar(p.clientX); return; }
      if (s.mode === 'back') {
        s.dx = Math.max(0, dx);
        slide(s.layer, `translateX(${s.dx}px)`, false);
        if (s.layer) s.layer.style.boxShadow = '-12px 0 30px rgba(0,0,0,.18)';
        return;
      }
      // tab: only toward the neighbour that was picked; a little resistance past the start
      s.dx = s.side === 1 ? Math.min(0, dx) : Math.max(0, dx);
      if (!s.to) { slide(scroller.current, `translateX(${s.dx * 0.22}px)`, false); return; }
      slide(scroller.current, `translateX(${s.dx}px)`, false);
      slide(peek.current, `translateX(calc(${s.side * 100}% + ${s.dx}px))`, false);
    };

    const up = (e: TouchEvent) => {
      const g = s; s = null;
      if (!g || g.mode === 'undecided' || g.mode === 'none') return;
      if (g.mode === 'bar') { endBar(g, true); return; }
      const w = (g.mode === 'back' ? g.layer?.clientWidth : scroller.current?.clientWidth) || window.innerWidth;
      const ms = Math.max(1, Date.now() - g.t), p = e.changedTouches[0];
      const v = Math.abs((p ? p.clientX - g.x : g.dx) / ms);
      const done = Math.abs(g.dx) > w * COMMIT || (v > FLICK && Math.abs(g.dx) > 30);
      // The time left depends on how far is left to go and how fast the finger was moving.
      const rest = done ? w - Math.abs(g.dx) : Math.abs(g.dx);
      const dur = Math.round(Math.max(170, Math.min(MS, rest / Math.max(v, 0.9) * 1.6)));
      busy = true;
      if (g.mode === 'tab' && !g.to) { slide(scroller.current, 'translateX(0)', true, 320); setTimeout(() => { clear(scroller.current); busy = false; }, 320); return; }
      if (g.mode === 'back') {
        if (done) {
          slide(g.layer, `translateX(${w}px)`, true, dur);
          setTimeout(() => { const b = backButton(); if (b) { b.dataset.going = '1'; b.click(); delete b.dataset.going; } clear(g.layer); busy = false; }, dur);
        } else {
          slide(g.layer, 'translateX(0)', true, dur);
          setTimeout(() => { clear(g.layer); busy = false; }, dur);
        }
        return;
      }
      if (done && g.to) {
        slide(scroller.current, `translateX(${-g.side * w}px)`, true, dur);
        slide(peek.current, 'translateX(0)', true, dur);
        // The App resets the scroller's position in the same render that shows the new tab (no flicker).
        setTimeout(() => { swiped = true; setUI({ tab: g.to! }); setPeek(null); busy = false; }, dur);
      } else {
        slide(scroller.current, 'translateX(0)', true, dur);
        slide(peek.current, `translateX(${g.side * 100}%)`, true, dur);
        setTimeout(() => { clear(scroller.current); setPeek(null); busy = false; }, dur);
      }
    };
    const cancel = () => {
      const g = s; s = null;
      if (!g) return;
      if (g.mode === 'bar') endBar(g, false);
      if (g.mode === 'back') clear(g.layer);
      if (g.mode === 'tab') { clear(scroller.current); setPeek(null); }
    };

    // Tapping a page's back button: the page slides away to the right first, then goes back.
    const backTap = (e: MouseEvent) => {
      const b = (e.target as Element | null)?.closest?.<HTMLElement>('[data-back]');
      const layer = b?.closest<HTMLElement>('.page');
      if (!b || !layer || b.dataset.going || getState().ui.sheet || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      e.preventDefault(); e.stopPropagation();
      if (busy) return;
      busy = true;
      layer.style.animation = 'none';
      slide(layer, `translateX(${layer.clientWidth}px)`, true, 260);
      setTimeout(() => { b.dataset.going = '1'; b.click(); delete b.dataset.going; clear(layer); layer.style.animation = ''; busy = false; }, 250);
    };
    window.addEventListener('click', backTap, true);
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up, { passive: true });
    window.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      window.removeEventListener('click', backTap, true);
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', cancel);
    };
  }, [enabled, tabs.join()]);
}
