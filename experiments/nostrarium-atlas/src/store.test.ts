import { beforeEach, describe, expect, it } from 'vitest';
import { accounts, fieldFor, fields, notes } from './data';
import { currentLocation, initialAtlasState, useAtlasStore } from './store';

beforeEach(() => {
  for (const record of [accounts, fields, notes]) {
    for (const key of Object.keys(record)) delete record[key];
  }
  accounts.author = {
    id: 'author', name: 'author…0000', handle: '@author', publicKey: 'a'.repeat(64),
    about: 'Profile metadata has not been requested.', color: '#456', live: true,
  };
  notes.event = {
    id: 'event', authorId: 'author', content: 'live test note', createdAt: 'just now',
    timestamp: 1, relayCount: 1, relayUrls: ['wss://relay.test/'], live: true,
  };
  fields.live = {
    id: 'live', label: 'Live relay field', description: 'One installed note.', noteIds: ['event'],
    commandLabel: 'show live',
    conditions: { source: 'wss://relay.test/', terminal: 'EOSE', excludedWarnings: 0, uncertainty: 'bounded' },
  };
  useAtlasStore.setState({
    ...initialAtlasState,
    history: [...initialAtlasState.history],
    pinnedNoteIds: [], pinnedAccountIds: [], activities: [],
  });
});

describe('Atlas live UI store', () => {
  it('starts empty and opens only installed live results', () => {
    expect(currentLocation(useAtlasStore.getState()).target.type).toBe('none');
    useAtlasStore.getState().openInstalledField('live');
    expect(currentLocation(useAtlasStore.getState())).toEqual({ fieldId: 'live', target: { type: 'note', id: 'event' } });
  });

  it('navigates directly among observed notes and authors', () => {
    const store = useAtlasStore.getState();
    store.openInstalledField('live');
    useAtlasStore.getState().inspectAccount('author');
    expect(currentLocation(useAtlasStore.getState()).target).toEqual({ type: 'account', id: 'author' });
    useAtlasStore.getState().back();
    expect(currentLocation(useAtlasStore.getState()).target).toEqual({ type: 'note', id: 'event' });
    useAtlasStore.getState().forward();
    expect(currentLocation(useAtlasStore.getState()).target).toEqual({ type: 'account', id: 'author' });
  });

  it('restores each installed field with its retained ordinary engine handle', () => {
    fields.live.runtime = {
      fieldId: 'live', sourceKind: 'query', handleId: 'engine-field-one', pageHandleId: 'engine-field-one', total: 1, nextOffset: 1,
      mode: 'replace', prependCount: 0, handleAddedCount: 1, olderExhausted: false, relays: ['wss://relay.test/'],
      draft: { limit: 5, hours: 24, search: '', eventId: '', author: '', hashtag: '', excludeContentWarnings: true },
      newestTimestamp: 1, oldestTimestamp: 1,
    };
    notes.other = { ...notes.event, id: 'other' };
    fields.other = {
      ...fields.live, id: 'other', label: 'Other field', noteIds: ['other'],
      runtime: { ...fields.live.runtime, fieldId: 'other', handleId: 'engine-field-two' },
    };

    useAtlasStore.getState().openInstalledField('live');
    useAtlasStore.getState().openInstalledField('other');
    expect(fieldFor(currentLocation(useAtlasStore.getState()).fieldId).runtime?.handleId).toBe('engine-field-two');
    useAtlasStore.getState().back();
    expect(fieldFor(currentLocation(useAtlasStore.getState()).fieldId).runtime?.handleId).toBe('engine-field-one');
    useAtlasStore.getState().forward();
    expect(fieldFor(currentLocation(useAtlasStore.getState()).fieldId).runtime?.handleId).toBe('engine-field-two');
  });

  it('pins only installed live notes and accounts', () => {
    const store = useAtlasStore.getState();
    store.toggleNotePin('event');
    store.toggleNotePin('missing');
    store.toggleAccountPin('author');
    expect(useAtlasStore.getState().pinnedNoteIds).toEqual(['event']);
    expect(useAtlasStore.getState().pinnedAccountIds).toEqual(['author']);
  });
});
