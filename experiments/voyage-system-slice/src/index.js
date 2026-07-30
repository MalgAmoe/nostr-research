const DEFAULT_BRANCH_LIMIT = 6;
const DEFAULT_QUESTION_LIMIT = 8;
const DEFAULT_REFERENCE_LIMIT = 8;
const LENS_FAMILIES = new Set(['evidence', 'relation']);
const EVIDENCE_OPERATIONS = new Set(['show']);
const RELATION_OPERATIONS = new Set(['show', 'schema']);
const MAX_LENS_ITEMS = 8;
const MAX_RELATION_FIELDS = 30;
const MAX_ROW_FIELDS = 20;

/**
 * Provisional first vertical slice of one caller-side voyage system.
 *
 * The system owns only local voyage state. It executes exactly one staged,
 * navigator-supplied ordinary command when executeStaged() is called. It never
 * observes, routes, places, retries, or follows up automatically.
 */
export function createVoyageSystemSlice({
  controller,
  branchLimit = DEFAULT_BRANCH_LIMIT,
  questionLimit = DEFAULT_QUESTION_LIMIT,
  questionReferenceLimit = DEFAULT_REFERENCE_LIMIT,
} = {}) {
  if (!controller || typeof controller.execute !== 'function') {
    throw new TypeError('controller must expose execute().');
  }
  integer(branchLimit, 'branchLimit', 1, 20);
  integer(questionLimit, 'questionLimit', 1, 20);
  integer(questionReferenceLimit, 'questionReferenceLimit', 1, 20);

  let ground = null;
  let branches = [];
  let focus = null;
  let questions = [];
  let nextQuestion = 0;
  let nextQuestionReference = 0;
  let lens = null;
  let staged = null;
  let pending = null;
  let lastExecution = null;
  let observedConditions = emptyConditions();

  function setFocus(target, reason) {
    if (lens) throw new TypeError('Close the active lens before changing shared focus.');
    const reference = typeof target === 'string'
      ? frameReference(target)
      : handleReference(target);
    focus = {
      ...reference,
      reason: text(reason, 'focus reason'),
    };
    return snapshot();
  }

  function focusedHandle() {
    if (focus?.type !== 'handle') {
      throw new TypeError('Shared focus is not an ordinary handle.');
    }
    return clone(focus.handle);
  }

  function addQuestion(prompt) {
    if (questions.length >= questionLimit) {
      throw new TypeError(`Voyage already contains its ${questionLimit} question limit.`);
    }
    const question = {
      id: `question-${++nextQuestion}`,
      prompt: text(prompt, 'question'),
      references: [],
    };
    questions = [...questions, question];
    return { question: clone(question), voyage: snapshot() };
  }

  function removeQuestion(id) {
    const { question, index } = requiredQuestion(id);
    questions = questions.filter((_, candidate) => candidate !== index);
    return { removed: clone(question), voyage: snapshot() };
  }

  function attachQuestion(id, value) {
    const { question, index } = requiredQuestion(id);
    if (question.references.length >= questionReferenceLimit) {
      throw new TypeError(
        `Question already contains its ${questionReferenceLimit} reference limit.`,
      );
    }
    plain(value, 'question attachment');
    const hasHandle = Object.hasOwn(value, 'handle');
    const hasSubject = Object.hasOwn(value, 'subject');
    if (hasHandle === hasSubject) {
      throw new TypeError('question attachment must contain exactly one of handle or subject.');
    }
    const reference = hasHandle
      ? handleReference(value.handle)
      : subjectReference(value.subject);
    const attachment = {
      id: `question-reference-${++nextQuestionReference}`,
      ...reference,
      reason: text(value.reason, 'question attachment reason'),
    };
    const revised = {
      ...question,
      references: [...question.references, attachment],
    };
    questions = questions.with(index, revised);
    return { attachment: clone(attachment), voyage: snapshot() };
  }

  function detachQuestion(id, referenceId) {
    const { question, index } = requiredQuestion(id);
    const normalizedId = text(referenceId, 'question reference id');
    const attachment = question.references.find(({ id: candidate }) => candidate === normalizedId);
    if (!attachment) throw new TypeError(`Unknown question reference: ${normalizedId}.`);
    questions = questions.with(index, {
      ...question,
      references: question.references.filter(({ id: candidate }) => candidate !== normalizedId),
    });
    return { removed: clone(attachment), voyage: snapshot() };
  }

  function openLens({ family, observations, label } = {}) {
    if (lens) throw new TypeError('Exactly one primary lens may be open.');
    if (!focus) throw new TypeError('Shared focus is unavailable.');
    const normalizedFamily = text(family, 'lens family');
    if (!LENS_FAMILIES.has(normalizedFamily)) {
      throw new TypeError(`Unsupported first-slice lens family: ${normalizedFamily}.`);
    }
    const records = normalizeObservations(observations);
    const allowed = normalizedFamily === 'evidence'
      ? EVIDENCE_OPERATIONS : RELATION_OPERATIONS;
    for (const record of records) {
      if (!allowed.has(record.command.command)) {
        throw new TypeError(
          `${normalizedFamily} lens cannot consume ${record.command.command} observations.`,
        );
      }
      requireObservationMatchesFocus(record.command, focus);
    }
    lens = {
      family: normalizedFamily,
      ...(label === undefined ? {} : { label: text(label, 'lens label') }),
      observations: records.map(({ command, response }) => ({
        command: clone(command),
        responseType: optionalText(response.result?.type),
        observation: optionalText(response.result?.observation) ?? command.command,
      })),
      projection: normalizedFamily === 'evidence'
        ? projectEvidence(records) : projectRelation(records),
    };
    for (const record of records) noticeOutcome(record.command, record.outcome);
    return snapshot();
  }

  function closeLens() {
    if (!lens) throw new TypeError('No primary lens is open.');
    const closed = lens;
    lens = null;
    return { closed: clone(closed), voyage: snapshot() };
  }

  function stage(command) {
    if (pending) throw new TypeError('Place or discard the pending result before staging another command.');
    if (staged) throw new TypeError('A command is already staged.');
    staged = commandDraft(command);
    return snapshot();
  }

  async function executeStaged() {
    if (!staged) throw new TypeError('No command is staged.');
    if (pending) throw new TypeError('Place or discard the pending result before execution.');
    const command = clone(staged);
    let outcome;
    try {
      outcome = await controller.execute(clone(command));
    } catch (error) {
      lastExecution = {
        command,
        transportFailure: {
          name: typeof error?.name === 'string' ? error.name : 'Error',
          message: typeof error?.message === 'string' ? error.message : String(error),
        },
      };
      throw error;
    }
    staged = null;
    noticeOutcome(command, outcome);
    const response = responseFrom(outcome, 'controller outcome');
    lastExecution = executionFact(command, outcome);
    const handle = successfulHandle(outcome);
    if (response.ok === true && handle) {
      pending = {
        command,
        handle,
        receipt: receiptFact(outcome),
        warnings: warningsFact(outcome),
      };
    }
    return clone({
      command,
      outcome,
      pending: pending ? pendingFact(pending) : null,
    });
  }

  function placePending({ destination, key, label, reason, observation } = {}) {
    if (!pending) throw new TypeError('No result is pending placement.');
    const normalizedDestination = text(destination, 'pending destination');
    let placed;
    if (normalizedDestination === 'ground') {
      if (ground) throw new TypeError('Ground is already established.');
      const frame = normalizeFrame({
        key, label, reason, handle: pending.handle, observation,
      }, 'ground');
      ground = frame;
      focus = focusFact(frame.handle, frame.reason);
      noticeObservation(frame.observation);
      placed = { destination: 'ground', key: frame.key, handle: frame.handle };
    } else if (normalizedDestination === 'branch') {
      requireGround();
      if (branches.length >= branchLimit) {
        throw new TypeError(`Voyage already contains its ${branchLimit} branch limit.`);
      }
      const frame = normalizeFrame({
        key, label, reason, handle: pending.handle, observation,
      }, 'branch');
      uniqueFrameKey(frame.key);
      branches = [...branches, frame];
      noticeObservation(frame.observation);
      placed = { destination: 'branch', key: frame.key, handle: frame.handle };
    } else if (normalizedDestination === 'replace-branch') {
      requireGround();
      const normalizedKey = text(key, 'branch key');
      const index = branches.findIndex((branch) => branch.key === normalizedKey);
      if (index === -1) throw new TypeError(`Unknown branch: ${normalizedKey}.`);
      const frame = normalizeFrame({
        key: normalizedKey, label, reason, handle: pending.handle, observation,
      }, 'branch');
      const displaced = branches[index];
      branches = branches.with(index, frame);
      noticeObservation(frame.observation);
      placed = {
        destination: 'replace-branch',
        key: normalizedKey,
        handle: frame.handle,
        displaced: displaced.handle,
      };
    } else if (normalizedDestination === 'focus') {
      if (lens) throw new TypeError('Close the active lens before changing shared focus.');
      focus = focusFact(pending.handle, text(reason, 'focus reason'));
      placed = { destination: 'focus', handle: pending.handle };
    } else {
      throw new TypeError(
        'pending destination must be ground, branch, replace-branch, or focus.',
      );
    }
    pending = null;
    return { placed: clone(placed), voyage: snapshot() };
  }

  function discardPending(reason) {
    if (!pending) throw new TypeError('No result is pending placement.');
    const discarded = {
      handle: clone(pending.handle),
      command: clone(pending.command),
      reason: text(reason, 'discard reason'),
      engineReleaseIssued: false,
    };
    pending = null;
    return { discarded, voyage: snapshot() };
  }

  function notice({ command, outcome } = {}) {
    const draft = commandDraft(command, { allowCommandId: true });
    responseFrom(outcome, 'outcome');
    noticeOutcome(draft, outcome);
    return snapshot();
  }

  function snapshot() {
    return clone({
      type: 'voyage-system-slice',
      version: 1,
      position: {
        ground: ground ? frameFact(ground) : null,
        branches: branches.map(frameFact),
        focus,
        focusLocation: focusLocation(focus, ground, branches),
        limits: {
          branchLimit,
          branchCount: branches.length,
          remainingBranches: branchLimit - branches.length,
        },
      },
      questions,
      questionLimits: {
        questionLimit,
        questionCount: questions.length,
        referenceLimit: questionReferenceLimit,
      },
      lens,
      actionGate: {
        staged,
        pending: pending ? pendingFact(pending) : null,
        lastExecution,
      },
      conditions: observedConditions,
    });
  }

  function requireGround() {
    if (!ground) throw new TypeError('Establish Ground before adding branches.');
  }

  function uniqueFrameKey(key) {
    const keys = [ground, ...branches]
      .filter(Boolean)
      .map((frame) => frame.key);
    if (keys.includes(key)) throw new TypeError(`Duplicate field key: ${key}.`);
  }

  function frameReference(key) {
    const normalizedKey = text(key, 'field key');
    const frame = [ground, ...branches].filter(Boolean)
      .find(({ key: candidate }) => candidate === normalizedKey);
    if (!frame) throw new TypeError(`Unknown field position: ${normalizedKey}.`);
    return handleReference(frame.handle);
  }

  function requiredQuestion(id) {
    const normalizedId = text(id, 'question id');
    const index = questions.findIndex(({ id: candidate }) => candidate === normalizedId);
    if (index === -1) throw new TypeError(`Unknown question: ${normalizedId}.`);
    return { question: questions[index], index };
  }

  function noticeObservation(observation) {
    if (!observation) return;
    noticeOutcome(observation.command, observation.outcome);
  }

  function noticeOutcome(command, outcome) {
    const response = responseFrom(outcome, 'outcome');
    const result = response.result;
    const pressure = statusPressure(result);
    observedConditions = {
      latestCommand: clone(command),
      latestReceipt: receiptFact(outcome),
      warnings: warningsFact(outcome),
      pressure: pressure ?? observedConditions.pressure,
    };
  }

  const api = Object.freeze({
    focus: setFocus,
    focusedHandle,
    addQuestion,
    removeQuestion,
    attachQuestion,
    detachQuestion,
    openLens,
    closeLens,
    stage,
    executeStaged,
    placePending,
    discardPending,
    notice,
    snapshot,
    raw: controller,
  });
  return api;
}

