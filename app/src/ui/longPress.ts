// Press and hold (about half a second) or right-click to open a menu. A drag or scroll cancels it, and the tap that
// ends a hold doesn't also count as a normal tap. Spread the result on any element.
import { useRef, type MouseEvent, type PointerEvent } from 'react';

const HOLD_MS = 480, SLOP = 10;

export function useLongPress(onHold: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const stop = () => { window.clearTimeout(timer.current); start.current = null; };
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false; start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true; start.current = null;
        try { navigator.vibrate?.(10); } catch { /* not supported (iPhone) */ }
        onHold();
      }, HOLD_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > SLOP) stop();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
    onContextMenu: (e: MouseEvent) => { e.preventDefault(); stop(); if (!fired.current) onHold(); fired.current = true; },
    // Swallow the click that follows a hold, before it reaches the row's own onClick.
    onClickCapture: (e: MouseEvent) => { if (fired.current) { e.stopPropagation(); e.preventDefault(); fired.current = false; } },
    style: { WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' } as const
  };
}
