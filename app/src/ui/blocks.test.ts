import { describe, expect, it } from 'vitest';
import { arrange } from './Blocks';

describe('edit layout: saved order', () => {
  const ids = ['safe', 'stats', 'pockets', 'coming', 'recent'];
  it('uses the default order when nothing is saved', () => {
    expect(arrange(ids)).toEqual({ shown: ids, hidden: [] });
  });
  it('applies a saved order and hides removed blocks', () => {
    const r = arrange(ids, { order: ['pockets', 'safe', 'stats', 'recent', 'coming'], hidden: ['coming'] });
    expect(r).toEqual({ shown: ['pockets', 'safe', 'stats', 'recent'], hidden: ['coming'] });
  });
  it('drops blocks that no longer exist and slots new ones after their default neighbour', () => {
    const r = arrange(['a', 'b', 'new', 'c'], { order: ['c', 'gone', 'a', 'b'], hidden: ['gone'] });
    expect(r).toEqual({ shown: ['c', 'a', 'b', 'new'], hidden: [] });
  });
  it('puts a new first block at the top', () => {
    expect(arrange(['x', 'a', 'b'], { order: ['b', 'a'], hidden: [] }).shown).toEqual(['x', 'b', 'a']);
  });
});
