import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNavigatorActions } from './actions';
import { accounts, fields, notes, type Field } from './data';
import { DEFAULT_DRAFT } from './live-types';
import { useLiveStore } from './live-store';
import {
  resolveAccountFacet, resolveAccountNotes, resolveAccountProjection, resolveAcquisition, resolvePlacePage,
  resolveSubjectObservation, type ControllerFactory, type SubjectObservationIntent,
} from './resolvers';
import { currentPlaceId, initialAtlasState, placeOperationKey, useAtlasStore } from './store';

const author = 'a'.repeat(64);

function place(id: string, handleId: string, noteId = 'event'): Field {
  return {
    id, label: id, description: 'bounded place', noteIds: [noteId], handleId, installRevision: 3,
    role: 'branch', resultKind: 'events', countingUnit: 'subjects', originCommand: { command: 'acquire' },
    originReceipt: { revisionAfter: 3 }, navigatorReason: `reason for ${id}`, projection: 'stream', localPageOffset: 1,
    selected: { type: 'none', id: '' }, selectedFacet: null, localConstraints: { text: '' }, observationSnapshots: [],
    declaredBounds: {}, declaredOmissions: {}, evidenceResolution: {}, accountResearch: {}, noteResearch: {}, mediaLoads: {},
    runtime: {
      fieldId: id, sourceKind: 'query', handleId, pageHandleId: handleId, total: 1, nextOffset: 1,
      handleAddedCount: 1, relays: ['wss://relay.test'], draft: { ...DEFAULT_DRAFT }, newestTimestamp: 1, oldestTimestamp: 1,
    },
    conditions: { source: 'wss://relay.test', terminal: 'EOSE', excludedWarnings: 0, uncertainty: 'bounded', partial: false },
  };
}

function resetAtlas() {
  for (const record of [accounts, fields, notes]) for (const key of Object.keys(record)) delete record[key];
  accounts[author] = { id: author, name: 'author', handle: '@author', publicKey: author, about: 'unrequested', color: '#456', live: true };
  notes.event = { id: 'event', authorId: author, content: 'preview', createdAt: 'now', timestamp: 1, relayCount: 1, live: true };
  useLiveStore.setState({ phase: { type: 'idle' } });
  useAtlasStore.setState({
    ...initialAtlasState,
    history: ['start'], historyIndex: 0, groundPlaceId: null, activities: [], nextActivity: 0,
    acquisition: {
      ...initialAtlasState.acquisition,
      relays: [{ url: 'wss://relay.test', label: 'test', selected: true }],
      draft: { ...DEFAULT_DRAFT }, panelOpen: true,
    },
    navigatorOperations: {}, latestExternal: { label: 'No external request yet', status: 'IDLE', warningCount: 0 },
  });
}

function controllerFactory(execute: (command: Record<string, unknown>) => Promise<unknown>): ControllerFactory {
  return (async () => ({ execute })) as unknown as ControllerFactory;
}

beforeEach(resetAtlas);