export function formatVoyageSystemSlice(voyage, {
  branchLimit = 6,
  questionLimit = 8,
  referenceLimit = 4,
  lensItemLimit = 5,
} = {}) {
  if (!plainObject(voyage) || voyage.type !== 'voyage-system-slice') {
    throw new TypeError('voyage must be a voyage-system-slice snapshot.');
  }
  integer(branchLimit, 'branchLimit', 0, 20);
  integer(questionLimit, 'questionLimit', 0, 20);
  integer(referenceLimit, 'referenceLimit', 0, 20);
  integer(lensItemLimit, 'lensItemLimit', 0, 20);

  const position = voyage.position;
  const focusLabel = formatReference(position.focus);
  const lines = [
    `VOYAGE SYSTEM · focus ${focusLabel} · ${position.focusLocation}`,
    position.ground
      ? `GROUND · ${position.ground.label} · ${formatHandle(position.ground.handle)}\nreason (caller): ${position.ground.reason}`
      : 'GROUND · unavailable',
  ];

  lines.push(`BRANCHES · ${position.branches.length}/${position.limits.branchLimit}`);
  for (const branch of position.branches.slice(0, branchLimit)) {
    lines.push(`- ${branch.key} · ${branch.label} · ${formatHandle(branch.handle)} · reason: ${branch.reason}`);
  }
  appendOmitted(lines, position.branches.length - branchLimit, 'branches');

  lines.push(`QUESTIONS · ${voyage.questions.length}/${voyage.questionLimits.questionLimit}`);
  for (const question of voyage.questions.slice(0, questionLimit)) {
    lines.push(`- ${question.id}: ${question.prompt}`);
    for (const reference of question.references.slice(0, referenceLimit)) {
      lines.push(`  ↳ ${formatReference(reference)} · reason: ${reference.reason}`);
    }
    appendOmitted(
      lines,
      question.references.length - referenceLimit,
      `references for ${question.id}`,
      '  ',
    );
  }
  appendOmitted(lines, voyage.questions.length - questionLimit, 'questions');

  if (!voyage.lens) {
    lines.push('LENS · closed');
  } else {
    lines.push(`LENS · ${voyage.lens.family} · ${voyage.lens.label ?? 'unnamed'}`);
    lines.push(...formatLens(voyage.lens, lensItemLimit));
  }

  const gate = voyage.actionGate;
  lines.push(`ACTION · staged ${gate.staged ? inlineJson(gate.staged) : 'none'}`);
  lines.push(`PENDING · ${gate.pending ? formatHandle(gate.pending.handle) : 'none'}`);
  if (gate.lastExecution) {
    lines.push(`LAST EXECUTION · ${gate.lastExecution.command.command}`
      + `${gate.lastExecution.receipt?.ok === undefined ? '' : ` · ok ${gate.lastExecution.receipt.ok}`}`);
  }

  const conditions = voyage.conditions;
  lines.push([
    'CONDITIONS',
    `revision ${conditions.latestReceipt?.revisionAfter ?? 'unavailable'}`,
    `warnings ${conditions.warnings.length}`,
  ].join(' · '));
  if (conditions.latestReceipt?.external) {
    lines.push(`EXTERNAL · ${inlineJson(conditions.latestReceipt.external)}`);
  }
  if (conditions.pressure) lines.push(`PRESSURE · ${inlineJson(conditions.pressure)}`);
  return lines.join('\n');
}

