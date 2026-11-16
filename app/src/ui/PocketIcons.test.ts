import { describe, expect, it } from 'vitest';
import { lastEmoji, POCKET_ICONS } from './PocketIcons';

describe('lastEmoji', () => {
  it('keeps only the last emoji and ignores letters', () => {
    expect(lastEmoji('ab🐢')).toBe('🐢');
    expect(lastEmoji('🛒x🍽️')).toBe('🍽️');
    expect(lastEmoji('hello')).toBe('');
  });
  it('treats joined emojis, skin tones and flags as one', () => {
    expect(lastEmoji('👩‍💻')).toBe('👩‍💻');
    expect(lastEmoji('👍🏽')).toBe('👍🏽');
    expect(lastEmoji('🇨🇴')).toBe('🇨🇴');
  });
});

it('every icon code is unique', () => {
  expect(new Set(POCKET_ICONS.map(i => i.code)).size).toBe(POCKET_ICONS.length);
});
