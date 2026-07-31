import { create } from 'zustand';
import {
  accounts, fields, notes,
  type AccountFacetRecord, type AccountResearchState, type Field, type Note,
  type NoteObservation, type ObservationExchange, type ObservationSnapshot,
} from './data';
import { liveController } from './live-session';
import type {
  AcquiredPhase, AuthoredActionDraft, ExternalActionDraft, LivePhase, QueryDraft, RelaySource,
} from './live-types';
import { mediaFromText } from './media';
import { currentPlaceId, useAtlasStore } from './store';

const DEFAULT_RELAYS: RelaySource[] = [
  { url: 'wss://nos.lol', label: 'nos.lol', selected: true },
  { url: 'wss://relay.primal.net', label: 'Primal', selected: false },
  { url: 'wss://relay.snort.social', label: 'Snort', selected: false },
  { url: 'wss://search.nos.today', label: 'Searchnos · NIP-50', selected: false },
];

export const DEFAULT_DRAFT: QueryDraft = {
  limit: 20,
  hours: 24,
  search: '',
  eventId: '',
  author: '',
  hashtag: '',
  excludeContentWarnings: true,
  includeFilterLimit: true,
  timeoutMs: 10000,
  observationLimit: 100,
  distinctEventLimit: 100,
  concurrency: 4,
};

type LiveStore = {
  panelOpen: boolean;
  relays: RelaySource[];
  relaySearch: string;
  customRelay: string;
  customRelayError: string | null;
  draft: QueryDraft;
  phase: LivePhase;
  latestExternal: { label: string; status: string; warningCount: number };
  setPanelOpen: (open: boolean) => void;
  setRelaySearch: (value: string) => void;
  setCustomRelay: (value: string) => void;
  addRelay: () => void;
  removeRelay: (url: string) => void;
  toggleRelay: (url: string) => void;
  setDraft: (draft: Partial<QueryDraft>) => void;
  acquire: () => Promise<void>;
  showMore: () => Promise<void>;
  openAccountProjection: (placeId: string) => Promise<void>;
  deriveAccountFacet: (placeId: string) => Promise<void>;
  openAccountNotes: (placeId: string, publicKey: string) => Promise<void>;
  prepareAccountResearch: (placeId: string, publicKey: string) => void;
  observeNote: (noteId: string, placeId: string) => Promise<void>;
  observeAccount: (accountId: string, placeId: string) => Promise<void>;
  updateProfileDraft: (placeId: string, accountId: string, patch: Partial<ExternalActionDraft>) => void;
  updateAuthoredDraft: (placeId: string, accountId: string, patch: Partial<AuthoredActionDraft>) => void;
  requestProfile: (placeId: string, accountId: string) => Promise<void>;
  requestAuthoredNotes: (placeId: string, accountId: string) => Promise<void>;
  resetPhase: () => void;
};

type Executed = {
  result: Record<string, unknown>;
  response: Record<string, unknown>;
  receipt: Record<string, unknown>;
};

class CommandFailure extends Error {
  executed: Executed;
  constructor(message: string, executed: Executed) {
    super(message);
    this.executed = executed;
  }
}

let nextHandle = 0;
let nextSnapshot = 0;