function normalizeFrame(value, role) {
  plain(value, `${role} frame`);
  const handle = ordinaryHandle(value.handle ?? value.source);
  const common = {
    key: text(value.key, `${role}.key`),
    label: text(value.label, `${role}.label`),
    role,
    reason: text(value.reason, `${role}.reason`),
    handle,
  };
  if (value.observation === undefined) {
    return { ...common, summary: null, observation: null };
  }
  const observation = normalizeObservation(value.observation);
  if (observation.command.command !== 'show'
      || observation.command.input !== handle.id
      || observation.command.parameters?.mode !== 'summary') {
    throw new TypeError(
      `${role} observation must be an already-requested summary for ${handle.id}.`,
    );
  }
  const result = observation.response.result;
  if (result.observation !== 'summary' || !plainObject(result.summary)) {
    throw new TypeError(`${role} observation must contain a summary result.`);
  }
  if (result.summary.count !== handle.count) {
    throw new TypeError(
      `${role} handle count ${handle.count} does not match summary count ${result.summary.count}.`,
    );
  }
  const summary = pickPresent(result.summary, [
    'resultKind', 'count', 'countUnit', 'evidenceResolution', 'bounds',
    'completeness', 'lineage', 'eventFacts',
  ]);
  return {
    ...common,
    summary,
    observation: {
      command: clone(observation.command),
      outcome: clone(observation.outcome),
    },
  };
}

