// A credit card as it appears on Accounts: the account's color, or a photo of the real card's design.
import type { ReactNode } from 'react';
import { ink, tint } from '../lib/constants';
import { fmt, initialOf, pctOf } from '../lib/derive';
import { AcctBadge } from './bits';
import { CARD_RATIO } from './Cropper';

export interface CardLook { name: string; hue: number; photo?: string | null; cardImg?: string | null; cardText?: 'light' | 'dark'; bal: number; limit?: number; due?: string; notMine?: boolean }

/** Colors for text and the small glass chips, on a plain color or on a card photo. */
export function cardInk(a: CardLook) {
  if (!a.cardImg) return { k: ink(a.hue), glass: 'var(--glass)', shadow: 'none' };
  const light = (a.cardText ?? 'light') === 'light';
  return light
    ? { k: '#ffffff', glass: 'rgba(255,255,255,.22)', shadow: '0 1px 3px rgba(0,0,0,.45)' }
    : { k: '#141414', glass: 'rgba(255,255,255,.6)', shadow: '0 1px 2px rgba(255,255,255,.5)' };
}

export function CardFace({ a, onClick, action }: { a: CardLook; onClick?: () => void; action?: ReactNode }) {
  const { k, glass, shadow } = cardInk(a), lim = a.limit || 0;
  const light = (a.cardText ?? 'light') === 'light';
  // A soft shade at the top and bottom keeps the numbers readable on any card design.
  const scrim = light
    ? 'linear-gradient(180deg, rgba(0,0,0,.38) 0%, rgba(0,0,0,.08) 38%, rgba(0,0,0,.12) 60%, rgba(0,0,0,.55) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,.45) 0%, rgba(255,255,255,.1) 38%, rgba(255,255,255,.15) 60%, rgba(255,255,255,.6) 100%)';
  return (
    <div onClick={onClick} className={onClick ? 'pr98' : undefined}
      style={{ background: a.cardImg ? `${scrim}, url(${a.cardImg}) center / cover no-repeat` : tint(a.hue), borderRadius: a.cardImg ? 22 : 28, padding: 20, display: 'flex', flexDirection: 'column', gap: 4, cursor: onClick ? 'pointer' : 'default', transition: 'transform .15s', textShadow: shadow, ...(a.cardImg ? { aspectRatio: String(CARD_RATIO), justifyContent: 'space-between', boxShadow: '0 10px 26px rgba(0,0,0,.18)' } : {}) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, fontSize: 15, fontWeight: 700, color: k }}>
          {!a.cardImg && <AcctBadge photo={a.photo} initial={initialOf(a.name)} size={34} radius={12} bg="var(--glass)" color={k} fs={14} />}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: k, background: glass, padding: '5px 10px', borderRadius: 999, whiteSpace: 'nowrap', backdropFilter: a.cardImg ? 'blur(8px)' : undefined, WebkitBackdropFilter: a.cardImg ? 'blur(8px)' : undefined }}>Due {a.due || '—'}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ marginTop: a.cardImg ? 0 : 10, fontSize: 13, color: k }}>{a.notMine ? 'Balance owed · not yours' : 'Balance owed'}</span>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', color: k, lineHeight: 1.1 }}>{fmt(a.bal)}</span>
        <div style={{ marginTop: 8, height: 10, borderRadius: 999, background: glass, overflow: 'hidden' }}>
          <div className="bar-fill" style={{ height: 10, borderRadius: 999, width: '100%', clipPath: `inset(0 calc(100% - ${pctOf(a.bal, lim)}) 0 0 round 999px)`, background: k }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 10 }}>
          <span style={{ fontSize: 12, color: k }}>{Math.round(lim ? a.bal / lim * 100 : 0)}% of {fmt(lim)} used</span>
          {action}
        </div>
      </div>
    </div>
  );
}
