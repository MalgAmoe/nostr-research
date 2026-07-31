import { create } from 'zustand';
import {
  discardPending,
  executeStaged,
  focusAccount,
  focusSignal,
  initialFlightState,
  placePending,
  preserveFocus,
  stageOperation,
  travelTo,
  type FlightState,
  type OperationKind,
} from './flight-model';

export type FlightStore = FlightState & {
  stage: (kind: OperationKind) => void;
  execute: () => void;
  cancelStage: () => void;
  place: () => void;
  discard: () => void;
  travel: (fieldId: string) => void;
  focusSignal: (signalId: string) => void;
  focusAccount: (accountId: string) => void;
  returnToSignal: () => void;
  preserve: () => void;
  setView: (view: FlightState['view']) => void;
};

export const useFlightStore = create<FlightStore>((set) => ({
  ...initialFlightState,
  stage: (kind) => set((state) => stageOperation(state, kind)),
  execute: () => set((state) => executeStaged(state)),
  cancelStage: () => set((state) => ({ ...state, staged: null })),
  place: () => set((state) => placePending(state)),
  discard: () => set((state) => discardPending(state)),
  travel: (fieldId) => set((state) => travelTo(state, fieldId)),
  focusSignal: (signalId) => set((state) => focusSignal(state, signalId)),
  focusAccount: (accountId) => set((state) => focusAccount(state, accountId)),
  returnToSignal: () => set({ focusMode: 'signal', focusedAccountId: null }),
  preserve: () => set((state) => preserveFocus(state)),
  setView: (view) => set({ view }),
}));
