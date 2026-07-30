const MAX_CARDS = 100;
const MAX_RELAYS = 12;
const OBSERVATION_MODES = Object.freeze(['preview', 'summary', 'coverage', 'details', 'explain']);

const ACTION_GROUPS = Object.freeze([
  ['navigate', ['select', 'pick', 'move', 'extract', 'continue', 'hydrate', 'fetch']],
  ['shape', [
    'filter', 'project', 'distinct', 'sort', 'slice', 'aggregate', 'derive',
    'explode', 'scan', 'join', 'sample', 'limit', 'union', 'intersection',
    'difference', 'compare', 'balance', 'relate',
  ]],
  ['judge', ['remember', 'forget', 'remember-membership']],
  ['preserve', ['preserve', 'release-archive']],
]);
const ACTION_GROUP = new Map(ACTION_GROUPS.flatMap(([group, operations]) => (
  operations.map((operation) => [operation, group])
)));

/**
 * Arrange one already-requested show response around notes and accounts.
 * This function has no execute/request capability.
 */
export function arrangeEvidence({ command, outcome } = {}) {
  plainObject(command, 'command');
  if (command.command !== 'show' || typeof command.input !== 'string') {
    throw new TypeError('command must be an explicit show command with an input handle.');
  }
  const response = successfulResponse(outcome, 'outcome');
  const result = response.result;
  if (typeof result.observation !== 'string') {
    throw new TypeError('outcome must contain a show response.');
  }
  const preview = Array.isArray(result.preview) ? result.preview : [];
  const selected = preview.slice(0, MAX_CARDS);
  const cardMode = ['preview', 'details'].includes(result.observation);
  const arranged = cardMode ? selected.map((item, index) => {
    const position = (result.offset ?? 0) + index + 1;
    if (result.observation === 'details' && isPlainObject(item?.preview)) {
      const card = arrangeCard(item.preview, position);
      if (card.object !== 'unsupported') card.detail = detailFacts(item);
      return card;
    }
    return arrangeCard(item, position);
  }) : [];
  const unsupported = arranged.filter(({ object }) => object === 'unsupported').length;
  const cards = arranged.filter(({ object }) => object !== 'unsupported');
  const explanations = result.observation === 'explain'
    ? selected.filter(isPlainObject).map((item, index) => ({
        position: (result.offset ?? 0) + index + 1,
        ...pickPresent(item, [
          'subject', 'reasons', 'omittedReasons', 'provenance', 'omittedProvenance',
        ]),
      }))
    : [];

  return structuredClone(compact({
    type: 'evidence-desk',
    version: 2,
    source: {
      handle: command.input,
      resultType: string(result.type),
      observation: result.observation,
    },
    frame: compact({
      total: integer(result.count),
      visible: cards.length || explanations.length,
      offset: integer(result.offset),
      limit: integer(result.limit),
      nextOffset: integer(result.nextOffset),
      omittedBefore: integer(result.omittedBefore),
      omittedAfter: integer(result.omittedAfter),
      omitted: integer(result.omitted),
      sizeBounded: boolean(result.sizeBounded),
      arrangementOmittedCards: cardMode ? Math.max(0, preview.length - MAX_CARDS) : 0,
      unsupportedPreviewItems: unsupported,
    }),
    cards,
    explanations: explanations.length ? explanations : undefined,
    summary: isPlainObject(result.summary) ? result.summary : undefined,
    coverage: coverageFacts(result),
    context: arrangeContext(result.context, result.external, result.summary),
  }));
}

/**
 * Render evidence cards as a bounded, human-readable desk. The full arranged
 * object remains available for visual interfaces.
 */
