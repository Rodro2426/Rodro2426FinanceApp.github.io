import { describe, expect, it } from 'vitest';
import { ES_PATTERNS } from './es';

describe('Spanish patterns', () => {
  it('use each placeholder only once on the English side (a repeat crashes the app in Spanish)', () => {
    const bad = ES_PATTERNS.split('\n').map(l => l.split('|')[0]).filter(en => {
      const seen = en.match(/\{\d+\}/g) ?? [];
      return new Set(seen).size !== seen.length;
    });
    expect(bad).toEqual([]);
  });
});
