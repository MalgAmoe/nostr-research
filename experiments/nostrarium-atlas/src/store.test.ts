import { beforeEach, describe, expect, it } from 'vitest';
import { accounts, fields, notes, type Field } from './data';
import { currentLocation, currentPlaceId, initialAtlasState, useAtlasStore } from './store';
import { DEFAULT_DRAFT } from './live-types';

function place(id: string, handleId: string, noteId: string): Field {
  return {
    id, label: id, description: 'bounded place', noteIds: [noteId], handleId,
    installRevision: handleId === 'handle-ground' ? 3 : 7, role: 'branch',
    resultKind: 'events', countingUnit: 'subjects', originCommand: { command: 'select' },
    originReceipt: { commandId: `${id}-command`, revisionAfter: 3 }, navigatorReason: `reason for ${id}`,
    projection: 'stream', localPageOffset: 1, selected: { type: 'none', id: '' }, selectedFacet: null,
    localConstraints: { text: '' }, observationSnapshots: [], declaredBounds: {}, declaredOmissions: {}, evidenceResolution: {}, accountResearch: {},
    runtime: {
      fieldId: id, sourceKind: 'query', handleId, pageHandleId: handleId, total: 1, nextOffset: 1,
      handleAddedCount: 1, relays: ['wss://relay.test/'], draft: DEFAULT_DRAFT,
      newestTimestamp: 1, oldestTimestamp: 1,
    },
    conditions: { source: 'wss://relay.test/', terminal: 'EOSE', excludedWarnings: 0, uncertainty: 'bounded', partial: false },
  };
}

beforeEach(() => {
  for (const record of [accounts, fields, notes]) for (const key of Object.keys(record)) delete record[key];
  accounts.author = { id: 'author', name: 'author…0000', handle: '@author', publicKey: 'a'.repeat(64), about: 'Unrequested', color: '#456', live: true };
  notes.event = { id: 'event', authorId: 'author', content: 'ground note', createdAt: 'now', timestamp: 1, relayCount: 1, live: true };
  notes.other = { ...notes.event, id: 'other', content: 'branch note' };
  fields.ground = place('ground', 'handle-ground', 'event');
  fields.branch = place('branch', 'handle-branch', 'other');
  useAtlasStore.setState({ ...initialAtlasState, history: ['start'], activities: [] });
});