export function formatEvidence(desk, { cardLimit = 20 } = {}) {
  plainObject(desk, 'desk');
  if (desk.type !== 'evidence-desk') throw new TypeError('desk must be produced by arrangeEvidence.');
  if (!Number.isInteger(cardLimit) || cardLimit < 1 || cardLimit > 50) {
    throw new TypeError('cardLimit must be an integer from 1 through 50.');
  }
  if (desk.source.observation === 'summary') return formatSummaryDesk(desk);
  if (desk.source.observation === 'coverage') return formatCoverageDesk(desk);
  if (desk.source.observation === 'explain') return formatExplanationDesk(desk, cardLimit);
  const objectLabel = desk.cards.length && desk.cards.every(({ object }) => (
    object === desk.cards[0].object
  )) ? plural(desk.cards[0].object, desk.frame.total) : 'evidence objects';
  const lines = [
    `${desk.frame.visible}/${desk.frame.total} ${objectLabel} visible`
      + ` · ${desk.source.observation}`,
  ];
  for (const card of desk.cards.slice(0, cardLimit)) {
    if (card.object === 'account') {
      const claims = card.claims ?? {};
      lines.push(`\n[${card.position}] account · ${claims.displayName ?? claims.name ?? shortId(card.id)}`);
      lines.push(`id: ${card.id}`);
      if (claims.name && claims.name !== claims.displayName) lines.push(`name: ${claims.name}`);
      if (claims.nip05) lines.push(`nip05 claim: ${claims.nip05}`);
      if (claims.description) lines.push(`about claim: ${claims.description}`);
      if (card.evidence?.metadataEventId) {
        lines.push(`metadata event: ${card.evidence.metadataEventId}`);
      }
    } else {
      const unresolved = card.evidence?.resolved === false
        || card.evidence?.resolutionSource === 'unresolved';
      const author = unresolved ? 'unresolved reference' : (
        card.author?.claims?.displayName
        ?? card.author?.claims?.name ?? shortId(card.author?.id)
      );
      lines.push(`\n[${card.position}] ${card.object} · ${author}`);
      lines.push(`id: ${card.id}`);
      if (card.createdAt !== undefined) {
        lines.push(`created: ${new Date(card.createdAt * 1000).toISOString()} · unix ${card.createdAt}`);
      }
      if (card.text !== undefined) lines.push(`text: ${card.text || '(empty excerpt)'}`);
    }
    const evidence = card.evidence ?? {};
    lines.push([
      'evidence', evidence.resolutionSource,
      evidence.resolved === undefined ? null : `resolved ${evidence.resolved}`,
      evidence.relayCount === undefined
        ? null : `${evidence.relayCount} ${plural('relay', evidence.relayCount)}`,
      card.inclusion?.reasons === undefined
        ? null : `${card.inclusion.reasons} ${plural('reason', card.inclusion.reasons)}`,
    ].filter(Boolean).join(' · '));
    if (card.inclusion?.relationshipTypes?.length) {
      lines.push(`included via: ${card.inclusion.relationshipTypes.join(', ')}`);
    }
    if (card.detail?.notebookEntry) {
      const notebook = card.detail.notebookEntry;
      lines.push([
        'notebook', notebook.attribution,
        notebook.reason ? `reason: ${notebook.reason}` : null,
        notebook.note ? `note: ${notebook.note}` : null,
      ].filter(Boolean).join(' · '));
    }
    if (card.detail?.provenance) {
      const provenance = card.detail.provenance;
      lines.push([
        'detail provenance',
        provenance.observations === undefined
          ? null : `${provenance.observations} observations`,
        Array.isArray(provenance.relays) ? `${provenance.relays.length} relays` : null,
        card.detail.omittedProvenance
          ? `${card.detail.omittedProvenance} provenance omitted` : null,
      ].filter(Boolean).join(' · '));
    }
    if (card.detail?.freshness) {
      const freshness = card.detail.freshness;
      lines.push([
        'freshness',
        freshness.observationCount === undefined
          ? null : `${freshness.observationCount} observations`,
        freshness.oldestObservedAt ? `oldest ${freshness.oldestObservedAt}` : null,
        freshness.newestObservedAt ? `newest ${freshness.newestObservedAt}` : null,
      ].filter(Boolean).join(' · '));
    }
  }
  const hidden = Math.max(0, desk.cards.length - cardLimit);
  if (hidden) lines.push(`\narranged cards not rendered: ${hidden}`);
  if (desk.frame.omittedBefore || desk.frame.omittedAfter) {
    lines.push(`response paging omissions: ${[
      desk.frame.omittedBefore ? `${desk.frame.omittedBefore} before` : null,
      desk.frame.omittedAfter ? `${desk.frame.omittedAfter} after` : null,
    ].filter(Boolean).join(' · ')}`);
  }
  if (desk.frame.arrangementOmittedCards || desk.frame.unsupportedPreviewItems) {
    lines.push(
      `arrangement omissions: ${desk.frame.arrangementOmittedCards} bounded`
      + ` · ${desk.frame.unsupportedPreviewItems} unsupported`,
    );
  }
  const acquisition = desk.context?.acquisition;
  if (acquisition) {
    lines.push([
      'acquisition', acquisition.completionReason,
      acquisition.exhaustive === undefined ? null : `exhaustive ${acquisition.exhaustive}`,
      acquisition.uncertainty,
    ].filter(Boolean).join(' · '));
  }
  const origin = desk.context?.origin;
  if (origin) {
    lines.push([
      'origin', origin.sourceOperation ?? origin.operation,
      origin.relationship,
      origin.source,
      origin.stageCount === undefined ? null : `${origin.stageCount} stages`,
      origin.completeness?.attemptStatus,
      origin.completeness?.dataScope,
      origin.completeness?.exhaustive === undefined
        ? null : `exhaustive ${origin.completeness.exhaustive}`,
      origin.cardinality?.truncated === undefined
        ? null : `truncated ${origin.cardinality.truncated}`,
    ].filter(Boolean).join(' · '));
  }
  lines.push(`source handle: ${desk.source.handle}`);
  return lines.join('\n');
}

