import { create } from 'zustand';
import {
  accounts, fieldFor, fields, notes, type AccountResearchState, type InspectorTarget,
  type MediaLoadState, type NoteResearchState, type ObservationExchange, type PlaceProjection,
} from './data';
import { DEFAULT_DRAFT, DEFAULT_RELAYS, type QueryDraft, type RelaySource } from './live-types';
import type {
  AccountFacetResolution, AccountNotesResolution, AccountProjectionResolution, AcquisitionResolution,
  PlacePageResolution, SubjectObservationResolution,
} from './resolvers';

export type Location = { fieldId: string; target: InspectorTarget };
export type Activity = { id: number; label: string; command: string; outcome: string };
export type ExternalStatus = { label: string; status: string; warningCount: number };
export type NavigatorOperation = {
  status: 'working' | 'failure';
  stage: 'acquire' | 'page' | 'projection' | 'facet' | 'branch' | 'note' | 'account';
  message?: string;
  command?: Record<string, unknown> | Record<string, unknown>[];
  exchanges?: ObservationExchange[];
};

/** UI-owned tracer state. Existing top-level navigation fields below are transitional UI aliases. */
export type AcquisitionUiState = {
  panelOpen: boolean;
  relays: RelaySource[];
  relaySearch: string;
  customRelay: string;
  customRelayError: string | null;
  draft: QueryDraft;
};

/** The one research-state boundary. These are aliases to the existing owned maps, never copies. */
export const atlasResearch = { places: fields, notes, accounts };

export type AtlasData = {
  history: string[];
  historyIndex: number;
  groundPlaceId: string | null;
  pinnedNoteIds: string[];
  pinnedAccountIds: string[];
  activities: Activity[];
  nextActivity: number;
  guideVisible: boolean;
  fieldRevision: number;
  acquisition: AcquisitionUiState;
  navigatorOperations: Record<string, NavigatorOperation>;
  latestExternal: ExternalStatus;
  research: typeof atlasResearch;
};

export type AtlasStore = AtlasData & {
  // Named tracer commits. Only the stateless action facade invokes these from migrated components.
  setAcquisitionPanel: (open: boolean) => void;
  setAcquisitionRelaySearch: (value: string) => void;
  setAcquisitionCustomRelay: (value: string) => void;
  addAcquisitionRelay: () => void;
  removeAcquisitionRelay: (url: string) => void;
  toggleAcquisitionRelay: (url: string) => void;
  patchAcquisitionDraft: (patch: Partial<QueryDraft>) => void;
  replaceAcquisitionDraft: (draft: QueryDraft, open: boolean) => void;
  commitOperationStarted: (key: string, operation: NavigatorOperation) => void;
  commitOperationFailure: (key: string, operation: NavigatorOperation) => void;
  clearOperation: (key: string) => void;
  commitAcquisition: (resolution: AcquisitionResolution) => void;
  commitAccountProjectionStarted: (placeId: string) => void;
  commitAccountFacetStarted: (placeId: string) => void;
  commitPlacePage: (resolution: PlacePageResolution) => void;
  commitAccountProjection: (resolution: AccountProjectionResolution) => void;
  commitAccountFacet: (resolution: AccountFacetResolution) => void;
  commitAccountNotes: (resolution: AccountNotesResolution) => void;
  commitSelection: (placeId: string, target: InspectorTarget, facet?: boolean) => boolean;
  commitObservationStarted: (placeId: string, type: 'note' | 'account', id: string) => void;
  commitObservation: (resolution: SubjectObservationResolution) => void;
  commitObservationFailure: (placeId: string, type: 'note' | 'account', id: string, error: string, exchanges: ObservationExchange[]) => void;
  setExternalStatus: (status: ExternalStatus) => void;

  // Unmigrated legacy actions retain the same maps and source of truth.
  installGround: (id: string) => void;
  installBranch: (id: string) => void;
  activatePlace: (id: string) => void;
  removePlace: (id: string) => void;
  back: () => void;
  forward: () => void;
  jump: (index: number) => void;
  openPinnedNote: (id: string) => void;
  openPinnedAccount: (id: string) => void;
  setView: (view: PlaceProjection) => void;
  setQuery: (query: string) => void;
  toggleNotePin: (id: string) => void;
  toggleAccountPin: (id: string) => void;
  setMediaLoad: (placeId: string, noteId: string, url: string, status: MediaLoadState) => void;
  dismissGuide: () => void;
  recordActivity: (label: string, command: string, outcome: string) => void;
  fieldUpdated: () => void;
};

