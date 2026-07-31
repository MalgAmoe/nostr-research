import { create } from 'zustand';
import { accounts, fields, notes, type Account, type Field, type Note } from './data';
import { liveController } from './live-session';
import type { AcquiredPhase, AcquisitionMode, ActiveLiveField, LivePhase, QueryDraft, RelaySource } from './live-types';
import { mediaFromText } from './media';
import { useAtlasStore } from './store';

const DEFAULT_RELAYS: RelaySource[] = [
  { url: 'wss://nos.lol', label: 'nos.lol', selected: true },
  { url: 'wss://relay.primal.net', label: 'Primal', selected: false },
  { url: 'wss://relay.snort.social', label: 'Snort', selected: false },
  { url: 'wss://search.nos.today', label: 'Searchnos · NIP-50', selected: false },
];

const DEFAULT_DRAFT: QueryDraft = {
  limit: 20,
  hours: 24,
  search: '',
  eventId: '',
  author: '',
  hashtag: '',
  excludeContentWarnings: true,
};

type LiveStore = {
  panelOpen: boolean;
  relays: RelaySource[];
  relaySearch: string;
  customRelay: string;
  customRelayError: string | null;
  draft: QueryDraft;
  phase: LivePhase;
  setPanelOpen: (open: boolean) => void;
  setRelaySearch: (value: string) => void;
  setCustomRelay: (value: string) => void;
  addRelay: () => void;
  removeRelay: (url: string) => void;
  toggleRelay: (url: string) => void;
  setDraft: (draft: Partial<QueryDraft>) => void;
  observeNote: (noteId: string, fieldId: string) => Promise<void>;
  observeAccount: (accountId: string, fieldId: string) => Promise<void>;
  requestProfile: (accountId: string) => Promise<void>;
  requestAuthoredNotes: (accountId: string) => Promise<void>;
  openAuthoredNotes: (accountId: string) => Promise<void>;
  acquire: () => Promise<void>;
  acquireAround: (mode: 'newer' | 'older') => Promise<void>;
  observe: () => Promise<void>;
  showMore: () => Promise<void>;
  resetPhase: () => void;
};

let nextQuery = 0;
let nextJourney = 0;

