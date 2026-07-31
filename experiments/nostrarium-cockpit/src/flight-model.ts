import { fields } from './fixtures';

export type CommandDraft = {
  command: string;
  input?: string;
  parameters: Record<string, unknown>;
  resultId?: string;
};

export type OperationKind = 'conversation' | 'author-history';

export type FlightState = {
  activeFieldId: string;
  focusId: string;
  focusMode: 'signal' | 'account';
  focusedAccountId: string | null;
  placedFieldIds: string[];
  staged: { kind: OperationKind; command: CommandDraft } | null;
  pendingFieldId: string | null;
  lastCommand: CommandDraft | null;
  preservedIds: string[];
  view: 'universe' | 'signals';
  log: string[];
};

export const initialFlightState: FlightState = {
  activeFieldId: 'ground',
  focusId: fields.ground.defaultFocusId,
  focusMode: 'signal',
  focusedAccountId: null,
  placedFieldIds: ['ground'],
  staged: null,
  pendingFieldId: null,
  lastCommand: {
    command: 'select',
    parameters: { scope: 'acquisition', kinds: [1], limit: 9 },
    resultId: 'fixture-ground',
  },
  preservedIds: [],
  view: 'universe',
  log: ['Ground placed · fixture-ground · 9 events', 'Focus acquired · signal 7e4a'],
};

export function commandFor(kind: OperationKind): CommandDraft {
  if (kind === 'conversation') {
    return {
      command: 'continue', input: 'fixture-focused-note',
      parameters: { relationship: 'conversation', source: 'local', depth: 2, eventLimit: 12 },
      resultId: 'fixture-conversation',
    };
  }
  return {
    command: 'continue', input: 'fixture-focused-author',
    parameters: { relationship: 'authored-notes', source: 'local', eventLimit: 8 },
    resultId: 'fixture-author-history',
  };
}

export function stageOperation(state: FlightState, kind: OperationKind): FlightState {
  if (state.staged || state.pendingFieldId) return state;
  return {
    ...state,
    staged: { kind, command: commandFor(kind) },
    log: [`Command staged · ${kind}`, ...state.log].slice(0, 8),
  };
}

export function executeStaged(state: FlightState): FlightState {
  if (!state.staged || state.pendingFieldId) return state;
  const fieldId = state.staged.kind === 'conversation' ? 'conversation' : 'author';
  return {
    ...state,
    lastCommand: state.staged.command,
    staged: null,
    pendingFieldId: fieldId,
    log: [`Recorded outcome received · ${fields[fieldId].handle.count} events · placement pending`, ...state.log].slice(0, 8),
  };
}

export function placePending(state: FlightState): FlightState {
  if (!state.pendingFieldId) return state;
  const fieldId = state.pendingFieldId;
  const placedFieldIds = state.placedFieldIds.includes(fieldId)
    ? state.placedFieldIds : [...state.placedFieldIds, fieldId];
  return {
    ...state,
    placedFieldIds,
    pendingFieldId: null,
    log: [`Branch placed · ${fields[fieldId].label}`, ...state.log].slice(0, 8),
  };
}

export function discardPending(state: FlightState): FlightState {
  if (!state.pendingFieldId) return state;
  return {
    ...state,
    pendingFieldId: null,
    log: [`Voyage reference discarded · engine release not issued`, ...state.log].slice(0, 8),
  };
}

export function travelTo(state: FlightState, fieldId: string): FlightState {
  if (!state.placedFieldIds.includes(fieldId) || !fields[fieldId]) return state;
  return {
    ...state,
    activeFieldId: fieldId,
    focusId: fields[fieldId].defaultFocusId,
    focusMode: 'signal',
    focusedAccountId: null,
    log: [`Position changed · ${fields[fieldId].label}`, ...state.log].slice(0, 8),
  };
}

export function focusSignal(state: FlightState, signalId: string): FlightState {
  if (!fields[state.activeFieldId].signals.some(({ id }) => id === signalId)) return state;
  return { ...state, focusId: signalId, focusMode: 'signal', focusedAccountId: null };
}

export function focusAccount(state: FlightState, accountId: string): FlightState {
  return { ...state, focusMode: 'account', focusedAccountId: accountId };
}

export function preserveFocus(state: FlightState): FlightState {
  if (state.preservedIds.includes(state.focusId)) return state;
  return {
    ...state,
    preservedIds: [...state.preservedIds, state.focusId],
    log: [`Notebook reference recorded · signal ${state.focusId}`, ...state.log].slice(0, 8),
  };
}
