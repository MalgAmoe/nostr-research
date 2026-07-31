import {
  type Account, type AttachmentFact, type Field, type Note, type NoteObservation, type ObservationExchange,
} from './data';
import { liveController } from './live-session';
import type { QueryDraft } from './live-types';

export type ExecutedCommand = {
  result: Record<string, unknown>;
  response: Record<string, unknown>;
  receipt: Record<string, unknown>;
};

export class ResolverFailure extends Error {
  commands: Record<string, unknown>[];
  exchanges: ObservationExchange[];

  constructor(message: string, command: Record<string, unknown>, exchange: ObservationExchange) {
    super(message);
    this.commands = [command];
    this.exchanges = [exchange];
  }

  prepend(commands: Record<string, unknown>[], exchanges: ObservationExchange[]) {
    this.commands = [...commands, ...this.commands];
    this.exchanges = [...exchanges, ...this.exchanges];
    return this;
  }
}

export type AcquisitionIntent = {
  draft: QueryDraft;
  relays: string[];
  hadGround: boolean;
  knownNotes: Record<string, Note>;
  knownAccounts: Record<string, Account>;
};

export type AcquisitionResolution = {
  kind: 'acquisition';
  command: Record<string, unknown>;
  showCommand: Record<string, unknown>;
  handleId: string;
  installRevision: number;
  count: number;
  receipt: Record<string, unknown>;
  coverage: Record<string, unknown>;
  relays: string[];
  draft: QueryDraft;
  place: Field;
  notes: Record<string, Note>;
  baseNotes: Record<string, Note>;
  accounts: Record<string, Account>;
  preview?: ExecutedCommand;
  observationFailure?: ObservationExchange;
  externalStatus: { label: string; status: string; warningCount: number };
};

export type SubjectPlaceIntent = {
  id: string;
  handleId: string;
  accountProjection?: {
    status: 'loading' | 'available' | 'failure';
    handleId: string;
    accountIds: string[];
  };
  accountFacet?: {
    status: 'idle' | 'loading' | 'available' | 'failure';
    handles?: { rows: string; aggregate: string; ranked: string };
    records: Array<{ account: string }>;
  };
};

export type SubjectObservationIntent = {
  place: SubjectPlaceIntent;
  subject: { type: 'note'; id: string; note: Note } | { type: 'account'; id: string; account: Account };
  fallbackSource?: { noteId: string; placeHandleId: string };
};

export type NoteObservationResolution = {
  kind: 'note-observation';
  placeId: string;
  subjectId: string;
  observation: NoteObservation;
  exchanges: ObservationExchange[];
  notePatch: Partial<Note>;
  referencedAccounts: Account[];
  authorResearch?: {
    accountId: string;
    engineHandleId: string;
    localResolution: Record<string, unknown>;
  };
  activity: { label: string; command: string; outcome: string };
};

export type AccountObservationResolution = {
  kind: 'account-observation';
  placeId: string;
  subjectId: string;
  status: 'available' | 'unresolved';
  engineHandleId?: string;
  localResolution: Record<string, unknown>;
  exchanges: ObservationExchange[];
  activity?: { label: string; command: string; outcome: string };
};

export type SubjectObservationResolution = NoteObservationResolution | AccountObservationResolution;

export type ControllerFactory = typeof liveController;

let nextResolverHandle = 0;