export const useLiveStore = create<LiveStore>((set, get) => {
  async function runAcquire(mode: AcquisitionMode, draftInput: QueryDraft, relays: string[], fieldId?: string) {
    if (['acquiring', 'observing', 'paging'].includes(get().phase.type)) return;
    const draft = normalizeDraft(draftInput);
    const validation = validateDraft(draft) ?? validateSearchRelayCount(draft, relays);
    if (validation) {
      set({ phase: { type: 'failure', stage: 'acquire', message: validation } });
      return;
    }
    const active = fieldId ? fields[fieldId]?.runtime ?? null : null;
    const filter = applyCursorBounds(queryFilter(draft), mode, active);
    if (number(filter.since) && number(filter.until) && number(filter.since) > number(filter.until)) {
      set({ phase: { type: 'failure', stage: 'acquire', message: 'No time remains inside the original bounded window.' }, panelOpen: true });
      return;
    }
    const sequence = ++nextQuery;
    const handleId = `atlas-live-${sequence}`;
    const overallBudget = Math.min(500, Math.max(draft.limit, draft.limit * relays.length));
    const command = {
      command: 'plan',
      plan: [
        {
          id: 'acquired', operation: 'acquire', parameters: {
            relays, filter, timeoutMs: 10000,
            observationLimit: Math.min(700, overallBudget + 30),
            distinctEventLimit: overallBudget,
            concurrency: Math.min(3, relays.length),
            excludeContentWarnings: draft.excludeContentWarnings,
          },
        },
        { id: 'selected', operation: 'select', input: 'acquired', parameters: { limit: overallBudget, order: 'newest' } },
      ],
      outputs: { selected: handleId },
    };
    set({ phase: { type: 'acquiring', mode, command }, draft });
    try {
      const controller = await liveController();
      const outcome = await controller.execute(command);
      const response = outcome.response as unknown as Record<string, unknown>;
      if (response.ok !== true) throw new Error(responseError(response));
      const result = object(response.result);
      const stages = Array.isArray(result.stages) ? result.stages.map(object) : [];
      const acquisition = stages.find((stage) => stage.id === 'acquired') ?? null;
      const selectedStage = stages.find((stage) => stage.id === 'selected');
      const count = number(object(selectedStage?.handle).count);
      useAtlasStore.getState().recordActivity(
        mode === 'replace' ? `Searched ${relays.length} selected relay${relays.length === 1 ? '' : 's'}` : mode === 'newer' ? 'Checked relays for newer notes' : 'Acquired an older bounded page',
        JSON.stringify(command),
        `${count} selected event identities · buffer updated by bounded attempt`,
      );
      if (mode === 'older' && count === 0 && active && active.fieldId === fieldId && fields[fieldId]) {
        fields[fieldId].runtime = { ...active, olderExhausted: true };
        useAtlasStore.getState().fieldUpdated();
      }
      set({ phase: { type: 'acquired', sourceKind: 'query', mode, handleId, count, command, coverage: acquisition, relays, draft, fieldId } });
    } catch (error) {
      set({ phase: { type: 'failure', stage: 'acquire', message: errorMessage(error), command }, panelOpen: true });
    }
  }

  async function observeAccount(accountId: string, fieldId: string) {
    const account = accounts[accountId];
    if (!account || account.engineHandleId || account.localObservation?.status === 'loading') return;
    account.localObservation = { status: 'loading' };
    useAtlasStore.getState().fieldUpdated();
    try {
      const field = fields[fieldId];
      const sourceNoteId = field?.noteIds.find((id) => notes[id]?.authorId === accountId) ?? account.sourceNoteId;
      const sourceField = field?.runtime && sourceNoteId && field.noteIds.includes(sourceNoteId)
        ? field
        : Object.values(fields).find((candidate) => candidate.runtime && sourceNoteId && candidate.noteIds.includes(sourceNoteId));
      if (!sourceField?.runtime || !sourceNoteId) throw new Error('No operational field handle retains this observed author.');
      const sequence = ++nextJourney;
      const noteHandleId = `atlas-account-source-${sequence}`;
      const authorHandleId = `atlas-account-${sequence}`;
      const filterCommand = {
        command: 'filter', input: sourceField.runtime.handleId,
        parameters: { where: { field: 'subject.id', equals: sourceNoteId }, limit: 1 }, resultId: noteHandleId,
      };
      await executeResult(filterCommand);
      const authorCommand = {
        command: 'move', input: noteHandleId,
        parameters: { to: 'authors', limit: 1 }, resultId: authorHandleId,
      };
      const authorResult = await executeResult(authorCommand);
      if (number(object(authorResult.handle).count) < 1) {
        account.localObservation = { status: 'unresolved', resolution: { resolved: false, source: 'operational field handle' } };
      } else {
        account.engineHandleId = authorHandleId;
        const inspected = await executeResult(inspectCommand({ type: 'account', id: accountId }));
        account.localObservation = {
          status: 'available',
          resolution: {
            resident: boolean(inspected.resident), resolved: boolean(inspected.resolved),
            source: string(inspected.resolutionSource) || undefined,
          },
        };
      }
      useAtlasStore.getState().recordActivity(
        'Observed an event author locally', JSON.stringify([filterCommand, authorCommand]),
        account.engineHandleId ? 'Account handle retained · no relay contacted' : 'Author unresolved from retained local evidence · no relay contacted',
      );
    } catch (error) {
      account.localObservation = { status: 'failure', error: errorMessage(error) };
    }
    useAtlasStore.getState().fieldUpdated();
  }

  async function observeNote(noteId: string, fieldId: string) {
    const note = notes[noteId];
    if (!note || ['loading', 'available', 'unresolved'].includes(note.observation?.status ?? '')) return;
    note.observation = { status: 'loading' };
    useAtlasStore.getState().fieldUpdated();
    try {
      const field = fields[fieldId];
      if (!field?.runtime) throw new Error('This UI field has no retained engine handle.');
      const sequence = ++nextJourney;
      const handles = {
        event: `atlas-note-${sequence}`,
        author: `atlas-note-author-${sequence}`,
        facts: `atlas-note-facts-${sequence}`,
        events: `atlas-note-events-${sequence}`,
        accounts: `atlas-note-accounts-${sequence}`,
        addresses: `atlas-note-addresses-${sequence}`,
      };
      const filterCommand = {
        command: 'filter', input: field.runtime.handleId,
        parameters: { where: { field: 'subject.id', equals: noteId }, limit: 1 }, resultId: handles.event,
      };
      await executeResult(filterCommand);
      const authorCommand = { command: 'move', input: handles.event, parameters: { to: 'authors', limit: 1 }, resultId: handles.author };
      const authorResult = await executeResult(authorCommand);
      const relateCommand = { command: 'relate', input: handles.event, parameters: {}, resultId: handles.facts };
      await executeResult(relateCommand);
      const eventMoveCommand = { command: 'move', input: handles.event, parameters: { to: 'referencedEvents', limit: 20 }, resultId: handles.events };
      await executeResult(eventMoveCommand);
      const accountMoveCommand = { command: 'move', input: handles.event, parameters: { to: 'referencedAccounts', limit: 20 }, resultId: handles.accounts };
      await executeResult(accountMoveCommand);
      const addressMoveCommand = { command: 'move', input: handles.event, parameters: { to: 'referencedAddresses', limit: 20 }, resultId: handles.addresses };
      await executeResult(addressMoveCommand);
      const inspect = inspectCommand({ type: 'event', id: noteId });
      const inspected = await executeResult(inspect);
      const factsCommand = showDetailsCommand(handles.facts);
      const facts = await executeResult(factsCommand);
      const eventRefsCommand = showPreviewCommand(handles.events);
      const eventRefs = await executeResult(eventRefsCommand);
      const accountRefsCommand = showPreviewCommand(handles.accounts);
      const accountRefs = await executeResult(accountRefsCommand);
      const addressRefsCommand = showPreviewCommand(handles.addresses);
      const addressRefs = await executeResult(addressRefsCommand);
      const evidence = object(inspected.evidence);
      const event = object(evidence.event);
      const values = object(objectArray(facts.preview)[0]?.values);
      const content = typeof event.content === 'string' ? event.content : undefined;
      const resolved = boolean(inspected.resolved);
      note.observation = {
        status: resolved ? 'available' : 'unresolved',
        eventHandleId: handles.event,
        authorHandleId: number(object(authorResult.handle).count) ? handles.author : undefined,
        resolution: {
          resident: boolean(inspected.resident), resolved,
          source: string(inspected.resolutionSource) || undefined,
        },
        content,
        contentState: !resolved || content === undefined ? 'unavailable' : content.length < 1000 ? 'complete' : 'bounded',
        tags: Array.isArray(event.tags) ? event.tags.filter(Array.isArray) as unknown[][] : undefined,
        omittedTags: number(event.omittedTags),
        role: string(values['event.role']) || undefined,
        conversationRole: string(values['event.conversationRole']) || undefined,
        attachments: Array.isArray(values['event.attachments']) ? values['event.attachments'].map(object) : undefined,
        attachmentsOmitted: number(values['event.attachmentsOmitted']),
        observedRelays: stringArray(values.observedRelays),
        referencedEvents: subjectIds(eventRefs),
        referencedAccounts: subjectIds(accountRefs),
        referencedAddresses: subjectIds(addressRefs),
        relationshipsOmitted: number(eventRefs.omitted) + number(accountRefs.omitted) + number(addressRefs.omitted),
        provenance: presentObject({ summary: inspected.provenance, evidence: evidence.provenance, observationCount: evidence.observationCount, omittedObservationCount: evidence.omittedObservationCount }),
        bounds: presentObject({
          relation: object(facts.context).cardinality,
          relationships: presentObject({ events: referenceBounds(eventRefs), accounts: referenceBounds(accountRefs), addresses: referenceBounds(addressRefs) }),
          corpus: inspected.corpus, freshness: inspected.freshness,
        }),
      };
      const account = accounts[note.authorId];
      if (account && note.observation.authorHandleId) {
        account.engineHandleId = note.observation.authorHandleId;
        account.localObservation = { status: 'available', resolution: note.observation.resolution };
      }
      useAtlasStore.getState().recordActivity(
        'Observed known note evidence locally',
        JSON.stringify([filterCommand, authorCommand, relateCommand, eventMoveCommand, accountMoveCommand, addressMoveCommand, inspect, factsCommand, eventRefsCommand, accountRefsCommand, addressRefsCommand]),
        `${resolved ? 'Exact resident evidence observed' : 'Subject unresolved'} · no relay contacted`,
      );
    } catch (error) {
      note.observation = { status: 'failure', error: errorMessage(error) };
    }
    useAtlasStore.getState().fieldUpdated();
  }

  async function requestProfile(accountId: string) {
    const account = accounts[accountId];
    if (!account || !account.engineHandleId || account.profile?.status === 'loading') return;
    const relays = selectedRelayUrls(get().relays);
    if (!relays.length) {
      account.profile = { status: 'failure', relays, error: 'Select at least one visible relay before requesting a profile.' };
      useAtlasStore.getState().fieldUpdated();
      return;
    }
    const sequence = ++nextJourney;
    const handleId = `atlas-profile-events-${sequence}`;
    const command = {
      command: 'hydrate', input: account.engineHandleId,
      parameters: {
        relays, kinds: [0], timeoutMs: 10000,
        observationLimit: Math.min(80, Math.max(20, relays.length * 10)),
        distinctEventLimit: 20, concurrency: Math.min(3, relays.length),
        excludeContentWarnings: get().draft.excludeContentWarnings,
      },
      resultId: handleId,
    };
    account.profile = { status: 'loading', relays, command };
    useAtlasStore.getState().fieldUpdated();
    try {
      const result = await executeResult(command);
      const inspected = await executeResult(inspectCommand({ type: 'account', id: accountId }));
      const evidence = object(inspected.evidence);
      const claims = object(evidence.profile);
      const external = object(result.external);
      const completeness = object(external.completeness);
      const resolved = boolean(inspected.resolved) && Object.keys(claims).length > 0;
      const attemptStatus = string(external.status) || string(completeness.attemptStatus);
      account.profile = {
        status: !resolved ? 'unresolved' : attemptStatus === 'partial' ? 'partial' : 'available',
        relays, command, external, completeness, claims,
        resolution: {
          resident: boolean(inspected.resident), resolved: boolean(inspected.resolved),
          source: string(inspected.resolutionSource) || undefined,
        },
        provenance: presentObject({ summary: inspected.provenance, evidence: evidence.provenance, observationCount: evidence.observationCount, omittedObservationCount: evidence.omittedObservationCount }),
      };
      useAtlasStore.getState().recordActivity(
        'Requested profile metadata', JSON.stringify(command),
        `${Object.keys(claims).length ? 'Profile claims observed' : 'Profile unresolved'} · ${attemptStatus || 'bounded relay attempt'}`,
      );
    } catch (error) {
      account.profile = { status: 'failure', relays, command, error: errorMessage(error) };
    }
    useAtlasStore.getState().fieldUpdated();
  }

  async function requestAuthoredNotes(accountId: string) {
    const account = accounts[accountId];
    if (!account || !account.engineHandleId || account.authoredNotes?.status === 'loading') return;
    const relays = selectedRelayUrls(get().relays);
    const eventLimit = get().draft.limit;
    if (!relays.length) {
      account.authoredNotes = { status: 'failure', relays, eventLimit, error: 'Select at least one visible relay before requesting authored notes.' };
      useAtlasStore.getState().fieldUpdated();
      return;
    }
    const sequence = ++nextJourney;
    const handleId = `atlas-authored-notes-${sequence}`;
    const command = {
      command: 'continue', input: account.engineHandleId,
      parameters: {
        relationship: 'authored-notes', source: 'relays', relays,
        eventLimit, timeoutMs: 10000,
        observationLimit: Math.min(700, eventLimit * relays.length + 30),
        distinctEventLimit: Math.min(500, Math.max(eventLimit, eventLimit * relays.length)),
        concurrency: Math.min(3, relays.length),
        excludeContentWarnings: get().draft.excludeContentWarnings,
      },
      resultId: handleId,
    };
    account.authoredNotes = { status: 'loading', relays, eventLimit, command };
    useAtlasStore.getState().fieldUpdated();
    try {
      const result = await executeResult(command);
      const count = number(object(result.handle).count);
      const external = object(result.external);
      const completeness = object(result.completeness);
      const attemptStatus = string(completeness.attemptStatus) || string(completeness.status) || string(external.status);
      const partial = [string(external.status), string(completeness.attemptStatus), string(completeness.status)].includes('partial')
        || (Array.isArray(completeness.boundsReached) && completeness.boundsReached.length > 0);
      account.authoredNotes = {
        status: partial ? 'partial' : count > 0 ? 'available' : 'empty',
        relays, command, external, completeness, handleId, count, eventLimit,
      };
      useAtlasStore.getState().recordActivity(
        'Requested authored notes', JSON.stringify(command),
        `${count} event identities retained in an ordinary handle · ${attemptStatus || 'bounded relay attempt'}`,
      );
    } catch (error) {
      account.authoredNotes = { status: 'failure', relays, eventLimit, command, error: errorMessage(error) };
    }
    useAtlasStore.getState().fieldUpdated();
  }

  async function openAuthoredNotes(accountId: string) {
    const account = accounts[accountId];
    const request = account?.authoredNotes;
    if (!account || !request?.handleId || !request.count || ['loading', 'failure'].includes(request.status)) return;
    const command = showCommand(request.handleId, 0, request.count);
    set({ phase: { type: 'paging', command } });
    try {
      const shown = await executeShow(command);
      const draft = normalizeDraft({ ...DEFAULT_DRAFT, author: accountId, limit: request.eventLimit ?? DEFAULT_DRAFT.limit });
      const acquired: AcquiredPhase = {
        type: 'acquired', sourceKind: 'authored-notes', mode: 'replace',
        handleId: request.handleId, count: request.count, command,
        coverage: { external: { ...request.external, completeness: request.completeness } },
        relays: request.relays, draft,
      };
      const installed = installRows({ acquired, shown });
      if (!installed.added) throw new Error('The authored-notes handle returned no displayable notes.');
      useAtlasStore.getState().openInstalledField(installed.fieldId);
      useAtlasStore.getState().recordActivity(
        'Opened authored-notes field', JSON.stringify(command),
        `${installed.added} notes displayed from retained handle · no relay contacted`,
      );
      set({ phase: { type: 'idle' }, panelOpen: false });
    } catch (error) {
      set({ phase: { type: 'failure', stage: 'page', message: errorMessage(error), command } });
    }
  }

  return {
    panelOpen: true,
    relays: DEFAULT_RELAYS,
    relaySearch: '',
    customRelay: '',
    customRelayError: null,
    draft: DEFAULT_DRAFT,
    phase: { type: 'idle' },
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
      set((state) => ({ relays: [...state.relays, { url, label: new URL(url).hostname, selected: true, custom: true }], customRelay: '', customRelayError: null }));
    },
    removeRelay: (url) => set((state) => ({ relays: state.relays.filter((relay) => !(relay.custom && relay.url === url)) })),
    toggleRelay: (url) => set((state) => ({ relays: state.relays.map((relay) => relay.url === url ? { ...relay, selected: !relay.selected } : relay) })),
    setDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
    observeNote,
    observeAccount,
    requestProfile,
    requestAuthoredNotes,
    openAuthoredNotes,
    acquire: async () => {
      const selected = get().relays.filter(({ selected }) => selected).map(({ url }) => url);
      if (!selected.length) {
        set({ phase: { type: 'failure', stage: 'acquire', message: 'Select at least one relay.' } });
        return;
      }
      await runAcquire('replace', get().draft, selected);
    },
    acquireAround: async (mode) => {
      const location = useAtlasStore.getState().history[useAtlasStore.getState().historyIndex];
      const active = fields[location.fieldId]?.runtime;
      if (!active || active.sourceKind !== 'query' || active.draft.eventId || active.draft.search || active.nextOffset < active.total || (mode === 'older' && active.olderExhausted)) return;
      set({ panelOpen: true });
      await runAcquire(mode, active.draft, active.relays, active.fieldId);
    },
    observe: async () => {
      const acquired = get().phase;
      if (acquired.type !== 'acquired') return;
      const command = showCommand(acquired.handleId, 0, acquired.count);
      set({ phase: { type: 'observing', acquired, command } });
      try {
        const shown = await executeShow(command);
        const priorActive = acquired.fieldId ? fields[acquired.fieldId]?.runtime : undefined;
        const priorForMerge = acquired.mode !== 'replace' && priorActive && priorActive.fieldId === acquired.fieldId
          ? priorActive
          : undefined;
        let installing = acquired;
        let unionCommand: Record<string, unknown> | undefined;
        if (priorForMerge) {
          const fieldHandleId = `atlas-field-${++nextJourney}`;
          unionCommand = {
            command: 'union', input: priorForMerge.handleId,
            parameters: { with: acquired.handleId }, resultId: fieldHandleId,
          };
          await executeResult(unionCommand);
          installing = { ...acquired, fieldHandleId };
        }
        const installed = installRows({
          acquired: installing,
          shown,
          active: acquired.mode === 'newer' && priorForMerge
            ? { ...priorForMerge, prependCount: 0 }
            : priorForMerge,
        });
        useAtlasStore.getState().recordActivity(
          acquired.mode === 'replace' ? 'Displayed live search results' : acquired.mode === 'newer' ? 'Displayed newer buffered notes' : 'Displayed older buffered notes',
          JSON.stringify(unionCommand ? [command, unionCommand] : command),
          `${installed.added} new notes displayed · ${installed.nextOffset} of ${acquired.count} from this buffer handle shown`,
        );
        if (acquired.mode === 'replace' && !installed.added) throw new Error('The explicit preview returned no displayable notes. No field was opened.');
        if (acquired.mode === 'replace') useAtlasStore.getState().openInstalledField(installed.fieldId);
        set({ phase: { type: 'idle' }, panelOpen: false });
      } catch (error) {
        set({ phase: { type: 'failure', stage: 'observe', message: errorMessage(error), command } });
      }
    },
    showMore: async () => {
      const location = useAtlasStore.getState().history[useAtlasStore.getState().historyIndex];
      const active = fields[location.fieldId]?.runtime;
      if (!active || active.nextOffset >= active.total || get().phase.type !== 'idle') return;
      const command = showCommand(active.pageHandleId, active.nextOffset, active.total - active.nextOffset);
      set({ phase: { type: 'paging', command } });
      try {
        const shown = await executeShow(command);
        const acquired: AcquiredPhase = { type: 'acquired', sourceKind: active.sourceKind, mode: active.mode, handleId: active.pageHandleId, fieldHandleId: active.handleId, count: active.total, command, coverage: null, relays: active.relays, draft: active.draft, fieldId: active.fieldId };
        const installed = installRows({ acquired, shown, active });
        useAtlasStore.getState().recordActivity('Loaded more from the live buffer', JSON.stringify(command), `${installed.added} additional notes displayed · ${installed.nextOffset} of ${active.total} shown`);
        set({ phase: { type: 'idle' } });
      } catch (error) {
        set({ phase: { type: 'failure', stage: 'page', message: errorMessage(error), command } });
      }
    },
    resetPhase: () => set({ phase: { type: 'idle' } }),
  };
});

