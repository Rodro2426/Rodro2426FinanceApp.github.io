// Phone swipes that follow your finger, like a native iPhone app:
// - from the left edge to the right: the page or sheet on top slides away with your finger, then goes back
//   (it presses the back or close button on screen, so it goes exactly where that button would);
// - left or right on a main tab: the tab moves with your finger and the next one slides in beside it;
//   letting go opens it if more than half of it is showing or after a quick flick, otherwise both slide back;
// - along the tab bar: a highlight follows your finger and letting go opens that tab (like Instagram).
// Swipes that start on something that scrolls sideways, a slider, a text box or a chart are left alone.
// While the finger is down, elements are moved directly (no React re-render per frame), so it stays smooth.
import { useEffect, type RefObject } from 'react';
import { getState, setUI } from '../lib/store';
import type { Tab } from '../lib/types';

const EDGE = 28;        // px from the left edge that counts as an edge swipe
const LOCK = 10;        // px of movement before deciding sideways vs. up-and-down
const COMMIT = 0.28;    // back swipe: share of the width past which a released swipe completes
const TAB_COMMIT = 0.5; // tab swipe: a slow drag opens the next tab only if more than half of it is showing when you let go
export const FLICK = 0.5; // px/ms: a quick flick completes even if short
const MS = 300;         // longest slide after letting go (a fast flick finishes sooner)
const TAB_FLICK = 0.3;  // px/ms: tabs take a gentler flick than the back swipe
const TAB_MS = [500, 620]; // a tab change glides in slower than the back swipe, like paging in Apple's own apps
const TAB_EASE = 'cubic-bezier(.32,.72,0,1)'; // iOS's own curve: a gentler start and a long, soft landing
const TAB_SINK = 0.06;  // tab swipe: how much smaller the tab you leave gets
export const EASE ='cubic-bezier(.22,1,.36,1)'; // quick start, soft landing, like iOS

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

const slide = (el: HTMLElement | null, x: string, animate: boolean, ms = MS, ease = EASE) => {
  if (!el) return;
  el.style.transition = animate ? `transform ${ms}ms ${ease}` : 'none';
  el.style.transform = x;
};
/** The tab bar keeping pace with a tab swipe: the current tab's highlight fades out and the next one's fades in, in step with the page. */
type Bar = { a: HTMLElement; b: HTMLElement; saved: [string, string]; tr: string } | null;
const barBtn = (t: Tab) => document.querySelector<HTMLElement>(`.tabbar nav button[data-tour="tab-${t}"]`);
function barStart(from: Tab, to: Tab): Bar {
  const a = barBtn(from), b = barBtn(to);
  return a && b ? { a, b, saved: [a.style.cssText, b.style.cssText], tr: a.style.transition } : null;
}
/** p: 0 = the current tab is selected, 1 = the next one is. ms > 0 glides there. */
function barAt(bar: Bar, p: number, ms = 0) {
  if (!bar) return;
  const pct = Math.round(p * 100), set = (el: HTMLElement, on: number) => {
    el.style.transition = ms ? `background-color ${ms}ms ${EASE}, color ${ms}ms ${EASE}` : 'none';
    el.style.background = `color-mix(in srgb, var(--brand-tint) ${on}%, transparent)`;
    el.style.color = `color-mix(in srgb, var(--brand) ${on}%, var(--color-neutral-600))`;
  };
  set(bar.a, 100 - pct);
  set(bar.b, pct);
}
/** Back to exactly what React drew (after a swipe that sprang back). */
const barReset = (bar: Bar) => { if (bar) { bar.a.style.cssText = bar.saved[0]; bar.b.style.cssText = bar.saved[1]; } };

const clear = (el: HTMLElement | null) => {
  if (el) { el.style.transition = ''; el.style.transform = ''; el.style.boxShadow = ''; el.style.borderRadius = ''; el.style.opacity = ''; el.style.transformOrigin = ''; el.style.willChange = ''; }
};

/* ---- Back swipe on a full page: it shrinks into a rounded card that follows the finger over a dimmed screen,
   and on letting go it shrinks away (or springs back to full size). ---- */
const ZOOM = 0.3;   // how much smaller the page gets when dragged all the way across
const RADIUS = 38;  // corner roundness of the card, close to the iPhone screen's
const DIM = 0.22;   // how dark the screen behind the card gets
/** Turns the page into a card once, when the swipe starts. Corners and shadow never change while dragging:
    changing them every frame makes the phone repaint the whole page, which is what made the start stutter. */
