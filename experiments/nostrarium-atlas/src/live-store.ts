import { create } from 'zustand';
import {
  accounts, fields, notes, retainObservedProfile,
  type AccountResearchState, type AttachmentFact, type Field, type Note,
  type NoteResearchState, type ObservationExchange, type ObservationSnapshot,
} from './data';
import { liveController } from './live-session';
import { DEFAULT_DRAFT } from './live-types';
import type {
  AcquiredPhase, AuthorResolutionDraft, AuthoredActionDraft, ExternalActionDraft, LivePhase,
  NoteRelationship, QueryDraft, RelationshipActionDraft,
} from './live-types';
export { DEFAULT_DRAFT } from './live-types';
export { validateSearchRelayCount } from './resolvers';
import { currentPlaceId, useAtlasStore } from './store';

type LiveStore = {
  phase: LivePhase;
  prepareAccountResearch: (placeId: string, publicKey: string) => void;
  updateProfileDraft: (placeId: string, accountId: string, patch: Partial<ExternalActionDraft>) => void;
  updateAuthoredDraft: (placeId: string, accountId: string, patch: Partial<AuthoredActionDraft>) => void;
  requestProfile: (placeId: string, accountId: string) => Promise<void>;
  requestAuthoredNotes: (placeId: string, accountId: string) => Promise<void>;
  openLocalNoteRelationship: (placeId: string, noteId: string, relationship: NoteRelationship) => Promise<void>;
  prepareNoteRelationship: (placeId: string, noteId: string, relationship: NoteRelationship) => void;
  updateNoteRelationshipDraft: (placeId: string, noteId: string, patch: Partial<RelationshipActionDraft>) => void;
  requestNoteRelationship: (placeId: string, noteId: string) => Promise<void>;
  prepareAuthorResolution: (placeId: string) => void;
  updateAuthorResolutionDraft: (placeId: string, patch: Partial<AuthorResolutionDraft>) => void;
  resolveAuthors: (placeId: string) => Promise<void>;
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
  phase: { type: 'idle' },

  prepareAccountResearch: (placeId, publicKey) => {
    const place = fields[placeId];
    if (!place?.accountFacet?.records.some((record) => record.account === publicKey)) return;
    place.selectedFacet = publicKey;
    const fresh = freshAccountResearchDraft(publicKey);
    const atlas = useAtlasStore.getState();
    atlas.replaceAcquisitionDraft(fresh, true);
    set({ phase: { type: 'idle' } });
    atlas.recordActivity(
      'Prepared independent relay acquisition draft', JSON.stringify({
        command: 'acquire', parameters: {
          relays: atlas.acquisition.relays.filter((relay) => relay.selected).map((relay) => relay.url), filter: queryFilter(fresh),
          timeoutMs: fresh.timeoutMs, observationLimit: fresh.observationLimit,
          distinctEventLimit: fresh.distinctEventLimit, concurrency: fresh.concurrency,
          excludeContentWarnings: fresh.excludeContentWarnings,
        },
      }),
      'Draft only · no relay contacted · older draft constraints discarded',
    );
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
    if (!place || !state?.engineHandleId || state.profile?.status === 'loading' || tracerWorking()) return;
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
      retainObservedProfile(accountId, state.profile, placeId, number(inspected.response.sessionRevision));
      useAtlasStore.getState().setExternalStatus({
        label: 'Profile hydration', status: (attemptStatus || 'BOUNDED').toUpperCase(),
        warningCount: Array.isArray(hydrated.response.warnings) ? hydrated.response.warnings.length : 0,
      });
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
      set({ phase: { type: 'failure', stage: 'profile', message: errorMessage(error), command } });
      useAtlasStore.getState().setExternalStatus({ label: 'Profile hydration', status: 'FAILURE', warningCount: 0 });
    }
    useAtlasStore.getState().fieldUpdated();
  },

  requestAuthoredNotes: async (placeId, accountId) => {
    const sourcePlace = fields[placeId];
    const state = sourcePlace && ensureAccountResearch(sourcePlace, accountId);
    if (!sourcePlace || !state?.engineHandleId || state.authoredNotes?.status === 'loading' || tracerWorking()) return;
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
      useAtlasStore.getState().setExternalStatus({
        label: 'Authored-note acquisition',
        status: (string(completeness.attemptStatus) || string(external.status) || 'BOUNDED').toUpperCase(),
        warningCount: Array.isArray(continued.response.warnings) ? continued.response.warnings.length : 0,
      });
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
      set({ phase: { type: 'failure', stage: 'authored', message: errorMessage(error), command } });
      useAtlasStore.getState().setExternalStatus({ label: 'Authored-note acquisition', status: 'FAILURE', warningCount: 0 });
    }
    useAtlasStore.getState().fieldUpdated();
  },

  openLocalNoteRelationship: async (placeId, noteId, relationship) => {
    const sourcePlace = fields[placeId];
    const eventHandleId = sourcePlace && noteEventHandle(sourcePlace, noteId);
    if (!sourcePlace || !eventHandleId || get().phase.type === 'working' || tracerWorking()) return;
    const research = ensureNoteResearch(sourcePlace, noteId);
    const handleId = uniqueHandle(`atlas-local-${relationship}`);
    const eventLimit = research.relationshipDraft.eventLimit;
    const command = { command: 'continue', input: eventHandleId, parameters: { relationship, source: 'local', eventLimit }, resultId: handleId };
    setRelationshipAttempt(research, relationship, 'local', { status: 'loading', relationship, source: 'local', relays: [], command, handleId });
    set({ phase: { type: 'working', stage: 'relationship', command } });
    useAtlasStore.getState().fieldUpdated();
    try {
      const continued = await execute(command);
      const handle = object(continued.result.handle);
      const count = number(handle.count);
      const completeness = object(continued.result.completeness);
      const show = showCommand(handleId, 0, count);
      let shown: Executed | undefined;
      let observationFailure: ObservationExchange | undefined;
      try { shown = await execute(show); } catch (error) { observationFailure = await failureExchange(show, error); }
      setRelationshipAttempt(research, relationship, 'local', {
        status: relationshipAttemptStatus(count, completeness, observationFailure), relationship, source: 'local', relays: [],
        command, handleId, count, installRevision: number(handle.revision) || number(continued.response.sessionRevision), completeness,
      });
      const acquired: AcquiredPhase = {
        type: 'acquired', sourceKind: 'local-note-relationship', handleId,
        installRevision: number(handle.revision) || number(continued.response.sessionRevision), count,
        command, receipt: continued.receipt, coverage: null, relays: [], draft: { ...DEFAULT_DRAFT, limit: eventLimit },
      };
      const branch = installPlace({
        acquired, shown, observationFailure, role: 'branch', localSource: sourcePlace,
        reason: `Local resident-memory ${relationship} from ${shortKey(noteId)}.`,
        label: `${relationshipLabel(relationship)} · local`,
      });
      addSnapshot(sourcePlace, {
        target: { type: 'place', id: `${noteId}:${relationship}:local` }, sourceHandleId: handleId,
        observedRevision: number(continued.response.sessionRevision), locality: 'local',
        exchanges: [exchange(command, continued), ...(shown ? [exchange(show, shown)] : observationFailure ? [observationFailure] : [])],
        facts: research.attempts[relationship]!.local as unknown as Record<string, unknown>,
      });
      useAtlasStore.getState().installBranch(branch.id);
      useAtlasStore.getState().recordActivity('Opened local note-relationship branch', JSON.stringify([command, show]), `${count} resident event subjects · Ground unchanged · no relay contacted`);
      set(observationFailure
        ? { phase: { type: 'failure', stage: 'relationship', message: 'Local branch opened, but its first bounded preview is unavailable.', command: show } }
        : { phase: { type: 'idle' } });
    } catch (error) {
      setRelationshipAttempt(research, relationship, 'local', { status: 'failure', relationship, source: 'local', relays: [], command, handleId, error: errorMessage(error) });
      set({ phase: { type: 'failure', stage: 'relationship', message: errorMessage(error), command } });
      useAtlasStore.getState().fieldUpdated();
    }
  },

  prepareNoteRelationship: (placeId, noteId, relationship) => {
    const place = fields[placeId];
    if (!place || !noteEventHandle(place, noteId)) return;
    const research = ensureNoteResearch(place, noteId);
    research.draftOpen = true;
    research.relationshipDraft.relationship = relationship;
    useAtlasStore.getState().recordActivity('Prepared note-relationship relay draft', JSON.stringify(relationshipRelayCommand(noteEventHandle(place, noteId)!, research.relationshipDraft, 'draft-result')), 'Draft only · no relay contacted');
    useAtlasStore.getState().fieldUpdated();
  },

  updateNoteRelationshipDraft: (placeId, noteId, patch) => {
    const place = fields[placeId];
    if (!place) return;
    const research = ensureNoteResearch(place, noteId);
    research.relationshipDraft = sanitizeRelationshipDraft({ ...research.relationshipDraft, ...patch });
    useAtlasStore.getState().fieldUpdated();
  },

  requestNoteRelationship: async (placeId, noteId) => {
    const sourcePlace = fields[placeId];
    const eventHandleId = sourcePlace && noteEventHandle(sourcePlace, noteId);
    if (!sourcePlace || !eventHandleId || get().phase.type === 'working' || tracerWorking()) return;
    const research = ensureNoteResearch(sourcePlace, noteId);
    const draft = research.relationshipDraft;
    const relayError = validateRelayDraft(draft.relays);
    if (relayError) {
      setRelationshipAttempt(research, draft.relationship, 'relays', { status: 'failure', relationship: draft.relationship, source: 'relays', relays: draft.relays, error: relayError });
      useAtlasStore.getState().fieldUpdated(); return;
    }
    const handleId = uniqueHandle(`atlas-relay-${draft.relationship}`);
    const command = relationshipRelayCommand(eventHandleId, draft, handleId);
    setRelationshipAttempt(research, draft.relationship, 'relays', { status: 'loading', relationship: draft.relationship, source: 'relays', relays: draft.relays, command, handleId });
    set({ phase: { type: 'working', stage: 'relationship', command } });
    useAtlasStore.getState().fieldUpdated();
    try {
      const continued = await execute(command);
      const handle = object(continued.result.handle);
      const count = number(handle.count);
      const completeness = object(continued.result.completeness);
      const show = showCommand(handleId, 0, count);
      let shown: Executed | undefined;
      let observationFailure: ObservationExchange | undefined;
      try { shown = await execute(show); } catch (error) { observationFailure = await failureExchange(show, error); }
      setRelationshipAttempt(research, draft.relationship, 'relays', {
        status: relationshipAttemptStatus(count, completeness, observationFailure), relationship: draft.relationship, source: 'relays',
        relays: draft.relays, command, handleId, count,
        installRevision: number(handle.revision) || number(continued.response.sessionRevision), completeness,
        external: presentObject({ coverage: continued.result.coverage, counts: continued.result.counts, completionReason: continued.result.completionReason }),
      });
      const acquired: AcquiredPhase = {
        type: 'acquired', sourceKind: 'note-relationship', handleId,
        installRevision: number(handle.revision) || number(continued.response.sessionRevision), count,
        command, receipt: continued.receipt,
        coverage: { external: { status: completeness.status, completeness } }, relays: draft.relays,
        draft: { ...DEFAULT_DRAFT, limit: draft.eventLimit, excludeContentWarnings: draft.excludeContentWarnings },
      };
      const branch = installPlace({
        acquired, shown, observationFailure, role: 'branch',
        reason: `Explicit bounded relay ${draft.relationship} research from ${shortKey(noteId)}.`,
        label: `${relationshipLabel(draft.relationship)} · relays`,
      });
      addSnapshot(sourcePlace, {
        target: { type: 'place', id: `${noteId}:${draft.relationship}:relays` }, sourceHandleId: handleId,
        observedRevision: number(continued.response.sessionRevision), locality: 'external',
        exchanges: [exchange(command, continued), ...(shown ? [exchange(show, shown)] : observationFailure ? [observationFailure] : [])],
        facts: research.attempts[draft.relationship]!.relays as unknown as Record<string, unknown>,
      });
      useAtlasStore.getState().setExternalStatus({ label: `Note ${draft.relationship}`, status: (string(completeness.status) || 'BOUNDED').toUpperCase(), warningCount: Array.isArray(continued.response.warnings) ? continued.response.warnings.length : 0 });
      useAtlasStore.getState().installBranch(branch.id);
      useAtlasStore.getState().recordActivity('Executed note-relationship relay draft and opened branch', JSON.stringify([command, show]), `${count} event subjects · branch opened including bounded zero · Ground unchanged`);
      set(observationFailure
        ? { phase: { type: 'failure', stage: 'relationship', message: 'Relay relationship branch opened, but its first bounded preview is unavailable.', command: show } }
        : { phase: { type: 'idle' } });
    } catch (error) {
      setRelationshipAttempt(research, draft.relationship, 'relays', { status: 'failure', relationship: draft.relationship, source: 'relays', relays: draft.relays, command, handleId, error: errorMessage(error) });
      set({ phase: { type: 'failure', stage: 'relationship', message: errorMessage(error), command } });
      useAtlasStore.getState().setExternalStatus({ label: `Note ${draft.relationship}`, status: 'FAILURE', warningCount: 0 });
      useAtlasStore.getState().fieldUpdated();
    }
  },

  prepareAuthorResolution: (placeId) => {
    const place = fields[placeId];
    if (!place || place.role === 'start') return;
    const state = ensureAuthorResolution(place);
    state.draftOpen = true;
    useAtlasStore.getState().recordActivity('Prepared Resolve authors draft', JSON.stringify(authorResolutionCommands(place, state.draft)), 'Draft only · no relay contacted');
    useAtlasStore.getState().fieldUpdated();
  },

  updateAuthorResolutionDraft: (placeId, patch) => {
    const place = fields[placeId];
    if (!place) return;
    const state = ensureAuthorResolution(place);
    state.draft = sanitizeAuthorResolutionDraft({ ...state.draft, ...patch });
    useAtlasStore.getState().fieldUpdated();
  },

  resolveAuthors: async (placeId) => {
    const place = fields[placeId];
    if (!place || get().phase.type === 'working' || tracerWorking()) return;
    const state = ensureAuthorResolution(place);
    const draft = state.draft;
    const relayError = validateRelayDraft(draft.relays);
    if (relayError) {
      state.attempt = { status: 'failure', relays: draft.relays, error: relayError };
      useAtlasStore.getState().fieldUpdated(); return;
    }
    const [move, showAuthors, hydrate] = authorResolutionCommands(place, draft);
    const commands: Record<string, unknown>[] = [move, showAuthors, hydrate];
    const outcomes: Executed[] = [];
    state.attempt = { status: 'loading', relays: draft.relays, commands, authorHandleId: String(move.resultId), supportingHandleId: String(hydrate.resultId) };
    set({ phase: { type: 'working', stage: 'authors', command: commands } });
    useAtlasStore.getState().fieldUpdated();
    try {
      const moved = await execute(move); outcomes.push(moved);
      const shown = await execute(showAuthors); outcomes.push(shown);
      const authorIds = subjectIds(shown.result);
      const authorBounds = responseBounds(shown.result);
      const authorOmissions = presentObject({ omitted: shown.result.omitted, omittedBefore: shown.result.omittedBefore, omittedAfter: shown.result.omittedAfter }) ?? {};
      const authorBoundarySized = authorIds.length >= draft.authorLimit;
      const authorSourcePartial = boolean(object(object(shown.result.context).cardinality).truncated)
        || Object.values(authorOmissions).some((value) => number(value) > 0);
      for (const accountId of authorIds) accounts[accountId] ??= liveAccount(accountId);
      if (!authorIds.length) {
        state.attempt = { status: authorSourcePartial ? 'partial' : 'empty', relays: draft.relays, commands: commands.slice(0, 2), authorHandleId: String(move.resultId), authorCount: 0, resolvedCount: 0, unresolvedCount: 0, failedCount: 0, completeness: { status: authorSourcePartial ? 'partial' : 'empty', scope: 'resident-place-authors', emptyValidResult: !authorSourcePartial }, authorBounds, authorOmissions, authorBoundarySized };
        addSnapshot(place, { target: { type: 'place', id: `${placeId}:resolved-authors` }, sourceHandleId: String(move.resultId), observedRevision: number(shown.response.sessionRevision), locality: 'local', exchanges: [exchange(move, moved), exchange(showAuthors, shown)], facts: state.attempt as unknown as Record<string, unknown> });
        set({ phase: { type: 'idle' } });
        useAtlasStore.getState().fieldUpdated(); return;
      }
      const hydrated = await execute(hydrate); outcomes.push(hydrated);
      const external = object(hydrated.result.external);
      const completeness = object(external.completeness);
      let resolvedCount = 0; let unresolvedCount = 0; let failedCount = 0;
      const inspectCommands: Record<string, unknown>[] = [];
      const inspectionExchanges: ObservationExchange[] = [];
      for (const accountId of authorIds) {
        const inspect = inspectCommand({ type: 'account', id: accountId });
        inspectCommands.push(inspect);
        try {
          const inspected = await execute(inspect);
          inspectionExchanges.push(exchange(inspect, inspected));
          const evidence = object(inspected.result.evidence);
          const claims = object(evidence.profile);
          const resolved = boolean(inspected.result.resolved) && Object.keys(claims).length > 0;
          const profile = {
            status: resolved ? (isPartial(completeness) ? 'partial' as const : 'available' as const) : 'unresolved' as const,
            relays: draft.relays, command: hydrate, supportingHandleId: String(hydrate.resultId), external, completeness, claims,
            resolution: { resident: boolean(inspected.result.resident), resolved: boolean(inspected.result.resolved), source: string(inspected.result.resolutionSource) || undefined },
            provenance: presentObject({ summary: inspected.result.provenance, evidence: evidence.provenance, observationCount: evidence.observationCount, omittedObservationCount: evidence.omittedObservationCount }),
          };
          const accountState = ensureAccountResearch(place, accountId);
          accountState.profile = profile;
          retainObservedProfile(accountId, profile, placeId, number(inspected.response.sessionRevision));
          if (resolved) resolvedCount += 1; else unresolvedCount += 1;
        } catch (error) {
          failedCount += 1;
          inspectionExchanges.push(await failureExchange(inspect, error));
        }
      }
      commands.push(...inspectCommands);
      const partial = authorSourcePartial || isPartial(completeness) || failedCount > 0;
      state.attempt = {
        status: partial ? 'partial' : resolvedCount ? 'available' : 'unresolved', relays: draft.relays,
        commands, authorHandleId: String(move.resultId), supportingHandleId: String(hydrate.resultId),
        authorCount: authorIds.length, resolvedCount, unresolvedCount, failedCount, external, completeness,
        authorBounds, authorOmissions, authorBoundarySized,
      };
      addSnapshot(place, {
        target: { type: 'place', id: `${placeId}:resolved-authors` }, sourceHandleId: String(hydrate.resultId),
        observedRevision: lastExchangeRevision(inspectionExchanges, number(hydrated.response.sessionRevision)), locality: 'external',
        exchanges: [exchange(move, moved), exchange(showAuthors, shown), exchange(hydrate, hydrated), ...inspectionExchanges], facts: state.attempt as unknown as Record<string, unknown>,
      });
      set({ phase: { type: 'idle' } });
      useAtlasStore.getState().setExternalStatus({ label: 'Resolve authors in this place', status: (state.attempt.status === 'partial' ? 'PARTIAL' : string(completeness.attemptStatus) || string(external.status) || state.attempt.status).toUpperCase(), warningCount: Array.isArray(hydrated.response.warnings) ? hydrated.response.warnings.length : 0 });
      useAtlasStore.getState().recordActivity('Resolved authors in this place explicitly', JSON.stringify(commands), `${resolvedCount} resolved · ${unresolvedCount} unresolved · ${failedCount} failed · place unchanged`);
    } catch (error) {
      const failed = await failureExchange(commands[outcomes.length] ?? commands.at(-1)!, error);
      state.attempt = { status: 'failure', relays: draft.relays, commands, authorHandleId: String(move.resultId), supportingHandleId: String(hydrate.resultId), error: errorMessage(error) };
      addSnapshot(place, { target: { type: 'place', id: `${placeId}:resolved-authors` }, sourceHandleId: outcomes.length > 1 ? String(hydrate.resultId) : place.handleId, observedRevision: lastExchangeRevision([failed], place.installRevision), locality: 'external', exchanges: [...outcomes.map((outcome, index) => exchange(commands[index], outcome)), failed], facts: state.attempt as unknown as Record<string, unknown> });
      set({ phase: { type: 'failure', stage: 'authors', message: errorMessage(error), command: commands } });
      useAtlasStore.getState().setExternalStatus({ label: 'Resolve authors in this place', status: 'FAILURE', warningCount: 0 });
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
    noteResearch: {},
    mediaLoads: {},
    authorResolution: {
      draftOpen: false,
      draft: {
        relays: [...acquired.relays], authorLimit: 20, timeoutMs: 10000, observationLimit: 80,
        distinctEventLimit: 60, concurrency: 2, excludeContentWarnings: acquired.draft.excludeContentWarnings,
      },
    },
    runtime: {
      fieldId: placeId, sourceKind: local && acquired.sourceKind !== 'local-note-relationship' ? 'local-account-notes' : acquired.sourceKind,
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

function ensureNoteResearch(place: Field, noteId: string): NoteResearchState {
  place.noteResearch ??= {};
  const existing = place.noteResearch[noteId];
  if (existing) return existing;
  const external = defaultExternalDraft(place);
  const state: NoteResearchState = {
    draftOpen: false,
    relationshipDraft: { ...external, relationship: 'replies', eventLimit: 20 },
    attempts: {},
  };
  place.noteResearch[noteId] = state;
  return state;
}

function setRelationshipAttempt(
  research: NoteResearchState,
  relationship: NoteRelationship,
  source: 'local' | 'relays',
  attempt: NonNullable<NoteResearchState['attempts'][NoteRelationship]>['local'],
) {
  const retained = research.attempts[relationship] ?? {};
  research.attempts[relationship] = { ...retained, [source]: attempt };
}

function ensureAuthorResolution(place: Field) {
  if (place.authorResolution) return place.authorResolution;
  place.authorResolution = { draftOpen: false, draft: { ...defaultExternalDraft(place), authorLimit: 20 } };
  return place.authorResolution;
}

function defaultExternalDraft(place: Field): ExternalActionDraft {
  return {
    relays: [...(place.runtime?.relays ?? [])], timeoutMs: 10000, observationLimit: 80,
    distinctEventLimit: 60, concurrency: 2,
    excludeContentWarnings: place.runtime?.draft.excludeContentWarnings ?? true,
  };
}

function noteEventHandle(place: Field, noteId: string) {
  const snapshot = [...place.observationSnapshots].reverse().find((candidate) => candidate.target.type === 'note' && candidate.target.id === noteId);
  return string(snapshot?.facts.eventHandleId);
}

function relationshipRelayCommand(input: string, draft: RelationshipActionDraft, resultId: string) {
  const { relationship, eventLimit, relays, ...external } = draft;
  return { command: 'continue', input, parameters: { relationship, source: 'relays', relays, eventLimit, ...external }, resultId };
}

function authorResolutionCommands(place: Field, draft: AuthorResolutionDraft): Record<string, unknown>[] {
  const authorHandleId = uniqueHandle('atlas-place-authors');
  const profileHandleId = uniqueHandle('atlas-place-profiles');
  const { authorLimit, ...external } = draft;
  return [
    { command: 'move', input: place.handleId, parameters: { to: 'authors', limit: authorLimit }, resultId: authorHandleId },
    { command: 'show', input: authorHandleId, parameters: { mode: 'preview', previewLimit: authorLimit, excerptLimit: 1000, sizeLimit: 50000 } },
    { command: 'hydrate', input: authorHandleId, parameters: { ...external, kinds: [0] }, resultId: profileHandleId },
  ];
}

function sanitizeRelationshipDraft(draft: RelationshipActionDraft): RelationshipActionDraft {
  return {
    ...sanitizeExternalDraft(draft), relationship: draft.relationship,
    eventLimit: boundedInteger(draft.eventLimit, 1, 100),
  };
}

function sanitizeAuthorResolutionDraft(draft: AuthorResolutionDraft): AuthorResolutionDraft {
  return { ...sanitizeExternalDraft(draft), authorLimit: boundedInteger(draft.authorLimit, 1, 20) };
}

function relationshipAttemptStatus(count: number, completeness: Record<string, unknown>, observationFailure?: ObservationExchange) {
  if (observationFailure || isPartial(completeness)) return 'partial' as const;
  return count ? 'available' as const : 'empty' as const;
}

function isPartial(completeness: Record<string, unknown>) {
  return string(completeness.status) === 'partial' || string(completeness.attemptStatus) === 'partial'
    || (Array.isArray(completeness.boundsReached) && completeness.boundsReached.length > 0);
}

function relationshipLabel(value: NoteRelationship) {
  return ({ ancestors: 'Parent / ancestors', replies: 'Replies', quotes: 'Quoted events', mentions: 'Mentioned events', 'referenced-events': 'Referenced events' })[value];
}

function normalizedAttachments(values?: Record<string, unknown>[]): AttachmentFact[] {
  return (values ?? []).map((value) => {
    const url = string(value.url);
    return {
      url,
      families: stringArray(value.families)?.filter((family): family is AttachmentFact['families'][number] => ['image', 'video', 'audio', 'file', 'unknown'].includes(family)) ?? ['unknown'],
      mimeTypes: stringArray(value.mimeTypes) ?? [], classification: string(value.classification) || 'unknown',
      sources: stringArray(value.sources) ?? [], width: optionalNumber(value.width), height: optionalNumber(value.height),
      durationSeconds: optionalNumber(value.durationSeconds), alt: string(value.alt) || undefined,
      hashes: stringArray(value.hashes) ?? [], fallbackUrls: stringArray(value.fallbackUrls) ?? [],
    };
  }).filter((attachment) => attachment.url.startsWith('http://') || attachment.url.startsWith('https://'));
}

function mediaFromAttachment(attachment: AttachmentFact): NonNullable<Note['media']> {
  const family = attachment.families.find((item) => ['image', 'video', 'audio'].includes(item)) ?? attachment.families[0] ?? 'unknown';
  return { type: family, src: attachment.url, alt: attachment.alt ?? `Remote ${family} referenced by this note`, remote: true };
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
    const attachments = current?.attachments ?? [];
    notes[id] = {
      id, authorId, content,
      createdAt: createdAt ? relativeTime(createdAt) : 'time unavailable', timestamp: createdAt,
      relayCount: number(preview.relayCount) || relayUrls.length || current?.relayCount || 0,
      relayUrls: relayUrls.length ? relayUrls : current?.relayUrls,
      attachments, media: attachments[0] ? mediaFromAttachment(attachments[0]) : current?.media,
      contentRole: current?.contentRole, conversationRole: current?.conversationRole, live: true,
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

function tracerWorking() {
  return Object.values(useAtlasStore.getState().navigatorOperations).some((operation) => operation.status === 'working');
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
function optionalNumber(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function boolean(value: unknown) { return value === true; }
function responseError(response: Record<string, unknown>) { const error = object(response.error); return string(error.message) || string(error.code) || 'The research command failed.'; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }
