import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountProfileHeader } from './App';
import { accountProfilePresentation, accounts, fields, notes, type Field } from './data';
import { DEFAULT_DRAFT, freshAccountResearchDraft, useLiveStore, validateSearchRelayCount } from './live-store';
import { initialAtlasState, useAtlasStore } from './store';

const author = 'a'.repeat(64);

function groundPlace(): Field {
  return {
    id: 'ground', label: 'Ground', description: 'bounded', noteIds: ['event'],
    handleId: 'ground-handle', installRevision: 2, role: 'ground', resultKind: 'events', countingUnit: 'subjects',
    originCommand: { command: 'plan' }, originReceipt: { revisionAfter: 2 }, navigatorReason: 'initial acquisition',
    projection: 'stream', localPageOffset: 1, selected: { type: 'none', id: '' }, selectedFacet: null,
    localConstraints: { text: '' }, observationSnapshots: [], declaredBounds: {}, declaredOmissions: {}, evidenceResolution: {}, accountResearch: {},
    accountFacet: {
      status: 'available', sourcePlaceId: 'ground', sourceHandleId: 'ground-handle', commands: [],
      handles: { rows: 'rows', aggregate: 'facets', ranked: 'ranked' }, countUnit: 'rows', records: [{
        account: author, noteCount: 1, sourcePlaceId: 'ground', sourceHandleId: 'ground-handle',
        derivationHandles: { rows: 'rows', aggregate: 'facets', ranked: 'ranked' }, derivationCommands: [],
        countUnit: 'rows', lineage: { account: ['event.author'] }, bounds: {}, truncated: false, omissions: {},
      }],
    },
    runtime: {
      fieldId: 'ground', sourceKind: 'query', handleId: 'ground-handle', pageHandleId: 'ground-handle',
      total: 1, nextOffset: 1, handleAddedCount: 1, relays: ['wss://nos.lol'], draft: DEFAULT_DRAFT,
      newestTimestamp: 1, oldestTimestamp: 1,
    },
    conditions: { source: 'wss://nos.lol', terminal: 'EOSE', excludedWarnings: 0, uncertainty: 'bounded', partial: false },
  };
}

beforeEach(() => {
  for (const record of [accounts, fields, notes]) for (const key of Object.keys(record)) delete record[key];
  accounts[author] = { id: author, name: 'author', handle: '@author', publicKey: author, about: 'unrequested', color: '#456', live: true };
  notes.event = { id: 'event', authorId: author, content: 'note', createdAt: 'now', timestamp: 1, relayCount: 1, live: true };
  fields.ground = groundPlace();
  useAtlasStore.setState({ ...initialAtlasState, history: ['ground'], historyIndex: 0, groundPlaceId: 'ground' });
  useLiveStore.setState({
    panelOpen: false, phase: { type: 'idle' },
    draft: { ...DEFAULT_DRAFT, search: 'old hidden search', hashtag: 'old-tag', eventId: 'f'.repeat(64) },
  });
});

describe('Atlas interaction presentation boundaries', () => {
  it('uses attributed observed profile claims in the selected-account header', () => {
    const html = renderToStaticMarkup(createElement(AccountProfileHeader, {
      account: accounts[author],
      profile: {
        status: 'available', relays: ['wss://nos.lol'], supportingHandleId: 'profile-events',
        claims: { display_name: 'Relay Display', name: 'relay_name', about: 'Relay-observed about claim', picture: 'https://media.example/profile.jpg' },
      },
    }));
    expect(html).toContain('<h2>Relay Display</h2>');
    expect(html).toContain('Relay-observed about claim');
    expect(html).toContain('Relay-observed profile claims · available');
    expect(html).toContain('https://media.example/profile.jpg');
    expect(html).toContain('Load claimed profile picture');
    expect(html).not.toContain('Profile metadata has not been requested.');
  });

  it('keeps not-requested, unresolved, and failed profile wording distinct', () => {
    const account = accounts[author];
    expect(accountProfilePresentation(account).state).toBe('not-requested');
    expect(accountProfilePresentation(account, { status: 'unresolved', relays: [] }).about).toMatch(/no resolvable profile claim/i);
    expect(accountProfilePresentation(account, { status: 'failure', relays: [], error: 'relay unavailable' }).about).toMatch(/failed: relay unavailable/i);
  });
});

describe('Atlas acquisition draft boundaries', () => {
  it('requires one exact relay for experimental NIP-50 text search', () => {
    expect(validateSearchRelayCount({ ...DEFAULT_DRAFT, search: 'nostr' }, [])).toMatch(/exactly one selected relay/i);
    expect(validateSearchRelayCount({ ...DEFAULT_DRAFT, search: 'nostr' }, ['wss://one', 'wss://two'])).toMatch(/exactly one selected relay/i);
    expect(validateSearchRelayCount({ ...DEFAULT_DRAFT, search: 'nostr' }, ['wss://one'])).toBeNull();
    expect(validateSearchRelayCount(DEFAULT_DRAFT, ['wss://one', 'wss://two'])).toBeNull();
  });

  it('creates a fresh account draft without hidden constraints from the older draft', () => {
    expect(freshAccountResearchDraft(author)).toEqual({ ...DEFAULT_DRAFT, author, hours: 0, includeFilterLimit: false });
    useLiveStore.getState().prepareAccountResearch('ground', author);
    expect(useLiveStore.getState().draft).toEqual({ ...DEFAULT_DRAFT, author, hours: 0, includeFilterLimit: false });
    expect(useLiveStore.getState().panelOpen).toBe(true);
    expect(fields.ground.handleId).toBe('ground-handle');
    expect(fields.ground.role).toBe('ground');
  });

  it('does not alter the main acquisition draft when selecting a note or account', () => {
    const before = { ...useLiveStore.getState().draft };
    useAtlasStore.getState().selectNote('event');
    useAtlasStore.getState().inspectAccount(author);
    expect(useLiveStore.getState().draft).toEqual(before);
    expect(fields.ground.localPageOffset).toBe(1);
    expect(fields.ground.accountFacet?.records).toHaveLength(1);
  });
});