export async function resolveAcquisition(
  intent: AcquisitionIntent,
  controllerFactory: ControllerFactory = liveController,
  onCommand?: (command: Record<string, unknown>) => void,
): Promise<AcquisitionResolution> {
  const draft = cleanDraft(intent.draft);
  const validation = validateDraft(draft) ?? validateSearchRelayCount(draft, intent.relays);
  if (!intent.relays.length || validation) {
    const command = acquisitionCommand('unallocated', draft, intent.relays);
    throw localFailure(validation ?? 'Select at least one relay.', command);
  }

  const handleId = uniqueHandle('atlas-ground');
  const command = acquisitionCommand(handleId, draft, intent.relays);
  onCommand?.(command);
  const acquired = await execute(command, controllerFactory);
  const handle = object(acquired.result.handle);
  const count = number(handle.count);
  const installRevision = number(handle.revision) || number(acquired.response.sessionRevision);
  const showCommand = boundedShowCommand(handleId, 0, count);
  let shown: ExecutedCommand | undefined;
  let observationFailure: ObservationExchange | undefined;
  try {
    shown = await execute(showCommand, controllerFactory);
  } catch (error) {
    observationFailure = failureExchange(showCommand, error);
  }

  const presentation = presentNotes(objectArray(shown?.result.preview), intent.knownNotes, intent.knownAccounts);
  const shownResult = shown?.result ?? {};
  const external = object(acquired.result.external);
  const completeness = object(external.completeness);
  const timestamps = Object.values(presentation.notes).map((note) => note.timestamp).filter((value) => value > 0);
  const nextOffset = number(shownResult.nextOffset) || number(shownResult.offset) + presentation.noteIds.length;
  const placeId = `ground:${handleId}`;
  const place: Field = {
    id: placeId,
    label: draft.search ? `Search: ${draft.search}` : draft.author
      ? `${presentation.accounts[draft.author]?.name ?? intent.knownAccounts[draft.author]?.name ?? shortKey(draft.author)} · relay notes`
      : draft.eventId ? 'Exact event result' : 'Bounded relay notes',
    description: `${presentation.noteIds.length} displayed of ${count} retained event subjects.`,
    noteIds: presentation.noteIds,
    handleId,
    installRevision,
    role: 'ground',
    resultKind: 'events',
    countingUnit: string(shownResult.countUnit) || 'subjects',
    originCommand: command,
    originReceipt: acquired.receipt,
    navigatorReason: intent.hadGround
      ? 'Explicitly replaced Ground with a new bounded acquisition.'
      : 'Established Ground from the explicit initial acquisition.',
    projection: 'stream',
    localPageOffset: nextOffset,
    selected: { type: 'none', id: '' },
    selectedFacet: null,
    localConstraints: { text: '' },
    observationSnapshots: [],
    declaredBounds: presentObject({
      requestBudget: object(shownResult.context).budget,
      response: shown ? responseBounds(shownResult) : undefined,
      completeness: completeness.boundsReached,
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
        relays: [...intent.relays], authorLimit: 20, timeoutMs: 10000, observationLimit: 80,
        distinctEventLimit: 60, concurrency: 2, excludeContentWarnings: draft.excludeContentWarnings,
      },
    },
    runtime: {
      fieldId: placeId, sourceKind: 'query', handleId, pageHandleId: handleId, total: count,
      nextOffset, handleAddedCount: presentation.noteIds.length, relays: [...intent.relays], draft,
      newestTimestamp: timestamps.length ? Math.max(...timestamps) : 0,
      oldestTimestamp: timestamps.length ? Math.min(...timestamps) : 0,
    },
    conditions: {
      source: intent.relays.join(' · '),
      terminal: string(completeness.attemptStatus).toUpperCase() || string(completeness.status).toUpperCase()
        || string(external.status).toUpperCase() || string(acquired.result.status).toUpperCase() || 'BOUNDED',
      excludedWarnings: number(completeness.excludedContentWarnings),
      uncertainty: observationFailure
        ? 'The external handle was installed, but its first bounded preview is unavailable.'
        : draft.search
          ? 'Relay-side NIP-50 matching varies by relay; completeness and ranking are not implied.'
          : 'A bounded relay attempt was made; relay and network completeness are not implied.',
      partial: Boolean(observationFailure)
        || [string(external.status), string(completeness.attemptStatus), string(completeness.status)].includes('partial')
        || (Array.isArray(completeness.boundsReached) && completeness.boundsReached.length > 0),
    },
  };

  return {
    kind: 'acquisition', command, showCommand, handleId, installRevision, count,
    receipt: acquired.receipt, coverage: acquired.result, relays: [...intent.relays], draft,
    place, notes: presentation.notes, baseNotes: presentation.baseNotes, accounts: presentation.accounts, preview: shown, observationFailure,
    externalStatus: {
      label: 'Ground acquisition', status: string(external.status).toUpperCase() || 'BOUNDED',
      warningCount: Array.isArray(acquired.response.warnings) ? acquired.response.warnings.length : 0,
    },
  };
}

export async function resolveSubjectObservation(
  intent: SubjectObservationIntent,
  controllerFactory: ControllerFactory = liveController,
): Promise<SubjectObservationResolution> {
  return intent.subject.type === 'note'
    ? resolveNoteObservation(intent, controllerFactory)
    : resolveAccountObservation(intent, controllerFactory);
}