export const useLiveStore = create<LiveStore>((set, get) => ({
  panelOpen: true,
  relays: DEFAULT_RELAYS,
  relaySearch: '',
  customRelay: '',
  customRelayError: null,
  draft: DEFAULT_DRAFT,
  phase: { type: 'idle' },
  latestExternal: { label: 'No external request yet', status: 'IDLE', warningCount: 0 },
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setRelaySearch: (relaySearch) => set({ relaySearch }),
  setCustomRelay: (customRelay) => set({ customRelay, customRelayError: null }),
  addRelay: () => {
    const value = get().customRelay.trim();
    let url;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'wss:') throw new Error('Relay URL must use wss://.');
      parsed.hash = '';
      parsed.search = '';
      url = parsed.href.replace(/\/$/u, '');
    } catch (error) {
      set({ customRelayError: error instanceof Error ? error.message : 'Enter a valid wss:// relay URL.' });
      return;
    }
    if (get().relays.some((relay) => relay.url === url)) {
      set({ customRelayError: 'That relay is already listed.' });
      return;
    }
    set((state) => ({
      relays: [...state.relays, { url, label: new URL(url).hostname, selected: true, custom: true }],
      customRelay: '', customRelayError: null,
    }));
  },
  removeRelay: (url) => set((state) => ({ relays: state.relays.filter((relay) => !(relay.custom && relay.url === url)) })),
  toggleRelay: (url) => set((state) => ({ relays: state.relays.map((relay) => relay.url === url ? { ...relay, selected: !relay.selected } : relay) })),
  setDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),

  acquire: async () => {
    if (get().phase.type === 'working') return;
    const relays = selectedRelayUrls(get().relays);
    const draft = cleanDraft(get().draft);
    const validation = validateDraft(draft) ?? validateSearchRelayCount(draft, relays);
    if (!relays.length || validation) {
      set({ phase: { type: 'failure', stage: 'acquire', message: validation ?? 'Select at least one relay.' } });
      return;
    }
    const handleId = uniqueHandle('atlas-ground');
    const command = {
      command: 'acquire',
      parameters: {
        relays, filter: queryFilter(draft), timeoutMs: draft.timeoutMs,
        observationLimit: draft.observationLimit,
        distinctEventLimit: draft.distinctEventLimit,
        concurrency: draft.concurrency,
        excludeContentWarnings: draft.excludeContentWarnings,
      },
      resultId: handleId,
    };
    set({ phase: { type: 'working', stage: 'acquire', command }, draft });
    let executed: Executed;
    try {
      executed = await execute(command);
    } catch (error) {
      set({
        phase: { type: 'failure', stage: 'acquire', message: errorMessage(error), command }, panelOpen: true,
        latestExternal: { label: 'Ground acquisition', status: 'FAILURE', warningCount: 0 },
      });
      return;
    }
    const handle = object(executed.result.handle);
    const acquisitionExternal = object(executed.result.external);
    set({ latestExternal: {
      label: 'Ground acquisition', status: string(acquisitionExternal.status).toUpperCase() || 'BOUNDED',
      warningCount: Array.isArray(executed.response.warnings) ? executed.response.warnings.length : 0,
    } });
    const acquired: AcquiredPhase = {
      type: 'acquired', sourceKind: 'query', handleId,
      installRevision: number(handle.revision) || number(executed.response.sessionRevision),
      count: number(handle.count), command, receipt: executed.receipt,
      coverage: executed.result, relays, draft,
    };
    const show = showCommand(handleId, 0, acquired.count);
    let shown: Executed | undefined;
    let observationFailure: ObservationExchange | undefined;
    try {
      shown = await execute(show);
    } catch (error) {
      observationFailure = await failureExchange(show, error);
    }
    const field = installPlace({
      acquired, shown, observationFailure, role: 'ground',
      reason: useAtlasStore.getState().groundPlaceId
        ? 'Explicitly replaced Ground with a new bounded acquisition.'
        : 'Established Ground from the explicit initial acquisition.',
    });
    useAtlasStore.getState().installGround(field.id);
    useAtlasStore.getState().recordActivity(
      'Installed explicit acquisition as Ground', JSON.stringify([command, show]),
      observationFailure
        ? `${acquired.count} event subjects retained · Ground installed · first preview unavailable`
        : `${acquired.count} event subjects · handle ${handleId} installed once at revision ${acquired.installRevision}`,
    );
    set(observationFailure
      ? { phase: { type: 'failure', stage: 'page', message: 'Ground was installed, but its first bounded preview is unavailable.', command: show }, panelOpen: false }
      : { phase: { type: 'idle' }, panelOpen: false });
  },

  showMore: async () => {
    const placeId = currentPlaceId(useAtlasStore.getState());
    const place = fields[placeId];
    const active = place?.runtime;
    if (!place || !active || active.nextOffset >= active.total || get().phase.type !== 'idle') return;
    const command = showCommand(active.pageHandleId, active.nextOffset, active.total - active.nextOffset);
    set({ phase: { type: 'working', stage: 'page', command } });
    try {
      const shown = await execute(command);
      const incoming = materializeNotes(objectArray(shown.result.preview));
      const newIds = incoming.filter((id) => !place.noteIds.includes(id));
      place.noteIds = [...place.noteIds, ...newIds];
      active.nextOffset = number(shown.result.nextOffset) || number(shown.result.offset) + incoming.length;
      active.handleAddedCount += newIds.length;
      place.localPageOffset = active.nextOffset;
      addSnapshot(place, {
        target: { type: 'place', id: place.id }, sourceHandleId: place.handleId,
        observedRevision: number(shown.response.sessionRevision), locality: 'local',
        exchanges: [exchange(command, shown)], facts: shown.result,
      });
      useAtlasStore.getState().recordActivity(
        'Loaded more from the current place handle', JSON.stringify(command),
        `${newIds.length} additional notes displayed · ${active.nextOffset} of ${active.total} observed locally`,
      );
      useAtlasStore.getState().fieldUpdated();
      set({ phase: { type: 'idle' } });
    } catch (error) {
      const failed = await failureExchange(command, error);
      addSnapshot(place, {
        target: { type: 'place', id: place.id }, sourceHandleId: place.handleId,
        observedRevision: lastExchangeRevision([failed], place.installRevision), locality: 'local',
        exchanges: [failed], facts: { status: 'failure', error: errorMessage(error) },
      });
      useAtlasStore.getState().fieldUpdated();
      set({ phase: { type: 'failure', stage: 'page', message: errorMessage(error), command } });
    }
  },

  openAccountProjection: async (placeId) => {
    const place = fields[placeId];
    if (!place || place.role === 'start' || get().phase.type === 'working') return;
    if (place.accountProjection?.status === 'available') {
      place.projection = 'accounts';
      useAtlasStore.getState().fieldUpdated();
      return;
    }
    if (place.accountProjection?.status === 'loading') return;
    const retained = place.accountProjection?.receipt ? place.accountProjection : undefined;
    const handleId = retained?.handleId ?? uniqueHandle('atlas-place-accounts');
    const move = retained?.command ?? { command: 'move', input: place.handleId, parameters: { to: 'authors', limit: 1000 }, resultId: handleId };
    const commands: Record<string, unknown>[] = [];
    const outcomes: Executed[] = [];
    place.accountProjection = {
      status: 'loading', handleId, command: move, accountIds: retained?.accountIds ?? [],
      ...(retained?.installRevision === undefined ? {} : { installRevision: retained.installRevision }),
      ...(retained?.receipt ? { receipt: retained.receipt } : {}),
      ...(retained?.bounds ? { bounds: retained.bounds } : {}),
      ...(retained?.omissions ? { omissions: retained.omissions } : {}),
    };
    place.projection = 'accounts';
    set({ phase: { type: 'working', stage: 'projection', command: move } });
    useAtlasStore.getState().fieldUpdated();
    try {
      if (!retained) {
        commands.push(move);
        const moved = await execute(move); outcomes.push(moved);
        const handle = object(moved.result.handle);
        place.accountProjection = {
          ...place.accountProjection,
          installRevision: number(handle.revision) || number(moved.response.sessionRevision),
          receipt: moved.receipt,
        };
        useAtlasStore.getState().fieldUpdated();
      }
      const preview = { command: 'show', input: handleId, parameters: { mode: 'preview', previewLimit: 20, excerptLimit: 1000, sizeLimit: 50000 } };
      const summary = { command: 'show', input: handleId, parameters: { mode: 'summary', previewLimit: 1, excerptLimit: 1000, sizeLimit: 50000 } };
      commands.push(preview, summary);
      const shown = await execute(preview); outcomes.push(shown);
      const summarized = await execute(summary); outcomes.push(summarized);
      const accountIds = objectArray(shown.result.preview).map((row) => string(row.id) || string(object(row.subject).id)).filter(Boolean);
      for (const accountId of accountIds) accounts[accountId] ??= liveAccount(accountId);
      place.accountProjection = {
        status: 'available', handleId,
        installRevision: place.accountProjection.installRevision,
        command: move, receipt: place.accountProjection.receipt, accountIds,
        countUnit: string(object(summarized.result.summary).countUnit) || 'subjects',
        bounds: presentObject({ cardinality: object(summarized.result.context).cardinality, response: responseBounds(shown.result) }) ?? {},
        omissions: presentObject({ omitted: shown.result.omitted, omittedBefore: shown.result.omittedBefore, omittedAfter: shown.result.omittedAfter }) ?? {},
      };
      addSnapshot(place, {
        target: { type: 'place', id: `${place.id}:accounts` }, sourceHandleId: handleId,
        observedRevision: number(summarized.response.sessionRevision), locality: 'local',
        exchanges: outcomes.map((outcome, index) => exchange(commands[index], outcome)), facts: place.accountProjection as unknown as Record<string, unknown>,
      });
      useAtlasStore.getState().recordActivity(
        'Opened local account-list projection', JSON.stringify(commands),
        `${accountIds.length} displayed accounts · supporting handle ${handleId} · no relay contacted`,
      );
      set({ phase: { type: 'idle' } });
    } catch (error) {
      const failed = await failureExchange(commands[outcomes.length] ?? commands.at(-1) ?? move, error);
      const exchanges = [...outcomes.map((outcome, index) => exchange(commands[index], outcome)), failed];
      const previewOutcome = outcomes.find((outcome) => Array.isArray(outcome.result.preview));
      const accountIds = previewOutcome
        ? objectArray(previewOutcome.result.preview).map((row) => string(row.id) || string(object(row.subject).id)).filter(Boolean)
        : place.accountProjection.accountIds;
      for (const accountId of accountIds) accounts[accountId] ??= liveAccount(accountId);
      place.accountProjection = {
        ...place.accountProjection,
        status: 'failure', handleId, command: move, accountIds, error: errorMessage(error),
      };
      addSnapshot(place, {
        target: { type: 'place', id: `${place.id}:accounts` }, sourceHandleId: handleId,
        observedRevision: lastExchangeRevision(exchanges, place.accountProjection.installRevision ?? place.installRevision),
        locality: 'local', exchanges, facts: place.accountProjection as unknown as Record<string, unknown>,
      });
      set({ phase: { type: 'failure', stage: 'projection', message: errorMessage(error), command: commands.length ? commands : move } });
    }
    useAtlasStore.getState().fieldUpdated();
  },

  deriveAccountFacet: async (placeId) => {
    const place = fields[placeId];
    if (!place || place.role !== 'ground' || place.accountFacet?.status === 'loading') return;
    const rowsId = uniqueHandle('atlas-ground-rows');
    const aggregateId = uniqueHandle('atlas-account-facets');
    const rankedId = uniqueHandle('atlas-ranked-account-facets');
    const commands: Record<string, unknown>[] = [
      { command: 'relate', input: place.handleId, resultId: rowsId },
      {
        command: 'aggregate', input: rowsId,
        parameters: {
          by: [{ field: 'event.author', name: 'account' }],
          aggregations: [{ name: 'noteCount', operation: 'count' }],
          limit: 1000,
        }, resultId: aggregateId,
      },
      { command: 'sort', input: aggregateId, parameters: { by: [{ field: 'noteCount', direction: 'descending' }] }, resultId: rankedId },
      { command: 'show', input: aggregateId, parameters: { mode: 'summary', previewLimit: 1, excerptLimit: 1000, sizeLimit: 50000 } },
      { command: 'show', input: rankedId, parameters: { mode: 'preview', previewLimit: 20, excerptLimit: 1000, sizeLimit: 50000 } },
      { command: 'show', input: rankedId, parameters: { mode: 'summary', previewLimit: 1, excerptLimit: 1000, sizeLimit: 50000 } },
      { command: 'schema', input: rankedId, parameters: {} },
    ];
    place.accountFacet = {
      status: 'loading', sourcePlaceId: place.id, sourceHandleId: place.handleId,
      commands, handles: { rows: rowsId, aggregate: aggregateId, ranked: rankedId }, records: [],
    };
    useAtlasStore.getState().fieldUpdated();
    set({ phase: { type: 'working', stage: 'facet', command: commands } });
    const outcomes: Executed[] = [];
    try {
      for (const command of commands) outcomes.push(await execute(command));
      const aggregateSummary = outcomes[3].result;
      const rankedPreview = outcomes[4].result;
      const rankedSummary = outcomes[5].result;
      const schema = outcomes[6].result;
      const aggregateCardinality = object(object(aggregateSummary.context).cardinality);
      const rankedCardinality = object(object(rankedSummary.context).cardinality);
      const bounds = presentObject({ aggregate: aggregateCardinality, ranked: rankedCardinality, preview: responseBounds(rankedPreview) }) ?? {};
      const omissions = presentObject({
        omitted: rankedPreview.omitted,
        omittedBefore: rankedPreview.omittedBefore,
        omittedAfter: rankedPreview.omittedAfter,
        aggregateOmittedCount: aggregateCardinality.omittedCount,
        rankedOmittedCount: rankedCardinality.omittedCount,
      }) ?? {};
      const truncated = boolean(aggregateCardinality.truncated) || boolean(rankedCardinality.truncated)
        || number(aggregateCardinality.omittedCount) > 0 || number(rankedCardinality.omittedCount) > 0
        || number(rankedPreview.omitted) > 0;
      const structure = object(schema.structure);
      const fieldsWithLineage = Array.isArray(structure.fields) ? structure.fields : [];
      const lineage = { fields: fieldsWithLineage };
      const countUnit = string(object(rankedSummary.summary).countUnit) || 'rows';
      const handles = { rows: rowsId, aggregate: aggregateId, ranked: rankedId };
      const derivationCommands = commands.slice(0, 3);
      const records = objectArray(rankedPreview.preview).map((row) => object(row.values)).map((values) => ({
        account: string(values.account), noteCount: number(values.noteCount),
      })).filter((row) => row.account).map((row): AccountFacetRecord => {
        accounts[row.account] ??= liveAccount(row.account);
        return {
          ...row, sourcePlaceId: place.id, sourceHandleId: place.handleId,
          derivationHandles: handles, derivationCommands,
          countUnit, lineage, bounds, truncated, omissions,
        };
      });
      place.accountFacet = {
        status: 'available', sourcePlaceId: place.id, sourceHandleId: place.handleId,
        commands, handles, records, countUnit, bounds, truncated, omissions,
      };
      addSnapshot(place, {
        target: { type: 'facet', id: 'account-frequency' }, sourceHandleId: place.handleId,
        observedRevision: number(outcomes.at(-1)?.response.sessionRevision), locality: 'local',
        exchanges: outcomes.map((outcome, index) => exchange(commands[index], outcome)),
        facts: { records, countUnit, bounds, truncated, omissions, lineage },
      });
      useAtlasStore.getState().recordActivity(
        'Derived bounded account frequency locally', JSON.stringify(commands),
        `${records.length} account facet rows · count unit ${countUnit} · no relay contacted`,
      );
      useAtlasStore.getState().fieldUpdated();
      set({ phase: { type: 'idle' } });
    } catch (error) {
      place.accountFacet = { ...place.accountFacet, status: 'failure', error: errorMessage(error) };
      const failed = await failureExchange(commands[outcomes.length] ?? commands.at(-1)!, error);
      addSnapshot(place, {
        target: { type: 'facet', id: 'account-frequency' }, sourceHandleId: place.handleId,
        observedRevision: number(failed.response.sessionRevision), locality: 'local',
        exchanges: [...outcomes.map((outcome, index) => exchange(commands[index], outcome)), failed],
        facts: { status: 'failure', error: errorMessage(error) },
      });
      useAtlasStore.getState().fieldUpdated();
      set({ phase: { type: 'failure', stage: 'facet', message: errorMessage(error), command: commands } });
    }
  },

  openAccountNotes: async (placeId, publicKey) => {
    const ground = fields[placeId];
    const facets = ground?.accountFacet;
    if (!ground || facets?.status !== 'available' || !facets.handles || get().phase.type === 'working') return;
    const filteredId = uniqueHandle('atlas-account-note-rows');
    const eventsId = uniqueHandle('atlas-account-notes-here');
    const commands: Record<string, unknown>[] = [
      {
        command: 'filter', input: facets.handles.rows,
        parameters: { where: { field: 'event.author', equals: publicKey }, limit: 1000 }, resultId: filteredId,
      },
      {
        command: 'extract', input: filteredId,
        parameters: { field: 'subject.id', subjectType: 'event', limit: 1000 }, resultId: eventsId,
      },
    ];
    const outcomes: Executed[] = [];
    set({ phase: { type: 'working', stage: 'branch', command: commands } });
    let filtered: Executed;
    let extracted: Executed;
    try {
      filtered = await execute(commands[0]); outcomes.push(filtered);
      extracted = await execute(commands[1]); outcomes.push(extracted);
    } catch (error) {
      const failed = await failureExchange(commands[outcomes.length] ?? commands.at(-1)!, error);
      const exchanges = [...outcomes.map((outcome, index) => exchange(commands[index], outcome)), failed];
      addSnapshot(ground, {
        target: { type: 'facet', id: `account-notes:${publicKey}` }, sourceHandleId: facets.handles.rows,
        observedRevision: lastExchangeRevision(exchanges, ground.installRevision), locality: 'local',
        exchanges, facts: { status: 'failure', error: errorMessage(error) },
      });
      useAtlasStore.getState().fieldUpdated();
      set({ phase: { type: 'failure', stage: 'branch', message: errorMessage(error), command: commands } });
      return;
    }
    const handle = object(extracted.result.handle);
    const show = showCommand(eventsId, 0, number(handle.count));
    commands.push(show);
    let shown: Executed | undefined;
    let observationFailure: ObservationExchange | undefined;
    try {
      shown = await execute(show); outcomes.push(shown);
    } catch (error) {
      observationFailure = await failureExchange(show, error);
    }
    const acquired: AcquiredPhase = {
      type: 'acquired', sourceKind: 'query', handleId: eventsId,
      installRevision: number(handle.revision) || number(extracted.response.sessionRevision),
      count: number(handle.count), command: commands[1], receipt: extracted.receipt,
      coverage: null, relays: ground.runtime?.relays ?? [],
      draft: { ...DEFAULT_DRAFT, author: publicKey, limit: Math.min(100, Math.max(5, number(handle.count) || 20)) },
    };
    const field = installPlace({
      acquired, shown, observationFailure, role: 'branch',
      reason: `Notes in Ground authored by ${shortKey(publicKey)}.`,
      label: `${accounts[publicKey]?.name ?? shortKey(publicKey)} · notes here`,
      originCommand: commands.slice(0, 2),
      originReceipt: [filtered.receipt, extracted.receipt],
      localSource: ground,
    });
    useAtlasStore.getState().installBranch(field.id);
    useAtlasStore.getState().recordActivity(
      'Opened local account-note branch', JSON.stringify(commands),
      observationFailure
        ? `Branch handle installed · first preview unavailable · Ground unchanged · no relay contacted`
        : `${field.noteIds.length} event subjects · Ground unchanged · no relay contacted`,
    );
    set(observationFailure
      ? { phase: { type: 'failure', stage: 'branch', message: 'Branch installed, but its first bounded preview is unavailable.', command: show } }
      : { phase: { type: 'idle' } });
  },

  prepareAccountResearch: (placeId, publicKey) => {
    const place = fields[placeId];
    if (!place?.accountFacet?.records.some((record) => record.account === publicKey)) return;
    place.selectedFacet = publicKey;
    const fresh = freshAccountResearchDraft(publicKey);
    set({ draft: fresh, panelOpen: true, phase: { type: 'idle' } });
    useAtlasStore.getState().recordActivity(
      'Prepared independent relay acquisition draft', JSON.stringify({
        command: 'acquire', parameters: {
          relays: selectedRelayUrls(get().relays), filter: queryFilter(fresh),
          timeoutMs: fresh.timeoutMs, observationLimit: fresh.observationLimit,
          distinctEventLimit: fresh.distinctEventLimit, concurrency: fresh.concurrency,
          excludeContentWarnings: fresh.excludeContentWarnings,
        },
      }),
      'Draft only · no relay contacted · older draft constraints discarded',
    );
    useAtlasStore.getState().fieldUpdated();
  },

  observeNote: async (noteId, placeId) => {
    const place = fields[placeId];
    const note = notes[noteId];
    if (!place || !note || existingSnapshot(place, 'note', noteId, ['loading', 'available', 'unresolved'])) return;
    addOrReplaceSubjectSnapshot(place, 'note', noteId, { status: 'loading' });
    useAtlasStore.getState().fieldUpdated();
    const handles = {
      event: uniqueHandle('atlas-note'), author: uniqueHandle('atlas-note-author'), facts: uniqueHandle('atlas-note-facts'),
      events: uniqueHandle('atlas-note-events'), accounts: uniqueHandle('atlas-note-accounts'), addresses: uniqueHandle('atlas-note-addresses'),
    };
    const commands: Record<string, unknown>[] = [
      { command: 'filter', input: place.handleId, parameters: { where: { field: 'subject.id', equals: noteId }, limit: 1 }, resultId: handles.event },
      { command: 'move', input: handles.event, parameters: { to: 'authors', limit: 1 }, resultId: handles.author },
      { command: 'relate', input: handles.event, parameters: {}, resultId: handles.facts },
      { command: 'move', input: handles.event, parameters: { to: 'referencedEvents', limit: 20 }, resultId: handles.events },
      { command: 'move', input: handles.event, parameters: { to: 'referencedAccounts', limit: 20 }, resultId: handles.accounts },
      { command: 'move', input: handles.event, parameters: { to: 'referencedAddresses', limit: 20 }, resultId: handles.addresses },
      inspectCommand({ type: 'event', id: noteId }),
      showDetailsCommand(handles.facts), showPreviewCommand(handles.events), showPreviewCommand(handles.accounts), showPreviewCommand(handles.addresses),
    ];
    const outcomes: Executed[] = [];
    try {
      for (const command of commands) outcomes.push(await execute(command));
      const inspected = outcomes[6].result;
      const facts = outcomes[7].result;
      const eventRefs = outcomes[8].result;
      const accountRefs = outcomes[9].result;
      const addressRefs = outcomes[10].result;
      const evidence = object(inspected.evidence);
      const event = object(evidence.event);
      const values = object(objectArray(facts.preview)[0]?.values);
      const content = typeof event.content === 'string' ? event.content : undefined;
      const resolved = boolean(inspected.resolved);
      const observation: NoteObservation = {
        status: resolved ? 'available' : 'unresolved', eventHandleId: handles.event,
        authorHandleId: number(object(outcomes[1].result.handle).count) ? handles.author : undefined,
        resolution: { resident: boolean(inspected.resident), resolved, source: string(inspected.resolutionSource) || undefined },
        content, contentState: !resolved || content === undefined ? 'unavailable' : content.length < 1000 ? 'returned' : 'boundary-sized',
        tags: Array.isArray(event.tags) ? event.tags.filter(Array.isArray) as unknown[][] : undefined,
        omittedTags: number(event.omittedTags), role: string(values['event.role']) || undefined,
        conversationRole: string(values['event.conversationRole']) || undefined,
        attachments: Array.isArray(values['event.attachments']) ? values['event.attachments'].map(object) : undefined,
        attachmentsOmitted: number(values['event.attachmentsOmitted']), observedRelays: stringArray(values.observedRelays),
        referencedEvents: subjectIds(eventRefs), referencedAccounts: subjectIds(accountRefs), referencedAddresses: subjectIds(addressRefs),
        relationshipsOmitted: number(eventRefs.omitted) + number(accountRefs.omitted) + number(addressRefs.omitted),
        provenance: presentObject({ summary: inspected.provenance, evidence: evidence.provenance, observationCount: evidence.observationCount, omittedObservationCount: evidence.omittedObservationCount }),
        bounds: presentObject({ relation: object(facts.context).cardinality, relationships: { events: responseBounds(eventRefs), accounts: responseBounds(accountRefs), addresses: responseBounds(addressRefs) }, corpus: inspected.corpus, freshness: inspected.freshness }),
      };
      addOrReplaceSubjectSnapshot(place, 'note', noteId, observation as unknown as Record<string, unknown>, commands.map((command, index) => exchange(command, outcomes[index])), 'local');
      if (observation.authorHandleId) {
        const state = ensureAccountResearch(place, note.authorId);
        state.engineHandleId = observation.authorHandleId;
        state.localStatus = 'available';
        state.localResolution = observation.resolution;
      }
      useAtlasStore.getState().recordActivity(
        'Selected and observed note locally', JSON.stringify(commands),
        `${resolved ? 'Resident event evidence observed' : 'Event evidence unresolved'} · no relay contacted`,
      );
    } catch (error) {
      const failed = await failureExchange(commands[outcomes.length] ?? commands.at(-1)!, error);
      addOrReplaceSubjectSnapshot(place, 'note', noteId, { status: 'failure', error: errorMessage(error) }, [
        ...outcomes.map((outcome, index) => exchange(commands[index], outcome)), failed,
      ]);
    }
    useAtlasStore.getState().fieldUpdated();
  },

  observeAccount: async (accountId, placeId) => {
    const place = fields[placeId];
    const account = accounts[accountId];
    if (!place || !account) return;
    const state = ensureAccountResearch(place, accountId);
    if (state.engineHandleId || state.localStatus === 'loading') return;
    state.localStatus = 'loading';
    addOrReplaceSubjectSnapshot(place, 'account', accountId, { status: 'loading' });
    useAtlasStore.getState().fieldUpdated();
    const authorHandleId = uniqueHandle('atlas-account');
    let commands: Record<string, unknown>[];
    if (place.accountProjection?.status === 'available' && place.accountProjection.accountIds.includes(accountId)) {
      commands = [
        { command: 'filter', input: place.accountProjection.handleId, parameters: { where: { field: 'subject.id', equals: accountId }, limit: 1 }, resultId: authorHandleId },
        inspectCommand({ type: 'account', id: accountId }),
      ];
    } else if (place.accountFacet?.status === 'available' && place.accountFacet.handles
        && place.accountFacet.records.some((record) => record.account === accountId)) {
      const accountRowsId = uniqueHandle('atlas-account-source-rows');
      commands = [
        { command: 'filter', input: place.accountFacet.handles.rows, parameters: { where: { field: 'event.author', equals: accountId }, limit: 1000 }, resultId: accountRowsId },
        { command: 'extract', input: accountRowsId, parameters: { field: 'event.author', subjectType: 'account', limit: 1 }, resultId: authorHandleId },
        inspectCommand({ type: 'account', id: accountId }),
      ];
    } else {
      const sourceNoteId = place.noteIds.find((id) => notes[id]?.authorId === accountId)
        ?? Object.values(fields).flatMap((candidate) => candidate.noteIds).find((id) => notes[id]?.authorId === accountId);
      const sourcePlace = sourceNoteId && place.noteIds.includes(sourceNoteId)
        ? place : Object.values(fields).find((candidate) => sourceNoteId && candidate.noteIds.includes(sourceNoteId));
      if (!sourcePlace || !sourceNoteId) {
        state.localStatus = 'unresolved';
        state.localResolution = { resolved: false, source: 'No retained event or facet row for this account.' };
        addOrReplaceSubjectSnapshot(place, 'account', accountId, { status: 'unresolved', resolution: state.localResolution });
        useAtlasStore.getState().fieldUpdated();
        return;
      }
      const noteHandleId = uniqueHandle('atlas-account-source');
      commands = [
        { command: 'filter', input: sourcePlace.handleId, parameters: { where: { field: 'subject.id', equals: sourceNoteId }, limit: 1 }, resultId: noteHandleId },
        { command: 'move', input: noteHandleId, parameters: { to: 'authors', limit: 1 }, resultId: authorHandleId },
        inspectCommand({ type: 'account', id: accountId }),
      ];
    }
    const outcomes: Executed[] = [];
    try {
      for (const command of commands) outcomes.push(await execute(command));
      const handleOutcome = place.accountProjection?.status === 'available' && place.accountProjection.accountIds.includes(accountId)
        ? outcomes[0] : outcomes[1];
      const inspection = outcomes.at(-1)!;
      if (number(object(handleOutcome.result.handle).count) < 1) {
        state.localStatus = 'unresolved';
        state.localResolution = { resolved: false, source: 'operational place handle' };
      } else {
        state.engineHandleId = authorHandleId;
        state.localStatus = 'available';
        state.localResolution = {
          resident: boolean(inspection.result.resident), resolved: boolean(inspection.result.resolved),
          source: string(inspection.result.resolutionSource) || undefined,
        };
      }
      addOrReplaceSubjectSnapshot(place, 'account', accountId, {
        status: state.localStatus, resolution: state.localResolution, engineHandleId: state.engineHandleId,
      }, commands.map((command, index) => exchange(command, outcomes[index])), 'local');
      useAtlasStore.getState().recordActivity(
        'Selected and observed account locally', JSON.stringify(commands),
        `${state.engineHandleId ? 'Account handle retained' : 'Account unresolved'} · no relay contacted`,
      );
    } catch (error) {
      state.localStatus = 'failure'; state.localError = errorMessage(error);
      const failed = await failureExchange(commands[outcomes.length] ?? commands.at(-1)!, error);
      addOrReplaceSubjectSnapshot(place, 'account', accountId, { status: 'failure', error: state.localError }, [
        ...outcomes.map((outcome, index) => exchange(commands[index], outcome)), failed,
      ]);
    }
    useAtlasStore.getState().fieldUpdated();
  },

  updateProfileDraft: (placeId, accountId, patch) => {
    const place = fields[placeId];
    if (!place) return;
    const state = ensureAccountResearch(place, accountId);
    state.profileDraft = sanitizeExternalDraft({ ...state.profileDraft, ...patch });
    useAtlasStore.getState().fieldUpdated();
  },

  updateAuthoredDraft: (placeId, accountId, patch) => {
    const place = fields[placeId];
    if (!place) return;
    const state = ensureAccountResearch(place, accountId);
    state.authoredDraft = { ...sanitizeExternalDraft({ ...state.authoredDraft, ...patch }), eventLimit: boundedInteger(patch.eventLimit ?? state.authoredDraft.eventLimit, 1, 100) };
    useAtlasStore.getState().fieldUpdated();
  },

  requestProfile: async (placeId, accountId) => {
    const place = fields[placeId];
    const state = place && ensureAccountResearch(place, accountId);
    if (!place || !state?.engineHandleId || state.profile?.status === 'loading') return;
    const draft = state.profileDraft;
    const relayError = validateRelayDraft(draft.relays);
    if (relayError) {
      state.profile = { status: 'failure', relays: draft.relays, error: relayError };
      useAtlasStore.getState().fieldUpdated(); return;
    }
    const handleId = uniqueHandle('atlas-profile-events');
    const command = {
      command: 'hydrate', input: state.engineHandleId,
      parameters: { ...draft, kinds: [0] }, resultId: handleId,
    };
    const inspect = inspectCommand({ type: 'account', id: accountId });
    const commands = [command, inspect];
    const outcomes: Executed[] = [];
    state.profile = { status: 'loading', relays: draft.relays, command, supportingHandleId: handleId };
    set({ phase: { type: 'working', stage: 'profile', command } });
    useAtlasStore.getState().fieldUpdated();
    try {
      const hydrated = await execute(command); outcomes.push(hydrated);
      const inspected = await execute(inspect); outcomes.push(inspected);
      const evidence = object(inspected.result.evidence);
      const claims = object(evidence.profile);
      const external = object(hydrated.result.external);
      const completeness = object(external.completeness);
      const resolved = boolean(inspected.result.resolved) && Object.keys(claims).length > 0;
      const attemptStatus = string(external.status) || string(completeness.attemptStatus);
      state.profile = {
        status: !resolved ? 'unresolved' : attemptStatus === 'partial' ? 'partial' : 'available',
        relays: draft.relays, command, supportingHandleId: handleId, external, completeness, claims,
        resolution: { resident: boolean(inspected.result.resident), resolved: boolean(inspected.result.resolved), source: string(inspected.result.resolutionSource) || undefined },
        provenance: presentObject({ summary: inspected.result.provenance, evidence: evidence.provenance, observationCount: evidence.observationCount, omittedObservationCount: evidence.omittedObservationCount }),
      };
      set({ latestExternal: {
        label: 'Profile hydration', status: (attemptStatus || 'BOUNDED').toUpperCase(),
        warningCount: Array.isArray(hydrated.response.warnings) ? hydrated.response.warnings.length : 0,
      } });
      addSnapshot(place, {
        target: { type: 'account', id: accountId }, sourceHandleId: handleId,
        observedRevision: number(inspected.response.sessionRevision), locality: 'external',
        exchanges: outcomes.map((outcome, index) => exchange(commands[index], outcome)),
        facts: state.profile as unknown as Record<string, unknown>,
      });
      useAtlasStore.getState().recordActivity(
        'Executed dedicated profile hydration draft', JSON.stringify(command),
        `${Object.keys(claims).length ? 'Profile claims observed' : 'Profile unresolved'} · place unchanged`,
      );
      set({ phase: { type: 'idle' } });
    } catch (error) {
      state.profile = { status: 'failure', relays: draft.relays, command, supportingHandleId: handleId, error: errorMessage(error) };
      const failedCommand = commands[outcomes.length] ?? commands.at(-1)!;
      const failed = await failureExchange(failedCommand, error);
      const exchanges = [...outcomes.map((outcome, index) => exchange(commands[index], outcome)), failed];
      addSnapshot(place, {
        target: { type: 'account', id: accountId }, sourceHandleId: outcomes.length ? handleId : state.engineHandleId,
        observedRevision: lastExchangeRevision(exchanges, place.installRevision), locality: 'external',
        exchanges, facts: state.profile as unknown as Record<string, unknown>,
      });
      set({
        phase: { type: 'failure', stage: 'profile', message: errorMessage(error), command },
        latestExternal: { label: 'Profile hydration', status: 'FAILURE', warningCount: 0 },
      });
    }
    useAtlasStore.getState().fieldUpdated();
  },

  requestAuthoredNotes: async (placeId, accountId) => {
    const sourcePlace = fields[placeId];
    const state = sourcePlace && ensureAccountResearch(sourcePlace, accountId);
    if (!sourcePlace || !state?.engineHandleId || state.authoredNotes?.status === 'loading') return;
    const draft = state.authoredDraft;
    const relayError = validateRelayDraft(draft.relays);
    if (relayError) {
      state.authoredNotes = { status: 'failure', relays: draft.relays, eventLimit: draft.eventLimit, error: relayError };
      useAtlasStore.getState().fieldUpdated(); return;
    }
    const handleId = uniqueHandle('atlas-authored-notes');
    const { eventLimit, relays, ...externalDraft } = draft;
    const command = {
      command: 'continue', input: state.engineHandleId,
      parameters: { relationship: 'authored-notes', source: 'relays', relays, eventLimit, ...externalDraft },
      resultId: handleId,
    };
    const commands: Record<string, unknown>[] = [command];
    const outcomes: Executed[] = [];
    state.authoredNotes = { status: 'loading', relays: draft.relays, eventLimit, command, handleId };
    set({ phase: { type: 'working', stage: 'authored', command } });
    useAtlasStore.getState().fieldUpdated();
    try {
      const continued = await execute(command); outcomes.push(continued);
      const handle = object(continued.result.handle);
      const count = number(handle.count);
      const external = object(continued.result.external);
      const completeness = object(continued.result.completeness);
      const partial = [string(external.status), string(completeness.attemptStatus), string(completeness.status)].includes('partial')
        || (Array.isArray(completeness.boundsReached) && completeness.boundsReached.length > 0);
      state.authoredNotes = {
        status: partial ? 'partial' : count > 0 ? 'available' : 'empty',
        relays: draft.relays, command, external, completeness, handleId, count, eventLimit,
      };
      set({ latestExternal: {
        label: 'Authored-note acquisition',
        status: (string(completeness.attemptStatus) || string(external.status) || 'BOUNDED').toUpperCase(),
        warningCount: Array.isArray(continued.response.warnings) ? continued.response.warnings.length : 0,
      } });
      const show = showCommand(handleId, 0, count);
      commands.push(show);
      let shown: Executed | undefined;
      let observationFailure: ObservationExchange | undefined;
      try {
        shown = await execute(show); outcomes.push(shown);
      } catch (error) {
        observationFailure = await failureExchange(show, error);
      }
      const acquired: AcquiredPhase = {
        type: 'acquired', sourceKind: 'authored-notes', handleId,
        installRevision: number(handle.revision) || number(continued.response.sessionRevision), count,
        command, receipt: continued.receipt,
        coverage: { external: { ...external, completeness } }, relays: draft.relays,
        draft: { ...DEFAULT_DRAFT, author: accountId, limit: eventLimit, excludeContentWarnings: draft.excludeContentWarnings },
      };
      const authoredExchanges = [
        ...outcomes.map((outcome, index) => exchange(commands[index], outcome)),
        ...(observationFailure ? [observationFailure] : []),
      ];
      addSnapshot(sourcePlace, {
        target: { type: 'account', id: accountId }, sourceHandleId: handleId,
        observedRevision: lastExchangeRevision(authoredExchanges, acquired.installRevision), locality: 'external',
        exchanges: authoredExchanges,
        facts: state.authoredNotes as unknown as Record<string, unknown>,
      });
      const branch = installPlace({
        acquired, shown, observationFailure, role: 'branch',
        reason: `Explicit authored-note relay research for ${shortKey(accountId)}.`,
        label: `${accounts[accountId]?.name ?? shortKey(accountId)} · authored notes`,
      });
      useAtlasStore.getState().installBranch(branch.id);
      useAtlasStore.getState().recordActivity(
        'Executed authored-note draft and opened branch', JSON.stringify([command, show]),
        observationFailure
          ? `${count} event subjects retained · branch opened · first preview unavailable · Ground unchanged`
          : `${count} event subjects · branch opened · Ground unchanged`,
      );
      set(observationFailure
        ? { phase: { type: 'failure', stage: 'authored', message: 'Authored-note branch opened, but its first bounded preview is unavailable.', command: show } }
        : { phase: { type: 'idle' } });
    } catch (error) {
      state.authoredNotes = { status: 'failure', relays: draft.relays, eventLimit, command, handleId, error: errorMessage(error) };
      const failedCommand = commands[outcomes.length] ?? commands.at(-1)!;
      const failed = await failureExchange(failedCommand, error);
      const exchanges = [...outcomes.map((outcome, index) => exchange(commands[index], outcome)), failed];
      addSnapshot(sourcePlace, {
        target: { type: 'account', id: accountId }, sourceHandleId: outcomes.length ? handleId : state.engineHandleId,
        observedRevision: lastExchangeRevision(exchanges, sourcePlace.installRevision), locality: 'external',
        exchanges, facts: state.authoredNotes as unknown as Record<string, unknown>,
      });
      set({
        phase: { type: 'failure', stage: 'authored', message: errorMessage(error), command },
        latestExternal: { label: 'Authored-note acquisition', status: 'FAILURE', warningCount: 0 },
      });
    }
    useAtlasStore.getState().fieldUpdated();
  },

  resetPhase: () => set({ phase: { type: 'idle' } }),
}));