function formatSummaryDesk(desk) {
  const summary = desk.summary ?? {};
  const lines = [
    `${summary.count ?? desk.frame.total} ${summary.countUnit ?? 'subjects'} · summary`,
  ];
  if (summary.evidenceResolution) {
    const resolution = summary.evidenceResolution;
    lines.push(
      `resolution: ${resolution.buffer ?? 0} buffer · ${resolution.archive ?? 0} archive`
      + ` · ${resolution.unresolved ?? 0} unresolved`,
    );
  }
  if (summary.bounds) {
    const declared = [
      summary.bounds.outputCount === undefined
        ? null : `${summary.bounds.outputCount} output`,
      summary.bounds.outputLimit === undefined
        ? null : `limit ${summary.bounds.outputLimit}`,
      summary.bounds.omittedCount === undefined
        ? null : `${summary.bounds.omittedCount} omitted`,
      summary.bounds.truncated === undefined
        ? null : `truncated ${summary.bounds.truncated}`,
    ].filter(Boolean);
    const facts = declared.length ? declared : numericFacts(summary.bounds);
    if (facts.length) lines.push(`bounds · ${facts.join(' · ')}`);
  }
  if (summary.completeness) {
    const completeness = summary.completeness;
    lines.push([
      'completeness', completeness.status ?? completeness.attemptStatus,
      completeness.scope ?? completeness.dataScope,
      completeness.exhaustive === undefined
        ? null : `exhaustive ${completeness.exhaustive}`,
      completeness.omissionCount === undefined
        ? null : `${completeness.omissionCount} omitted`,
      completeness.boundsReached?.length
        ? `bounds ${completeness.boundsReached.join(', ')}` : null,
    ].filter(Boolean).join(' · '));
  }
  if (summary.eventFacts) {
    const facts = summary.eventFacts;
    lines.push([
      'events', `${facts.resolvedEventCount} resolved`,
      facts.distinctAuthorCount === undefined
        ? null : `${facts.distinctAuthorCount} distinct authors`,
      Array.isArray(facts.kindHistogram)
        ? `kinds ${facts.kindHistogram.map(({ kind, count }) => `${kind} × ${count}`).join(', ')}`
        : null,
    ].filter(Boolean).join(' · '));
  }
  appendOrigin(lines, desk.context?.origin);
  lines.push(`source handle: ${desk.source.handle}`);
  return lines.join('\n');
}

function formatCoverageDesk(desk) {
  const coverage = desk.coverage ?? {};
  if (coverage.kind === 'acquisition') {
    return formatAcquisitionCoverageDesk(desk, coverage);
  }
  const lines = [`${desk.frame.total} subjects · coverage`];
  if (coverage.sources) {
    lines.push([
      'sources', `${coverage.sources.observations ?? 0} observations`,
      `${coverage.sources.relays?.length ?? 0} relays`,
      coverage.sources.omittedObservationCount
        ? `${coverage.sources.omittedObservationCount} observations omitted` : null,
    ].filter(Boolean).join(' · '));
  }
  if (coverage.evidenceResolution) {
    const resolution = coverage.evidenceResolution;
    lines.push(
      `resolution: ${resolution.buffer ?? 0} buffer · ${resolution.archive ?? 0} archive`
      + ` · ${resolution.unresolved ?? 0} unresolved`,
    );
  }
  lines.push([
    'coverage', coverage.partial === undefined ? null : `partial ${coverage.partial}`,
    coverage.bounds?.truncated === undefined
      ? null : `truncated ${coverage.bounds.truncated}`,
    coverage.unresolvedEvidence === undefined
      ? null : `${coverage.unresolvedEvidence} unresolved evidence`,
  ].filter(Boolean).join(' · '));
  appendOrigin(lines, desk.context?.origin);
  lines.push(`source handle: ${desk.source.handle}`);
  return lines.join('\n');
}

