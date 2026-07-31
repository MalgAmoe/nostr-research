import { create } from 'zustand';
import { accounts, notes, notesFor } from './data';

export type InspectorTarget =
  | { type: 'none'; id: '' }
  | { type: 'note'; id: string }
  | { type: 'account'; id: string };
export type Location = { fieldId: string; target: InspectorTarget };
export type Activity = { id: number; label: string; command: string; outcome: string };

type AtlasData = {
  history: Location[];
  historyIndex: number;
  view: 'stream' | 'gallery';
  query: string;
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
  openInstalledField: (id: string) => void;
  back: () => void;
  forward: () => void;
  jump: (index: number) => void;
  openPinnedNote: (id: string) => void;
  openPinnedAccount: (id: string) => void;
  setView: (view: AtlasData['view']) => void;
  setQuery: (query: string) => void;
  toggleNotePin: (id: string) => void;
  toggleAccountPin: (id: string) => void;
  dismissGuide: () => void;
  recordActivity: (label: string, command: string, outcome: string) => void;
  fieldUpdated: () => void;
};

export const initialAtlasState: AtlasData = {
  history: [{ fieldId: 'start', target: { type: 'none', id: '' } }],
  historyIndex: 0,
  view: 'stream',
  query: '',
  pinnedNoteIds: [],
  pinnedAccountIds: [],
  activities: [],
  nextActivity: 0,
  guideVisible: true,
  fieldRevision: 0,
};

export function currentLocation(state: AtlasData): Location {
  return state.history[state.historyIndex];
}

function visit(state: AtlasData, location: Location) {
  const history = [...state.history.slice(0, state.historyIndex + 1), location];
  return { history, historyIndex: history.length - 1 };
}

export const useAtlasStore = create<AtlasStore>((set) => ({
  ...initialAtlasState,
  selectNote: (id) => set((state) => {
    const current = currentLocation(state);
    if (!notesFor(current.fieldId).some((note) => note.id === id)
        || (current.target.type === 'note' && current.target.id === id)) return state;
    return visit(state, { fieldId: current.fieldId, target: { type: 'note', id } });
  }),
  inspectAccount: (id) => set((state) => accounts[id]
    ? visit(state, { fieldId: currentLocation(state).fieldId, target: { type: 'account', id } })
    : state),
  openInstalledField: (id) => set((state) => {
    const first = notesFor(id)[0];
    return first ? visit(state, { fieldId: id, target: { type: 'note', id: first.id } }) : state;
  }),
  back: () => set((state) => state.historyIndex > 0
    ? { historyIndex: state.historyIndex - 1 } : state),
  forward: () => set((state) => state.historyIndex < state.history.length - 1
    ? { historyIndex: state.historyIndex + 1 } : state),
  jump: (index) => set((state) => Number.isInteger(index) && index >= 0 && index < state.history.length
    ? { historyIndex: index } : state),
  openPinnedNote: (id) => set((state) => {
    if (!notes[id]) return state;
    const fieldId = [...state.history].reverse()
      .find((entry) => notesFor(entry.fieldId).some((note) => note.id === id))?.fieldId
      ?? currentLocation(state).fieldId;
    return visit(state, { fieldId, target: { type: 'note', id } });
  }),
  openPinnedAccount: (id) => set((state) => accounts[id]
    ? visit(state, { fieldId: currentLocation(state).fieldId, target: { type: 'account', id } })
    : state),
  setView: (view) => set({ view }),
  setQuery: (query) => set({ query }),
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
      activities: [{ id: nextActivity, label, command, outcome }, ...state.activities].slice(0, 12),
    };
  }),
  fieldUpdated: () => set((state) => ({ fieldRevision: state.fieldRevision + 1 })),
}));