function installPlace({
  acquired, shown, observationFailure, role, reason, label, originCommand, originReceipt, localSource,
}: {
  acquired: AcquiredPhase;
  shown?: Executed;
  observationFailure?: ObservationExchange;
  role: 'ground' | 'branch';
  reason: string;
  label?: string;
  originCommand?: Record<string, unknown> | Record<string, unknown>[];
  originReceipt?: Record<string, unknown> | Record<string, unknown>[];
  localSource?: Field;
}) {
  const shownResult = shown?.result ?? {};
  const incoming = materializeNotes(objectArray(shownResult.preview));
  const placeId = `${role}:${acquired.handleId}`;
  const external = object(acquired.coverage?.external);
  const completeness = object(external.completeness);
  const timestamps = incoming.map((id) => notes[id]?.timestamp ?? 0).filter((value) => value > 0);
  const nextOffset = number(shownResult.nextOffset) || number(shownResult.offset) + incoming.length;
  const authored = acquired.sourceKind === 'authored-notes';
  const local = Boolean(localSource);
  const place: Field = {
    id: placeId,
    label: label ?? (acquired.draft.search ? `Search: ${acquired.draft.search}`
      : acquired.draft.author ? `${accounts[acquired.draft.author]?.name ?? shortKey(acquired.draft.author)} · relay notes`
      : acquired.draft.eventId ? 'Exact event result' : 'Bounded relay notes'),
    description: `${incoming.length} displayed of ${acquired.count} ${local ? 'locally derived' : 'retained'} event subjects.`,
    noteIds: incoming,
    handleId: acquired.handleId,
    installRevision: acquired.installRevision,
    role,
    resultKind: 'events',
    countingUnit: string(shownResult.countUnit) || 'subjects',
    originCommand: originCommand ?? acquired.command,
    originReceipt: originReceipt ?? acquired.receipt,
    navigatorReason: reason,
    projection: 'stream',
    localPageOffset: nextOffset,
    selected: { type: 'none', id: '' },
    selectedFacet: null,
    localConstraints: { text: '' },
    observationSnapshots: [],
    declaredBounds: presentObject({
      requestBudget: object(shownResult.context).budget,
      response: shown ? responseBounds(shownResult) : undefined,
      completeness: object(external.completeness).boundsReached,
    }) ?? {},
    declaredOmissions: presentObject({
      omitted: shownResult.omitted,
      omittedBefore: shownResult.omittedBefore,
      omittedAfter: shownResult.omittedAfter,
      observationUnavailable: observationFailure ? true : undefined,
    }) ?? {},
    evidenceResolution: object(object(shownResult.summary).evidenceResolution),
    accountResearch: {},
    runtime: {
      fieldId: placeId, sourceKind: local ? 'local-account-notes' : acquired.sourceKind,
      handleId: acquired.handleId, pageHandleId: acquired.handleId, total: acquired.count,
      nextOffset, handleAddedCount: incoming.length, relays: acquired.relays, draft: acquired.draft,
      newestTimestamp: timestamps.length ? Math.max(...timestamps) : 0,
      oldestTimestamp: timestamps.length ? Math.min(...timestamps) : 0,
    },
    conditions: local ? {
      source: `Local memory · ${localSource?.label ?? 'Ground'}`, terminal: 'LOCAL', excludedWarnings: 0,
      uncertainty: observationFailure ? 'The local branch handle was installed, but its first bounded preview is unavailable.' : 'A bounded subset of Ground rows; no relay was contacted.',
      partial: observationFailure ? true : Boolean(object(object(shownResult.context).cardinality).truncated),
    } : {
      source: acquired.relays.join(' · '),
      terminal: string(completeness.attemptStatus).toUpperCase() || string(completeness.status).toUpperCase()
        || string(external.status).toUpperCase() || string(acquired.coverage?.status).toUpperCase() || 'BOUNDED',
      excludedWarnings: number(completeness.excludedContentWarnings),
      uncertainty: observationFailure
        ? 'The external handle was installed, but its first bounded preview is unavailable.'
        : authored
          ? 'Bounded authored-note evidence from displayed relays; network completeness is not implied.'
          : acquired.draft.search
            ? 'Relay-side NIP-50 matching varies by relay; completeness and ranking are not implied.'
            : 'A bounded relay attempt was made; relay and network completeness are not implied.',
      partial: Boolean(observationFailure)
        || [string(external.status), string(completeness.attemptStatus), string(completeness.status)].includes('partial')
        || (Array.isArray(completeness.boundsReached) && completeness.boundsReached.length > 0),
    },
  };
  addSnapshot(place, {
    target: { type: 'place', id: place.id }, sourceHandleId: place.handleId,
    observedRevision: shown ? number(shown.response.sessionRevision) : acquired.installRevision, locality: 'local',
    exchanges: shown ? [exchange(showCommand(place.handleId, 0, acquired.count), shown)] : observationFailure ? [observationFailure] : [],
    facts: shown ? shown.result : { status: 'failure', unavailable: true, error: observationFailure ? errorFromExchange(observationFailure) : 'Observation unavailable.' },
  });
  fields[placeId] = place;
  return place;
}

