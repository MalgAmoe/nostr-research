import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountProfileHeader, AttachmentResource, RichText } from './App';
import { LiveQueryPanelContent } from './LiveQuery';
import { accountProfilePresentation, accounts, fields, notes, observedProfiles, retainObservedProfile, type Field } from './data';
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
  for (const record of [accounts, fields, notes, observedProfiles]) for (const key of Object.keys(record)) delete record[key];
  accounts[author] = { id: author, name: 'author', handle: '@author', publicKey: author, about: 'unrequested', color: '#456', live: true };
  notes.event = { id: 'event', authorId: author, content: 'note', createdAt: 'now', timestamp: 1, relayCount: 1, live: true };
  fields.ground = groundPlace();
  useAtlasStore.setState({
    ...initialAtlasState, history: ['ground'], historyIndex: 0, groundPlaceId: 'ground',
    acquisition: {
      ...initialAtlasState.acquisition, panelOpen: false,
      relays: initialAtlasState.acquisition.relays.map((relay) => ({ ...relay })),
      draft: { ...DEFAULT_DRAFT, search: 'old hidden search', hashtag: 'old-tag', eventId: 'f'.repeat(64) },
    },
    navigatorOperations: {},
  });
  useLiveStore.setState({ phase: { type: 'idle' } });
});

describe('Atlas second-slice presentation boundaries', () => {
  it('renders multiline text, safe web links, hashtags, and visible Nostr references', () => {
    const html = renderToStaticMarkup(createElement(RichText, { text: 'first line\nhttps://example.com/path #nostr nostr:note1abc npub1visible' }));
    expect(html).toContain('first line\n');
    expect(html).toContain('href="https://example.com/path"');
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain('class="rich-hashtag"');
    expect(html.match(/class="rich-nostr-reference"/gu)).toHaveLength(2);
  });

  it('renders factual attachment metadata without inserting external media bytes', () => {
    const html = renderToStaticMarkup(createElement(AttachmentResource, {
      placeId: 'ground', noteId: 'event',
      attachment: { url: 'https://media.example/picture.jpg', families: ['image'], mimeTypes: ['image/jpeg'], classification: 'declared', sources: ['imeta'], width: 640, height: 480, hashes: ['sha256:fact'], fallbackUrls: [] },
    }));
    expect(html).toContain('REMOTE IMAGE PLACEHOLDER');
    expect(html).toContain('640×480');
    expect(html).toContain('Load this image resource');
    expect(html).not.toContain('<img');
  });

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

  it('reuses explicitly observed profile claims across places without changing account identity', () => {
    retainObservedProfile(author, { status: 'available', relays: ['wss://nos.lol'], claims: { name: 'Shared relay name' } }, 'ground', 9);
    expect(accountProfilePresentation(accounts[author]).name).toBe('Shared relay name');
    expect(accountProfilePresentation(accounts[author]).attribution).toMatch(/relay-observed/i);
    expect(accounts[author].publicKey).toBe(author);
  });

  it('keeps not-requested, unresolved, and failed profile wording distinct', () => {
    const account = accounts[author];
    expect(accountProfilePresentation(account).state).toBe('not-requested');
    expect(accountProfilePresentation(account, { status: 'unresolved', relays: [] }).about).toMatch(/no resolvable profile claim/i);
    retainObservedProfile(author, { status: 'available', relays: ['wss://nos.lol'], claims: { name: 'Older success' } }, 'ground', 3);
    expect(accountProfilePresentation(account, { status: 'failure', relays: [], error: 'relay unavailable' }).about).toMatch(/failed: relay unavailable/i);
    expect(accountProfilePresentation(account, { status: 'available', relays: [], claims: { picture: 'javascript:alert(1)' } }).picture).toBeUndefined();
  });
});

describe('Atlas acquisition draft boundaries', () => {
  it('renders the open acquisition panel safely while an unrelated legacy operation is working', () => {
    useAtlasStore.setState((state) => ({
      acquisition: { ...state.acquisition, panelOpen: true },
      navigatorOperations: {},
    }));
    useLiveStore.setState({ phase: { type: 'working', stage: 'facet', command: { command: 'aggregate' } } });
    const html = renderToStaticMarkup(createElement(LiveQueryPanelContent, {
      acquisition: useAtlasStore.getState().acquisition,
      operation: undefined,
      navigatorBusy: false,
      legacyPhase: useLiveStore.getState().phase,
      groundPlaceId: useAtlasStore.getState().groundPlaceId,
    }));
    expect(html).toContain('Working: facet');
    expect(html).toContain('Replace Ground with this acquisition');
    expect(html).not.toContain('Acquiring…');
  });

  it('requires one exact relay for experimental NIP-50 text search', () => {
    expect(validateSearchRelayCount({ ...DEFAULT_DRAFT, search: 'nostr' }, [])).toMatch(/exactly one selected relay/i);
    expect(validateSearchRelayCount({ ...DEFAULT_DRAFT, search: 'nostr' }, ['wss://one', 'wss://two'])).toMatch(/exactly one selected relay/i);
    expect(validateSearchRelayCount({ ...DEFAULT_DRAFT, search: 'nostr' }, ['wss://one'])).toBeNull();
    expect(validateSearchRelayCount(DEFAULT_DRAFT, ['wss://one', 'wss://two'])).toBeNull();
  });

  it('creates a fresh account draft without hidden constraints from the older draft', () => {
    expect(freshAccountResearchDraft(author)).toEqual({ ...DEFAULT_DRAFT, author, hours: 0, includeFilterLimit: false });
    useLiveStore.getState().prepareAccountResearch('ground', author);
    expect(useAtlasStore.getState().acquisition.draft).toEqual({ ...DEFAULT_DRAFT, author, hours: 0, includeFilterLimit: false });
    expect(useAtlasStore.getState().acquisition.panelOpen).toBe(true);
    expect(fields.ground.handleId).toBe('ground-handle');
    expect(fields.ground.role).toBe('ground');
  });

  it('prepares relationship and author-resolution drafts without external execution', () => {
    fields.ground.observationSnapshots.push({
      id: 'note-facts', target: { type: 'note', id: 'event' }, sourceHandleId: 'ground-handle', observedRevision: 3,
      locality: 'local', exchanges: [], facts: { status: 'available', eventHandleId: 'exact-event-handle' },
    });
    useLiveStore.getState().prepareNoteRelationship('ground', 'event', 'replies');
    useLiveStore.getState().prepareAuthorResolution('ground');
    expect(fields.ground.noteResearch?.event.relationshipDraft.relationship).toBe('replies');
    expect(fields.ground.noteResearch?.event.draftOpen).toBe(true);
    expect(fields.ground.authorResolution?.draftOpen).toBe(true);
    expect(fields.ground.authorResolution?.draft.relays).toEqual(['wss://nos.lol']);
    expect(useLiveStore.getState().phase).toEqual({ type: 'idle' });
    expect(fields.ground.handleId).toBe('ground-handle');
  });

  it('does not alter the main acquisition draft when selecting a note or account', () => {
    const before = { ...useAtlasStore.getState().acquisition.draft };
    useAtlasStore.getState().commitSelection('ground', { type: 'note', id: 'event' });
    useAtlasStore.getState().commitSelection('ground', { type: 'account', id: author });
    expect(useAtlasStore.getState().acquisition.draft).toEqual(before);
    expect(fields.ground.localPageOffset).toBe(1);
    expect(fields.ground.accountFacet?.records).toHaveLength(1);
  });
});
