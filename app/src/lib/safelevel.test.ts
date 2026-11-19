import { describe, expect, it } from 'vitest';
import { safeLevel } from './derive';

describe('safe-to-spend colour', () => {
  it('green above 30% left', () => { expect(safeLevel(1)).toBe('green'); expect(safeLevel(0.31)).toBe('green'); });
  it('yellow from 30% down to nothing left', () => { expect(safeLevel(0.3)).toBe('yellow'); expect(safeLevel(0.01)).toBe('yellow'); expect(safeLevel(0)).toBe('yellow'); });
  it('red only once past the limit', () => { expect(safeLevel(-0.01)).toBe('red'); expect(safeLevel(-1)).toBe('red'); });
});