async function resolveNoteObservation(intent: SubjectObservationIntent, controllerFactory: ControllerFactory): Promise<NoteObservationResolution> {
  if (intent.subject.type !== 'note') throw new Error('Expected a note observation intent.');
  const { place } = intent;
  const note = intent.subject.note;
  const handles = {
    event: uniqueHandle('atlas-note'), author: uniqueHandle('atlas-note-author'), facts: uniqueHandle('atlas-note-facts'),
    events: uniqueHandle('atlas-note-events'), accounts: uniqueHandle('atlas-note-accounts'), addresses: uniqueHandle('atlas-note-addresses'),
  };
  const commands: Record<string, unknown>[] = [
    { command: 'filter', input: place.handleId, parameters: { where: { field: 'subject.id', equals: note.id }, limit: 1 }, resultId: handles.event },
    { command: 'move', input: handles.event, parameters: { to: 'authors', limit: 1 }, resultId: handles.author },
    { command: 'relate', input: handles.event, parameters: {}, resultId: handles.facts },
    { command: 'move', input: handles.event, parameters: { to: 'referencedEvents', limit: 20 }, resultId: handles.events },
    { command: 'move', input: handles.event, parameters: { to: 'referencedAccounts', limit: 20 }, resultId: handles.accounts },
    { command: 'move', input: handles.event, parameters: { to: 'referencedAddresses', limit: 20 }, resultId: handles.addresses },
    inspectCommand({ type: 'event', id: note.id }),
    showDetailsCommand(handles.facts), showPreviewCommand(handles.events), showPreviewCommand(handles.accounts), showPreviewCommand(handles.addresses),
  ];
  const outcomes = await executeSequence(commands, controllerFactory);
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
  const attachments = normalizedAttachments(Array.isArray(values['event.attachments']) ? values['event.attachments'].map(object) : undefined);
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
  const referencedAccounts = (observation.referencedAccounts ?? []).map((id) => liveAccount(id));
  const notePatch: Partial<Note> = {
    ...(content === undefined ? {} : { content }), attachments,
    media: attachments[0] ? mediaFromAttachment(attachments[0]) : undefined,
    contentRole: observation.role, conversationRole: observation.conversationRole,
  };
  const localResolution = observation.resolution as Record<string, unknown>;
  return {
    kind: 'note-observation', placeId: place.id, subjectId: note.id, observation,
    exchanges: commands.map((command, index) => exchange(command, outcomes[index])),
    notePatch, referencedAccounts,
    ...(observation.authorHandleId ? { authorResearch: { accountId: note.authorId, engineHandleId: observation.authorHandleId, localResolution } } : {}),
    activity: {
      label: 'Selected and observed note locally', command: JSON.stringify(commands),
      outcome: `${resolved ? 'Resident event evidence observed' : 'Event evidence unresolved'} · no relay contacted`,
    },
  };
}

async function resolveAccountObservation(intent: SubjectObservationIntent, controllerFactory: ControllerFactory): Promise<AccountObservationResolution> {
  if (intent.subject.type !== 'account') throw new Error('Expected an account observation intent.');
  const { place } = intent;
  const accountId = intent.subject.id;
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
    const fallback = intent.fallbackSource;
    if (!fallback) {
      return {
        kind: 'account-observation', placeId: place.id, subjectId: accountId, status: 'unresolved',
        localResolution: { resolved: false, source: 'No retained event or facet row for this account.' }, exchanges: [],
      };
    }
    const noteHandleId = uniqueHandle('atlas-account-source');
    commands = [
      { command: 'filter', input: fallback.placeHandleId, parameters: { where: { field: 'subject.id', equals: fallback.noteId }, limit: 1 }, resultId: noteHandleId },
      { command: 'move', input: noteHandleId, parameters: { to: 'authors', limit: 1 }, resultId: authorHandleId },
      inspectCommand({ type: 'account', id: accountId }),
    ];
  }
  const outcomes = await executeSequence(commands, controllerFactory);
  const directProjection = place.accountProjection?.status === 'available' && place.accountProjection.accountIds.includes(accountId);
  const handleOutcome = directProjection ? outcomes[0] : outcomes[1];
  const inspection = outcomes.at(-1)!;
  const available = number(object(handleOutcome.result.handle).count) > 0;
  const localResolution = available ? {
    resident: boolean(inspection.result.resident), resolved: boolean(inspection.result.resolved),
    source: string(inspection.result.resolutionSource) || undefined,
  } : { resolved: false, source: 'operational place handle' };
  return {
    kind: 'account-observation', placeId: place.id, subjectId: accountId,
    status: available ? 'available' : 'unresolved', ...(available ? { engineHandleId: authorHandleId } : {}),
    localResolution, exchanges: commands.map((command, index) => exchange(command, outcomes[index])),
    activity: {
      label: 'Selected and observed account locally', command: JSON.stringify(commands),
      outcome: `${available ? 'Account handle retained' : 'Account unresolved'} · no relay contacted`,
    },
  };
}