function formatAcquisitionCoverageDesk(desk, coverage) {
  const lines = [`${desk.frame.total} events · acquisition coverage`];
  if (coverage.requested) {
    lines.push([
      'requested',
      Array.isArray(coverage.requested.relays)
        ? `${coverage.requested.relays.length} relays` : null,
      coverage.requested.filter ? `filter ${inlineJson(coverage.requested.filter)}` : null,
      coverage.requested.excludeContentWarnings === undefined
        ? null : `exclude content warnings ${coverage.requested.excludeContentWarnings}`,
    ].filter(Boolean).join(' · '));
  }
  if (coverage.budget) {
    lines.push(`budget: ${numericFacts(coverage.budget).join(' · ')}`);
  }
  if (coverage.counts) {
    lines.push(`counts: ${numericFacts(coverage.counts).join(' · ')}`);
  }
  lines.push([
    'attempt', coverage.completionReason,
    coverage.exhaustive === undefined ? null : `exhaustive ${coverage.exhaustive}`,
  ].filter(Boolean).join(' · '));
  for (const relay of coverage.relays ?? []) {
    lines.push([
      'relay', relay.relay ?? relay.endpoint,
      relay.outcome,
      relay.attemptStarted === undefined ? null : `started ${relay.attemptStarted}`,
      relay.socketOpened === undefined ? null : `opened ${relay.socketOpened}`,
      relay.subscriptionSent === undefined ? null : `subscribed ${relay.subscriptionSent}`,
      relay.acceptedObservations === undefined
        ? null : `${relay.acceptedObservations} accepted observations`,
    ].filter(Boolean).join(' · '));
  }
  if (coverage.omittedRelaysBefore || coverage.omittedRelaysAfter) {
    lines.push([
      'relay omissions',
      coverage.omittedRelaysBefore ? `${coverage.omittedRelaysBefore} before` : null,
      coverage.omittedRelaysAfter ? `${coverage.omittedRelaysAfter} after` : null,
    ].filter(Boolean).join(' · '));
  }
  if (coverage.observedEvents?.length
    || coverage.omittedObservedEventsBefore || coverage.omittedObservedEventsAfter) {
    lines.push([
      'observed events', `${coverage.observedEvents?.length ?? 0} shown`,
      coverage.omittedObservedEventsBefore
        ? `${coverage.omittedObservedEventsBefore} before` : null,
      coverage.omittedObservedEventsAfter
        ? `${coverage.omittedObservedEventsAfter} after` : null,
    ].filter(Boolean).join(' · '));
  }
  if (coverage.uncertainty) lines.push(`uncertainty: ${coverage.uncertainty}`);
  lines.push(`source handle: ${desk.source.handle}`);
  return lines.join('\n');
}

function numericFacts(value) {
  return Object.entries(value)
    .filter(([, member]) => Number.isFinite(member))
    .slice(0, 20)
    .map(([name, member]) => `${name} ${member}`);
}

function inlineJson(value, limit = 360) {
  const serialized = JSON.stringify(value);
  return serialized.length <= limit ? serialized : `${serialized.slice(0, limit - 1)}…`;
}

function formatExplanationDesk(desk, limit) {
  const explanations = desk.explanations ?? [];
  const lines = [
    `${explanations.length}/${desk.frame.total} explanations visible · explain`,
  ];
  for (const explanation of explanations.slice(0, limit)) {
    lines.push(`\n[${explanation.position}] ${explanation.subject?.type ?? 'subject'} · ${explanation.subject?.id ?? 'unknown'}`);
    for (const reason of explanation.reasons ?? []) {
      lines.push(`reason: ${formatReason(reason)}`);
    }
    for (const provenance of explanation.provenance ?? []) {
      if (provenance.relay) {
        lines.push(`observed: ${provenance.relay}${provenance.observedAt ? ` · ${provenance.observedAt}` : ''}`);
      } else if (provenance.type) {
        lines.push(`provenance: ${provenance.type}`);
      }
    }
    if (explanation.omittedReasons) lines.push(`reasons omitted: ${explanation.omittedReasons}`);
    if (explanation.omittedProvenance) {
      lines.push(`provenance omitted: ${explanation.omittedProvenance}`);
    }
  }
  const hidden = Math.max(0, explanations.length - limit);
  if (hidden) lines.push(`\nexplanations not rendered: ${hidden}`);
  appendOrigin(lines, desk.context?.origin);
  lines.push(`source handle: ${desk.source.handle}`);
  return lines.join('\n');
}

function formatReason(reason) {
  if (!isPlainObject(reason)) return String(reason);
  if (reason.type === 'relationship') {
    return [
      reason.type, reason.relationshipType, reason.direction,
      reason.depth === undefined ? null : `depth ${reason.depth}`,
      reason.evidence?.protocol,
    ].filter(Boolean).join(' · ');
  }
  if (reason.type === 'continuation') {
    return [reason.type, reason.relationship, reason.source].filter(Boolean).join(' · ');
  }
  return reason.type ?? JSON.stringify(reason);
}

function appendOrigin(lines, origin) {
  if (!origin) return;
  const facts = [
    origin.sourceOperation ?? origin.operation,
    origin.relationship,
    origin.source,
  ].filter(Boolean);
  if (facts.length) lines.push(`origin · ${facts.join(' · ')}`);
}

/**
 * Arrange contextual actions from schema responses the caller already chose to
 * request. No schema request is performed here.
 */