const cardStart = (el: HTMLElement) => {
  el.style.animation = 'none';
  el.style.transition = 'none';
  el.style.willChange = 'transform';
  el.style.transformOrigin = '50% 50%';
  el.style.borderRadius = `${RADIUS}px`;
  el.style.boxShadow = '0 24px 70px rgba(0,0,0,.28)';
};
/** While dragging only the position and size change (the phone's graphics chip does that without repainting). */
const cardAt = (el: HTMLElement, dx: number, dy: number, w: number) => {
  el.style.transform = `translate(${dx * 0.55}px, ${dy * 0.35}px) scale(${1 - ZOOM * Math.min(1, dx / w)})`;
};
/** The dim layer drawn just under the page. */
function dimUnder(el: HTMLElement): HTMLElement {
  const d = document.createElement('div');
  d.setAttribute('aria-hidden', 'true');
  d.style.cssText = `position:absolute;inset:0;pointer-events:none;background:#000;opacity:0;z-index:${el.style.zIndex || getComputedStyle(el).zIndex}`;
  el.parentElement?.insertBefore(d, el);
  return d;
}
/** Letting go: shrink away and fade (go = true), or back to full size. */
function cardEnd(el: HTMLElement, dim: HTMLElement | null, go: boolean, ms: number, dx: number, dy: number, w: number) {
  el.style.transition = `transform ${ms}ms ${EASE}, opacity ${ms}ms ease`;
  el.style.transform = go ? `translate(${dx * 0.55 + w * 0.08}px, ${dy * 0.35}px) scale(.55)` : 'translate(0px, 0px) scale(1)';
  if (go) el.style.opacity = '0';
  if (dim) { dim.style.transition = `opacity ${ms}ms ease`; dim.style.opacity = '0'; }
}