function frameFact(frame) {
  const { observation: _observation, ...facts } = frame;
  return clone(facts);
}

function normalizeObservations(value) {
  const observations = Array.isArray(value) ? value : [value];
  if (!observations.length || observations.some((item) => item === undefined)) {
    throw new TypeError('lens observations must contain at least one explicit observation.');
  }
  return observations.map(normalizeObservation);
}

function normalizeObservation(value) {
  plain(value, 'observation');
  const command = commandDraft(value.command, { allowCommandId: true });
  const response = responseFrom(value.outcome, 'observation outcome');
  if (response.ok !== true || !plainObject(response.result)) {
    throw new TypeError('observation outcome must be successful and contain a result.');
  }
  return { command, outcome: value.outcome, response };
}

function requireObservationMatchesFocus(command, focus) {
  if (command.input !== focus.handle.id) {
    throw new TypeError(
      `lens observation input must match shared focus ${focus.handle.id}.`,
    );
  }
}

function projectEvidence(records) {
  const shows = records.filter(({ command }) => command.command === 'show');
  const primary = shows.at(-1) ?? records.at(-1);
  const result = primary.response.result;
  const items = (Array.isArray(result.preview) ? result.preview : [])
    .slice(0, MAX_LENS_ITEMS)
    .map(projectEvidenceItem);
  const summary = plainObject(result.summary)
    ? pickPresent(result.summary, [
        'resultKind', 'count', 'countUnit', 'evidenceResolution', 'bounds',
        'completeness', 'eventFacts',
      ])
    : null;
  return compact({
    resultType: optionalText(result.type),
    observation: optionalText(result.observation) ?? primary.command.command,
    count: nonNegativeIntegerOrNull(result.count),
    summary,
    items,
    omittedItems: Math.max(0, (Array.isArray(result.preview) ? result.preview.length : 0)
      - items.length),
    paging: pickPresent(result, [
      'offset', 'limit', 'nextOffset', 'omittedBefore', 'omittedAfter', 'omitted',
      'sizeBounded',
    ]),
  });
}