export function arrangeActions({ source, schemaOutcomes = [] } = {}) {
  if (typeof source !== 'string' || source.length === 0) {
    throw new TypeError('source must be a non-empty handle id.');
  }
  if (!Array.isArray(schemaOutcomes)) throw new TypeError('schemaOutcomes must be an array.');
  let broad;
  const focused = new Map();
  for (const [index, outcome] of schemaOutcomes.entries()) {
    const result = successfulResponse(outcome, `schemaOutcomes[${index}]`).result;
    if (!String(result.type ?? '').includes('schema')) {
      throw new TypeError(`schemaOutcomes[${index}] must contain a schema response.`);
    }
    if (result.operation?.name) focused.set(result.operation.name, result.operation);
    if (Array.isArray(result.compatibleOperations)) broad = result;
  }
  if (!broad) throw new TypeError('schemaOutcomes must include one broad contextual schema response.');
  if (broad.handle?.id !== source) {
    throw new TypeError('broad schema handle must match source.');
  }

  const observations = OBSERVATION_MODES.map((mode) => ({
    id: `observe:${mode}`,
    group: 'observe',
    label: `Observe ${humanize(mode)}`,
    basis: 'desk-observation-vocabulary',
    command: { command: 'show', input: source, parameters: { mode } },
  }));
  const actions = broad.compatibleOperations.map((operation) => {
    const contract = focused.get(operation);
    return compact({
      id: `operate:${operation}`,
      group: ACTION_GROUP.get(operation) ?? 'other',
      label: humanize(operation),
      contractLoaded: Boolean(contract),
      command: { command: operation, input: source, parameters: {} },
      requirements: contract ? parameterRequirements(contract) : undefined,
      variants: contract ? actionVariants(operation, contract, source) : undefined,
      contract: contract ? contractFacts(contract) : undefined,
    });
  });
  const groups = ['navigate', 'shape', 'judge', 'preserve', 'other']
    .map((id) => ({ id, actions: actions.filter(({ group }) => group === id) }))
    .filter(({ actions: members }) => members.length > 0);

  return structuredClone({
    type: 'evidence-actions',
    version: 1,
    source,
    observations,
    groups,
  });
}

/**
 * Fill one arranged action with navigator-supplied values. The returned object
 * is an ordinary visible controller command and is not executed here.
 */
export function composeAction(action, values = {}) {
  plainObject(action, 'action');
  plainObject(action.command, 'action.command');
  plainObject(values, 'values');
  rejectUnknown(values, ['parameters', 'resultId', 'replace']);
  const suppliedParameters = values.parameters ?? {};
  plainObject(suppliedParameters, 'values.parameters');
  const parameters = {
    ...(action.command.parameters ?? {}),
    ...suppliedParameters,
  };
  validateRequirements(action.requirements, parameters);
  if (values.resultId !== undefined && (
    typeof values.resultId !== 'string' || values.resultId.trim().length === 0
  )) {
    throw new TypeError('values.resultId must be a non-empty string.');
  }
  if (values.replace !== undefined && typeof values.replace !== 'boolean') {
    throw new TypeError('values.replace must be a boolean.');
  }
  return structuredClone(compact({
    command: action.command.command,
    input: action.command.input,
    parameters,
    resultId: values.resultId,
    replace: values.replace,
  }));
}

/**
 * Compare two explicitly observed card frames without attributing causality.
 */
export function compareEvidenceFrames(before, after) {
  validateDesk(before, 'before');
  validateDesk(after, 'after');
  const earlier = new Map((before.cards ?? []).map((card) => [cardSubjectKey(card), card]));
  const later = new Map((after.cards ?? []).map((card) => [cardSubjectKey(card), card]));
  const onlyAfter = [...later]
    .filter(([key]) => !earlier.has(key))
    .map(([, card]) => cardReference(card));
  const onlyBefore = [...earlier]
    .filter(([key]) => !later.has(key))
    .map(([, card]) => cardReference(card));
  const resolutionChanges = [...later]
    .filter(([key]) => earlier.has(key))
    .map(([key, card]) => {
      const prior = earlier.get(key);
      return {
        object: cardReference(card),
        before: resolutionState(prior),
        after: resolutionState(card),
      };
    })
    .filter(({ before: prior, after: next }) => prior !== next);
  return structuredClone({
    type: 'evidence-frame-comparison',
    version: 1,
    before: { handle: before.source.handle, observation: before.source.observation },
    after: { handle: after.source.handle, observation: after.source.observation },
    shared: [...later.keys()].filter((key) => earlier.has(key)).length,
    onlyBefore,
    onlyAfter,
    resolutionChanges,
  });
}

/**
 * Produce visible commands that isolate one displayed object. Profile-event
 * cards require a second visible move because their displayed account is not
 * the event subject held by the source handle.
 */