describe('typed Atlas navigator boundary', () => {
  it('captures the visible draft once and installs rendered bounded notes through the acquisition resolver', async () => {
    const commands: Record<string, unknown>[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const factory = controllerFactory(async (command) => {
      commands.push(command);
      if (command.command === 'acquire') {
        await gate;
        return {
          response: { ok: true, sessionRevision: 4, result: { handle: { count: 2, revision: 4 }, external: { status: 'complete', completeness: {} }, status: 'complete' } },
          receipt: { commandId: 'acquire', revisionAfter: 4 },
        };
      }
      return {
        response: {
          ok: true, sessionRevision: 4,
          result: { count: 2, countUnit: 'subjects', offset: 0, nextOffset: 2, preview: [
            { id: 'new-event', preview: { author: { publicKey: author }, contentExcerpt: 'bounded rendered note', createdAt: 1, relays: ['wss://relay.test'] } },
            { id: 'event', preview: { author: { publicKey: author }, contentExcerpt: 'stale preview excerpt', createdAt: 1, relays: ['wss://relay.test'] } },
          ] },
        },
        receipt: { commandId: 'show', revisionAfter: 4 },
      };
    });
    const actions = createNavigatorActions({
      resolveAcquisition: (intent, onCommand) => resolveAcquisition(intent, factory, onCommand),
      resolveSubjectObservation: (intent) => resolveSubjectObservation(intent, factory),
    });

    actions.patchAcquisitionDraft({ hashtag: 'captured' });
    const acquisition = actions.acquireGround();
    actions.patchAcquisitionDraft({ hashtag: 'edited-after-start' });
    notes.event.content = 'richer local observation completed after capture';
    notes.event.contentRole = 'root';
    release();
    await acquisition;

    const groundId = useAtlasStore.getState().groundPlaceId!;
    expect(fields[groundId].runtime?.draft.hashtag).toBe('captured');
    expect(useAtlasStore.getState().acquisition.draft.hashtag).toBe('edited-after-start');
    expect(fields[groundId].noteIds).toEqual(['new-event', 'event']);
    expect(notes['new-event'].content).toBe('bounded rendered note');
    expect(notes.event.content).toBe('richer local observation completed after capture');
    expect(notes.event.contentRole).toBe('root');
    expect(commands.map((command) => command.command)).toEqual(['acquire', 'show']);
    expect(useAtlasStore.getState().navigatorOperations.acquisition).toBeUndefined();
  });

  it('installs immutable Ground even when its first bounded preview fails', async () => {
    fields.old = place('old', 'old-handle');
    fields.old.role = 'ground';
    useAtlasStore.setState({ history: ['old'], historyIndex: 0, groundPlaceId: 'old' });
    const commands: Record<string, unknown>[] = [];
    const factory = controllerFactory(async (command) => {
      commands.push(command);
      if (command.command === 'acquire') return {
        response: { ok: true, sessionRevision: 8, result: { handle: { count: 2, revision: 8 }, external: { status: 'partial', completeness: { status: 'partial' } } } },
        receipt: { commandId: 'acquire', revisionAfter: 8 },
      };
      return { response: { ok: false, sessionRevision: 8, error: { message: 'preview unavailable' } }, receipt: { commandId: 'show', revisionAfter: 8 } };
    });
    const actions = createNavigatorActions({
      resolveAcquisition: (intent, onCommand) => resolveAcquisition(intent, factory, onCommand),
      resolveSubjectObservation: (intent) => resolveSubjectObservation(intent, factory),
    });

    await actions.acquireGround();

    const groundId = useAtlasStore.getState().groundPlaceId!;
    expect(groundId).not.toBe('old');
    expect(fields[groundId].handleId).toMatch(/^atlas-ground-/u);
    expect(fields[groundId].installRevision).toBe(8);
    expect(fields.old.role).toBe('branch');
    expect(fields.old.handleId).toBe('old-handle');
    expect(useAtlasStore.getState().navigatorOperations.acquisition).toMatchObject({ status: 'failure', stage: 'page' });
    expect(fields[groundId].observationSnapshots.at(-1)?.exchanges[0].response.ok).toBe(false);
    expect(commands.map((command) => command.command)).toEqual(['acquire', 'show']);
  });

  it('composes the current-place transformation family through one action and resolver boundary', async () => {
    fields.ground = place('ground', 'ground-handle');
    fields.ground.role = 'ground';
    fields.ground.runtime!.total = 2;
    useAtlasStore.setState({ history: ['ground'], historyIndex: 0, groundPlaceId: 'ground' });
    const commands: Record<string, unknown>[] = [];
    const factory = controllerFactory(async (command) => {
      commands.push(command);
      const input = String(command.input ?? '');
      const mode = String((command.parameters as Record<string, unknown> | undefined)?.mode ?? '');
      let result: Record<string, unknown> = { handle: { count: 1, revision: 4 } };
      if (command.command === 'show' && input === 'ground-handle') result = {
        count: 2, countUnit: 'subjects', offset: 1, nextOffset: 2,
        preview: [{ id: 'page-event', preview: { author: { publicKey: author }, contentExcerpt: 'second page', createdAt: 2, relays: ['wss://relay.test'] } }],
      };
      else if (command.command === 'show' && input.includes('place-accounts') && mode === 'preview') result = { preview: [{ id: author }], countUnit: 'subjects' };
      else if (command.command === 'show' && input.includes('ranked-account-facets') && mode === 'preview') result = { preview: [{ values: { account: author, noteCount: 1 } }], countUnit: 'rows' };
      else if (command.command === 'show' && input.includes('account-notes-here')) result = {
        count: 1, countUnit: 'subjects', offset: 0, nextOffset: 1,
        context: { budget: { requested: 1 }, cardinality: { truncated: false } },
        preview: [{ id: 'event', preview: { author: { publicKey: author }, contentExcerpt: 'preview', createdAt: 1, relays: ['wss://relay.test'] } }],
      };
      else if (command.command === 'show' && mode === 'summary') result = { summary: { countUnit: input.includes('accounts') ? 'subjects' : 'rows' }, context: { cardinality: { truncated: false } } };
      else if (command.command === 'schema') result = { structure: { fields: [{ name: 'account', subjectType: 'account' }] } };
      return { response: { ok: true, sessionRevision: 4, result }, receipt: { commandId: String(command.command), revisionAfter: 4 } };
    });
    const actions = createNavigatorActions({
      resolveAcquisition: (intent, onCommand) => resolveAcquisition(intent, factory, onCommand),
      resolveSubjectObservation: (intent) => resolveSubjectObservation(intent, factory),
      resolvePlacePage: (intent) => resolvePlacePage(intent, factory),
      resolveAccountProjection: (intent) => resolveAccountProjection(intent, factory),
      resolveAccountFacet: (intent) => resolveAccountFacet(intent, factory),
      resolveAccountNotes: (intent) => resolveAccountNotes(intent, factory),
    });

    await actions.openAccountProjection('ground');
    expect(fields.ground.accountProjection).toMatchObject({ status: 'available', accountIds: [author] });
    actions.setPlaceProjection('stream');
    await actions.deriveAccountFacet('ground');
    expect(fields.ground.accountFacet).toMatchObject({ status: 'available', records: [{ account: author, noteCount: 1 }] });
    await actions.openAccountNotes('ground', author);
    const branchId = currentPlaceId(useAtlasStore.getState());
    expect(branchId).toMatch(/^branch:atlas-account-notes-here-/u);
    expect(fields[branchId].declaredBounds.requestBudget).toEqual({ requested: 1 });
    actions.navigateBack();
    await actions.showMore('ground');

    expect(fields.ground.noteIds).toContain('page-event');
    expect(fields.ground.runtime?.nextOffset).toBe(2);
    expect(Object.values(useAtlasStore.getState().navigatorOperations).filter((item) => item.status === 'working')).toHaveLength(0);
    expect(commands.map((command) => command.command)).toEqual([
      'move', 'show', 'show', 'relate', 'aggregate', 'sort', 'show', 'show', 'show', 'schema',
      'filter', 'extract', 'show', 'show',
    ]);
    expect(JSON.stringify(commands)).not.toContain('relays');
  });

  it('does not reuse a projection handle when its creating move failed', async () => {
    fields.ground = place('ground', 'ground-handle'); fields.ground.role = 'ground';
    useAtlasStore.setState({ history: ['ground'], historyIndex: 0, groundPlaceId: 'ground' });
    const commands: Record<string, unknown>[] = [];
    let failed = false;
    const factory = controllerFactory(async (command) => {
      commands.push(command);
      if (!failed && command.command === 'move') {
        failed = true;
        return { response: { ok: false, sessionRevision: 3, error: { message: 'move failed' } }, receipt: { commandId: 'failed-move', revisionAfter: 3 } };
      }
      const mode = String((command.parameters as Record<string, unknown> | undefined)?.mode ?? '');
      const result = command.command === 'move' ? { handle: { count: 1, revision: 4 } }
        : mode === 'preview' ? { preview: [{ id: author }] }
          : { summary: { countUnit: 'subjects' }, context: { cardinality: {} } };
      return { response: { ok: true, sessionRevision: 4, result }, receipt: { commandId: String(command.command), revisionAfter: 4 } };
    });
    const actions = createNavigatorActions({
      resolveAcquisition: vi.fn(), resolveSubjectObservation: vi.fn(),
      resolveAccountProjection: (intent) => resolveAccountProjection(intent, factory),
    });

    await actions.openAccountProjection('ground');
    expect(fields.ground.accountProjection?.receipt).toBeUndefined();
    await actions.openAccountProjection('ground');

    expect(commands.map((command) => command.command)).toEqual(['move', 'move', 'show', 'show']);
    expect(fields.ground.accountProjection?.status).toBe('available');
  });

  it('settles every migrated local operation after an unexpected resolver rejection', async () => {
    const cases: Array<{ stage: 'page' | 'projection' | 'facet' | 'branch'; invoke(actions: ReturnType<typeof createNavigatorActions>): Promise<void> }> = [
      { stage: 'page', invoke: (actions) => actions.showMore('ground') },
      { stage: 'projection', invoke: (actions) => actions.openAccountProjection('ground') },
      { stage: 'facet', invoke: (actions) => actions.deriveAccountFacet('ground') },
      { stage: 'branch', invoke: (actions) => actions.openAccountNotes('ground', author) },
    ];
    for (const item of cases) {
      resetAtlas(); fields.ground = place('ground', 'ground-handle'); fields.ground.role = 'ground';
      fields.ground.runtime!.total = 2;
      fields.ground.accountFacet = {
        status: 'available', sourcePlaceId: 'ground', sourceHandleId: 'ground-handle', commands: [],
        handles: { rows: 'rows-handle', aggregate: 'aggregate-handle', ranked: 'ranked-handle' }, records: [],
      };
      useAtlasStore.setState({ history: ['ground'], historyIndex: 0, groundPlaceId: 'ground' });
      const reject = async () => { throw new Error(`${item.stage} exploded`); };
      const actions = createNavigatorActions({
        resolveAcquisition: vi.fn(), resolveSubjectObservation: vi.fn(), resolvePlacePage: reject,
        resolveAccountProjection: reject, resolveAccountFacet: reject, resolveAccountNotes: reject,
      });
      await item.invoke(actions).catch(() => undefined);
      expect(useAtlasStore.getState().navigatorOperations[placeOperationKey('ground', item.stage)]).toMatchObject({ status: 'failure' });
    }
  });

  it('settles paging when its source branch is removed during resolution', async () => {
    fields.ground = place('ground', 'ground-handle'); fields.ground.role = 'ground';
    fields.branch = place('branch', 'branch-handle'); fields.branch.runtime!.total = 2;
    useAtlasStore.setState({ history: ['ground', 'branch'], historyIndex: 1, groundPlaceId: 'ground' });
    let release!: (value: Awaited<ReturnType<typeof resolvePlacePage>>) => void;
    const pending = new Promise<Awaited<ReturnType<typeof resolvePlacePage>>>((resolve) => { release = resolve; });
    const actions = createNavigatorActions({ resolveAcquisition: vi.fn(), resolveSubjectObservation: vi.fn(), resolvePlacePage: () => pending });

    const paging = actions.showMore('branch');
    useAtlasStore.getState().removePlace('branch');
    release({ kind: 'place-page', status: 'available', placeId: 'branch', command: { command: 'show' }, exchanges: [], nextOffset: 2, notes: {}, baseNotes: {}, accounts: {} });
    await paging;

    expect(useAtlasStore.getState().navigatorOperations[placeOperationKey('branch', 'page')]).toBeUndefined();
  });

  it('attributes account-note derivation failures to the account and rows handle', async () => {
    fields.ground = place('ground', 'ground-handle'); fields.ground.role = 'ground';
    fields.ground.accountFacet = {
      status: 'available', sourcePlaceId: 'ground', sourceHandleId: 'ground-handle', commands: [],
      handles: { rows: 'rows-handle', aggregate: 'aggregate-handle', ranked: 'ranked-handle' }, records: [],
    };
    useAtlasStore.setState({ history: ['ground'], historyIndex: 0, groundPlaceId: 'ground' });
    const factory = controllerFactory(async () => ({ response: { ok: false, sessionRevision: 3, error: { message: 'filter failed' } }, receipt: { commandId: 'filter', revisionAfter: 3 } }));
    const actions = createNavigatorActions({ resolveAcquisition: vi.fn(), resolveSubjectObservation: vi.fn(), resolveAccountNotes: (intent) => resolveAccountNotes(intent, factory) });

    await actions.openAccountNotes('ground', author);

    const snapshot = fields.ground.observationSnapshots.at(-1)!;
    expect(snapshot.target).toEqual({ type: 'facet', id: `account-notes:${author}` });
    expect(snapshot.sourceHandleId).toBe('rows-handle');
  });

  it('selects and observes exact note evidence through the disclosed bounded local recipe', async () => {
    fields.ground = place('ground', 'ground-handle');
    fields.ground.role = 'ground';
    useAtlasStore.setState({ history: ['ground'], historyIndex: 0, groundPlaceId: 'ground' });
    const commands: Record<string, unknown>[] = [];
    const factory = controllerFactory(async (command) => {
      commands.push(command);
      const input = typeof command.input === 'string' ? command.input : '';
      let result: Record<string, unknown> = { handle: { count: 1, revision: 4 } };
      if (command.command === 'inspect') result = {
        resident: true, resolved: true, resolutionSource: 'memory',
        evidence: { event: { content: 'locally observed canonical excerpt', tags: [['p', author]] }, observationCount: 1 },
      };
      if (command.command === 'show' && input.includes('note-facts')) result = {
        preview: [{ values: { 'event.role': 'root', observedRelays: ['wss://relay.test'] } }], context: { cardinality: { returnedCount: 1 } },
      };
      else if (command.command === 'show') result = { preview: [], count: 0, context: { cardinality: { returnedCount: 0 } } };
      return { response: { ok: true, sessionRevision: 4, result }, receipt: { commandId: String(command.command), revisionAfter: 4 } };
    });
    const actions = createNavigatorActions({
      resolveAcquisition: (intent, onCommand) => resolveAcquisition(intent, factory, onCommand),
      resolveSubjectObservation: (intent) => resolveSubjectObservation(intent, factory),
    });

    actions.selectNote('ground', 'event');
    await vi.waitFor(() => expect(fields.ground.observationSnapshots.at(-1)?.facts.status).toBe('available'));

    expect(fields.ground.selected).toEqual({ type: 'note', id: 'event' });
    expect(notes.event.content).toBe('locally observed canonical excerpt');
    expect(fields.ground.observationSnapshots.at(-1)?.exchanges).toHaveLength(11);
    expect(commands.map((command) => command.command)).toEqual([
      'filter', 'move', 'relate', 'move', 'move', 'move', 'inspect', 'show', 'show', 'show', 'show',
    ]);
    expect(JSON.stringify(commands)).not.toContain('relays');
  });

  it('keeps exact selection when bounded local observation fails and retains disclosed exchanges', async () => {
    fields.ground = place('ground', 'ground-handle');
    fields.ground.role = 'ground';
    useAtlasStore.setState({ history: ['ground'], historyIndex: 0, groundPlaceId: 'ground' });
    const commands: Record<string, unknown>[] = [];
    const factory = controllerFactory(async (command) => {
      commands.push(command);
      return { response: { ok: false, sessionRevision: 3, error: { message: 'local observation failed' } }, receipt: { commandId: 'failed', revisionAfter: 3 } };
    });
    const actions = createNavigatorActions({
      resolveAcquisition: (intent, onCommand) => resolveAcquisition(intent, factory, onCommand),
      resolveSubjectObservation: (intent) => resolveSubjectObservation(intent, factory),
    });

    actions.selectNote('ground', 'event');
    await vi.waitFor(() => expect(fields.ground.observationSnapshots.at(-1)?.facts.status).toBe('failure'));

    expect(fields.ground.selected).toEqual({ type: 'note', id: 'event' });
    expect(fields.ground.handleId).toBe('ground-handle');
    expect(fields.ground.observationSnapshots.at(-1)?.exchanges).toHaveLength(1);
    expect(JSON.stringify(commands)).not.toContain('relays');
  });

  it('keeps keyed lifecycle state while preventing tracer and legacy command recipes from interleaving', async () => {
    fields.ground = place('ground', 'ground-handle'); fields.ground.role = 'ground';
    useAtlasStore.setState({ history: ['ground'], historyIndex: 0, groundPlaceId: 'ground' });
    const resolveAcquisitionSpy = vi.fn();
    const resolveSubjectSpy = vi.fn();
    const actions = createNavigatorActions({ resolveAcquisition: resolveAcquisitionSpy, resolveSubjectObservation: resolveSubjectSpy });

    useLiveStore.setState({ phase: { type: 'working', stage: 'authors', command: { command: 'move' } } });
    actions.selectNote('ground', 'event');
    expect(fields.ground.selected).toEqual({ type: 'note', id: 'event' });
    expect(fields.ground.observationSnapshots.at(-1)?.facts).toMatchObject({ status: 'failure' });
    expect(resolveSubjectSpy).not.toHaveBeenCalled();

    useLiveStore.setState({ phase: { type: 'idle' } });
    useAtlasStore.getState().commitOperationStarted('observe:other', { status: 'working', stage: 'note' });
    await actions.acquireGround();
    expect(resolveAcquisitionSpy).not.toHaveBeenCalled();
    await actions.deriveAccountFacet('ground');
    expect(fields.ground.accountFacet).toBeUndefined();
  });

  it('settles keyed observation lifecycle even when its branch is removed before resolution', async () => {
    fields.ground = place('ground', 'ground-handle'); fields.ground.role = 'ground';
    fields.branch = place('branch', 'branch-handle');
    useAtlasStore.setState({ history: ['ground', 'branch'], historyIndex: 1, groundPlaceId: 'ground' });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const actions = createNavigatorActions({
      resolveAcquisition: vi.fn(),
      resolveSubjectObservation: async (intent) => {
        await gate;
        return {
          kind: 'note-observation', placeId: intent.place.id, subjectId: intent.subject.id,
          observation: { status: 'available' }, exchanges: [], notePatch: {}, referencedAccounts: [],
          activity: { label: 'observed', command: '[]', outcome: 'local' },
        };
      },
    });

    actions.selectNote('branch', 'event');
    expect(Object.values(useAtlasStore.getState().navigatorOperations).some((operation) => operation.status === 'working')).toBe(true);
    useAtlasStore.getState().removePlace('branch');
    release();
    await vi.waitFor(() => expect(Object.values(useAtlasStore.getState().navigatorOperations).some((operation) => operation.status === 'working')).toBe(false));
    expect(fields.branch).toBeUndefined();
  });

  it('uses command-free navigation and restores per-place presentation and research state', () => {
    fields.ground = place('ground', 'ground-handle'); fields.ground.role = 'ground';
    fields.branch = place('branch', 'branch-handle');
    useAtlasStore.setState({ history: ['ground', 'branch'], historyIndex: 1, groundPlaceId: 'ground' });
    fields.ground.projection = 'gallery'; fields.ground.localConstraints.text = 'ground-only';
    fields.ground.selected = { type: 'note', id: 'event' }; fields.ground.localPageOffset = 9;
    fields.ground.mediaLoads = { event: { 'https://media.example/a.jpg': 'loaded' } };
    fields.ground.observationSnapshots.push({ id: 'retained', target: { type: 'note', id: 'event' }, sourceHandleId: 'ground-handle', observedRevision: 4, locality: 'local', exchanges: [], facts: { status: 'available' } });
    const resolveAcquisitionSpy = vi.fn();
    const resolveSubjectSpy = vi.fn();
    const actions = createNavigatorActions({ resolveAcquisition: resolveAcquisitionSpy, resolveSubjectObservation: resolveSubjectSpy });

    actions.navigateBack();

    expect(currentPlaceId(useAtlasStore.getState())).toBe('ground');
    expect(fields.ground.projection).toBe('gallery');
    expect(fields.ground.localConstraints.text).toBe('ground-only');
    expect(fields.ground.localPageOffset).toBe(9);
    expect(fields.ground.mediaLoads?.event['https://media.example/a.jpg']).toBe('loaded');
    expect(fields.ground.observationSnapshots.at(-1)?.id).toBe('retained');
    expect(resolveAcquisitionSpy).not.toHaveBeenCalled();
    expect(resolveSubjectSpy).not.toHaveBeenCalled();
  });

  it('captures only minimal current-place and single-fallback facts for account observation', async () => {
    fields.ground = place('ground', 'ground-handle'); fields.ground.role = 'ground';
    fields.unrelated = place('unrelated', 'unrelated-handle', 'unrelated-note');
    notes['unrelated-note'] = { ...notes.event, id: 'unrelated-note', content: 'must not enter intent' };
    fields.unrelated.observationSnapshots = Array.from({ length: 50 }, (_, index) => ({
      id: `unrelated-${index}`, target: { type: 'note' as const, id: 'unrelated-note' }, sourceHandleId: 'unrelated-handle',
      observedRevision: index, locality: 'local' as const, exchanges: [], facts: { large: 'x'.repeat(100) },
    }));
    useAtlasStore.setState({ history: ['ground'], historyIndex: 0, groundPlaceId: 'ground' });
    let captured: SubjectObservationIntent | undefined;
    const actions = createNavigatorActions({
      resolveAcquisition: vi.fn(),
      resolveSubjectObservation: async (intent) => {
        captured = intent;
        return {
          kind: 'account-observation', placeId: intent.place.id, subjectId: intent.subject.id,
          status: 'unresolved', localResolution: { resolved: false }, exchanges: [],
        };
      },
    });

    actions.selectAccount('ground', author);
    await vi.waitFor(() => expect(captured).toBeDefined());

    expect(Object.keys(captured!)).toEqual(['place', 'subject', 'fallbackSource']);
    expect(captured!.place).toEqual({ id: 'ground', handleId: 'ground-handle' });
    expect(captured!.fallbackSource).toEqual({ noteId: 'event', placeHandleId: 'ground-handle' });
    expect(JSON.stringify(captured)).not.toContain('unrelated');
    expect(JSON.stringify(captured)).not.toContain('observationSnapshots');
  });

  it('resolves exact accounts from retained notes using local commands only', async () => {
    fields.ground = place('ground', 'ground-handle');
    const commands: Record<string, unknown>[] = [];
    const factory = controllerFactory(async (command) => {
      commands.push(command);
      const result = command.command === 'inspect'
        ? { resident: true, resolved: true, resolutionSource: 'memory' }
        : { handle: { count: 1, revision: 4 } };
      return { response: { ok: true, sessionRevision: 4, result }, receipt: { commandId: String(command.command), revisionAfter: 4 } };
    });

    const result = await resolveSubjectObservation({
      place: { id: fields.ground.id, handleId: fields.ground.handleId },
      subject: { type: 'account', id: author, account: structuredClone(accounts[author]) },
      fallbackSource: { noteId: 'event', placeHandleId: 'ground-handle' },
    }, factory);

    expect(result).toMatchObject({ kind: 'account-observation', status: 'available', subjectId: author });
    expect(commands.map((command) => command.command)).toEqual(['filter', 'move', 'inspect']);
    expect(JSON.stringify(commands)).not.toContain('relays');
  });
});
