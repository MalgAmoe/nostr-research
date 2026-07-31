import { create } from 'zustand';
import { accounts, fieldFor, fields, notes, notesFor, type InspectorTarget, type PlaceProjection } from './data';

export type Location = { fieldId: string; target: InspectorTarget };
export type Activity = { id: number; label: string; command: string; outcome: string };

type AtlasData = {
  history: string[];
  historyIndex: number;
  groundPlaceId: string | null;
  pinnedNoteIds: string[];
  pinnedAccountIds: string[];
  activities: Activity[];
  nextActivity: number;
  guideVisible: boolean;
  fieldRevision: number;
};

export type AtlasStore = AtlasData & {
  selectNote: (id: string) => void;
  inspectAccount: (id: string) => void;
  selectAccountFacet: (id: string) => void;
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
  dismissGuide: () => void;
  recordActivity: (label: string, command: string, outcome: string) => void;
  fieldUpdated: () => void;
};

export const initialAtlasState: AtlasData = {
  history: ['start'],
  historyIndex: 0,
  groundPlaceId: null,
  pinnedNoteIds: [],
  pinnedAccountIds: [],
  activities: [],
  nextActivity: 0,
  guideVisible: true,
  fieldRevision: 0,
};

export function currentPlaceId(state: AtlasData): string {
  return state.history[state.historyIndex] ?? 'start';
}

export function currentLocation(state: AtlasData): Location {
  const fieldId = currentPlaceId(state);
  return { fieldId, target: fieldFor(fieldId).selected };
}

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

export const useAtlasStore = create<AtlasStore>((set) => ({
  ...initialAtlasState,
  selectNote: (id) => set((state) => mutateCurrent(state, (fieldId) => {
    if (notesFor(fieldId).some((note) => note.id === id)) fields[fieldId].selected = { type: 'note', id };
  })),
  inspectAccount: (id) => set((state) => mutateCurrent(state, (fieldId) => {
    if (accounts[id]) fields[fieldId].selected = { type: 'account', id };
  })),
  selectAccountFacet: (id) => set((state) => mutateCurrent(state, (fieldId) => {
    if (accounts[id] && fields[fieldId].accountFacet?.records.some((record) => record.account === id)) {
      fields[fieldId].selectedFacet = id;
      fields[fieldId].selected = { type: 'account', id };
    }
  })),
  installGround: (id) => set((state) => {
    if (!fields[id]) return state;
    if (state.groundPlaceId && fields[state.groundPlaceId] && state.groundPlaceId !== id) {
      fields[state.groundPlaceId].role = 'branch';
    }
    fields[id].role = 'ground';
    const moved = visit(state, id);
    return { ...moved, groundPlaceId: id, fieldRevision: state.fieldRevision + 1 };
  }),
  installBranch: (id) => set((state) => {
    if (!fields[id]) return state;
    fields[id].role = 'branch';
    return { ...visit(state, id), fieldRevision: state.fieldRevision + 1 };
  }),
  activatePlace: (id) => set((state) => fields[id] ? visit(state, id) : state),
  removePlace: (id) => set((state) => {
    if (!fields[id] || id === state.groundPlaceId) return state;
    delete fields[id];
    const retained = state.history.filter((placeId) => placeId !== id && (placeId === 'start' || fields[placeId]));
    const history = retained.length ? retained : state.groundPlaceId ? [state.groundPlaceId] : ['start'];
    return {
      history,
      historyIndex: Math.min(state.historyIndex, history.length - 1),
      fieldRevision: state.fieldRevision + 1,
    };
  }),
  back: () => set((state) => state.historyIndex > 0
    ? { historyIndex: state.historyIndex - 1 } : state),
  forward: () => set((state) => state.historyIndex < state.history.length - 1
    ? { historyIndex: state.historyIndex + 1 } : state),
  jump: (index) => set((state) => Number.isInteger(index) && index >= 0 && index < state.history.length
    ? { historyIndex: index } : state),
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
  toggleNotePin: (id) => set((state) => state.pinnedNoteIds.includes(id)
    ? { pinnedNoteIds: state.pinnedNoteIds.filter((item) => item !== id) }
    : notes[id] ? { pinnedNoteIds: [...state.pinnedNoteIds, id] } : state),
  toggleAccountPin: (id) => set((state) => state.pinnedAccountIds.includes(id)
    ? { pinnedAccountIds: state.pinnedAccountIds.filter((item) => item !== id) }
    : accounts[id] ? { pinnedAccountIds: [...state.pinnedAccountIds, id] } : state),
  dismissGuide: () => set({ guideVisible: false }),
  recordActivity: (label, command, outcome) => set((state) => {
    const nextActivity = state.nextActivity + 1;
    return {
      nextActivity,
      activities: [{ id: nextActivity, label, command, outcome }, ...state.activities].slice(0, 20),
    };
  }),
  fieldUpdated: () => set((state) => ({ fieldRevision: state.fieldRevision + 1 })),
}));