export const initialAtlasState: AtlasData = {
  history: ['start'], historyIndex: 0, groundPlaceId: null,
  pinnedNoteIds: [], pinnedAccountIds: [], activities: [], nextActivity: 0,
  guideVisible: true, fieldRevision: 0,
  acquisition: {
    panelOpen: true, relays: DEFAULT_RELAYS.map((relay) => ({ ...relay })), relaySearch: '',
    customRelay: '', customRelayError: null, draft: { ...DEFAULT_DRAFT },
  },
  navigatorOperations: {},
  latestExternal: { label: 'No external request yet', status: 'IDLE', warningCount: 0 },
  research: atlasResearch,
};

export function currentPlaceId(state: AtlasData): string {
  return state.history[state.historyIndex] ?? 'start';
}

export function currentLocation(state: AtlasData): Location {
  const fieldId = currentPlaceId(state);
  return { fieldId, target: fieldFor(fieldId).selected };
}

export const selectAcquisition = (state: AtlasStore) => state.acquisition;
export const selectAcquisitionOperation = (state: AtlasStore) => state.navigatorOperations.acquisition;
export const subjectOperationKey = (placeId: string, type: 'note' | 'account', id: string) => `observe:${placeId}:${type}:${id}`;
export const placeOperationKey = (placeId: string, stage: 'page' | 'projection' | 'facet' | 'branch') => `${stage}:${placeId}`;

function visit(state: AtlasData, fieldId: string) {
  if (!fields[fieldId] || currentPlaceId(state) === fieldId) return {};
  const history = [...state.history.slice(0, state.historyIndex + 1), fieldId];
  return { history, historyIndex: history.length - 1 };
}

function mutateCurrent(state: AtlasData, update: (fieldId: string) => void) {
  const fieldId = currentPlaceId(state);
  if (!fields[fieldId]) return state;
  update(fieldId);
  return { fieldRevision: state.fieldRevision + 1 };
}

let nextTracerSnapshot = 0;