function ensureAccountResearch(place: Field, accountId: string): AccountResearchState {
  const existing = place.accountResearch[accountId];
  if (existing) return existing;
  const relays = [...(place.runtime?.relays ?? [])];
  const excludeContentWarnings = place.runtime?.draft.excludeContentWarnings ?? true;
  const profileDraft: ExternalActionDraft = {
    relays, timeoutMs: 10000, observationLimit: 80,
    distinctEventLimit: 60, concurrency: 2, excludeContentWarnings,
  };
  const authoredDraft: AuthoredActionDraft = {
    relays, eventLimit: 50, timeoutMs: 10000,
    observationLimit: 80, distinctEventLimit: 60,
    concurrency: 2, excludeContentWarnings,
  };
  const state: AccountResearchState = { localStatus: 'idle', profileDraft, authoredDraft };
  place.accountResearch[accountId] = state;
  return state;
}

async function execute(command: Record<string, unknown>): Promise<Executed> {
  const controller = await liveController();
  const outcome = await controller.execute(command);
  const response = outcome.response as unknown as Record<string, unknown>;
  const executed = { result: object(response.result), response, receipt: object(outcome.receipt) };
  if (response.ok !== true) throw new CommandFailure(responseError(response), executed);
  return executed;
}

function exchange(command: Record<string, unknown>, outcome: Executed): ObservationExchange {
  return { command, response: outcome.response, receipt: outcome.receipt };
}