function projectEvidenceItem(item, index) {
  if (!plainObject(item)) return { position: index + 1, unsupported: true };
  const source = plainObject(item.preview) ? item.preview : item;
  const author = plainObject(source.author) ? source.author : {};
  const facts = compact({
    position: index + 1,
    type: optionalText(source.type),
    id: optionalText(source.id) ?? optionalText(source.publicKey),
    kind: nonNegativeIntegerOrNull(source.kind),
    resolutionSource: optionalText(source.resolutionSource),
    resolved: typeof source.resolved === 'boolean' ? source.resolved : undefined,
    createdAt: nonNegativeIntegerOrNull(source.createdAt),
    text: optionalText(source.contentExcerpt),
    author: compact({
      id: optionalText(author.publicKey),
      name: optionalText(author.name),
      displayName: optionalText(author.displayName),
      metadataEventId: optionalText(author.metadataEventId),
    }),
    account: compact({
      name: optionalText(source.name),
      displayName: optionalText(source.displayName),
      nip05: optionalText(source.nip05),
      description: optionalText(source.descriptionExcerpt),
      metadataEventId: optionalText(source.metadataEventId),
    }),
    relayCount: nonNegativeIntegerOrNull(source.relayCount),
    role: optionalText(source.role),
    reasonSummary: plainObject(source.reasonSummary)
      ? clone(source.reasonSummary) : undefined,
  });
  if (plainObject(item.preview)) {
    const detail = pickPresent(item, [
      'resident', 'resolved', 'resolutionSource', 'provenance', 'freshness',
      'omittedProvenance',
    ]);
    if (Object.keys(detail).length) facts.detail = detail;
  }
  return facts;
}