export function composeCardFocus(desk, cardId, options = {}) {
  validateDesk(desk, 'desk');
  plainObject(options, 'options');
  const card = desk.cards?.find(({ cardId: candidate }) => candidate === cardId);
  if (!card) throw new TypeError(`Unknown card id: ${cardId}.`);
  const resultId = nonEmpty(options.resultId, 'options.resultId');
  const pickResultId = card.focus.requiresAccountMove
    ? nonEmpty(options.intermediateResultId, 'options.intermediateResultId')
    : resultId;
  const commands = [{
    command: 'pick',
    input: desk.source.handle,
    parameters: { positions: [card.position] },
    resultId: pickResultId,
  }];
  if (card.focus.requiresAccountMove) {
    commands.push({
      command: 'move',
      input: pickResultId,
      parameters: { to: 'authors' },
      resultId,
    });
  }
  return structuredClone({
    type: 'visible-command-sequence',
    purpose: 'focus-evidence-object',
    object: { type: card.object, id: card.id },
    commands,
  });
}

function validateDesk(desk, label) {
  plainObject(desk, label);
  if (desk.type !== 'evidence-desk' || !isPlainObject(desk.source)
    || !Array.isArray(desk.cards)) {
    throw new TypeError(`${label} must be produced by arrangeEvidence.`);
  }
}

function cardSubjectKey(card) {
  const subject = card.sourceSubject;
  if (!isPlainObject(subject) || typeof subject.type !== 'string'
    || typeof subject.id !== 'string') {
    throw new TypeError('evidence cards must expose a sourceSubject.');
  }
  return `${subject.type}:${subject.id}`;
}

function cardReference(card) {
  return {
    cardId: card.cardId,
    object: card.object,
    id: card.id,
    sourceSubject: card.sourceSubject,
  };
}

function resolutionState(card) {
  if (card.evidence?.resolved === false || card.evidence?.resolutionSource === 'unresolved') {
    return 'unresolved';
  }
  if (typeof card.evidence?.resolutionSource === 'string') {
    return card.evidence.resolutionSource;
  }
  if (card.evidence?.resolved === true) return 'resolved-source-not-declared';
  return 'not-declared';
}

function detailFacts(item) {
  return compact({
    resident: boolean(item.resident),
    resolved: boolean(item.resolved),
    resolutionSource: string(item.resolutionSource),
    notebookEntry: isPlainObject(item.preview?.notebookEntry)
      ? item.preview.notebookEntry : undefined,
    provenance: isPlainObject(item.provenance) ? item.provenance : undefined,
    freshness: isPlainObject(item.freshness) ? item.freshness : undefined,
    corpus: isPlainObject(item.corpus) ? item.corpus : undefined,
    omittedProvenance: integer(item.omittedProvenance),
    canonicalEvidence: isPlainObject(item.evidence) ? item.evidence : undefined,
  });
}

function arrangeCard(item, position) {
  if (!isPlainObject(item)) return { object: 'unsupported', position };
  if (item.type === 'account') return accountCard(item, position);
  if (item.type === 'event' && item.kind === 0 && item.author?.publicKey) {
    return profileCard(item, position);
  }
  if (item.type === 'event') return eventCard(item, position);
  return { object: 'unsupported', position };
}

function accountCard(item, position) {
  return compact({
    object: 'account',
    cardId: `account:${string(item.id)}`,
    id: string(item.publicKey) ?? string(item.id),
    position,
    claims: identityClaims(item),
    evidence: evidenceFacts(item),
    inclusion: inclusionFacts(item),
    sourceSubject: { type: 'account', id: string(item.id) },
    focus: { requiresAccountMove: false },
  });
}

function profileCard(item, position) {
  const account = item.author;
  return compact({
    object: 'account',
    cardId: `profile-event:${item.id}`,
    id: account.publicKey,
    position,
    claims: identityClaims(account),
    evidence: compact({
      ...evidenceFacts(item),
      metadataEventId: string(account.metadataEventId) ?? string(item.id),
      profileCreatedAt: integer(item.createdAt),
    }),
    inclusion: inclusionFacts(item),
    sourceSubject: { type: 'event', id: string(item.id), kind: 0 },
    focus: { requiresAccountMove: true },
  });
}

function eventCard(item, position) {
  const author = isPlainObject(item.author) ? item.author : {};
  return compact({
    object: item.kind === 1 ? 'note' : 'event',
    cardId: `event:${item.id}`,
    id: string(item.id),
    position,
    kind: integer(item.kind),
    createdAt: integer(item.createdAt),
    text: string(item.contentExcerpt),
    author: compact({
      id: string(author.publicKey),
      claims: Object.keys(identityClaims(author)).length ? identityClaims(author) : undefined,
    }),
    evidence: evidenceFacts(item),
    inclusion: inclusionFacts(item),
    sourceSubject: { type: 'event', id: string(item.id), kind: integer(item.kind) },
    focus: { requiresAccountMove: false },
  });
}

