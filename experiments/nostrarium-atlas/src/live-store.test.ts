import { describe, expect, it } from 'vitest';
import { applyCursorBounds, mergeFieldNoteIds, validateSearchRelayCount } from './live-store';
import type { ActiveLiveField, QueryDraft } from './live-types';

const draft: QueryDraft = {
  limit: 20,
  hours: 24,
  search: '',
  eventId: '',
  author: '',
  hashtag: '',
  excludeContentWarnings: true,
};

const active: ActiveLiveField = {
  fieldId: 'field',
  sourceKind: 'query',
  handleId: 'handle',
  pageHandleId: 'handle',
  total: 20,
  nextOffset: 20,
  mode: 'replace',
  prependCount: 0,
  handleAddedCount: 20,
  olderExhausted: false,
  relays: ['wss://relay.example'],
  draft,
  newestTimestamp: 200,
  oldestTimestamp: 100,
};

describe('Atlas live query boundaries', () => {
  it('keeps timestamp cursors inclusive so same-second events are not skipped', () => {
    expect(applyCursorBounds({}, 'newer', active)).toEqual({ since: 200 });
    expect(applyCursorBounds({}, 'older', active)).toEqual({ until: 100 });
  });

  it('requires one exact relay for experimental NIP-50 text search', () => {
    expect(validateSearchRelayCount({ ...draft, search: 'nostr' }, [])).toMatch(/exactly one selected relay/i);
    expect(validateSearchRelayCount({ ...draft, search: 'nostr' }, ['wss://one', 'wss://two'])).toMatch(/exactly one selected relay/i);
    expect(validateSearchRelayCount({ ...draft, search: 'nostr' }, ['wss://one'])).toBeNull();
    expect(validateSearchRelayCount(draft, ['wss://one', 'wss://two'])).toBeNull();
  });
});

describe('Atlas update buffer ordering', () => {
  it('places later pages of a newer update after its first page and before the old field', () => {
    const first = mergeFieldNoteIds(['old-1', 'old-2'], ['new-1', 'new-2'], 'newer', 0);
    expect(first).toEqual({ noteIds: ['new-1', 'new-2', 'old-1', 'old-2'], prependCount: 2 });

    const second = mergeFieldNoteIds(first.noteIds, ['new-3'], 'newer', first.prependCount);
    expect(second).toEqual({ noteIds: ['new-1', 'new-2', 'new-3', 'old-1', 'old-2'], prependCount: 3 });

    const nextUpdate = mergeFieldNoteIds(second.noteIds, ['latest'], 'newer', 0);
    expect(nextUpdate).toEqual({ noteIds: ['latest', 'new-1', 'new-2', 'new-3', 'old-1', 'old-2'], prependCount: 1 });
  });
});