async function failureExchange(command: Record<string, unknown>, error: unknown): Promise<ObservationExchange> {
  if (error instanceof CommandFailure) return exchange(command, error.executed);
  return {
    command,
    response: { unavailable: true, transportFailure: { message: errorMessage(error) } },
    receipt: { unavailable: true, reason: 'No controller response was returned.' },
  };
}

function errorFromExchange(item: ObservationExchange) {
  return string(object(item.response.error).message)
    || string(object(item.response.transportFailure).message)
    || 'Observation unavailable.';
}

function lastExchangeRevision(exchanges: ObservationExchange[], fallback: number) {
  for (const item of [...exchanges].reverse()) {
    const revision = number(item.response.sessionRevision);
    if (revision || item.response.sessionRevision === 0) return revision;
  }
  return fallback;
}

function addSnapshot(place: Field, input: Omit<ObservationSnapshot, 'id'>) {
  place.observationSnapshots.push({ ...input, id: `atlas-observation-${++nextSnapshot}` });
}

function addOrReplaceSubjectSnapshot(
  place: Field,
  type: 'note' | 'account',
  id: string,
  facts: Record<string, unknown>,
  exchanges: ObservationExchange[] = [],
  locality: 'local' | 'external' = 'local',
) {
  addSnapshot(place, {
    target: { type, id }, sourceHandleId: place.handleId,
    observedRevision: lastExchangeRevision(exchanges, place.installRevision),
    locality, exchanges, facts,
  });
}