function identityClaims(source) {
  return compact({
    name: string(source.name),
    displayName: string(source.displayName),
    nip05: string(source.nip05),
    description: string(source.descriptionExcerpt),
  });
}

function evidenceFacts(source) {
  const relays = Array.isArray(source.relays)
    ? source.relays.filter((relay) => typeof relay === 'string').slice(0, MAX_RELAYS)
    : [];
  return compact({
    resolved: boolean(source.resolved),
    resolutionSource: string(source.resolutionSource),
    relayCount: integer(source.relayCount) ?? (relays.length ? relays.length : undefined),
    relays: relays.length ? relays : undefined,
    omittedRelays: Array.isArray(source.relays)
      ? Math.max(0, source.relays.length - MAX_RELAYS) : undefined,
    omittedObservations: integer(source.omittedObservationCount),
    metadataEventId: string(source.metadataEventId),
  });
}

function inclusionFacts(source) {
  const reason = isPlainObject(source.reasonSummary) ? source.reasonSummary : {};
  return compact({
    role: string(source.role),
    reasons: integer(reason.count),
    relationshipReasons: integer(reason.relationshipCount),
    relationshipTypes: stringArray(reason.relationshipTypes, 20),
  });
}

function coverageFacts(result) {
  if (isPlainObject(result.coverage)) return result.coverage;
  if (result.observation !== 'coverage' || result.type !== 'acquisition-coverage') {
    return undefined;
  }
  const relays = Array.isArray(result.relays) ? result.relays : [];
  const observedEvents = Array.isArray(result.observedEvents) ? result.observedEvents : [];
  return compact({
    kind: 'acquisition',
    requested: isPlainObject(result.requested) ? result.requested : undefined,
    budget: isPlainObject(result.budget) ? result.budget : undefined,
    counts: isPlainObject(result.counts) ? result.counts : undefined,
    completionReason: string(result.completionReason),
    exhaustive: boolean(result.exhaustive),
    uncertainty: string(result.uncertainty),
    relays: relays.slice(0, MAX_RELAYS),
    omittedRelaysBefore: integer(result.omittedRelaysBefore),
    omittedRelaysAfter: (integer(result.omittedRelaysAfter) ?? 0)
      + Math.max(0, relays.length - MAX_RELAYS),
    observedEvents: observedEvents.slice(0, MAX_CARDS),
    omittedObservedEventsBefore: integer(result.omittedObservedEventsBefore),
    omittedObservedEventsAfter: (integer(result.omittedObservedEventsAfter) ?? 0)
      + Math.max(0, observedEvents.length - MAX_CARDS),
  });
}

function arrangeContext(context, external, summary) {
  context = isPlainObject(context) ? context : {};
  external = isPlainObject(external) ? external : {};
  summary = isPlainObject(summary) ? summary : {};
  const origin = compact({
    operation: string(context.operation),
    sourceOperation: string(context.sourceOperation),
    stageCount: integer(context.stageCount),
    latestStage: isPlainObject(context.latestStage) ? context.latestStage : undefined,
    cardinality: isPlainObject(context.cardinality) ? context.cardinality : undefined,
    relationship: string(context.relationship),
    source: string(context.source),
    startCount: integer(context.startCount),
    limit: integer(context.limit),
    completeness: isPlainObject(context.completeness) ? context.completeness : undefined,
    lineage: summary.lineage,
  });
  const acquisition = compact({
    completionReason: string(context.completionReason),
    exhaustive: boolean(context.exhaustive),
    uncertainty: string(context.uncertainty),
    requested: isPlainObject(context.requested) ? context.requested : undefined,
    budget: isPlainObject(context.budget) ? context.budget : undefined,
    counts: isPlainObject(context.counts) ? context.counts : undefined,
    corpus: isPlainObject(context.corpus) ? context.corpus : undefined,
    externalStatus: string(external.status),
    completeness: isPlainObject(external.completeness) ? external.completeness : undefined,
  });
  return compact({
    origin: Object.keys(origin).length ? origin : undefined,
    acquisition: Object.keys(acquisition).length ? acquisition : undefined,
    resolution: isPlainObject(summary.evidenceResolution)
      ? summary.evidenceResolution : undefined,
    bounds: isPlainObject(summary.bounds) ? summary.bounds : undefined,
  });
}