function projectRelation(records) {
  const show = records.filter(({ command }) => command.command === 'show').at(-1);
  const schema = records.filter(({ command }) => command.command === 'schema').at(-1);
  const result = show?.response.result ?? {};
  const structure = schema?.response.result?.structure;
  const rows = (Array.isArray(result.preview) ? result.preview : [])
    .slice(0, MAX_LENS_ITEMS)
    .map((row, index) => projectRelationRow(row, index));
  const fields = (Array.isArray(structure?.fields) ? structure.fields : [])
    .slice(0, MAX_RELATION_FIELDS)
    .map((field) => pickPresent(field, [
      'name', 'rowsWithValue', 'nullRows', 'types', 'lineage', 'subjectType',
    ]));
  const summary = plainObject(result.summary)
    ? pickPresent(result.summary, [
        'resultKind', 'count', 'countUnit', 'lineage', 'evidenceResolution',
        'bounds', 'completeness', 'distinctSubjectCount', 'evidenceSubjectCount',
      ])
    : null;
  return compact({
    resultType: optionalText(result.type) ?? optionalText(schema?.response.result?.type),
    observation: optionalText(result.observation),
    count: nonNegativeIntegerOrNull(result.count) ?? nonNegativeIntegerOrNull(structure?.count),
    distinctSubjectCount: nonNegativeIntegerOrNull(result.distinctSubjectCount),
    distinctAuthorCount: nonNegativeIntegerOrNull(result.distinctAuthorCount),
    summary,
    rows,
    omittedRows: Math.max(0, (Array.isArray(result.preview) ? result.preview.length : 0)
      - rows.length),
    fields,
    omittedFields: Math.max(0, (Array.isArray(structure?.fields) ? structure.fields.length : 0)
      - fields.length),
    cardinality: plainObject(structure?.cardinality) ? clone(structure.cardinality) : undefined,
  });
}

function projectRelationRow(row, index) {
  if (!plainObject(row)) return { position: index + 1, unsupported: true };
  const entries = Object.entries(plainObject(row.values) ? row.values : {});
  const selected = entries.slice(0, MAX_ROW_FIELDS);
  return compact({
    position: index + 1,
    values: clone(Object.fromEntries(selected)),
    omittedFields: Math.max(0, entries.length - selected.length),
    omittedValueFields: Array.isArray(row.omittedValueFields)
      ? row.omittedValueFields.slice(0, MAX_ROW_FIELDS) : undefined,
    subjectCount: nonNegativeIntegerOrNull(row.subjectCount),
    reasonCount: nonNegativeIntegerOrNull(row.reasonCount),
    provenanceCount: nonNegativeIntegerOrNull(row.provenanceCount),
  });
}