function existingSnapshot(place: Field, type: 'note' | 'account', id: string, statuses: string[]) {
  const snapshot = [...place.observationSnapshots].reverse().find((candidate) => candidate.target.type === type && candidate.target.id === id);
  return snapshot && statuses.includes(string(snapshot.facts.status));
}

function inspectCommand(subject: { type: 'event' | 'account'; id: string }) {
  return { command: 'inspect', parameters: { subject, includeEvidence: true, previewLimit: 20, excerptLimit: 1000, sizeLimit: 50000 } };
}
function showDetailsCommand(input: string) { return { command: 'show', input, parameters: { mode: 'details', includeEvidence: true, previewLimit: 1, excerptLimit: 1000, sizeLimit: 50000 } }; }
function showPreviewCommand(input: string) { return { command: 'show', input, parameters: { mode: 'explain', includeEvidence: true, previewLimit: 20, excerptLimit: 1000, sizeLimit: 50000 } }; }
function showCommand(handleId: string, offset: number, remaining: number) {
  return { command: 'show', input: handleId, parameters: { mode: 'preview', offset, previewLimit: Math.min(20, Math.max(1, remaining)), excerptLimit: 1000, sizeLimit: 50000 } };
}

function materializeNotes(rows: Record<string, unknown>[]) {
  const noteIds: string[] = [];
  for (const row of rows) {
    const id = string(row.id) || string(object(row.subject).id);
    const nestedPreview = object(row.preview);
    const preview = Object.keys(nestedPreview).length ? nestedPreview : row;
    const authorId = string(object(preview.author).publicKey);
    if (!id || !authorId) continue;
    if (!accounts[authorId]) accounts[authorId] = liveAccount(authorId, id);
    else accounts[authorId].sourceNoteId ??= id;
    const content = string(preview.contentExcerpt) || '[Content unavailable in this bounded preview]';
    const createdAt = number(preview.createdAt);
    const current = notes[id];
    const relayUrls = stringArray(preview.relays) ?? [];
    notes[id] = {
      id, authorId, content,
      createdAt: createdAt ? relativeTime(createdAt) : 'time unavailable', timestamp: createdAt,
      relayCount: number(preview.relayCount) || relayUrls.length || current?.relayCount || 0,
      relayUrls: relayUrls.length ? relayUrls : current?.relayUrls,
      media: mediaFromText(content), live: true,
    } satisfies Note;
    noteIds.push(id);
  }
  return [...new Set(noteIds)];
}