function actionVariants(operation, contract, source) {
  if (operation === 'move' && Array.isArray(contract.choices?.to)) {
    return contract.choices.to.map(({ to, outputKind }) => ({
      id: `operate:move:${to}`,
      label: humanize(to),
      outputKind,
      command: { command: 'move', input: source, parameters: { to } },
    }));
  }
  if (operation === 'continue' && Array.isArray(contract.choices?.relationships)) {
    return contract.choices.relationships.flatMap(({ relationship, outputKind, sources }) => (
      (sources ?? []).map((continuationSource) => ({
        id: `operate:continue:${relationship}:${continuationSource}`,
        label: `${humanize(relationship)} · ${humanize(continuationSource)}`,
        outputKind,
        command: {
          command: 'continue', input: source,
          parameters: { relationship, source: continuationSource },
        },
      }))
    ));
  }
  if (operation === 'preserve' && Array.isArray(contract.parameters?.level?.values)) {
    return contract.parameters.level.values.map((level) => ({
      id: `operate:preserve:${level}`,
      label: `Preserve ${humanize(level)}`,
      command: { command: 'preserve', input: source, parameters: { level } },
      requirements: { required: ['reason'] },
      remainingRequired: ['reason'],
    }));
  }
  return undefined;
}

function parameterRequirements(contract) {
  const required = Object.entries(contract.parameters ?? {})
    .filter(([, parameter]) => (
      (isPlainObject(parameter) && parameter.required === true)
      || (typeof parameter === 'string' && /^required\b/u.test(parameter))
    ))
    .map(([name]) => name);
  const atLeastOne = Array.isArray(contract.parameterRequirements?.atLeastOne)
    ? contract.parameterRequirements.atLeastOne.filter((name) => typeof name === 'string')
    : [];
  const requirements = compact({
    required: required.length ? required : undefined,
    atLeastOne: atLeastOne.length ? atLeastOne : undefined,
  });
  return Object.keys(requirements).length ? requirements : undefined;
}

function validateRequirements(requirements, parameters) {
  if (!isPlainObject(requirements)) return;
  for (const name of requirements.required ?? []) {
    if (!Object.hasOwn(parameters, name)
      || (typeof parameters[name] === 'string' && parameters[name].trim().length === 0)) {
      throw new TypeError(`Missing required parameter: ${name}.`);
    }
  }
  if (Array.isArray(requirements.atLeastOne)
    && !requirements.atLeastOne.some((name) => Object.hasOwn(parameters, name))) {
    throw new TypeError(
      `At least one parameter is required: ${requirements.atLeastOne.join(', ')}.`,
    );
  }
}

function contractFacts(contract) {
  return compact({
    name: string(contract.name),
    locality: string(contract.locality),
    mutation: string(contract.mutation),
    completeness: string(contract.completeness),
    reason: string(contract.reason),
    parameters: isPlainObject(contract.parameters) ? contract.parameters : undefined,
    choices: isPlainObject(contract.choices) ? contract.choices : undefined,
    effectiveDefaults: isPlainObject(contract.effectiveDefaults)
      ? contract.effectiveDefaults : undefined,
    remainingChoices: stringArray(contract.remainingChoices, 30),
    parameterRequirements: isPlainObject(contract.parameterRequirements)
      ? contract.parameterRequirements : undefined,
  });
}

function successfulResponse(outcome, label) {
  if (!isPlainObject(outcome)) throw new TypeError(`${label} must be an outcome or response.`);
  const response = isPlainObject(outcome.response) ? outcome.response : outcome;
  if (response.ok !== true || !isPlainObject(response.result)) {
    throw new TypeError(`${label} must contain a successful response result.`);
  }
  return response;
}

function pickPresent(source, keys) {
  return Object.fromEntries(keys
    .filter((key) => Object.hasOwn(source, key))
    .map((key) => [key, source[key]]));
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, member]) => member !== undefined));
}

function humanize(value) {
  return value.split('-').map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');
}

function plural(noun, count) {
  if (count === 1) return noun;
  if (noun === 'account') return 'accounts';
  if (noun === 'note') return 'notes';
  if (noun === 'event') return 'events';
  return `${noun}s`;
}

function shortId(value) {
  return typeof value === 'string' ? `${value.slice(0, 12)}…` : 'unknown';
}

function rejectUnknown(value, allowed) {
  const choices = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !choices.has(key));
  if (unknown) throw new TypeError(`values contains unknown field: ${unknown}.`);
}

function nonEmpty(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value;
}

function stringArray(value, limit) {
  if (!Array.isArray(value)) return undefined;
  const selected = value.filter((member) => typeof member === 'string').slice(0, limit);
  return selected.length ? selected : undefined;
}

function string(value) {
  return typeof value === 'string' ? value : undefined;
}

function integer(value) {
  return Number.isInteger(value) ? value : undefined;
}

function boolean(value) {
  return typeof value === 'boolean' ? value : undefined;
}

function plainObject(value, label) {
  if (!isPlainObject(value)) throw new TypeError(`${label} must be a plain object.`);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