export const useAtlasStore = create<AtlasStore>((set) => ({
  ...initialAtlasState,
  setAcquisitionPanel: (open) => set((state) => ({ acquisition: { ...state.acquisition, panelOpen: open } })),
  setAcquisitionRelaySearch: (value) => set((state) => ({ acquisition: { ...state.acquisition, relaySearch: value } })),
  setAcquisitionCustomRelay: (value) => set((state) => ({ acquisition: { ...state.acquisition, customRelay: value, customRelayError: null } })),
  addAcquisitionRelay: () => set((state) => {
    const value = state.acquisition.customRelay.trim();
    let url: string;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'wss:') throw new Error('Relay URL must use wss://.');
      parsed.hash = ''; parsed.search = '';
      url = parsed.href.replace(/\/$/u, '');
    } catch (error) {
      return { acquisition: { ...state.acquisition, customRelayError: error instanceof Error ? error.message : 'Enter a valid wss:// relay URL.' } };
    }
    if (state.acquisition.relays.some((relay) => relay.url === url)) {
      return { acquisition: { ...state.acquisition, customRelayError: 'That relay is already listed.' } };
    }
    return { acquisition: { ...state.acquisition, relays: [...state.acquisition.relays, { url, label: new URL(url).hostname, selected: true, custom: true }], customRelay: '', customRelayError: null } };
  }),
  removeAcquisitionRelay: (url) => set((state) => ({ acquisition: { ...state.acquisition, relays: state.acquisition.relays.filter((relay) => !(relay.custom && relay.url === url)) } })),
  toggleAcquisitionRelay: (url) => set((state) => ({ acquisition: { ...state.acquisition, relays: state.acquisition.relays.map((relay) => relay.url === url ? { ...relay, selected: !relay.selected } : relay) } })),
  patchAcquisitionDraft: (patch) => set((state) => ({ acquisition: { ...state.acquisition, draft: { ...state.acquisition.draft, ...patch } } })),
  replaceAcquisitionDraft: (draft, open) => set((state) => ({ acquisition: { ...state.acquisition, draft: { ...draft }, panelOpen: open } })),
  commitOperationStarted: (key, operation) => set((state) => ({ navigatorOperations: { ...state.navigatorOperations, [key]: operation } })),
  commitOperationFailure: (key, operation) => set((state) => ({ navigatorOperations: { ...state.navigatorOperations, [key]: operation } })),
  clearOperation: (key) => set((state) => {
    const navigatorOperations = { ...state.navigatorOperations };
    delete navigatorOperations[key];
    return { navigatorOperations };
  }),
  commitAcquisition: (resolution) => set((state) => {
    mergePresentedEvidence(resolution.notes, resolution.baseNotes, resolution.accounts);
    if (state.groundPlaceId && fields[state.groundPlaceId] && state.groundPlaceId !== resolution.place.id) fields[state.groundPlaceId].role = 'branch';
    fields[resolution.place.id] = resolution.place;
    const observation = resolution.observationFailure;
    resolution.place.observationSnapshots.push({
      id: `atlas-tracer-observation-${++nextTracerSnapshot}`,
      target: { type: 'place', id: resolution.place.id }, sourceHandleId: resolution.handleId,
      observedRevision: observation ? resolution.installRevision : responseRevision(resolution, resolution.installRevision),
      locality: 'local', exchanges: observation ? [observation] : resolution.preview ? [{ command: resolution.showCommand, response: resolution.preview.response, receipt: resolution.preview.receipt }] : [],
      facts: observation ? { status: 'failure', unavailable: true, error: exchangeError(observation) } : resolution.preview?.result ?? {},
    });
    const moved = visit(state, resolution.place.id);
    const nextActivity = state.nextActivity + 1;
    const navigatorOperations = { ...state.navigatorOperations };
    if (observation) navigatorOperations.acquisition = {
      status: 'failure', stage: 'page', message: 'Ground was installed, but its first bounded preview is unavailable.', command: resolution.showCommand,
    };
    else delete navigatorOperations.acquisition;
    return {
      ...moved, groundPlaceId: resolution.place.id, fieldRevision: state.fieldRevision + 1,
      acquisition: { ...state.acquisition, panelOpen: false },
      navigatorOperations, latestExternal: resolution.externalStatus, nextActivity,
      activities: [{
        id: nextActivity, label: 'Installed explicit acquisition as Ground', command: JSON.stringify([resolution.command, resolution.showCommand]),
        outcome: observation
          ? `${resolution.count} event subjects retained · Ground installed · first preview unavailable`
          : `${resolution.count} event subjects · handle ${resolution.handleId} installed once at revision ${resolution.installRevision}`,
      }, ...state.activities].slice(0, 20),
    };
  }),
  commitAccountProjectionStarted: (placeId) => set((state) => {
    const place = fields[placeId];
    if (!place) return state;
    place.projection = 'accounts';
    place.accountProjection = { status: 'loading', handleId: '', command: {}, accountIds: [] };
    return { fieldRevision: state.fieldRevision + 1 };
  }),
  commitAccountFacetStarted: (placeId) => set((state) => {
    const place = fields[placeId];
    if (!place) return state;
    place.accountFacet = { status: 'loading', sourcePlaceId: place.id, sourceHandleId: place.handleId, commands: [], records: [] };
    return { fieldRevision: state.fieldRevision + 1 };
  }),
  commitPlacePage: (resolution) => set((state) => {
    const place = fields[resolution.placeId];
    if (!place?.runtime) return state;
    const operationKey = placeOperationKey(resolution.placeId, 'page');
    const navigatorOperations = { ...state.navigatorOperations };
    if (resolution.status === 'failure') {
      navigatorOperations[operationKey] = { status: 'failure', stage: 'page', message: resolution.error, command: resolution.command, exchanges: resolution.exchanges };
      place.observationSnapshots.push({
        id: `atlas-tracer-observation-${++nextTracerSnapshot}`, target: { type: 'place', id: place.id }, sourceHandleId: place.handleId,
        observedRevision: lastExchangeRevision(resolution.exchanges, place.installRevision), locality: 'local', exchanges: resolution.exchanges,
        facts: { status: 'failure', error: resolution.error },
      });
      return { navigatorOperations, fieldRevision: state.fieldRevision + 1 };
    }
    mergePresentedEvidence(resolution.notes, resolution.baseNotes, resolution.accounts);
    const newIds = Object.keys(resolution.notes).filter((id) => !place.noteIds.includes(id));
    place.noteIds = [...place.noteIds, ...newIds];
    place.runtime.nextOffset = resolution.nextOffset;
    place.runtime.handleAddedCount += newIds.length;
    place.localPageOffset = resolution.nextOffset;
    place.observationSnapshots.push({
      id: `atlas-tracer-observation-${++nextTracerSnapshot}`, target: { type: 'place', id: place.id }, sourceHandleId: place.handleId,
      observedRevision: lastExchangeRevision(resolution.exchanges, place.installRevision), locality: 'local', exchanges: resolution.exchanges,
      facts: resolution.exchanges.at(-1)?.response.result as Record<string, unknown> ?? {},
    });
    delete navigatorOperations[operationKey];
    const nextActivity = state.nextActivity + 1;
    return {
      navigatorOperations, fieldRevision: state.fieldRevision + 1, nextActivity,
      activities: [{ id: nextActivity, label: 'Loaded more from the current place handle', command: JSON.stringify(resolution.command), outcome: `${newIds.length} additional notes displayed · ${resolution.nextOffset} of ${place.runtime.total} observed locally` }, ...state.activities].slice(0, 20),
    };
  }),
  commitAccountProjection: (resolution) => set((state) => {
    const place = fields[resolution.placeId];
    if (!place) return state;
    for (const [id, account] of Object.entries(resolution.accounts)) accounts[id] ??= account;
    place.projection = 'accounts';
    place.accountProjection = {
      status: resolution.status, handleId: resolution.handleId, command: resolution.command, accountIds: resolution.accountIds,
      ...(resolution.installRevision === undefined ? {} : { installRevision: resolution.installRevision }),
      ...(resolution.receipt ? { receipt: resolution.receipt } : {}), ...(resolution.countUnit ? { countUnit: resolution.countUnit } : {}),
      ...(resolution.bounds ? { bounds: resolution.bounds } : {}), ...(resolution.omissions ? { omissions: resolution.omissions } : {}),
      ...(resolution.error ? { error: resolution.error } : {}),
    };
    place.observationSnapshots.push({
      id: `atlas-tracer-observation-${++nextTracerSnapshot}`, target: { type: 'place', id: `${place.id}:accounts` }, sourceHandleId: resolution.handleId,
      observedRevision: lastExchangeRevision(resolution.exchanges, resolution.installRevision ?? place.installRevision), locality: 'local', exchanges: resolution.exchanges,
      facts: place.accountProjection as unknown as Record<string, unknown>,
    });
    const nextActivity = resolution.status === 'available' ? state.nextActivity + 1 : state.nextActivity;
    return {
      fieldRevision: state.fieldRevision + 1, nextActivity,
      ...(resolution.status === 'available' ? { activities: [{ id: nextActivity, label: 'Opened local account-list projection', command: JSON.stringify(resolution.commands), outcome: `${resolution.accountIds.length} displayed accounts · supporting handle ${resolution.handleId} · no relay contacted` }, ...state.activities].slice(0, 20) } : {}),
    };
  }),
  commitAccountFacet: (resolution) => set((state) => {
    const place = fields[resolution.placeId];
    if (!place) return state;
    for (const [id, account] of Object.entries(resolution.accounts)) accounts[id] ??= account;
    place.accountFacet = {
      status: resolution.status, sourcePlaceId: place.id, sourceHandleId: resolution.sourceHandleId,
      commands: resolution.commands, handles: resolution.handles, records: resolution.records,
      ...(resolution.countUnit ? { countUnit: resolution.countUnit } : {}), ...(resolution.bounds ? { bounds: resolution.bounds } : {}),
      ...(resolution.truncated === undefined ? {} : { truncated: resolution.truncated }), ...(resolution.omissions ? { omissions: resolution.omissions } : {}),
      ...(resolution.error ? { error: resolution.error } : {}),
    };
    place.observationSnapshots.push({
      id: `atlas-tracer-observation-${++nextTracerSnapshot}`, target: { type: 'facet', id: 'account-frequency' }, sourceHandleId: place.handleId,
      observedRevision: lastExchangeRevision(resolution.exchanges, place.installRevision), locality: 'local', exchanges: resolution.exchanges,
      facts: resolution.status === 'available' ? { records: resolution.records, countUnit: resolution.countUnit, bounds: resolution.bounds, truncated: resolution.truncated, omissions: resolution.omissions, lineage: resolution.records[0]?.lineage } : { status: 'failure', error: resolution.error },
    });
    const nextActivity = resolution.status === 'available' ? state.nextActivity + 1 : state.nextActivity;
    return {
      fieldRevision: state.fieldRevision + 1, nextActivity,
      ...(resolution.status === 'available' ? { activities: [{ id: nextActivity, label: 'Derived bounded account frequency locally', command: JSON.stringify(resolution.commands), outcome: `${resolution.records.length} account facet rows · count unit ${resolution.countUnit ?? 'rows'} · no relay contacted` }, ...state.activities].slice(0, 20) } : {}),
    };
  }),
  commitAccountNotes: (resolution) => set((state) => {
    const source = fields[resolution.sourcePlaceId];
    if (!source) return state;
    if (resolution.status === 'failure' || !resolution.place) {
      source.observationSnapshots.push({
        id: `atlas-tracer-observation-${++nextTracerSnapshot}`, target: { type: 'facet', id: 'account-notes' }, sourceHandleId: source.handleId,
        observedRevision: lastExchangeRevision(resolution.exchanges, source.installRevision), locality: 'local', exchanges: resolution.exchanges,
        facts: { status: 'failure', error: resolution.error },
      });
      return { fieldRevision: state.fieldRevision + 1 };
    }
    mergePresentedEvidence(resolution.notes, resolution.baseNotes, resolution.accounts);
    fields[resolution.place.id] = resolution.place;
    const moved = visit(state, resolution.place.id);
    const nextActivity = state.nextActivity + 1;
    return {
      ...moved, fieldRevision: state.fieldRevision + 1, nextActivity,
      activities: [{ id: nextActivity, label: 'Opened local account-note branch', command: JSON.stringify(resolution.commands), outcome: resolution.observationFailure ? 'Branch handle installed · first preview unavailable · Ground unchanged · no relay contacted' : `${resolution.place.noteIds.length} event subjects · Ground unchanged · no relay contacted` }, ...state.activities].slice(0, 20),
    };
  }),
  commitSelection: (placeId, target, facet = false) => {
    let selected = false;
    set((state) => {
      const place = fields[placeId];
      if (!place || !target.id) return state;
      if (target.type === 'note' && !place.noteIds.includes(target.id) && !notes[target.id]) {
        place.selected = target; selected = true;
      } else if (target.type === 'account' && accounts[target.id]) {
        place.selected = target; selected = true;
        if (facet && place.accountFacet?.records.some((record) => record.account === target.id)) place.selectedFacet = target.id;
      } else if (target.type === 'note' || target.type === 'address') {
        place.selected = target; selected = true;
      }
      return selected ? { fieldRevision: state.fieldRevision + 1 } : state;
    });
    return selected;
  },
  commitObservationStarted: (placeId, type, id) => set((state) => {
    const place = fields[placeId];
    if (!place) return state;
    if (type === 'account') ensureAccountResearch(placeId, id).localStatus = 'loading';
    addSubjectSnapshot(placeId, type, id, { status: 'loading' }, []);
    return { fieldRevision: state.fieldRevision + 1 };
  }),
  commitObservation: (resolution) => set((state) => {
    const operationKey = subjectOperationKey(resolution.placeId, resolution.kind === 'note-observation' ? 'note' : 'account', resolution.subjectId);
    const navigatorOperations = { ...state.navigatorOperations };
    delete navigatorOperations[operationKey];
    const place = fields[resolution.placeId];
    if (!place) return { navigatorOperations };
    const activity = resolution.activity;
    if (resolution.kind === 'note-observation') {
      const note = notes[resolution.subjectId];
      if (note) Object.assign(note, resolution.notePatch);
      for (const account of resolution.referencedAccounts) accounts[account.id] ??= account;
      ensureNoteResearch(resolution.placeId, resolution.subjectId);
      addSubjectSnapshot(resolution.placeId, 'note', resolution.subjectId, resolution.observation as unknown as Record<string, unknown>, resolution.exchanges);
      if (resolution.authorResearch) {
        const accountState = ensureAccountResearch(resolution.placeId, resolution.authorResearch.accountId);
        accountState.engineHandleId = resolution.authorResearch.engineHandleId;
        accountState.localStatus = 'available';
        accountState.localResolution = resolution.authorResearch.localResolution;
      }
    } else {
      const accountState = ensureAccountResearch(resolution.placeId, resolution.subjectId);
      accountState.localStatus = resolution.status;
      accountState.localResolution = resolution.localResolution;
      if (resolution.engineHandleId) accountState.engineHandleId = resolution.engineHandleId;
      addSubjectSnapshot(resolution.placeId, 'account', resolution.subjectId, {
        status: resolution.status, resolution: resolution.localResolution, engineHandleId: resolution.engineHandleId,
      }, resolution.exchanges);
    }
    if (!activity) return { fieldRevision: state.fieldRevision + 1, navigatorOperations };
    const nextActivity = state.nextActivity + 1;
    return {
      fieldRevision: state.fieldRevision + 1, navigatorOperations, nextActivity,
      activities: [{ id: nextActivity, ...activity }, ...state.activities].slice(0, 20),
    };
  }),
  commitObservationFailure: (placeId, type, id, error, exchanges) => set((state) => {
    const place = fields[placeId];
    if (!place) return state;
    if (type === 'account') {
      const accountState = ensureAccountResearch(placeId, id);
      accountState.localStatus = 'failure'; accountState.localError = error;
    }
    addSubjectSnapshot(placeId, type, id, { status: 'failure', error }, exchanges);
    return { fieldRevision: state.fieldRevision + 1 };
  }),
  setExternalStatus: (latestExternal) => set({ latestExternal }),

  installGround: (id) => set((state) => {
    if (!fields[id]) return state;
    if (state.groundPlaceId && fields[state.groundPlaceId] && state.groundPlaceId !== id) fields[state.groundPlaceId].role = 'branch';
    fields[id].role = 'ground';
    return { ...visit(state, id), groundPlaceId: id, fieldRevision: state.fieldRevision + 1 };
  }),
  installBranch: (id) => set((state) => { if (!fields[id]) return state; fields[id].role = 'branch'; return { ...visit(state, id), fieldRevision: state.fieldRevision + 1 }; }),
  activatePlace: (id) => set((state) => fields[id] ? visit(state, id) : state),
  removePlace: (id) => set((state) => {
    if (!fields[id] || id === state.groundPlaceId) return state;
    delete fields[id];
    const retained = state.history.filter((placeId) => placeId !== id && (placeId === 'start' || fields[placeId]));
    const history = retained.length ? retained : state.groundPlaceId ? [state.groundPlaceId] : ['start'];
    return { history, historyIndex: Math.min(state.historyIndex, history.length - 1), fieldRevision: state.fieldRevision + 1 };
  }),
  back: () => set((state) => state.historyIndex > 0 ? { historyIndex: state.historyIndex - 1 } : state),
  forward: () => set((state) => state.historyIndex < state.history.length - 1 ? { historyIndex: state.historyIndex + 1 } : state),
  jump: (index) => set((state) => Number.isInteger(index) && index >= 0 && index < state.history.length ? { historyIndex: index } : state),
  openPinnedNote: (id) => set((state) => {
    if (!notes[id]) return state;
    const fieldId = Object.values(fields).find((field) => field.noteIds.includes(id))?.id;
    if (!fieldId) return state;
    fields[fieldId].selected = { type: 'note', id };
    return { ...visit(state, fieldId), fieldRevision: state.fieldRevision + 1 };
  }),
  openPinnedAccount: (id) => set((state) => {
    if (!accounts[id]) return state;
    const fieldId = fields[currentPlaceId(state)] ? currentPlaceId(state) : state.groundPlaceId;
    if (!fieldId || !fields[fieldId]) return state;
    fields[fieldId].selected = { type: 'account', id };
    return { fieldRevision: state.fieldRevision + 1 };
  }),
  setView: (view) => set((state) => mutateCurrent(state, (fieldId) => { fields[fieldId].projection = view; })),
  setQuery: (query) => set((state) => mutateCurrent(state, (fieldId) => { fields[fieldId].localConstraints.text = query; })),
  toggleNotePin: (id) => set((state) => state.pinnedNoteIds.includes(id) ? { pinnedNoteIds: state.pinnedNoteIds.filter((item) => item !== id) } : notes[id] ? { pinnedNoteIds: [...state.pinnedNoteIds, id] } : state),
  toggleAccountPin: (id) => set((state) => state.pinnedAccountIds.includes(id) ? { pinnedAccountIds: state.pinnedAccountIds.filter((item) => item !== id) } : accounts[id] ? { pinnedAccountIds: [...state.pinnedAccountIds, id] } : state),
  setMediaLoad: (placeId, noteId, url, status) => set((state) => {
    const place = fields[placeId];
    if (!place || (!notes[noteId] && !noteId.startsWith('profile:')) || !url) return state;
    place.mediaLoads ??= {}; place.mediaLoads[noteId] ??= {}; place.mediaLoads[noteId][url] = status;
    return { fieldRevision: state.fieldRevision + 1 };
  }),
  dismissGuide: () => set({ guideVisible: false }),
  recordActivity: (label, command, outcome) => set((state) => {
    const nextActivity = state.nextActivity + 1;
    return { nextActivity, activities: [{ id: nextActivity, label, command, outcome }, ...state.activities].slice(0, 20) };
  }),
  fieldUpdated: () => set((state) => ({ fieldRevision: state.fieldRevision + 1 })),
}));

