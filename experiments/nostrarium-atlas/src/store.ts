import { create } from 'zustand';
import {
  accounts, fieldFor, fields, notes, retainObservedProfile, type AccountResearchState, type InspectorTarget,
  type MediaLoadState, type NoteResearchState, type ObservationExchange, type PlaceProjection,
} from './data';
import {
  DEFAULT_DRAFT, DEFAULT_RELAYS, type AuthorResolutionDraft, type AuthoredActionDraft, type ExternalActionDraft,
  type NoteRelationship, type QueryDraft, type RelaySource, type RelationshipActionDraft,
} from './live-types';
import type {
  AccountFacetResolution, AccountNotesResolution, AccountProjectionResolution, AcquisitionResolution,
  AuthoredNotesResolution, AuthorResolutionResolution, NoteRelationshipResolution, PlacePageResolution,
  ProfileHydrationResolution, SubjectObservationResolution,
} from './resolvers';

export type Location = { fieldId: string; target: InspectorTarget };
export type Activity = { id: number; label: string; command: string; outcome: string };
export type ExternalStatus = { label: string; status: string; warningCount: number };
export type NavigatorOperation = {
  status: 'working' | 'failure';
  stage: 'acquire' | 'page' | 'projection' | 'facet' | 'branch' | 'note' | 'account' | 'profile' | 'authored' | 'relationship' | 'authors';
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

export type WorkspaceSurface = 'context' | 'field' | 'inspector';
export type InspectorDraft = { placeId: string; subjectId: string; kind: 'profile' | 'authored' | 'relationship' } | null;

export type AtlasData = {
  history: string[];
  historyIndex: number;
  groundPlaceId: string | null;
  activities: Activity[];
  nextActivity: number;
  guideVisible: boolean;
  fieldRevision: number;
  acquisition: AcquisitionUiState;
  navigatorOperations: Record<string, NavigatorOperation>;
  latestExternal: ExternalStatus;
  workspaceSurface: WorkspaceSurface;
  inspectorDraft: InspectorDraft;
  research: typeof atlasResearch;
};

export type AtlasStore = AtlasData & {
  // Named tracer commits. Only the stateless action facade invokes these from migrated components.
  setAcquisitionPanel: (open: boolean) => void;
  setWorkspaceSurface: (surface: WorkspaceSurface) => void;
  setInspectorDraft: (draft: InspectorDraft) => void;
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
  failAccountProjection: (placeId: string, error: string) => void;
  failAccountFacet: (placeId: string, error: string) => void;
  commitPlacePage: (resolution: PlacePageResolution) => void;
  commitAccountProjection: (resolution: AccountProjectionResolution) => void;
  commitAccountFacet: (resolution: AccountFacetResolution) => void;
  commitAccountNotes: (resolution: AccountNotesResolution) => void;
  commitSelection: (placeId: string, target: InspectorTarget, facet?: boolean, memberOnly?: boolean) => boolean;
  commitObservationStarted: (placeId: string, type: 'note' | 'account', id: string) => void;
  commitObservation: (resolution: SubjectObservationResolution) => void;
  commitObservationFailure: (placeId: string, type: 'note' | 'account', id: string, error: string, exchanges: ObservationExchange[]) => void;
  prepareAccountResearch: (placeId: string, accountId: string, draft: QueryDraft, command: Record<string, unknown>) => void;
  updateProfileDraft: (placeId: string, accountId: string, draft: ExternalActionDraft) => void;
  updateAuthoredDraft: (placeId: string, accountId: string, draft: AuthoredActionDraft) => void;
  prepareNoteRelationship: (placeId: string, noteId: string, relationship: NoteRelationship, command: Record<string, unknown>) => void;
  updateNoteRelationshipDraft: (placeId: string, noteId: string, draft: RelationshipActionDraft) => void;
  prepareAuthorResolution: (placeId: string, commands: Record<string, unknown>[]) => void;
  updateAuthorResolutionDraft: (placeId: string, draft: AuthorResolutionDraft) => void;
  commitProfileStarted: (key: string, placeId: string, accountId: string, draft: ExternalActionDraft) => void;
  commitProfileHydration: (key: string, resolution: ProfileHydrationResolution) => void;
  commitAuthoredStarted: (key: string, placeId: string, accountId: string, draft: AuthoredActionDraft) => void;
  commitAuthoredNotes: (key: string, resolution: AuthoredNotesResolution) => void;
  commitRelationshipStarted: (key: string, placeId: string, noteId: string, relationship: NoteRelationship, source: 'local' | 'relays', draft: RelationshipActionDraft) => void;
  commitNoteRelationship: (key: string, resolution: NoteRelationshipResolution) => void;
  commitAuthorsStarted: (key: string, placeId: string, draft: AuthorResolutionDraft) => void;
  commitAuthorResolution: (key: string, resolution: AuthorResolutionResolution) => void;
  commitExternalFailure: (key: string, stage: 'profile' | 'authored' | 'relationship' | 'authors', message: string, command?: Record<string, unknown> | Record<string, unknown>[], exchanges?: ObservationExchange[], target?: { placeId: string; installRevision?: number; accountId?: string; noteId?: string; relationship?: NoteRelationship; source?: 'local' | 'relays' }) => void;
  setExternalStatus: (status: ExternalStatus) => void;

  // UI-local navigation and presentation state share the same maps and source of truth.
  installGround: (id: string) => void;
  installBranch: (id: string) => void;
  activatePlace: (id: string) => void;
  removePlace: (id: string) => void;
  back: () => void;
  forward: () => void;
  jump: (index: number) => void;
  setView: (view: PlaceProjection) => void;
  setQuery: (query: string) => void;
  setMediaLoad: (placeId: string, noteId: string, url: string, status: MediaLoadState) => void;
  dismissGuide: () => void;
};

export const initialAtlasState: AtlasData = {
  history: ['start'], historyIndex: 0, groundPlaceId: null,
  activities: [], nextActivity: 0,
  guideVisible: true, fieldRevision: 0,
  acquisition: {
    panelOpen: true, relays: DEFAULT_RELAYS.map((relay) => ({ ...relay })), relaySearch: '',
    customRelay: '', customRelayError: null, draft: { ...DEFAULT_DRAFT },
  },
  navigatorOperations: {},
  latestExternal: { label: 'No external request yet', status: 'IDLE', warningCount: 0 },
  workspaceSurface: 'field', inspectorDraft: null,
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
export const profileOperationKey = (placeId: string, accountId: string) => `profile:${placeId}:account:${accountId}`;
export const authoredOperationKey = (placeId: string, accountId: string) => `authored:${placeId}:account:${accountId}`;
export const relationshipOperationKey = (placeId: string, noteId: string, relationship: NoteRelationship, source: 'local' | 'relays') => `relationship:${placeId}:note:${noteId}:${relationship}:${source}`;
export const authorsOperationKey = (placeId: string) => `authors:${placeId}`;

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
  setWorkspaceSurface: (workspaceSurface) => set({ workspaceSurface }),
  setInspectorDraft: (inspectorDraft) => set({ inspectorDraft }),
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
    place.accountProjection = place.accountProjection
      ? { ...place.accountProjection, status: 'loading', error: undefined }
      : { status: 'loading', handleId: '', command: {}, accountIds: [] };
    return { fieldRevision: state.fieldRevision + 1 };
  }),
  commitAccountFacetStarted: (placeId) => set((state) => {
    const place = fields[placeId];
    if (!place) return state;
    place.accountFacet = place.accountFacet
      ? { ...place.accountFacet, status: 'loading', error: undefined }
      : { status: 'loading', sourcePlaceId: place.id, sourceHandleId: place.handleId, commands: [], records: [] };
    return { fieldRevision: state.fieldRevision + 1 };
  }),
  failAccountProjection: (placeId, error) => set((state) => {
    const projection = fields[placeId]?.accountProjection;
    if (!projection) return state;
    projection.status = 'failure'; projection.error = error;
    return { fieldRevision: state.fieldRevision + 1 };
  }),
  failAccountFacet: (placeId, error) => set((state) => {
    const facet = fields[placeId]?.accountFacet;
    if (!facet) return state;
    facet.status = 'failure'; facet.error = error;
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
        id: `atlas-tracer-observation-${++nextTracerSnapshot}`, target: { type: 'facet', id: `account-notes:${resolution.accountId}` }, sourceHandleId: resolution.rowsHandleId,
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
  commitSelection: (placeId, target, facet = false, memberOnly = false) => {
    let selected = false;
    set((state) => {
      const place = fields[placeId];
      if (!place || !target.id || (memberOnly && target.type === 'note' && !place.noteIds.includes(target.id))) return state;
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
  prepareAccountResearch: (placeId, accountId, draft, command) => set((state) => {
    const place = fields[placeId];
    if (!place?.accountFacet?.records.some((record) => record.account === accountId)) return state;
    place.selectedFacet = accountId;
    const nextActivity = state.nextActivity + 1;
    return {
      fieldRevision: state.fieldRevision + 1, nextActivity,
      acquisition: { ...state.acquisition, draft: { ...draft }, panelOpen: true },
      activities: [{ id: nextActivity, label: 'Prepared independent relay acquisition draft', command: JSON.stringify(command), outcome: 'Draft only · no relay contacted · older draft constraints discarded' }, ...state.activities].slice(0, 20),
    };
  }),
  updateProfileDraft: (placeId, accountId, draft) => set((state) => {
    const place = fields[placeId]; if (!place) return state;
    ensureAccountResearch(placeId, accountId).profileDraft = clone(draft);
    return { fieldRevision: state.fieldRevision + 1 };
  }),
  updateAuthoredDraft: (placeId, accountId, draft) => set((state) => {
    const place = fields[placeId]; if (!place) return state;
    ensureAccountResearch(placeId, accountId).authoredDraft = clone(draft);
    return { fieldRevision: state.fieldRevision + 1 };
  }),
  prepareNoteRelationship: (placeId, noteId, relationship, command) => set((state) => {
    const place = fields[placeId]; if (!place || !noteEventHandle(placeId, noteId)) return state;
    const research = ensureNoteResearch(placeId, noteId); research.draftOpen = true; research.relationshipDraft.relationship = relationship;
    const nextActivity = state.nextActivity + 1;
    return { fieldRevision: state.fieldRevision + 1, nextActivity, activities: [{ id: nextActivity, label: 'Prepared note-relationship relay draft', command: JSON.stringify(command), outcome: 'Draft only · no relay contacted' }, ...state.activities].slice(0, 20) };
  }),
  updateNoteRelationshipDraft: (placeId, noteId, draft) => set((state) => {
    if (!fields[placeId]) return state; ensureNoteResearch(placeId, noteId).relationshipDraft = clone(draft);
    return { fieldRevision: state.fieldRevision + 1 };
  }),
  prepareAuthorResolution: (placeId, commands) => set((state) => {
    const place = fields[placeId]; if (!place || place.role === 'start') return state;
    ensureAuthorResolution(placeId).draftOpen = true;
    const nextActivity = state.nextActivity + 1;
    return { fieldRevision: state.fieldRevision + 1, nextActivity, activities: [{ id: nextActivity, label: 'Prepared Resolve authors draft', command: JSON.stringify(commands), outcome: 'Draft only · no relay contacted' }, ...state.activities].slice(0, 20) };
  }),
  updateAuthorResolutionDraft: (placeId, draft) => set((state) => {
    if (!fields[placeId]) return state; ensureAuthorResolution(placeId).draft = clone(draft);
    return { fieldRevision: state.fieldRevision + 1 };
  }),
  commitProfileStarted: (key, placeId, accountId, draft) => set((state) => {
    const place = fields[placeId]; if (!place) return state;
    ensureAccountResearch(placeId, accountId).profile = { status: 'loading', relays: [...draft.relays] };
    return { fieldRevision: state.fieldRevision + 1, navigatorOperations: { ...state.navigatorOperations, [key]: { status: 'working', stage: 'profile' } } };
  }),
  commitProfileHydration: (key, resolution) => set((state) => {
    const place = fields[resolution.placeId]; const navigatorOperations = { ...state.navigatorOperations };
    if (!place) return settleMissingSource(state, navigatorOperations, key, 'profile', resolution.placeId, `account:${resolution.accountId}`);
    ensureAccountResearch(resolution.placeId, resolution.accountId).profile = clone(resolution.profile);
    if (resolution.profile.status !== 'failure') retainObservedProfile(resolution.accountId, resolution.profile, resolution.placeId, resolution.observedRevision);
    addExternalSnapshot(place, { type: 'account', id: resolution.accountId }, resolution.sourceHandleId, resolution.observedRevision, resolution.exchanges, resolution.profile as unknown as Record<string, unknown>);
    settleResolutionOperation(navigatorOperations, key, 'profile', resolution.profile.status === 'failure' ? resolution.profile.error : undefined, resolution.commands, resolution.exchanges);
    return resolutionState(state, navigatorOperations, resolution.externalStatus, resolution.activity);
  }),
  commitAuthoredStarted: (key, placeId, accountId, draft) => set((state) => {
    if (!fields[placeId]) return state;
    ensureAccountResearch(placeId, accountId).authoredNotes = { status: 'loading', relays: [...draft.relays], eventLimit: draft.eventLimit };
    return { fieldRevision: state.fieldRevision + 1, navigatorOperations: { ...state.navigatorOperations, [key]: { status: 'working', stage: 'authored' } } };
  }),
  commitAuthoredNotes: (key, resolution) => set((state) => {
    const source = fields[resolution.placeId]; const navigatorOperations = { ...state.navigatorOperations };
    if (!source) return settleMissingSource(state, navigatorOperations, key, 'authored', resolution.placeId, `account:${resolution.accountId}`);
    ensureAccountResearch(resolution.placeId, resolution.accountId).authoredNotes = clone(resolution.authoredNotes);
    addExternalSnapshot(source, { type: 'account', id: resolution.accountId }, resolution.sourceHandleId, resolution.observedRevision, resolution.exchanges, resolution.authoredNotes as unknown as Record<string, unknown>);
    let moved = {}; if (resolution.place) { mergePresentedEvidence(resolution.notes, resolution.baseNotes, resolution.accounts); fields[resolution.place.id] = resolution.place; moved = visit(state, resolution.place.id); }
    const message = resolution.authoredNotes.error ?? (resolution.observationFailure ? 'Authored-note branch opened, but its first bounded preview is unavailable.' : undefined);
    settleResolutionOperation(navigatorOperations, key, 'authored', message, resolution.commands, resolution.exchanges);
    return { ...resolutionState(state, navigatorOperations, resolution.externalStatus, resolution.activity), ...moved };
  }),
  commitRelationshipStarted: (key, placeId, noteId, relationship, source, draft) => set((state) => {
    if (!fields[placeId]) return state;
    setRelationshipAttempt(ensureNoteResearch(placeId, noteId), relationship, source, { status: 'loading', relationship, source, relays: source === 'local' ? [] : [...draft.relays] });
    return { fieldRevision: state.fieldRevision + 1, navigatorOperations: { ...state.navigatorOperations, [key]: { status: 'working', stage: 'relationship' } } };
  }),
  commitNoteRelationship: (key, resolution) => set((state) => {
    const sourcePlace = fields[resolution.placeId]; const navigatorOperations = { ...state.navigatorOperations };
    if (!sourcePlace) return settleMissingSource(state, navigatorOperations, key, 'relationship', resolution.placeId, `note:${resolution.noteId}:${resolution.relationship}:${resolution.source}`);
    setRelationshipAttempt(ensureNoteResearch(resolution.placeId, resolution.noteId), resolution.relationship, resolution.source, clone(resolution.attempt));
    addExternalSnapshot(sourcePlace, { type: 'place', id: `${resolution.noteId}:${resolution.relationship}:${resolution.source}` }, resolution.sourceHandleId, resolution.observedRevision, resolution.exchanges, resolution.attempt as unknown as Record<string, unknown>, resolution.source === 'local' ? 'local' : 'external');
    let moved = {}; if (resolution.place) { mergePresentedEvidence(resolution.notes, resolution.baseNotes, resolution.accounts); fields[resolution.place.id] = resolution.place; moved = visit(state, resolution.place.id); }
    const message = resolution.attempt.error ?? (resolution.observationFailure ? `${resolution.source === 'local' ? 'Local' : 'Relay relationship'} branch opened, but its first bounded preview is unavailable.` : undefined);
    settleResolutionOperation(navigatorOperations, key, 'relationship', message, resolution.commands, resolution.exchanges);
    return { ...resolutionState(state, navigatorOperations, resolution.externalStatus, resolution.activity), ...moved };
  }),
  commitAuthorsStarted: (key, placeId, draft) => set((state) => {
    if (!fields[placeId]) return state;
    ensureAuthorResolution(placeId).attempt = { status: 'loading', relays: [...draft.relays] };
    return { fieldRevision: state.fieldRevision + 1, navigatorOperations: { ...state.navigatorOperations, [key]: { status: 'working', stage: 'authors' } } };
  }),
  commitAuthorResolution: (key, resolution) => set((state) => {
    const place = fields[resolution.placeId]; const navigatorOperations = { ...state.navigatorOperations };
    if (!place) return settleMissingSource(state, navigatorOperations, key, 'authors', resolution.placeId, 'place:resolved-authors');
    for (const [id, account] of Object.entries(resolution.accounts)) accounts[id] ??= account;
    ensureAuthorResolution(resolution.placeId).attempt = clone(resolution.attempt);
    for (const item of resolution.profiles) {
      ensureAccountResearch(resolution.placeId, item.accountId).profile = clone(item.profile);
      retainObservedProfile(item.accountId, item.profile, resolution.placeId, item.observedRevision);
    }
    addExternalSnapshot(place, { type: 'place', id: `${resolution.placeId}:resolved-authors` }, resolution.sourceHandleId, resolution.observedRevision, resolution.exchanges, resolution.attempt as unknown as Record<string, unknown>, resolution.profiles.length ? 'external' : 'local');
    settleResolutionOperation(navigatorOperations, key, 'authors', resolution.attempt.status === 'failure' ? resolution.attempt.error : undefined, resolution.commands, resolution.exchanges);
    return resolutionState(state, navigatorOperations, resolution.externalStatus, resolution.activity);
  }),
  commitExternalFailure: (key, stage, message, command, exchanges, target) => set((state) => {
    const place = target && fields[target.placeId];
    const currentSource = place && (target?.installRevision === undefined || place.installRevision === target.installRevision);
    if (currentSource && target) {
      if (stage === 'profile' && target.accountId) {
        const research = ensureAccountResearch(target.placeId, target.accountId);
        research.profile = { status: 'failure', relays: [...research.profileDraft.relays], error: message };
      }
      if (stage === 'authored' && target.accountId) {
        const research = ensureAccountResearch(target.placeId, target.accountId);
        research.authoredNotes = { status: 'failure', relays: [...research.authoredDraft.relays], eventLimit: research.authoredDraft.eventLimit, error: message };
      }
      if (stage === 'relationship' && target.noteId && target.relationship && target.source) {
        const research = ensureNoteResearch(target.placeId, target.noteId);
        setRelationshipAttempt(research, target.relationship, target.source, { status: 'failure', relationship: target.relationship, source: target.source, relays: target.source === 'local' ? [] : [...research.relationshipDraft.relays], error: message });
      }
      if (stage === 'authors') {
        const research = ensureAuthorResolution(target.placeId);
        research.attempt = { status: 'failure', relays: [...research.draft.relays], commands: [], error: message };
      }
    }
    return { fieldRevision: state.fieldRevision + (currentSource ? 1 : 0), navigatorOperations: { ...state.navigatorOperations, [key]: { status: 'failure', stage, message, command, exchanges } } };
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
  setView: (view) => set((state) => mutateCurrent(state, (fieldId) => { fields[fieldId].projection = view; })),
  setQuery: (query) => set((state) => mutateCurrent(state, (fieldId) => { fields[fieldId].localConstraints.text = query; })),
  setMediaLoad: (placeId, noteId, url, status) => set((state) => {
    const place = fields[placeId];
    const knownSubject = Boolean(notes[noteId]) || noteId.startsWith('profile:');
    if (!place || !knownSubject || !url) return state;
    place.mediaLoads ??= {}; place.mediaLoads[noteId] ??= {}; place.mediaLoads[noteId][url] = status;
    return { fieldRevision: state.fieldRevision + 1 };
  }),
  dismissGuide: () => set({ guideVisible: false }),
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

function ensureAuthorResolution(placeId: string) {
  const place = fields[placeId];
  if (place.authorResolution) return place.authorResolution;
  place.authorResolution = {
    draftOpen: false,
    draft: { relays: [...(place.runtime?.relays ?? [])], authorLimit: 20, timeoutMs: 10000, observationLimit: 80, distinctEventLimit: 60, concurrency: 2, excludeContentWarnings: place.runtime?.draft.excludeContentWarnings ?? true },
  };
  return place.authorResolution;
}

function noteEventHandle(placeId: string, noteId: string) {
  const snapshot = [...fields[placeId].observationSnapshots].reverse().find((candidate) => candidate.target.type === 'note' && candidate.target.id === noteId);
  return typeof snapshot?.facts.eventHandleId === 'string' ? snapshot.facts.eventHandleId : '';
}

function setRelationshipAttempt(research: NoteResearchState, relationship: NoteRelationship, source: 'local' | 'relays', attempt: NonNullable<NoteResearchState['attempts'][NoteRelationship]>['local']) {
  research.attempts[relationship] = { ...(research.attempts[relationship] ?? {}), [source]: attempt };
}

function addExternalSnapshot(
  place: typeof fields[string], target: { type: 'place' | 'account'; id: string }, sourceHandleId: string,
  observedRevision: number, exchanges: ObservationExchange[], facts: Record<string, unknown>, locality: 'local' | 'external' = 'external',
) {
  place.observationSnapshots.push({ id: `atlas-tracer-observation-${++nextTracerSnapshot}`, target, sourceHandleId, observedRevision, locality, exchanges: clone(exchanges), facts: clone(facts) });
}

function settleResolutionOperation(
  operations: Record<string, NavigatorOperation>, key: string, stage: 'profile' | 'authored' | 'relationship' | 'authors',
  message: string | undefined, commands: Record<string, unknown>[], exchanges: ObservationExchange[],
) {
  if (message) operations[key] = { status: 'failure', stage, message, command: commands.length === 1 ? commands[0] : commands, exchanges };
  else delete operations[key];
}

function settleMissingSource(
  state: AtlasStore, operations: Record<string, NavigatorOperation>, key: string,
  stage: 'profile' | 'authored' | 'relationship' | 'authors', placeId: string, source: string,
) {
  operations[key] = { status: 'failure', stage, message: `Source ${source} in place ${placeId} disappeared before the operation settled.` };
  return { navigatorOperations: operations };
}

function resolutionState(
  state: AtlasStore, navigatorOperations: Record<string, NavigatorOperation>,
  latestExternal?: ExternalStatus, activity?: { label: string; command: string; outcome: string },
) {
  if (!activity) return { navigatorOperations, fieldRevision: state.fieldRevision + 1, ...(latestExternal ? { latestExternal } : {}) };
  const nextActivity = state.nextActivity + 1;
  return {
    navigatorOperations, fieldRevision: state.fieldRevision + 1, ...(latestExternal ? { latestExternal } : {}), nextActivity,
    activities: [{ id: nextActivity, ...activity }, ...state.activities].slice(0, 20),
  };
}

function clone<T>(value: T): T { return structuredClone(value); }

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