async function executeSequence(commands: Record<string, unknown>[], controllerFactory: ControllerFactory) {
  const outcomes: ExecutedCommand[] = [];
  for (const command of commands) {
    try {
      outcomes.push(await execute(command, controllerFactory));
    } catch (error) {
      if (error instanceof ResolverFailure) {
        throw error.prepend(
          commands.slice(0, outcomes.length),
          outcomes.map((outcome, index) => exchange(commands[index], outcome)),
        );
      }
      throw error;
    }
  }
  return outcomes;
}

async function execute(command: Record<string, unknown>, controllerFactory: ControllerFactory): Promise<ExecutedCommand> {
  try {
    const controller = await controllerFactory();
    const outcome = await controller.execute(command);
    const response = outcome.response as unknown as Record<string, unknown>;
    const executed = { result: object(response.result), response, receipt: object(outcome.receipt) };
    if (response.ok !== true) throw new ResolverFailure(responseError(response), command, exchange(command, executed));
    return executed;
  } catch (error) {
    if (error instanceof ResolverFailure) throw error;
    throw new ResolverFailure(errorMessage(error), command, failureExchange(command, error));
  }
}

function localFailure(message: string, command: Record<string, unknown>) {
  return new ResolverFailure(message, command, {
    command, response: { unavailable: true, validationFailure: { message } },
    receipt: { unavailable: true, reason: 'No controller command was executed.' },
  });
}

function failureExchange(command: Record<string, unknown>, error: unknown): ObservationExchange {
  if (error instanceof ResolverFailure) return error.exchanges.at(-1)!;
  return {
    command, response: { unavailable: true, transportFailure: { message: errorMessage(error) } },
    receipt: { unavailable: true, reason: 'No controller response was returned.' },
  };
}

function acquisitionCommand(handleId: string, draft: QueryDraft, relays: string[]) {
  return {
    command: 'acquire', parameters: {
      relays, filter: queryFilter(draft), timeoutMs: draft.timeoutMs,
      observationLimit: draft.observationLimit, distinctEventLimit: draft.distinctEventLimit,
      concurrency: draft.concurrency, excludeContentWarnings: draft.excludeContentWarnings,
    }, resultId: handleId,
  };
}

function boundedShowCommand(handleId: string, offset: number, remaining: number) {
  return { command: 'show', input: handleId, parameters: { mode: 'preview', offset, previewLimit: Math.min(20, Math.max(1, remaining)), excerptLimit: 1000, sizeLimit: 50000 } };
}

function inspectCommand(subject: { type: 'event' | 'account'; id: string }) {
  return { command: 'inspect', parameters: { subject, includeEvidence: true, previewLimit: 20, excerptLimit: 1000, sizeLimit: 50000 } };
}
function showDetailsCommand(input: string) { return { command: 'show', input, parameters: { mode: 'details', includeEvidence: true, previewLimit: 1, excerptLimit: 1000, sizeLimit: 50000 } }; }
function showPreviewCommand(input: string) { return { command: 'show', input, parameters: { mode: 'explain', includeEvidence: true, previewLimit: 20, excerptLimit: 1000, sizeLimit: 50000 } }; }