function ensureAccountResearch(placeId: string, accountId: string): AccountResearchState {
  const place = fields[placeId];
  const existing = place.accountResearch[accountId];
  if (existing) return existing;
  const relays = [...(place.runtime?.relays ?? [])];
  const excludeContentWarnings = place.runtime?.draft.excludeContentWarnings ?? true;
  const state: AccountResearchState = {
    localStatus: 'idle',
    profileDraft: { relays, timeoutMs: 10000, observationLimit: 80, distinctEventLimit: 60, concurrency: 2, excludeContentWarnings },
    authoredDraft: { relays, eventLimit: 50, timeoutMs: 10000, observationLimit: 80, distinctEventLimit: 60, concurrency: 2, excludeContentWarnings },
  };
  place.accountResearch[accountId] = state;
  return state;
}

function ensureNoteResearch(placeId: string, noteId: string): NoteResearchState {
  const place = fields[placeId];
  place.noteResearch ??= {};
  const existing = place.noteResearch[noteId];
  if (existing) return existing;
  const relays = [...(place.runtime?.relays ?? [])];
  const state: NoteResearchState = {
    draftOpen: false,
    relationshipDraft: {
      relays, relationship: 'replies', eventLimit: 20, timeoutMs: 10000, observationLimit: 80,
      distinctEventLimit: 60, concurrency: 2, excludeContentWarnings: place.runtime?.draft.excludeContentWarnings ?? true,
    }, attempts: {},
  };
  place.noteResearch[noteId] = state;
  return state;
}

