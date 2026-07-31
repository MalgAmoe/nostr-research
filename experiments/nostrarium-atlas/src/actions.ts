import { accounts, fields, notes, observationFor, type Field, type InspectorTarget, type MediaLoadState, type NoteObservation, type PlaceProjection } from './data';
import type { QueryDraft } from './live-types';
import { useLiveStore } from './live-store';
import {
  acquisitionDraftError, cleanAcquisitionDraft, ResolverFailure, resolveAcquisition, resolveSubjectObservation,
  type AcquisitionIntent, type AcquisitionResolution, type SubjectObservationIntent, type SubjectObservationResolution,
} from './resolvers';
import { currentPlaceId, subjectOperationKey, useAtlasStore } from './store';

export type NavigatorActions = {
  setAcquisitionPanel(open: boolean): void;
  setRelaySearch(value: string): void;
  setCustomRelay(value: string): void;
  addRelay(): void;
  removeRelay(url: string): void;
  toggleRelay(url: string): void;
  patchAcquisitionDraft(patch: Partial<QueryDraft>): void;
  replaceAcquisitionDraft(draft: QueryDraft, open?: boolean): void;
  resetAcquisitionFailure(): void;
  acquireGround(): Promise<void>;
  selectNote(placeId: string, noteId: string): void;
  selectAccount(placeId: string, accountId: string): void;
  selectAccountFacet(placeId: string, accountId: string): void;
  selectExactSubject(placeId: string, target: Extract<InspectorTarget, { type: 'note' | 'account' | 'address' }>): void;
  observeSubject(placeId: string, type: 'note' | 'account', id: string): Promise<void>;
  activatePlace(placeId: string): void;
  navigateBack(): void;
  navigateForward(): void;
  jumpToHistory(index: number): void;
  setPlaceProjection(projection: PlaceProjection): void;
  setPlaceFilter(value: string): void;
  authorizeResource(placeId: string, subjectId: string, url: string, status: MediaLoadState): void;
};

type ActionDependencies = {
  resolveAcquisition(intent: AcquisitionIntent, onCommand?: (command: Record<string, unknown>) => void): Promise<AcquisitionResolution>;
  resolveSubjectObservation(intent: SubjectObservationIntent): Promise<SubjectObservationResolution>;
};

