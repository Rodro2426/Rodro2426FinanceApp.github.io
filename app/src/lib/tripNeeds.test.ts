import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { tripNeeds } from './social';

describe('trips only read what changed', () => {
  it('nothing new: no reads', () => expect(tripNeeds({ updatedAt: 100, chatAt: 90 }, 100)).toEqual({ itemsNew: false, chatNew: false }));
  it('a new expense: read expenses, not the chat', () => expect(tripNeeds({ updatedAt: 150, chatAt: 90 }, 100)).toEqual({ itemsNew: true, chatNew: false }));
  it('a new message: read the chat, not the expenses', () => expect(tripNeeds({ updatedAt: 90, chatAt: 150 }, 100)).toEqual({ itemsNew: false, chatNew: true }));
  it('an older trip without a chat stamp: chat read only when the trip changed', () => {
    expect(tripNeeds({ updatedAt: 90 }, 100)).toEqual({ itemsNew: false, chatNew: false });
    expect(tripNeeds({ updatedAt: 150 }, 100)).toEqual({ itemsNew: true, chatNew: true });
  });
});
