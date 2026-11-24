// A small "toc" you feel. Android: navigator.vibrate. iPhone has no vibrate API; from iOS 18, toggling a
// `<input type="checkbox" switch>` plays the system switch haptic, so a hidden one is clicked instead.
// shortcut: iPhone only feels it during a tap (the user's gesture), and only a short tick, never a long buzz.
let sw: HTMLLabelElement | null = null;
function tick() {
  try {
    if (!sw) {
      sw = document.createElement('label');
      sw.setAttribute('aria-hidden', 'true');
      sw.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;left:-9px;top:0';
      const input = document.createElement('input');
      input.type = 'checkbox'; input.setAttribute('switch', ''); input.tabIndex = -1;
      sw.appendChild(input); document.body.appendChild(sw);
    }
    sw.click();
  } catch { /* no DOM */ }
}

/** 'tap': one tick. 'success': three quick ticks (a day stamped, an achievement earned). */
export function haptic(kind: 'tap' | 'success' = 'tap') {
  try { navigator.vibrate?.(kind === 'success' ? [16, 50, 16, 50, 34] : 12); } catch { /* not supported */ }
  tick();
  if (kind === 'success') { setTimeout(tick, 110); setTimeout(tick, 220); }
}