function executionFact(command, outcome) {
  const response = responseFrom(outcome, 'outcome');
  return compact({
    command: clone(command),
    receipt: receiptFact(outcome),
    warnings: warningsFact(outcome),
    result: successfulHandle(outcome),
    error: plainObject(response.error)
      ? pickPresent(response.error, ['code', 'message']) : undefined,
  });
}

function pendingFact(value) {
  return {
    command: clone(value.command),
    handle: clone(value.handle),
    receipt: clone(value.receipt),
    warnings: clone(value.warnings),
  };
}

function emptyConditions() {
  return {
    latestCommand: null,
    latestReceipt: null,
    warnings: [],
    pressure: null,
  };
}

function receiptFact(outcome) {
  if (plainObject(outcome?.receipt)) return clone(outcome.receipt);
  const response = responseFrom(outcome, 'outcome');
  return compact({
    commandId: optionalText(response.commandId),
    ok: typeof response.ok === 'boolean' ? response.ok : undefined,
    revisionAfter: nonNegativeIntegerOrNull(response.sessionRevision),
    handle: plainObject(response.result?.handle)
      ? ordinaryHandle(response.result.handle) : undefined,
  });
}

function warningsFact(outcome) {
  const response = responseFrom(outcome, 'outcome');
  const warnings = Array.isArray(outcome?.receipt?.warnings)
    ? outcome.receipt.warnings : response.warnings;
  return Array.isArray(warnings)
    ? warnings.filter((warning) => typeof warning === 'string').slice(0, 20)
    : [];
}

function statusPressure(result) {
  if (result?.type !== 'declarative-session-status') return null;
  return compact({
    handles: nonNegativeIntegerOrNull(result.handleCount),
    buffer: plainObject(result.observationBuffer) ? pickPresent(result.observationBuffer, [
      'eventCount', 'capacity', 'remainingCapacity', 'pressure', 'evictions',
      'retainedObservationCount', 'omittedObservationCount',
    ]) : undefined,
    archive: plainObject(result.archive) ? pickPresent(result.archive, [
      'entryCount', 'capacity', 'remainingCapacity', 'levels',
    ]) : undefined,
    notebook: plainObject(result.notebook) ? pickPresent(result.notebook, [
      'entryCount', 'membershipCount', 'capacity',
    ]) : undefined,
  });
}

function successfulHandle(outcome) {
  const response = responseFrom(outcome, 'outcome');
  return response.ok === true
    && plainObject(response.result?.handle)
    && typeof response.result.handle.id === 'string'
    && response.result.handle.id.trim().length > 0
    ? ordinaryHandle(response.result.handle) : null;
}

function responseFrom(outcome, label) {
  const response = outcome?.response ?? outcome;
  if (!plainObject(response) || typeof response.ok !== 'boolean') {
    throw new TypeError(`${label} must expose a controller or engine response.`);
  }
  return response;
}

function commandDraft(value, { allowCommandId = false } = {}) {
  plain(value, 'command draft');
  if (typeof value.command !== 'string' || value.command.trim().length === 0) {
    throw new TypeError('command draft must contain a non-empty command.');
  }
  if (!allowCommandId && Object.hasOwn(value, 'commandId')) {
    throw new TypeError('navigator command draft must not contain commandId.');
  }
  return clone(value);
}

function ordinaryHandle(source) {
  const candidate = source?.receipt?.handle
    ?? source?.response?.result?.handle
    ?? source?.result?.handle
    ?? source?.handle
    ?? source;
  if (!plainObject(candidate)) throw new TypeError('source must expose an ordinary handle.');
  const handle = {
    id: text(candidate.id, 'handle.id'),
    kind: text(candidate.kind, 'handle.kind'),
  };
  if (!Number.isSafeInteger(candidate.count) || candidate.count < 0) {
    throw new TypeError('handle.count must be a non-negative integer.');
  }
  handle.count = candidate.count;
  if (Number.isSafeInteger(candidate.revision) && candidate.revision >= 0) {
    handle.revision = candidate.revision;
  }
  if (typeof candidate.scope === 'string' && candidate.scope.length) {
    handle.scope = candidate.scope;
  }
  return handle;
}

