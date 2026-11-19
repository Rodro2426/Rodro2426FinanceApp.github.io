// The tour for people already using Pockets (Profile → App tutorial): it looks at the real screen without changing
// anything. A spotlight with a glowing edge glides from one part of the app to the next, and a small glass card opens
// out of a pill beside it (the setup's motion). Approved mocks: mocks/tour-motion (iPhone) and mocks/tour-desk.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { setUI, useApp } from '../lib/store';
import { useDesk } from '../ui/Desk';
import type { Tab } from '../lib/types';

interface Stop { title: string; text: string; target?: string; tab?: Tab; desk?: string }
const STOPS: Stop[] = [
  { title: 'A quick tour of Pockets', text: 'A look at the main parts of the app. Nothing you have is changed.' },
  { title: 'Safe to spend', text: 'What’s left in all your pockets this week. It turns green, yellow or red as you spend, and starts over every Monday. After the tour, swipe it to see today or the month.', target: '[data-tour="safe"]', tab: 'home' },
  { title: 'Add an expense', text: 'Spent or got paid? Tap + and log it in seconds: amount, category, pocket and account.', desk: 'Spent or got paid? Click Add and log it in seconds: amount, category, pocket and account.', target: '[data-tour="add"]', tab: 'home' },
  { title: 'Your pockets', text: 'Weekly budgets for each kind of spending. Tap one to see what you spent, or move leftovers to another pocket or a goal.', target: '[data-tour="pocket"]', tab: 'home' },
  { title: 'Accounts', text: 'Your banks, cash and cards with their balances. Investments and the Excel export live here too.', target: '[data-tour="tab-accounts"]', tab: 'accounts' },
  { title: 'Budget', text: 'Your monthly income and how it’s split into pockets and savings goals.', target: '[data-tour="income"]', tab: 'budget' },
  { title: 'Insights', text: 'Where your money goes: by category, pocket, #tag and bills, with reports.', target: '[data-tour="tab-insights"]', tab: 'insights' },
  { title: 'Every month', text: 'Your salary, bills and subscriptions repeat on their day, with reminders before they’re due.', target: '[data-tour="add-schedule"]', tab: 'calendar' },
  { title: 'Friends & trips', text: 'Debts with one person, and trips where everyone adds what they paid and Pockets settles up.', target: '[data-tour="tab-social"]', tab: 'social' },
  { title: 'Your profile', text: 'Your name, look, backups, Apple Pay purchases, and this tour again.', target: '[data-tour="profile"]', tab: 'home' },
  { title: 'You’re ready', text: 'Replay this tour anytime from Profile.' }
];

/** The same stops when every pocket is set up by the month. */
const MONTHLY: Record<string, Partial<Stop>> = {
  'Safe to spend': { text: 'What’s left in all your pockets this month. It turns green, yellow or red as you spend, and starts over on the 1st. After the tour, swipe it to see today or the week.' },
  'Your pockets': { text: 'Monthly budgets for each kind of spending. Tap one to see what you spent, or move leftovers to another pocket or a goal.' }
};

interface Box { x: number; y: number; w: number; h: number }
const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** The first element for this selector that is on screen: phone and desktop have their own copies of some buttons, and
 *  Home's swipeable cards keep the pages beside the one showing, peeking in at the edge (an element counts only if
 *  its middle is on screen). */
const find = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].find(e => { const r = e.getBoundingClientRect(); const mid = r.left + r.width / 2; return r.width > 0 && r.height > 0 && mid > 0 && mid < innerWidth; }) ?? null;