describe('Atlas place boundary', () => {
  it('installs an explicit result as Ground and current place with its immutable handle metadata', () => {
    useAtlasStore.getState().installGround('ground');
    expect(useAtlasStore.getState().groundPlaceId).toBe('ground');
    expect(currentPlaceId(useAtlasStore.getState())).toBe('ground');
    expect(fields.ground.role).toBe('ground');
    expect(fields.ground.handleId).toBe('handle-ground');
    expect(fields.ground.installRevision).toBe(3);
  });

  it('keeps selection inside the place instead of adding navigation history', () => {
    useAtlasStore.getState().installGround('ground');
    const history = [...useAtlasStore.getState().history];
    useAtlasStore.getState().commitSelection('ground', { type: 'note', id: 'event' });
    useAtlasStore.getState().commitSelection('ground', { type: 'account', id: 'author' });
    expect(useAtlasStore.getState().commitSelection('ground', { type: 'note', id: 'other' }, false, true)).toBe(false);
    expect(useAtlasStore.getState().history).toEqual(history);
    expect(currentLocation(useAtlasStore.getState()).target).toEqual({ type: 'account', id: 'author' });
    expect(currentPlaceId(useAtlasStore.getState())).toBe('ground');
  });

  it('selects exact unresolved typed subjects without moving or creating handles', () => {
    useAtlasStore.getState().installGround('ground');
    const history = [...useAtlasStore.getState().history];
    const handle = fields.ground.handleId;
    useAtlasStore.getState().commitSelection('ground', { type: 'address', id: '30023:pubkey:slug' });
    expect(fields.ground.selected).toEqual({ type: 'address', id: '30023:pubkey:slug' });
    expect(useAtlasStore.getState().history).toEqual(history);
    expect(fields.ground.handleId).toBe(handle);
  });

  it('retains independently authorized media load state per place during backtracking', () => {
    useAtlasStore.getState().installGround('ground');
    useAtlasStore.getState().setMediaLoad('ground', 'event', 'https://media.example/a.jpg', 'loaded');
    useAtlasStore.getState().setMediaLoad('ground', 'profile:author', 'https://media.example/profile.jpg', 'failed');
    useAtlasStore.getState().installBranch('branch');
    useAtlasStore.getState().setMediaLoad('branch', 'other', 'https://media.example/b.jpg', 'failed');
    useAtlasStore.getState().back();
    expect(fields.ground.mediaLoads?.event['https://media.example/a.jpg']).toBe('loaded');
    expect(fields.ground.mediaLoads?.['profile:author']['https://media.example/profile.jpg']).toBe('failed');
    expect(fields.branch.mediaLoads?.other['https://media.example/b.jpg']).toBe('failed');
    expect(fields.ground.handleId).toBe('handle-ground');
  });

  it('restores projection, local constraints, paging, selection, and observations per place', () => {
    useAtlasStore.getState().installGround('ground');
    fields.ground.accountProjection = {
      status: 'available', handleId: 'ground-accounts', installRevision: 4,
      command: { command: 'move', input: 'handle-ground' }, receipt: { revisionAfter: 4 },
      accountIds: ['author'], countUnit: 'subjects', bounds: { limit: 20 }, omissions: {},
    };
    useAtlasStore.getState().setView('accounts');
    useAtlasStore.getState().setQuery('ground-only');
    useAtlasStore.getState().commitSelection('ground', { type: 'note', id: 'event' });
    fields.ground.localPageOffset = 9;
    fields.ground.observationSnapshots.push({
      id: 'ground-observation', target: { type: 'note', id: 'event' }, sourceHandleId: 'handle-ground',
      observedRevision: 4, locality: 'local', exchanges: [], facts: { status: 'available' },
    });

    useAtlasStore.getState().installBranch('branch');
    useAtlasStore.getState().setQuery('branch-only');
    useAtlasStore.getState().commitSelection('branch', { type: 'note', id: 'other' });
    useAtlasStore.getState().back();

    expect(currentPlaceId(useAtlasStore.getState())).toBe('ground');
    expect(fields.ground.projection).toBe('accounts');
    expect(fields.ground.accountProjection?.handleId).toBe('ground-accounts');
    expect(fields.ground.localConstraints.text).toBe('ground-only');
    expect(fields.ground.localPageOffset).toBe(9);
    expect(fields.ground.selected).toEqual({ type: 'note', id: 'event' });
    expect(fields.ground.observationSnapshots[0].id).toBe('ground-observation');
    useAtlasStore.getState().forward();
    expect(fields.branch.localConstraints.text).toBe('branch-only');
    expect(fields.branch.selected).toEqual({ type: 'note', id: 'other' });
  });

  it('replaces Ground only through explicit installation and leaves the former Ground and facets as a branch', () => {
    fields.ground.accountFacet = {
      status: 'available', sourcePlaceId: 'ground', sourceHandleId: 'handle-ground', commands: [],
      handles: { rows: 'rows', aggregate: 'aggregate', ranked: 'ranked' }, records: [],
    };
    useAtlasStore.getState().installGround('ground');
    useAtlasStore.getState().installGround('branch');
    expect(useAtlasStore.getState().groundPlaceId).toBe('branch');
    expect(fields.branch.role).toBe('ground');
    expect(fields.ground.role).toBe('branch');
    expect(fields.ground.handleId).toBe('handle-ground');
    expect(fields.ground.accountFacet?.handles?.rows).toBe('rows');
  });

  it('removes only a branch UI reference and never mutates another place handle', () => {
    useAtlasStore.getState().installGround('ground');
    useAtlasStore.getState().installBranch('branch');
    const groundHandle = fields.ground.handleId;
    const branchHandle = fields.branch.handleId;
    useAtlasStore.getState().removePlace('branch');
    expect(fields.branch).toBeUndefined();
    expect(fields.ground.handleId).toBe(groundHandle);
    expect(branchHandle).toBe('handle-branch'); // no release command or handle mutation is part of this store action
    expect(currentPlaceId(useAtlasStore.getState())).toBe('ground');
  });
});