function handleReference(value) {
  return { type: 'handle', handle: ordinaryHandle(value) };
}

function subjectReference(value) {
  plain(value, 'subject');
  return {
    type: 'subject',
    subject: compact({
      type: text(value.type, 'subject.type'),
      id: text(value.id, 'subject.id'),
      kind: Number.isSafeInteger(value.kind) && value.kind >= 0 ? value.kind : undefined,
    }),
  };
}

function focusFact(handle, reason) {
  return { ...handleReference(handle), reason: text(reason, 'focus reason') };
}

function focusLocation(current, currentGround, currentBranches) {
  if (!current) return 'unavailable';
  if (currentGround?.handle.id === current.handle.id) return `ground:${currentGround.key}`;
  const branch = currentBranches.find(({ handle }) => handle.id === current.handle.id);
  return branch ? `branch:${branch.key}` : 'outside-field';
}

function formatLens(activeLens, itemLimit) {
  const projection = activeLens.projection ?? {};
  const lines = [
    `${projection.count ?? 'unknown'} ${projection.summary?.countUnit ?? 'items'}`
      + `${projection.observation ? ` · ${projection.observation}` : ''}`,
  ];
  if (activeLens.family === 'evidence') {
    for (const item of (projection.items ?? []).slice(0, itemLimit)) {
      lines.push(`- [${item.position}] ${item.type ?? 'evidence'} ${item.id ?? 'unidentified'}`
        + `${item.text ? ` · ${clip(item.text, 160)}` : ''}`
        + `${item.resolutionSource ? ` · ${item.resolutionSource}` : ''}`);
    }
    appendOmitted(lines, (projection.items?.length ?? 0) - itemLimit, 'lens items');
  } else {
    const populated = (projection.fields ?? []).filter(({ rowsWithValue }) => rowsWithValue > 0);
    if (populated.length) {
      lines.push(`fields with values: ${populated.slice(0, 12).map(({ name }) => name).join(', ')}`);
      appendOmitted(lines, populated.length - 12, 'populated fields');
    }
    for (const row of (projection.rows ?? []).slice(0, itemLimit)) {
      lines.push(`- row ${row.position}: ${clip(inlineJson(row.values), 240)}`);
    }
    appendOmitted(lines, (projection.rows?.length ?? 0) - itemLimit, 'lens rows');
  }
  return lines;
}

function formatReference(reference) {
  if (!reference) return 'unavailable';
  if (reference.type === 'handle') return formatHandle(reference.handle);
  if (reference.type === 'subject') return `${reference.subject.type}:${reference.subject.id}`;
  return 'unavailable';
}

function formatHandle(handle) {
  return `${handle.id} · ${handle.kind} · ${handle.count}`;
}

function appendOmitted(lines, count, label, prefix = '') {
  if (count > 0) lines.push(`${prefix}${count} ${label} omitted`);
}

function inlineJson(value) {
  return JSON.stringify(value);
}

function clip(value, limit) {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

function pickPresent(value, keys) {
  return Object.fromEntries(keys
    .filter((key) => Object.hasOwn(value ?? {}, key))
    .map((key) => [key, clone(value[key])]));
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, fact]) => fact !== undefined));
}

function clone(value) {
  return structuredClone(value);
}

function optionalText(value) {
  return typeof value === 'string' && value.length ? value : null;
}

function nonNegativeIntegerOrNull(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function text(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
    throw new TypeError(`${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
}

function plain(value, label) {
  if (!plainObject(value)) throw new TypeError(`${label} must be a plain object.`);
  return value;
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