function liveAccount(publicKey: string, sourceNoteId?: string) {
  return {
    id: publicKey, name: shortKey(publicKey), handle: `@${publicKey.slice(0, 8)}`, publicKey,
    about: 'Profile metadata has not been requested.', color: colorFor(publicKey),
    ...(sourceNoteId ? { sourceNoteId } : {}), live: true as const,
  };
}

export function freshAccountResearchDraft(publicKey: string): QueryDraft {
  return { ...DEFAULT_DRAFT, author: publicKey, hours: 0, includeFilterLimit: false };
}

export function validateSearchRelayCount(draft: QueryDraft, relays: string[]) {
  return draft.search.trim() && relays.length !== 1
    ? 'Experimental NIP-50 text search requires exactly one selected relay.' : null;
}

function cleanDraft(draft: QueryDraft): QueryDraft {
  return {
    limit: boundedInteger(draft.limit, 5, 100),
    hours: [0, 1, 6, 24, 72, 168, 720].includes(draft.hours) ? draft.hours : 24,
    search: draft.search.trim(), eventId: draft.eventId.trim().toLowerCase(),
    author: draft.author.trim().toLowerCase(), hashtag: draft.hashtag.trim().replace(/^#/u, ''),
    excludeContentWarnings: draft.excludeContentWarnings,
    includeFilterLimit: draft.includeFilterLimit,
    timeoutMs: boundedInteger(draft.timeoutMs, 1, 60000),
    observationLimit: Math.max(1, Math.round(draft.observationLimit)),
    distinctEventLimit: Math.max(1, Math.round(draft.distinctEventLimit)),
    concurrency: boundedInteger(draft.concurrency, 1, 10),
  };
}
function validateDraft(draft: QueryDraft) {
  if (draft.eventId && !/^[0-9a-f]{64}$/u.test(draft.eventId)) return 'Event ID must be a full 64-character hexadecimal identifier.';
  if (draft.author && !/^[0-9a-f]{64}$/u.test(draft.author)) return 'Author must be a full 64-character hexadecimal public key.';
  if (draft.search.length > 200) return 'Relay search text must be 200 characters or fewer.';
  return null;
}
function queryFilter(draft: QueryDraft): Record<string, unknown> {
  const filter: Record<string, unknown> = { kinds: [1] };
  if (draft.includeFilterLimit) filter.limit = draft.limit;
  if (draft.hours > 0) filter.since = Math.floor(Date.now() / 1000) - draft.hours * 3600;
  if (draft.search) filter.search = draft.search;
  if (draft.eventId) filter.ids = [draft.eventId];
  if (draft.author) filter.authors = [draft.author];
  if (draft.hashtag) filter['#t'] = [draft.hashtag];
  return filter;
}
function sanitizeExternalDraft<T extends ExternalActionDraft>(draft: T): T {
  return {
    ...draft,
    relays: [...new Set(draft.relays.map((relay) => relay.trim()).filter(Boolean))],
    timeoutMs: boundedInteger(draft.timeoutMs, 1, 60000),
    observationLimit: Math.max(1, Math.round(draft.observationLimit)),
    distinctEventLimit: Math.max(1, Math.round(draft.distinctEventLimit)),
    concurrency: boundedInteger(draft.concurrency, 1, 10),
  };
}
function validateRelayDraft(relays: string[]) {
  if (!relays.length) return 'Enter at least one visible wss:// relay.';
  if (relays.some((relay) => {
    try { return new URL(relay).protocol !== 'wss:'; } catch { return true; }
  })) return 'Every relay target must be a valid wss:// URL.';
  return null;
}
function selectedRelayUrls(relays: RelaySource[]) { return relays.filter(({ selected }) => selected).map(({ url }) => url); }
function uniqueHandle(prefix: string) { return `${prefix}-${++nextHandle}`; }
function subjectIds(result: Record<string, unknown>) { return [...new Set(objectArray(result.preview).map((item) => string(item.id) || string(object(item.subject).id)).filter(Boolean))]; }
function responseBounds(result: Record<string, unknown>) { return presentObject({ count: result.count, countUnit: result.countUnit, offset: result.offset, nextOffset: result.nextOffset, omitted: result.omitted, omittedBefore: result.omittedBefore, omittedAfter: result.omittedAfter, cardinality: object(result.context).cardinality }) ?? {}; }
function presentObject(value: Record<string, unknown>) { const entries = Object.entries(value).filter(([, item]) => item !== undefined && item !== null && (!Array.isArray(item) || item.length) && (typeof item !== 'object' || Array.isArray(item) || Object.keys(object(item)).length)); return entries.length ? Object.fromEntries(entries) : undefined; }
function boundedInteger(value: number, minimum: number, maximum: number) { return Math.min(maximum, Math.max(minimum, Math.round(Number.isFinite(value) ? value : minimum))); }
function relativeTime(timestamp: number) { const difference = timestamp - Math.floor(Date.now() / 1000); const absolute = Math.abs(difference); if (absolute < 60) return 'just now'; if (absolute < 3600) return `${Math.round(absolute / 60)} min ${difference < 0 ? 'ago' : 'from now'}`; if (absolute < 86400) return `${Math.round(absolute / 3600)} hr ${difference < 0 ? 'ago' : 'from now'}`; return new Date(timestamp * 1000).toLocaleDateString(); }
function shortKey(value: string) { return `${value.slice(0, 8)}…${value.slice(-4)}`; }
function colorFor(value: string) { const hue = [...value.slice(0, 8)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360; return `hsl(${hue} 32% 43%)`; }
function object(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function objectArray(value: unknown) { return Array.isArray(value) ? value.map(object) : []; }
function string(value: unknown) { return typeof value === 'string' ? value : ''; }
function stringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined; }
function number(value: unknown) { return Number.isSafeInteger(value) ? value as number : 0; }
function boolean(value: unknown) { return value === true; }
function responseError(response: Record<string, unknown>) { const error = object(response.error); return string(error.message) || string(error.code) || 'The research command failed.'; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }
