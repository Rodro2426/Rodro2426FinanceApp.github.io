import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CHUNK, split } from './cloud';

describe('cloud parts', () => {
  it('splits big data into parts under the 1 MB record limit and joins it back exactly', () => {
    const big = JSON.stringify({ photo: 'x'.repeat(CHUNK * 2 + 123), name: 'ñandú 💰' });
    const parts = split(big);
    expect(parts.length).toBe(3);
    parts.forEach(p => expect(p.length).toBeLessThanOrEqual(CHUNK));
    expect(parts.join('')).toBe(big);
    expect(split('')).toEqual(['']);
  });
});