export function createNavigatorActions(dependencies: ActionDependencies): NavigatorActions {
  const observe = async (placeId: string, type: 'note' | 'account', id: string, retry = false) => {
    const state = useAtlasStore.getState();
    const place = fields[placeId];
    if (!place) return;
    const key = subjectOperationKey(placeId, type, id);
    if (state.navigatorOperations[key]?.status === 'working') return;
    if (type === 'note') {
      const note = notes[id];
      const existing = observationFor<NoteObservation>(placeId, 'note', id);
      if (!note || !place.noteIds.includes(id) || (!retry && existing)) return;
    } else {
      const account = accounts[id];
      const research = place.accountResearch[id];
      if (!account || (!retry && research && research.localStatus !== 'idle')) return;
    }
    const conflictingOperation = Object.entries(state.navigatorOperations).find(([operationKey, operation]) =>
      operationKey !== key && operation.status === 'working',
    );
    if (useLiveStore.getState().phase.type === 'working' || conflictingOperation) {
      const message = 'Local observation was not started because another explicit research operation is still running.';
      state.commitObservationFailure(placeId, type, id, message, []);
      state.commitOperationFailure(key, { status: 'failure', stage: type, message, exchanges: [] });
      return;
    }

    const intent: SubjectObservationIntent = type === 'note'
      ? {
          place: { id: place.id, handleId: place.handleId },
          subject: { type: 'note', id, note: clone(notes[id]) },
        }
      : accountObservationIntent(place, id);
    state.commitObservationStarted(placeId, type, id);
    useAtlasStore.getState().commitOperationStarted(key, { status: 'working', stage: type });
    try {
      const resolution = await dependencies.resolveSubjectObservation(intent);
      useAtlasStore.getState().commitObservation(resolution);
    } catch (error) {
      const message = errorMessage(error);
      const exchanges = error instanceof ResolverFailure ? error.exchanges : [];
      useAtlasStore.getState().commitObservationFailure(placeId, type, id, message, exchanges);
      useAtlasStore.getState().commitOperationFailure(key, {
        status: 'failure', stage: type, message,
        ...(error instanceof ResolverFailure ? {
          command: error.commands.length === 1 ? error.commands[0] : error.commands,
          exchanges: error.exchanges,
        } : {}),
      });
    }
  };

  const selectAndObserve = (placeId: string, target: Extract<InspectorTarget, { type: 'note' | 'account' | 'address' }>, facet = false) => {
    const selected = useAtlasStore.getState().commitSelection(placeId, target, facet);
    if (!selected || target.type === 'address') return;
    void observe(placeId, target.type, target.id);
  };

  return {
    setAcquisitionPanel: (open) => useAtlasStore.getState().setAcquisitionPanel(open),
    setRelaySearch: (value) => useAtlasStore.getState().setAcquisitionRelaySearch(value),
    setCustomRelay: (value) => useAtlasStore.getState().setAcquisitionCustomRelay(value),
    addRelay: () => useAtlasStore.getState().addAcquisitionRelay(),
    removeRelay: (url) => useAtlasStore.getState().removeAcquisitionRelay(url),
    toggleRelay: (url) => useAtlasStore.getState().toggleAcquisitionRelay(url),
    patchAcquisitionDraft: (patch) => useAtlasStore.getState().patchAcquisitionDraft(patch),
    replaceAcquisitionDraft: (draft, open = true) => useAtlasStore.getState().replaceAcquisitionDraft(draft, open),
    resetAcquisitionFailure: () => useAtlasStore.getState().clearOperation('acquisition'),
    acquireGround: async () => {
      const state = useAtlasStore.getState();
      if (Object.values(state.navigatorOperations).some((operation) => operation.status === 'working') || useLiveStore.getState().phase.type === 'working') return;
      const relays = state.acquisition.relays.filter((relay) => relay.selected).map((relay) => relay.url);
      const draft = cleanAcquisitionDraft(clone(state.acquisition.draft));
      const intent: AcquisitionIntent = {
        draft, relays: [...relays], hadGround: Boolean(state.groundPlaceId),
        knownNotes: clone(notes), knownAccounts: clone(accounts),
      };
      state.commitOperationStarted('acquisition', { status: 'working', stage: 'acquire' });
      try {
        const resolution = await dependencies.resolveAcquisition(intent, (command) => {
          useAtlasStore.getState().commitOperationStarted('acquisition', { status: 'working', stage: 'acquire', command });
        });
        useAtlasStore.getState().commitAcquisition(resolution);
      } catch (error) {
        const message = errorMessage(error);
        useAtlasStore.getState().commitOperationFailure('acquisition', {
          status: 'failure', stage: 'acquire', message,
          ...(error instanceof ResolverFailure ? {
            command: error.commands.length === 1 ? error.commands[0] : error.commands,
            exchanges: error.exchanges,
          } : {}),
        });
        useAtlasStore.getState().setExternalStatus({ label: 'Ground acquisition', status: 'FAILURE', warningCount: 0 });
        useAtlasStore.getState().setAcquisitionPanel(true);
      }
    },
    selectNote: (placeId, noteId) => {
      if (fields[placeId]?.noteIds.includes(noteId)) selectAndObserve(placeId, { type: 'note', id: noteId });
    },
    selectAccount: (placeId, accountId) => selectAndObserve(placeId, { type: 'account', id: accountId }),
    selectAccountFacet: (placeId, accountId) => selectAndObserve(placeId, { type: 'account', id: accountId }, true),
    selectExactSubject: (placeId, target) => selectAndObserve(placeId, target),
    observeSubject: (placeId, type, id) => observe(placeId, type, id, true),
    activatePlace: (placeId) => useAtlasStore.getState().activatePlace(placeId),
    navigateBack: () => useAtlasStore.getState().back(),
    navigateForward: () => useAtlasStore.getState().forward(),
    jumpToHistory: (index) => useAtlasStore.getState().jump(index),
    setPlaceProjection: (projection) => useAtlasStore.getState().setView(projection),
    setPlaceFilter: (value) => useAtlasStore.getState().setQuery(value),
    authorizeResource: (placeId, subjectId, url, status) => useAtlasStore.getState().setMediaLoad(placeId, subjectId, url, status),
  };
}

export const navigatorActions = createNavigatorActions({
  resolveAcquisition: (intent, onCommand) => resolveAcquisition(intent, undefined, onCommand),
  resolveSubjectObservation,
});

export function visibleAcquisitionError(draft: QueryDraft, relays: string[]) {
  return acquisitionDraftError(draft, relays);
}

export function selectedAcquisitionRelays() {
  return useAtlasStore.getState().acquisition.relays.filter((relay) => relay.selected).map((relay) => relay.url);
}

export function activePlaceId() {
  return currentPlaceId(useAtlasStore.getState());
}

function accountObservationIntent(place: Field, accountId: string): SubjectObservationIntent {
  const projection = place.accountProjection?.status === 'available' && place.accountProjection.accountIds.includes(accountId)
    ? { status: place.accountProjection.status, handleId: place.accountProjection.handleId, accountIds: [accountId] }
    : undefined;
  const facet = place.accountFacet?.status === 'available' && place.accountFacet.handles
      && place.accountFacet.records.some((record) => record.account === accountId)
    ? { status: place.accountFacet.status, handles: { ...place.accountFacet.handles }, records: [{ account: accountId }] }
    : undefined;
  let fallbackSource: SubjectObservationIntent['fallbackSource'];
  if (!projection && !facet) {
    const localNoteId = place.noteIds.find((noteId) => notes[noteId]?.authorId === accountId);
    const sourcePlace = localNoteId ? place : Object.values(fields).find((candidate) =>
      candidate.noteIds.some((noteId) => notes[noteId]?.authorId === accountId),
    );
    const noteId = localNoteId ?? sourcePlace?.noteIds.find((candidate) => notes[candidate]?.authorId === accountId);
    if (sourcePlace && noteId) fallbackSource = { noteId, placeHandleId: sourcePlace.handleId };
  }
  return {
    place: {
      id: place.id, handleId: place.handleId,
      ...(projection ? { accountProjection: projection } : {}),
      ...(facet ? { accountFacet: facet } : {}),
    },
    subject: { type: 'account', id: accountId, account: clone(accounts[accountId]) },
    ...(fallbackSource ? { fallbackSource } : {}),
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
