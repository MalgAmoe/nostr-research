import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountProfileHeader, AttachmentResource, RichText } from './App';
import { createNavigatorActions } from './actions';
import { accounts, fields, notes, type Field } from './data';
import { DEFAULT_DRAFT } from './live-types';
import { initialAtlasState, useAtlasStore } from './store';

const author = 'a'.repeat(64);

function ground(): Field {
  return {
    id: 'ground', label: 'Ground', description: 'bounded', noteIds: ['event'], handleId: 'ground-handle', installRevision: 2,
    role: 'ground', resultKind: 'events', countingUnit: 'subjects', originCommand: { command: 'acquire' }, originReceipt: { revisionAfter: 2 },
    navigatorReason: 'initial acquisition', projection: 'stream', localPageOffset: 1, selected: { type: 'none', id: '' }, selectedFacet: null,
    localConstraints: { text: '' }, observationSnapshots: [{ id: 'note-facts', target: { type: 'note', id: 'event' }, sourceHandleId: 'ground-handle', observedRevision: 2, locality: 'local', exchanges: [], facts: { status: 'available', eventHandleId: 'event-handle' } }],
    declaredBounds: {}, declaredOmissions: {}, evidenceResolution: {}, accountResearch: {},
    accountFacet: { status: 'available', sourcePlaceId: 'ground', sourceHandleId: 'ground-handle', commands: [], handles: { rows: 'rows', aggregate: 'aggregate', ranked: 'ranked' }, countUnit: 'rows', records: [{ account: author, noteCount: 1, sourcePlaceId: 'ground', sourceHandleId: 'ground-handle', derivationHandles: { rows: 'rows', aggregate: 'aggregate', ranked: 'ranked' }, derivationCommands: [], countUnit: 'rows', lineage: {}, bounds: {}, truncated: false, omissions: {} }] },
    runtime: { fieldId: 'ground', sourceKind: 'query', handleId: 'ground-handle', pageHandleId: 'ground-handle', total: 1, nextOffset: 1, handleAddedCount: 1, relays: ['wss://relay.test'], draft: { ...DEFAULT_DRAFT }, newestTimestamp: 1, oldestTimestamp: 1 },
    conditions: { source: 'wss://relay.test', terminal: 'EOSE', excludedWarnings: 0, uncertainty: 'bounded', partial: false },
  };
}

beforeEach(() => {
  for (const record of [accounts, fields, notes]) for (const key of Object.keys(record)) delete record[key];
  accounts[author] = { id: author, name: 'author', handle: '@author', publicKey: author, about: 'unrequested', color: '#456', live: true };
  notes.event = { id: 'event', authorId: author, content: 'note', createdAt: 'now', timestamp: 1, relayCount: 1, live: true };
  fields.ground = ground();
  useAtlasStore.setState({ ...initialAtlasState, history: ['ground'], historyIndex: 0, groundPlaceId: 'ground', acquisition: { ...initialAtlasState.acquisition, panelOpen: false, relays: [{ url: 'wss://relay.test', label: 'test', selected: true }], draft: { ...DEFAULT_DRAFT, search: 'hidden search', hashtag: 'hidden-tag', eventId: 'f'.repeat(64) } }, navigatorOperations: {} });
});

describe('Atlas retained product boundaries', () => {
  it('keeps rich links safe, remote media inert, and profile claims visibly attributed', () => {
    const rich = renderToStaticMarkup(createElement(RichText, { text: 'https://example.com/path #nostr nostr:note1abc' }));
    expect(rich).toContain('href="https://example.com/path"');
    expect(rich).toContain('rel="noreferrer noopener"');
    expect(rich).toContain('class="rich-hashtag"');
    expect(rich).toContain('class="rich-nostr-reference"');

    const attachment = renderToStaticMarkup(createElement(AttachmentResource, { placeId: 'ground', noteId: 'event', attachment: { url: 'https://media.example/picture.jpg', families: ['image'], mimeTypes: ['image/jpeg'], classification: 'declared', sources: ['imeta'], width: 640, height: 480, hashes: [], fallbackUrls: [] } }));
    expect(attachment).toContain('REMOTE IMAGE PLACEHOLDER');
    expect(attachment).toContain('Load this image resource');
    expect(attachment).not.toContain('<img');

    const profile = renderToStaticMarkup(createElement(AccountProfileHeader, { account: accounts[author], profile: { status: 'available', relays: ['wss://relay.test'], supportingHandleId: 'profile-events', claims: { display_name: 'Relay Display', about: 'Relay-observed claim', picture: 'https://media.example/profile.jpg' } } }));
    expect(profile).toContain('Relay-observed profile claims · available');
    expect(profile).toContain('Relay-observed claim');
    expect(profile).toContain('Load claimed profile picture');
    expect(profile).not.toContain('<img');
  });

  it('isolates fresh account research and prepares relationship/author drafts without executing commands', () => {
    const external = vi.fn();
    const actions = createNavigatorActions({ resolveAcquisition: external, resolveSubjectObservation: external, resolveNoteRelationship: external, resolveAuthors: external });
    actions.prepareAccountResearch('ground', author);
    expect(useAtlasStore.getState().acquisition.draft).toEqual({ ...DEFAULT_DRAFT, author, hours: 0, includeFilterLimit: false });
    expect(fields.ground.handleId).toBe('ground-handle');

    actions.prepareNoteRelationship('ground', 'event', 'replies');
    actions.prepareAuthorResolution('ground');
    expect(fields.ground.noteResearch?.event).toMatchObject({ draftOpen: true, relationshipDraft: { relationship: 'replies' } });
    expect(fields.ground.authorResolution).toMatchObject({ draftOpen: true, draft: { relays: ['wss://relay.test'] } });
    expect(external).not.toHaveBeenCalled();
  });
});