export default function GuidedTour() {
  const { ui, data: d } = useApp();
  // Pockets set up by the month: talk about the month, not the week.
  const monthly = d.pockets.length > 0 && d.pockets.every(p => p.period === 'month');
  const desk = useDesk();
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const card = useRef<HTMLDivElement>(null), inner = useRef<HTMLDivElement>(null);
  const s = { ...STOPS[i], ...(monthly ? MONTHLY[STOPS[i].title] : {}) }, last = i === STOPS.length - 1, first = i === 0;
  const close = () => setUI({ guide: false });

  // Go where the stop is, then follow the target every frame (it can move while the screen scrolls).
  useEffect(() => {
    if (s.tab && (ui.tab !== s.tab || ui.page || ui.sheet)) setUI({ tab: s.tab, page: null, sheet: null });
    if (!s.target) { setBox(null); return; }
    let raf = 0, found = false;
    const t = setTimeout(() => find(s.target!)?.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }), 220);
    const tick = () => {
      const el = find(s.target!);
      if (el) {
        const r = el.getBoundingClientRect(); found = true;
        setBox(b => (b && Math.abs(b.x - r.left) < 0.5 && Math.abs(b.y - r.top) < 0.5 && Math.abs(b.w - r.width) < 0.5 && Math.abs(b.h - r.height) < 0.5 ? b : { x: r.left, y: r.top, w: r.width, h: r.height }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // A part this person's screen doesn't have (e.g. no pockets yet): move on.
    const skip = setTimeout(() => { if (!found) setI(n => Math.min(STOPS.length - 1, n + 1)); }, 1400);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); clearTimeout(skip); };
  }, [i]);

  // Each card opens out of a pill, then its words fade in.
  useLayoutEffect(() => {
    const c = card.current, n = inner.current;
    if (!c || !n || reduced()) return;
    const h = c.offsetHeight;
    c.animate([{ clipPath: `inset(0px 0px ${Math.max(0, h - 44)}px 0px round 22px)`, opacity: 0.4 }, { clipPath: 'inset(0px 0px 0px 0px round 22px)', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(0.76, 0, 0.24, 1)' });
    n.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' });
  }, [i, !!box]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight' || e.key === 'Enter') setI(n => Math.min(STOPS.length - 1, n + 1)); if (e.key === 'ArrowLeft') setI(n => Math.max(0, n - 1)); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const W = innerWidth, H = innerHeight, pad = 8;
  const hole = box ? { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 } : null;
  const radius = hole ? Math.min(28, hole.h / 2) : 28;
  // Where the card goes: on the phone, the full width above or below the target; on a computer, a small card beside it.
  const cw = desk ? 340 : Math.min(W - 28, 460);
  let pos: CSSProperties;
  if (!hole) pos = { left: (W - cw) / 2, top: H * (desk ? 0.34 : 0.3) };
  else {
    const below = H - (hole.y + hole.h) > 260 || hole.y < 260;
    const left = desk ? Math.min(Math.max(16, hole.x), W - cw - 16) : (W - cw) / 2;
    pos = below ? { left, top: hole.y + hole.h + 12 } : { left, bottom: H - hole.y + 12 };
  }
  const motion = reduced() ? 'none' : `left .6s ${EASE}, top .6s ${EASE}, width .6s ${EASE}, height .6s ${EASE}, border-radius .6s ${EASE}, opacity .4s`;
  // With no target (welcome and last card) the spotlight shrinks to a point in the middle: everything is dimmed, and
  // the next spotlight grows out of the centre.
  const spot = hole ?? { x: W / 2, y: H / 2, w: 1, h: 1 };

  return (
    <div className="setup guided" role="dialog" aria-label="App tour" style={{ position: 'fixed', inset: 0, zIndex: 90 }}>
      {/* The dim: a huge shadow around the spotlight, so the target stays sharp and clickable-looking. */}
      <div aria-hidden="true" style={{ position: 'fixed', left: spot.x, top: spot.y, width: spot.w, height: spot.h, borderRadius: hole ? radius : 0, boxShadow: `0 0 0 200vmax rgba(8,8,8,${hole ? 0.66 : 0.6})`, transition: motion, pointerEvents: 'none' }} />
      <div aria-hidden="true" className="guided-ring" style={{ position: 'fixed', left: spot.x - 3, top: spot.y - 3, width: spot.w + 6, height: spot.h + 6, borderRadius: (hole ? radius : 0) + 3, opacity: hole ? 1 : 0, transition: motion, pointerEvents: 'none' }} />
      <div ref={card} key={i} style={{ position: 'fixed', ...pos, width: cw, background: 'var(--su-panel)', color: 'var(--su-ink)', borderRadius: 22, boxShadow: '0 0 0 1px var(--su-line), 0 20px 50px rgba(0,0,0,.35)', textAlign: hole ? 'left' : 'center' }}>
        <div ref={inner} style={{ padding: hole ? '16px 18px 14px' : '22px 22px 18px' }}>
          {!hole && <span style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><img className="su-mark-dark" src="./pockets-mark-dark.svg" alt="" width={48} height={48} /><img className="su-mark-light" src="./pockets-mark.svg" alt="" width={48} height={48} /></span>}
          <div style={{ fontSize: hole ? 17 : 21, fontWeight: 800, letterSpacing: '-0.01em' }}>{s.title}</div>
          <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.45, color: 'var(--su-soft)' }}>{desk && s.desk ? s.desk : s.text}</div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: hole ? 'space-between' : 'center', gap: 10 }}>
            {hole && <span aria-hidden="true" style={{ display: 'flex', gap: 5 }}>{STOPS.slice(1, -1).map((_, k) => <i key={k} style={{ width: k === i - 1 ? 16 : 6, height: 6, borderRadius: 3, background: k === i - 1 ? 'var(--su-accent)' : 'var(--su-dot)', transition: 'width .3s' }} />)}</span>}
            <span style={{ display: 'flex', gap: 8 }}>
              {!first && !last && <button onClick={() => setI(i - 1)} style={btn(false)}>Back</button>}
              <button onClick={() => (last ? close() : setI(i + 1))} className="pr97" style={btn(true)}>{first ? 'Start' : last ? 'Done' : 'Next'}</button>
            </span>
          </div>
          {!last && <button onClick={close} style={{ display: 'block', margin: '10px auto 0', border: 0, background: 'transparent', color: 'var(--su-soft)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{first ? 'Not now' : 'End tour'}</button>}
        </div>
      </div>
    </div>
  );
}
const btn = (main: boolean): CSSProperties => ({ height: 36, padding: '0 18px', borderRadius: 18, border: 0, background: main ? 'var(--su-accent)' : 'var(--su-fill)', color: main ? 'var(--su-on-accent)' : 'var(--su-ink)', fontSize: 14, fontWeight: 700, cursor: 'pointer' });