async function executeResult(command: Record<string, unknown>) {
  const controller = await liveController();
  const outcome = await controller.execute(command);
  const response = outcome.response as unknown as Record<string, unknown>;
  if (response.ok !== true) throw new Error(responseError(response));
  return object(response.result);
}

function inspectCommand(subject: { type: 'event' | 'account'; id: string }) {
  return {
    command: 'inspect',
    parameters: { subject, includeEvidence: true, previewLimit: 20, excerptLimit: 1000, sizeLimit: 50000 },
  };
}

function showDetailsCommand(input: string) {
  return { command: 'show', input, parameters: { mode: 'details', includeEvidence: true, previewLimit: 1, excerptLimit: 1000, sizeLimit: 50000 } };
}

function showPreviewCommand(input: string) {
  return { command: 'show', input, parameters: { mode: 'explain', includeEvidence: true, previewLimit: 20, excerptLimit: 1000, sizeLimit: 50000 } };
}

function subjectIds(result: Record<string, unknown>) {
  return [...new Set(objectArray(result.preview).map((item) => string(item.id) || string(object(item.subject).id)).filter(Boolean))];
}

function referenceBounds(result: Record<string, unknown>) {
  return presentObject({
    count: result.count,
    offset: result.offset,
    nextOffset: result.nextOffset,
    omitted: result.omitted,
    omittedBefore: result.omittedBefore,
    omittedAfter: result.omittedAfter,
    cardinality: object(result.context).cardinality,
  });
}