function presentNotes(rows: Record<string, unknown>[], knownNotes: Record<string, Note>, knownAccounts: Record<string, Account>) {
  const presentedNotes: Record<string, Note> = {};
  const baseNotes: Record<string, Note> = {};
  const presentedAccounts: Record<string, Account> = {};
  const noteIds: string[] = [];
  for (const row of rows) {
    const id = string(row.id) || string(object(row.subject).id);
    const nestedPreview = object(row.preview);
    const preview = Object.keys(nestedPreview).length ? nestedPreview : row;
    const authorId = string(object(preview.author).publicKey);
    if (!id || !authorId) continue;
    const account = knownAccounts[authorId] ?? liveAccount(authorId, id);
    presentedAccounts[authorId] = account.sourceNoteId ? { ...account } : { ...account, sourceNoteId: id };
    const content = string(preview.contentExcerpt) || '[Content unavailable in this bounded preview]';
    const createdAt = number(preview.createdAt);
    const current = knownNotes[id];
    if (current) baseNotes[id] = current;
    const relayUrls = stringArray(preview.relays) ?? [];
    const attachments = current?.attachments ?? [];
    presentedNotes[id] = {
      id, authorId, content, createdAt: createdAt ? relativeTime(createdAt) : 'time unavailable', timestamp: createdAt,
      relayCount: number(preview.relayCount) || relayUrls.length || current?.relayCount || 0,
      relayUrls: relayUrls.length ? relayUrls : current?.relayUrls,
      attachments, media: attachments[0] ? mediaFromAttachment(attachments[0]) : current?.media,
      contentRole: current?.contentRole, conversationRole: current?.conversationRole, live: true,
    };
    noteIds.push(id);
  }
  return { noteIds: [...new Set(noteIds)], notes: presentedNotes, baseNotes, accounts: presentedAccounts };
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

function liveAccount(publicKey: string, sourceNoteId?: string): Account {
  return {
    id: publicKey, name: shortKey(publicKey), handle: `@${publicKey.slice(0, 8)}`, publicKey,
    about: 'Profile metadata has not been requested.', color: colorFor(publicKey),
    ...(sourceNoteId ? { sourceNoteId } : {}), live: true,
  };
}

export function cleanAcquisitionDraft(draft: QueryDraft): QueryDraft {
  return cleanDraft(draft);
}

export function acquisitionDraftError(draft: QueryDraft, relays: string[]) {
  const cleaned = cleanDraft(draft);
  return validateDraft(cleaned) ?? (!relays.length ? 'Select at least one relay.' : validateSearchRelayCount(cleaned, relays));
}

function cleanDraft(draft: QueryDraft): QueryDraft {
  return {
    limit: boundedInteger(draft.limit, 5, 100),
    hours: [0, 1, 6, 24, 72, 168, 720].includes(draft.hours) ? draft.hours : 24,
    search: draft.search.trim(), eventId: draft.eventId.trim().toLowerCase(), author: draft.author.trim().toLowerCase(),
    hashtag: draft.hashtag.trim().replace(/^#/u, ''), excludeContentWarnings: draft.excludeContentWarnings,
    includeFilterLimit: draft.includeFilterLimit, timeoutMs: boundedInteger(draft.timeoutMs, 1, 60000),
    observationLimit: Math.max(1, Math.round(draft.observationLimit)), distinctEventLimit: Math.max(1, Math.round(draft.distinctEventLimit)),
    concurrency: boundedInteger(draft.concurrency, 1, 10),
  };
}
function validateDraft(draft: QueryDraft) {
  if (draft.eventId && !/^[0-9a-f]{64}$/u.test(draft.eventId)) return 'Event ID must be a full 64-character hexadecimal identifier.';
  if (draft.author && !/^[0-9a-f]{64}$/u.test(draft.author)) return 'Author must be a full 64-character hexadecimal public key.';
  if (draft.search.length > 200) return 'Relay search text must be 200 characters or fewer.';
  return null;
}
export function validateSearchRelayCount(draft: QueryDraft, relays: string[]) {
  return draft.search.trim() && relays.length !== 1 ? 'Experimental NIP-50 text search requires exactly one selected relay.' : null;
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

function exchange(command: Record<string, unknown>, outcome: ExecutedCommand): ObservationExchange {
  return { command, response: outcome.response, receipt: outcome.receipt };
}
function subjectIds(result: Record<string, unknown>) { return [...new Set(objectArray(result.preview).map((item) => string(item.id) || string(object(item.subject).id)).filter(Boolean))]; }
function responseBounds(result: Record<string, unknown>) { return presentObject({ count: result.count, countUnit: result.countUnit, offset: result.offset, nextOffset: result.nextOffset, omitted: result.omitted, omittedBefore: result.omittedBefore, omittedAfter: result.omittedAfter, cardinality: object(result.context).cardinality }) ?? {}; }
function presentObject(value: Record<string, unknown>) { const entries = Object.entries(value).filter(([, item]) => item !== undefined && item !== null && (!Array.isArray(item) || item.length) && (typeof item !== 'object' || Array.isArray(item) || Object.keys(object(item)).length)); return entries.length ? Object.fromEntries(entries) : undefined; }
function boundedInteger(value: number, minimum: number, maximum: number) { return Math.min(maximum, Math.max(minimum, Math.round(Number.isFinite(value) ? value : minimum))); }
function uniqueHandle(prefix: string) { return `${prefix}-${++nextResolverHandle}`; }
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
