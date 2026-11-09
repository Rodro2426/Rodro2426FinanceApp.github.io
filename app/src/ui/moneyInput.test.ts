import { describe, expect, it } from 'vitest';
import { typedComma } from './MoneyInput';

describe('typedComma (comma key on iPhones set to Colombia or Europe)', () => {
  it('turns a comma just typed into the decimal point', () => {
    expect(typedComma('12', '12,', 3, true)).toBe('12.');
    expect(typedComma('1,234', '1,234,', 6, true)).toBe('1,234.');
  });
  it('turns a comma typed in the middle into the decimal point', () => {
    expect(typedComma('1,250', '12,,50', 3, true)).toBe('12.,50');
  });
  it('leaves thousands commas alone when a digit is typed', () => {
    expect(typedComma('123', '1,234', 5, true)).toBe('1,234');
  });
  it('ignores a second decimal mark', () => {
    expect(typedComma('12.5', '12.5,', 5, true)).toBe('12.5,');
  });
  it('does nothing in pesos (no cents)', () => {
    expect(typedComma('12', '12,', 3, false)).toBe('12,');
  });
});