function selectedRelayUrls(relays: RelaySource[]) {
  return relays.filter(({ selected }) => selected).map(({ url }) => url);
}

function presentObject(value: Record<string, unknown>) {
  const entries = Object.entries(value).filter(([, item]) => {
    if (item === undefined || item === null) return false;
    if (Array.isArray(item)) return item.length > 0;
    if (typeof item === 'object') return Object.keys(object(item)).length > 0;
    return true;
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function validateSearchRelayCount(draft: QueryDraft, relays: string[]) {
  if (draft.search.trim() && relays.length !== 1) {
    return 'Experimental NIP-50 text search requires exactly one selected relay.';
  }
  return null;
}

export function applyCursorBounds(
  filterInput: Record<string, unknown>,
  mode: AcquisitionMode,
  active: ActiveLiveField | null,
) {
  const filter = { ...filterInput };
  if (mode === 'newer' && active?.newestTimestamp) {
    filter.since = Math.max(number(filter.since), active.newestTimestamp);
  }
  if (mode === 'older' && active?.oldestTimestamp) {
    filter.until = active.oldestTimestamp;
  }
  return filter;
}

export function mergeFieldNoteIds(
  existing: string[],
  incoming: string[],
  mode: AcquisitionMode,
  prependCount: number,
) {
  if (mode !== 'newer') return { noteIds: [...existing, ...incoming], prependCount: 0 };
  const insertionPoint = Math.min(Math.max(0, prependCount), existing.length);
  return {
    noteIds: [...existing.slice(0, insertionPoint), ...incoming, ...existing.slice(insertionPoint)],
    prependCount: insertionPoint + incoming.length,
  };
}

function normalizeDraft(draft: QueryDraft): QueryDraft {
  return {
    limit: Math.min(100, Math.max(5, Math.round(draft.limit))),
    hours: [0, 1, 6, 24, 72, 168, 720].includes(draft.hours) ? draft.hours : 24,
    search: draft.search.trim(),
    eventId: draft.eventId.trim().toLowerCase(),
    author: draft.author.trim().toLowerCase(),
    hashtag: draft.hashtag.trim().replace(/^#/u, ''),
    excludeContentWarnings: draft.excludeContentWarnings,
  };
}

function validateDraft(draft: QueryDraft) {
  if (draft.eventId && !/^[0-9a-f]{64}$/u.test(draft.eventId)) return 'Event ID must be a full 64-character hexadecimal identifier.';
  if (draft.author && !/^[0-9a-f]{64}$/u.test(draft.author)) return 'Author must be a full 64-character hexadecimal public key.';
  if (draft.search.length > 200) return 'Relay search text must be 200 characters or fewer.';
  return null;
}

function queryFilter(draft: QueryDraft): Record<string, unknown> {
  const filter: Record<string, unknown> = { kinds: [1], limit: draft.limit };
  if (draft.hours > 0) filter.since = Math.floor(Date.now() / 1000) - draft.hours * 3600;
  if (draft.search) filter.search = draft.search;
  if (draft.eventId) filter.ids = [draft.eventId];
  if (draft.author) filter.authors = [draft.author];
  if (draft.hashtag) filter['#t'] = [draft.hashtag];
  return filter;
}

function showCommand(handleId: string, offset: number, remaining: number) {
  return {
    command: 'show', input: handleId,
    parameters: { mode: 'preview', offset, previewLimit: Math.min(20, Math.max(1, remaining)), excerptLimit: 1000, sizeLimit: 50000 },
  };
}

async function executeShow(command: Record<string, unknown>) {
  const controller = await liveController();
  const outcome = await controller.execute(command);
  const response = outcome.response as unknown as Record<string, unknown>;
  if (response.ok !== true) throw new Error(responseError(response));
  return object(response.result);
}

function installRows({ acquired, shown, active }: { acquired: AcquiredPhase; shown: Record<string, unknown>; active?: ActiveLiveField }) {
  const preview = Array.isArray(shown.preview) ? shown.preview.map(object) : [];
  const incoming = materializeNotes(preview);
  const fieldId = acquired.fieldId ?? `${acquired.sourceKind === 'authored-notes' ? 'authored' : 'live'}:${acquired.handleId}`;
  const existing = fields[fieldId]?.noteIds ?? [];
  const newIds = incoming.filter((id) => !existing.includes(id));
  const merged = mergeFieldNoteIds(existing, newIds, acquired.mode, active?.prependCount ?? 0);
  const noteIds = acquired.mode === 'replace' ? incoming : merged.noteIds;
  const external = object(acquired.coverage?.external);
  const completeness = object(external.completeness);
  const prior = fields[fieldId];
  const timestamps = noteIds.map((id) => notes[id]?.timestamp ?? 0).filter((value) => value > 0);
  const nextOffset = number(shown.nextOffset) || number(shown.offset) + incoming.length;
  const samePageHandle = active?.pageHandleId === acquired.handleId;
  const handleAddedCount = (samePageHandle ? active?.handleAddedCount ?? 0 : 0) + newIds.length;
  const runtime: ActiveLiveField = {
    fieldId,
    sourceKind: acquired.sourceKind,
    handleId: acquired.fieldHandleId ?? acquired.handleId,
    pageHandleId: acquired.handleId,
    total: acquired.count,
    nextOffset,
    mode: acquired.mode,
    prependCount: acquired.mode === 'newer' ? merged.prependCount : 0,
    handleAddedCount,
    olderExhausted: active?.olderExhausted === true
      || (acquired.mode === 'older' && nextOffset >= acquired.count && handleAddedCount === 0),
    relays: acquired.relays,
    draft: acquired.draft,
    newestTimestamp: timestamps.length ? Math.max(...timestamps) : 0,
    oldestTimestamp: timestamps.length ? Math.min(...timestamps) : 0,
  };
  const authored = acquired.sourceKind === 'authored-notes';
  const field: Field = {
    id: fieldId,
    label: authored
      ? `${accounts[acquired.draft.author]?.name ?? shortKey(acquired.draft.author)}’s authored notes`
      : acquired.draft.search ? `Search: ${acquired.draft.search}` : acquired.draft.author ? `${accounts[acquired.draft.author]?.name ?? shortKey(acquired.draft.author)}’s live notes` : acquired.draft.eventId ? 'Exact event result' : 'Live relay field',
    description: `${noteIds.length} displayed notes from ${authored ? 'an explicit bounded authored-notes request' : 'explicit bounded relay requests'}.`,
    noteIds,
    runtime,
    commandLabel: `show ${acquired.handleId} · offset ${number(shown.offset)} · limit ${number(shown.limit)}`,
    conditions: acquired.coverage ? {
      source: acquired.relays.join(' · '),
      terminal: string(completeness.attemptStatus).toUpperCase() || string(completeness.status).toUpperCase() || string(external.status).toUpperCase() || string(acquired.coverage.status).toUpperCase() || 'BOUNDED',
      excludedWarnings: number(completeness.excludedContentWarnings),
      uncertainty: authored
        ? 'Authored notes are a bounded continuation from one observed account; relay completeness is not implied.'
        : acquired.draft.search ? 'Relay-side NIP-50 matching varies by relay; completeness and ranking are not implied.' : 'A bounded attempt was made; relay completeness is not implied.',
    } : prior?.conditions ?? {
      source: acquired.relays.join(' · '), terminal: 'BOUNDED', excludedWarnings: 0,
      uncertainty: 'A bounded attempt was made; relay completeness is not implied.',
    },
  };
  fields[fieldId] = field;
  useAtlasStore.getState().fieldUpdated();
  return { fieldId, added: newIds.length, nextOffset, active: runtime };
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
    const content = string(preview.contentExcerpt) || '[Content unavailable in this preview]';
    const createdAt = number(preview.createdAt);
    const current = notes[id];
    const relayUrls = Array.isArray(preview.relays) ? preview.relays.filter((relay): relay is string => typeof relay === 'string') : [];
    notes[id] = {
      id, authorId, content,
      createdAt: createdAt ? relativeTime(createdAt) : 'time unavailable',
      timestamp: createdAt,
      relayCount: number(preview.relayCount) || relayUrls.length || current?.relayCount || 0,
      relayUrls: relayUrls.length ? relayUrls : current?.relayUrls,
      media: mediaFromText(content),
      observation: current?.observation,
      live: true,
    } satisfies Note;
    noteIds.push(id);
  }
  return [...new Set(noteIds)];
}

function liveAccount(publicKey: string, sourceNoteId: string): Account {
  return {
    id: publicKey, name: shortKey(publicKey), handle: `@${publicKey.slice(0, 8)}`, publicKey,
    about: 'Profile metadata has not been requested.', color: colorFor(publicKey), sourceNoteId, live: true,
  };
}

function relativeTime(timestamp: number) {
  const difference = timestamp - Math.floor(Date.now() / 1000);
  const absolute = Math.abs(difference);
  if (absolute < 60) return 'just now';
  if (absolute < 3600) return `${Math.round(absolute / 60)} min ${difference < 0 ? 'ago' : 'from now'}`;
  if (absolute < 86400) return `${Math.round(absolute / 3600)} hr ${difference < 0 ? 'ago' : 'from now'}`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

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