function addSubjectSnapshot(placeId: string, type: 'note' | 'account', id: string, facts: Record<string, unknown>, exchanges: ObservationExchange[]) {
  const place = fields[placeId];
  place.observationSnapshots.push({
    id: `atlas-tracer-observation-${++nextTracerSnapshot}`, target: { type, id }, sourceHandleId: place.handleId,
    observedRevision: lastExchangeRevision(exchanges, place.installRevision), locality: 'local', exchanges, facts,
  });
}

function lastExchangeRevision(exchanges: ObservationExchange[], fallback: number) {
  for (const item of [...exchanges].reverse()) {
    const revision = item.response.sessionRevision;
    if (Number.isSafeInteger(revision)) return revision as number;
  }
  return fallback;
}

function hasRetainedNoteObservation(noteId: string) {
  return Object.values(fields).some((place) => place.observationSnapshots.some((snapshot) =>
    snapshot.target.type === 'note' && snapshot.target.id === noteId
      && ['available', 'unresolved'].includes(String(snapshot.facts.status)),
  ));
}

function noteChangedSinceCapture(current: typeof notes[string], base?: typeof notes[string]) {
  return !base || JSON.stringify(current) !== JSON.stringify(base);
}

function mergePresentedEvidence(
  presentedNotes: typeof notes,
  baseNotes: typeof notes,
  presentedAccounts: typeof accounts,
) {
  for (const [id, account] of Object.entries(presentedAccounts)) accounts[id] ??= account;
  for (const [id, presented] of Object.entries(presentedNotes)) {
    const current = notes[id];
    const base = baseNotes[id];
    if (current && (hasRetainedNoteObservation(id) || noteChangedSinceCapture(current, base))) {
      notes[id] = {
        ...presented, ...current,
        relayCount: Math.max(presented.relayCount, current.relayCount),
        relayUrls: [...new Set([...(current.relayUrls ?? []), ...(presented.relayUrls ?? [])])],
      };
    } else notes[id] = presented;
  }
}

function exchangeError(exchange: ObservationExchange) {
  const error = exchange.response.error as Record<string, unknown> | undefined;
  const transport = exchange.response.transportFailure as Record<string, unknown> | undefined;
  return typeof error?.message === 'string' ? error.message : typeof transport?.message === 'string' ? transport.message : 'Observation unavailable.';
}

function responseRevision(resolution: AcquisitionResolution, fallback: number) {
  return Number.isSafeInteger(resolution.preview?.response.sessionRevision) ? resolution.preview!.response.sessionRevision as number : fallback;
}
