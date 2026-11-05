import { describe, expect, it } from 'vitest';
import { contrast, normHex, readable, PRESETS } from './bg';

describe('background color', () => {
  it('reads hex codes in the usual forms', () => {
    expect(normHex('#ABC')).toBe('#aabbcc');
    expect(normHex(' f7f5f3 ')).toBe('#f7f5f3');
    expect(normHex('#12345')).toBeNull();
    expect(normHex('red')).toBeNull();
  });
  it('measures contrast like WCAG', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
  it('every preset keeps text readable in its mode', () => {
    PRESETS.light.forEach(([c]) => expect(readable(c, 'light')).toBe(true));
    PRESETS.dark.forEach(([c]) => expect(readable(c, 'dark')).toBe(true));
  });
  it('flags a dark background in light mode', () => {
    expect(readable('#1d2a6b', 'light')).toBe(false);
  });
});