export function useSwipeNav({ tabs, enabled, scroller, peek, setPeek }: {
  tabs: Tab[]; enabled: boolean; scroller: RefObject<HTMLDivElement | null>; peek: RefObject<HTMLDivElement | null>; setPeek: (p: Peek | null) => void;
}) {
  useEffect(() => {
    if (!enabled) return;
    type Mode = 'undecided' | 'none' | 'back' | 'tab' | 'bar';
    let s: { x: number; y: number; t: number; edge: boolean; free: boolean; mode: Mode; dx: number; dy: number; layer: HTMLElement | null; dim: HTMLElement | null; side: 1 | -1; to: Tab | null; nav: HTMLElement | null; pill: HTMLElement | null; bar: Bar } | null = null;
    let busy = false;

    const blocked = () => {
      const { ui } = getState();
      return busy || !!(ui.guide || ui.setup || ui.welcome || ui.install || document.querySelector('[data-modal]'));
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
      s = { x: p.clientX, y: p.clientY, t: Date.now(), edge: p.clientX <= EDGE, free: !ownsSwipe(target), mode: 'undecided', dx: 0, dy: 0, layer: null, dim: null, side: 1, to: null, nav, pill: null, bar: null };
    };

    const move = (e: TouchEvent) => {
      if (!s || e.touches.length !== 1) return;
      const p = e.touches[0], dx = p.clientX - s.x, dy = p.clientY - s.y;
      if (s.mode === 'undecided') {
        if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.2) { s.mode = 'none'; return; }
        const { ui } = getState();
        if (s.nav) s.mode = 'bar';
        else if (s.edge && dx > 0 && backButton()) {
          s.mode = 'back'; s.layer = backLayer();
          if (s.layer?.classList.contains('page')) { cardStart(s.layer); s.dim = dimUnder(s.layer); }
        }
        else if (s.free && !ui.sheet && !ui.page) {
          const side: 1 | -1 = dx < 0 ? 1 : -1, i = tabs.indexOf(ui.tab), to = tabs[i + side];
          if (i >= 0 && to) { s.mode = 'tab'; s.side = side; s.to = to; s.bar = barStart(ui.tab, to); setPeek({ tab: to, side }); }
          else if (i >= 0) { s.mode = 'tab'; s.side = side; s.to = null; } // first or last tab: it stretches a little and springs back
          else s.mode = 'none';
        } else s.mode = 'none';
      }
      if (s.mode === 'none') return;
      e.preventDefault();
      if (s.mode === 'bar') { moveBar(p.clientX); return; }
      if (s.mode === 'back') {
        s.dx = Math.max(0, dx); s.dy = dy;
        if (s.dim && s.layer) {
          cardAt(s.layer, s.dx, dy, s.layer.clientWidth || window.innerWidth);
          s.dim.style.opacity = String(DIM * Math.min(1, s.dx / 60));
          return;
        }
        slide(s.layer, `translateX(${s.dx}px)`, false);
        if (s.layer) s.layer.style.boxShadow = '-12px 0 30px rgba(0,0,0,.18)';
        return;
      }
      // tab: only toward the neighbour that was picked; a little resistance past the start
      s.dx = s.side === 1 ? Math.min(0, dx) : Math.max(0, dx);
      if (!s.to) { slide(scroller.current, `translateX(${s.dx * 0.22}px)`, false); return; }
      const tp = Math.min(1, Math.abs(s.dx) / (scroller.current?.clientWidth || window.innerWidth));
      // The tab you leave sinks back a little, so the two read as layers instead of one flat strip.
      slide(scroller.current, `translateX(${s.dx}px) scale(${1 - TAB_SINK * tp})`, false);
      slide(peek.current, `translateX(calc(${s.side * 100}% + ${s.dx}px))`, false);
      barAt(s.bar, tp);
    };

    const up = (e: TouchEvent) => {
      const g = s; s = null;
      if (!g || g.mode === 'undecided' || g.mode === 'none') return;
      if (g.mode === 'bar') { endBar(g, true); return; }
      const w = (g.mode === 'back' ? g.layer?.clientWidth : scroller.current?.clientWidth) || window.innerWidth;
      const ms = Math.max(1, Date.now() - g.t), p = e.changedTouches[0];
      const v = Math.abs((p ? p.clientX - g.x : g.dx) / ms);
      // A slow drag must pass the line; a quick flick completes even if short.
      const done = Math.abs(g.dx) > w * (g.mode === 'tab' ? TAB_COMMIT : COMMIT) || (g.mode === 'tab' ? v > TAB_FLICK && Math.abs(g.dx) > 20 : v > FLICK && Math.abs(g.dx) > 30);
      // The time left depends on how far is left to go and how fast the finger was moving.
      const rest = done ? w - Math.abs(g.dx) : Math.abs(g.dx);
      const dur = Math.round(Math.max(170, Math.min(MS, rest / Math.max(v, 0.9) * 1.6)));
      busy = true;
      if (g.mode === 'tab' && !g.to) { slide(scroller.current, 'translateX(0)', true, 320); setTimeout(() => { clear(scroller.current); busy = false; }, 320); return; }
      if (g.mode === 'back' && g.dim && g.layer) {
        const layer = g.layer, dim = g.dim, ms = done ? 280 : 340;
        cardEnd(layer, dim, done, ms, g.dx, g.dy, w);
        setTimeout(() => {
          if (done) { const b = backButton(); if (b) { b.dataset.going = '1'; b.click(); delete b.dataset.going; } }
          clear(layer); layer.style.animation = ''; dim.remove(); busy = false;
        }, ms);
        return;
      }
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
        const tabDur = Math.round(Math.max(TAB_MS[0], Math.min(TAB_MS[1], rest / Math.max(v, 0.6) * 2)));
        slide(scroller.current, `translateX(${-g.side * w}px) scale(${1 - TAB_SINK})`, true, tabDur, TAB_EASE);
        slide(peek.current, 'translateX(0)', true, tabDur, TAB_EASE);
        barAt(g.bar, 1, tabDur);
        // The App resets the scroller's position in the same render that shows the new tab (no flicker).
        // React then draws the bar the same way, so only its normal transition is handed back.
        setTimeout(() => { swiped = true; setUI({ tab: g.to! }); setPeek(null); if (g.bar) g.bar.a.style.transition = g.bar.b.style.transition = g.bar.tr; busy = false; }, tabDur);
      } else {
        slide(scroller.current, 'translateX(0) scale(1)', true, dur);
        slide(peek.current, `translateX(${g.side * 100}%)`, true, dur);
        barAt(g.bar, 0, dur);
        setTimeout(() => { clear(scroller.current); setPeek(null); barReset(g.bar); busy = false; }, dur);
      }
    };
    const cancel = () => {
      const g = s; s = null;
      if (!g) return;
      if (g.mode === 'bar') endBar(g, false);
      if (g.mode === 'back') { clear(g.layer); if (g.layer) g.layer.style.animation = ''; g.dim?.remove(); }
      if (g.mode === 'tab') { clear(scroller.current); setPeek(null); barReset(g.bar); }
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
      // Same shrink-away as the back swipe, as if a short swipe had been let go.
      const w = layer.clientWidth || window.innerWidth, dim = dimUnder(layer);
      dim.style.opacity = String(DIM);
      cardStart(layer);
      void layer.offsetWidth; // start from full size, so the shrink animates
      cardEnd(layer, dim, true, 280, w * 0.2, 0, w);
      setTimeout(() => { b.dataset.going = '1'; b.click(); delete b.dataset.going; clear(layer); layer.style.animation = ''; dim.remove(); busy = false; }, 270);
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
