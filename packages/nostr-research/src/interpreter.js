import { ResearchMemoryError } from './index.js';
import {
  executeResearchOperation,
  executeResearchPlan,
  normalizeResearchPlan,
  preflightResearchOperation,
  preflightResearchPlan,
} from './plan.js';
import {
  acquisitionCorpusAccounting,
  facetResearchCollection,
  explainResearchMembership,
  presentHandleList,
  presentSessionStatus,
  showResearchValue,
} from './presentation.js';

const COMMANDS = new Set([
  'acquire', 'select', 'filter', 'project', 'distinct', 'sort', 'limit', 'sample',
  'group', 'summarize', 'move', 'union', 'intersection', 'difference', 'compare',
  'hydrate', 'retain', 'plan',
  'continue',
  'show', 'inspect', 'explain', 'list', 'status', 'schema', 'release', 'reset', 'close',
]);
const OBSERVATIONS = new Set(['show', 'inspect', 'explain', 'list', 'status', 'schema']);
const LIFECYCLE = new Set(['release', 'reset', 'close']);
const EXTERNAL = new Set(['acquire', 'hydrate']);
const SET_TRANSFORMS = new Set(['union', 'intersection', 'difference', 'compare']);
const UNSUCCESSFUL_RELAY_OUTCOMES = new Set(['connection-failure', 'closed']);
const COMMAND_KEYS = new Set([
  'commandId', 'ifRevision', 'command', 'input', 'parameters', 'resultId', 'replace',
]);
const PLAN_KEYS = new Set([
  'commandId', 'ifRevision', 'command', 'plan', 'outputs', 'replace',
]);

export function createDeclarativeResearchSession(memory) {
  return new DeclarativeResearchSession(memory);
}

export class DeclarativeResearchSession {
  #memory;
  #handles = new Map();
  #revision = 0;
  #closed = false;
  #closing;
  #active = new Set();
  #tail = Promise.resolve();

  constructor(memory) {
    if (!memory || typeof memory.asCollection !== 'function'
        || typeof memory.describe !== 'function') {
      throw new ResearchMemoryError('An open bounded research memory is required.');
    }
    memory.describe();
    this.#memory = memory;
  }

  get revision() {
    return this.#revision;
  }

  execute(command) {
    if (isPlainObject(command) && command.command === 'close') {
      const cancellable = this.#validateCloseCancellation(command);
      if (cancellable) {
        for (const controller of this.#active) controller.abort();
      }
    }
    const response = this.#tail.then(() => this.#dispatch(command));
    this.#tail = response.catch(() => {});
    return response;
  }

  #validateCloseCancellation(command) {
    try {
      validateEnvelope(command);
      if (this.#closed) return false;
      this.#prepareLifecycle(command);
      if (command.ifRevision !== undefined) {
        return this.#active.size === 0 && command.ifRevision === this.#revision;
      }
      return true;
    } catch {
      return false;
    }
  }

  async #dispatch(command) {
    let commandId = isPlainObject(command) && typeof command.commandId === 'string'
      ? command.commandId : null;
    try {
      commandId = validateEnvelope(command);
      if (this.#closed) return this.#failure(commandId, 'SESSION_CLOSED', 'The session is closed.');
      if (command.ifRevision !== undefined && command.ifRevision !== this.#revision) {
        return this.#failure(commandId, 'REVISION_CONFLICT',
          `Expected session revision ${command.ifRevision}, but current revision is ${this.#revision}.`,
          { expected: command.ifRevision, actual: this.#revision });
      }
      const prepared = command.command === 'plan' ? this.#preparePlan(command)
        : OBSERVATIONS.has(command.command) ? this.#prepareObservation(command)
          : LIFECYCLE.has(command.command) ? this.#prepareLifecycle(command)
            : this.#prepareOperation(command);
      const result = await prepared.run();
      let mutated = prepared.mutates(result);
      if (prepared.install) {
        const installed = prepared.install(result, this.#revision + (mutated ? 1 : 0));
        if (installed.length) mutated = true;
      }
      if (mutated) this.#revision += 1;
      const response = {
        ok: true,
        commandId,
        sessionRevision: this.#revision,
        result: prepared.present(result),
        warnings: externalWarnings(result),
      };
      if (command.command === 'close') await this.#finishClose();
      return response;
    } catch (error) {
      const semantic = semanticError(error);
      return this.#failure(commandId, semantic.code, semantic.message, semantic.details);
    }
  }

  async close() {
    if (this.#closing) return this.#closing;
    this.#closed = true;
    for (const controller of this.#active) controller.abort();
    this.#closing = Promise.allSettled([...this.#active].map((item) => item.done))
      .then(() => this.#finishClose());
    return this.#closing;
  }

  #finishClose() {
    this.#closed = true;
    this.#handles.clear();
    this.#memory.close();
  }

  #prepareObservation(command) {
    rejectKeys(command, new Set(['commandId', 'ifRevision', 'command', 'input', 'parameters']));
    const parameters = command.parameters ?? {};
    if (!isPlainObject(parameters)) {
      throw protocolError('INVALID_COMMAND', 'Command parameters must be a plain object.');
    }
    if (command.command === 'show') {
      const entry = this.#requireHandle(command.input);
      const options = projectionOptions(parameters, true);
      return readOnly(() => showResearchValue(this.#memory, null, entry.value, options));
    }
    if (command.command === 'inspect') {
      const { subject, ...rawOptions } = parameters;
      if (command.input !== undefined) {
        throw protocolError('INVALID_COMMAND', 'inspect does not accept an input handle.');
      }
      const options = projectionOptions(rawOptions);
      return readOnly(() => showResearchValue(
        this.#memory, null, this.#memory.inspect(subject), options,
      ));
    }
    if (command.command === 'explain') {
      const entry = this.#requireHandle(command.input);
      const { subject, ...rawOptions } = parameters;
      const options = projectionOptions(rawOptions);
      return readOnly(() => explainResearchMembership(
        this.#memory, collectionValue(entry.value), subject, options,
      ));
    }
    if (command.input !== undefined) {
      throw protocolError('INVALID_COMMAND', `${command.command} does not accept an input handle.`);
    }
    if (command.command === 'schema') {
      if (Object.keys(parameters).length) {
        throw protocolError('INVALID_COMMAND', 'schema parameters must be an empty object.');
      }
      return readOnly(() => this.#memory.describeCollectionPipeline());
    }
    if (command.command === 'list') {
      return readOnly(() => presentHandleList(
        [...this.#handles].map(([id, entry]) => handleMetadata(
          id, entry.descriptor, entry.value, entry.revision,
        )),
        parameters,
      ));
    }
    return readOnly(() => presentSessionStatus(this.#memory, {
      revision: this.#revision,
      activeOperationCount: this.#active.size,
      handleCount: this.#handles.size,
    }, parameters));
  }

  #prepareLifecycle(command) {
    rejectKeys(command, new Set(['commandId', 'ifRevision', 'command', 'input', 'parameters']));
    const parameters = command.parameters ?? {};
    if (!isPlainObject(parameters) || Object.keys(parameters).length) {
      throw protocolError('INVALID_COMMAND', 'Lifecycle command parameters must be an empty object.');
    }
    if (command.command === 'release') {
      const entry = this.#requireHandle(command.input);
      return {
        run: () => ({ id: command.input, released: true, entry }),
        mutates: () => true,
        install: null,
        present: (result) => {
          this.#handles.delete(result.id);
          return { type: 'released-result-handle', id: result.id, released: true };
        },
      };
    }
    if (command.input !== undefined) {
      throw protocolError('INVALID_COMMAND', `${command.command} does not accept an input handle.`);
    }
    return {
      run: () => ({ type: `${command.command}-session` }),
      mutates: () => true,
      install: null,
      present: (result) => {
        this.#handles.clear();
        if (command.command === 'reset') this.#memory.reset();
        else this.#closed = true;
        return result;
      },
    };
  }

  #requireHandle(id) {
    validateId(id, 'Input result ID');
    const entry = this.#handles.get(id);
    if (!entry) {
      throw protocolError('UNKNOWN_RESULT', `No named result exists for ${id}.`, { id });
    }
    return entry;
  }

  #prepareOperation(command) {
    rejectKeys(command, COMMAND_KEYS);
    if (!COMMANDS.has(command.command) || command.command === 'plan') {
      throw protocolError('INVALID_COMMAND', `Unsupported command: ${command.command}.`);
    }
    if (!isPlainObject(command.parameters)) {
      throw protocolError('INVALID_OPERATION', 'Command parameters must be a plain object.');
    }
    const inputEntry = command.input === undefined ? undefined : this.#handles.get(command.input);
    if (command.input !== undefined
        && (typeof command.input !== 'string' || command.input.trim().length === 0)) {
      throw protocolError('INVALID_COMMAND', 'input must name a non-empty result ID.');
    }
    if (command.input !== undefined && !inputEntry) {
      throw protocolError('UNKNOWN_RESULT', `No named result exists for ${command.input}.`,
        { id: command.input });
    }
    const referenced = SET_TRANSFORMS.has(command.command)
      ? this.#requireHandle(command.parameters.with) : undefined;
    const operation = {
      operation: command.command,
      parameters: SET_TRANSFORMS.has(command.command)
        ? { ...cloneJson(command.parameters), with: referenced.value }
        : cloneJson(command.parameters),
    };
    const externallyBacked = EXTERNAL.has(command.command)
      || (command.command === 'continue' && command.parameters.source === 'relays');
    const descriptorOperation = SET_TRANSFORMS.has(command.command)
      ? { operation: command.command, parameters: cloneJson(command.parameters) }
      : operation;
    const references = referenced === undefined ? undefined
      : new Map([[command.parameters.with, referenced.descriptor]]);
    const descriptor = preflightResearchOperation(
      this.#memory, descriptorOperation, inputEntry?.descriptor, references,
    );
    validateResultTarget(command.resultId, command.replace, this.#handles);
    const execute = () => executeResearchOperation(
      this.#memory, operation, inputEntry?.value,
    );
    return {
      run: () => externallyBacked
        ? this.#runExternal(operation, inputEntry?.value) : execute(),
      mutates: (result) => command.command === 'retain'
        || (externallyBacked && (result.counts?.acceptedObservations ?? 0) > 0),
      install: command.resultId === undefined ? null : (result) => {
        this.#handles.set(command.resultId, {
          value: ownHandleValue(result),
          descriptor,
          revision: this.#revision + 1,
        });
        return [command.resultId];
      },
      present: (result) => presentResult(
        result, command.resultId, descriptor, this.#revision, command.command, this.#memory,
      ),
    };
  }

  #preparePlan(command) {
    rejectKeys(command, PLAN_KEYS);
    const plan = normalizeResearchPlan(command.plan);
    const descriptors = preflightResearchPlan(this.#memory, plan);
    const outputs = normalizeOutputs(command.outputs, plan);
    const targetIds = [...outputs.values()];
    if (new Set(targetIds).size !== targetIds.length) {
      throw protocolError('DUPLICATE_RESULT', 'Plan output result IDs must be unique.');
    }
    for (const id of targetIds) validateResultTarget(id, command.replace, this.#handles);
    return {
      run: () => this.#runPlan(plan),
      mutates: (report) => report.stages.some(({ operation, result }) => (
        operation === 'retain'
        || ((EXTERNAL.has(operation) || result.type === 'continuation-report')
          && (result.counts?.acceptedObservations ?? 0) > 0)
      )),
      install: outputs.size === 0 ? null : (report) => {
        for (const [stageId, resultId] of outputs) {
          const stage = report.stages.find(({ id }) => id === stageId);
          this.#handles.set(resultId, {
            value: ownHandleValue(stage.result),
            descriptor: descriptors.get(stageId),
            revision: this.#revision + 1,
          });
        }
        return targetIds;
      },
      present: (report) => ({
        type: report.type,
        stages: report.stages.map(({ id, operation, resultKind, result }) => ({
          id, operation, resultKind,
          ...(outputs.has(id) ? {
            handle: handleMetadata(
              outputs.get(id), descriptors.get(id), result, this.#revision,
            ),
          } : {}),
          ...(EXTERNAL.has(operation)
            ? externalPresentation(result, operation, this.#memory)
            : operation === 'continue' ? {
                completeness: result.completeness,
                ...(result.coverage
                  ? externalPresentation(result, operation, this.#memory) : {}),
              }
            : {}),
        })),
      }),
    };
  }

  async #runExternal(operation, input) {
    const controller = new AbortController();
    const active = { controller, done: null };
    this.#active.add(controller);
    const parameters = { ...operation.parameters, signal: controller.signal };
    const done = executeResearchOperation(
      this.#memory, { ...operation, parameters }, input,
    );
    controller.done = done;
    try {
      return await done;
    } finally {
      this.#active.delete(controller);
    }
  }

  async #runPlan(plan) {
    // A single controller cancels every external stage while retaining complete
    // plan preflight before the first stage starts.
    const controller = new AbortController();
    const done = executeResearchPlan(this.#memory, plan, { signal: controller.signal });
    controller.done = done;
    this.#active.add(controller);
    try {
      return await done;
    } finally {
      this.#active.delete(controller);
    }
  }

  #failure(commandId, code, message, details = {}) {
    return {
      ok: false,
      commandId,
      sessionRevision: this.#revision,
      error: { code, message, details },
    };
  }
}

function validateEnvelope(command) {
  if (!isPlainObject(command)) {
    throw protocolError('INVALID_COMMAND', 'Command must be a plain JSON object.');
  }
  assertJsonData(command);
  if (typeof command.commandId !== 'string' || command.commandId.trim().length === 0) {
    throw protocolError('INVALID_COMMAND', 'commandId must be a non-empty string.');
  }
  if (command.ifRevision !== undefined
      && (!Number.isSafeInteger(command.ifRevision) || command.ifRevision < 0)) {
    throw protocolError('INVALID_COMMAND', 'ifRevision must be a non-negative integer.');
  }
  if (typeof command.command !== 'string' || !COMMANDS.has(command.command)) {
    throw protocolError('INVALID_COMMAND', `Unsupported command: ${command.command}.`);
  }
  return command.commandId;
}

function normalizeOutputs(value, plan) {
  if (value === undefined) return new Map();
  if (!isPlainObject(value)) {
    throw protocolError('INVALID_COMMAND', 'Plan outputs must map stage IDs to result IDs.');
  }
  const stageIds = new Set(plan.map(({ id }) => id));
  const result = new Map();
  for (const [stageId, resultId] of Object.entries(value)) {
    if (!stageIds.has(stageId)) {
      throw protocolError('INVALID_OPERATION', `Plan output names unknown stage ${stageId}.`);
    }
    validateId(resultId, 'Plan result ID');
    result.set(stageId, resultId);
  }
  return result;
}

function validateResultTarget(id, replace, handles) {
  if (replace !== undefined && typeof replace !== 'boolean') {
    throw protocolError('INVALID_COMMAND', 'replace must be a boolean.');
  }
  if (id === undefined) return;
  validateId(id, 'Result ID');
  if (handles.has(id) && replace !== true) {
    throw protocolError('DUPLICATE_RESULT', `A named result already exists for ${id}.`, { id });
  }
}

function validateId(id, label) {
  if (typeof id !== 'string' || id.trim().length === 0 || id !== id.trim()) {
    throw protocolError('INVALID_COMMAND', `${label} must be a non-empty trimmed string.`);
  }
}

function presentResult(result, id, descriptor, revision, operation, memory) {
  const metadata = id === undefined
    ? { kind: descriptor.kind, count: resultCount(result) }
    : handleMetadata(id, descriptor, result, revision);
  if (operation === 'continue') {
    return {
      handle: metadata,
      completeness: result.completeness,
      ...(result.coverage ? externalPresentation(result, operation, memory) : {}),
    };
  }
  return EXTERNAL.has(operation)
    ? {
        handle: metadata,
        ...externalPresentation(result, operation, memory),
      }
    : { handle: metadata };
}

function externalPresentation(result, operation, memory) {
  return {
    external: externalStatus(result, operation, memory),
    preview: showResearchValue(memory, null, result.collection, {
      previewLimit: 5, excerptLimit: 160, sizeLimit: 8_000,
    }),
    facets: facetResearchCollection(memory, result.collection, { limit: 5 }),
  };
}

function handleMetadata(id, descriptor, value, revision) {
  return {
    id, kind: descriptor.kind, count: resultCount(value), revision,
    ...(descriptor.scope ? { scope: descriptor.scope } : {}),
  };
}

function readOnly(run) {
  return { run, mutates: () => false, install: null, present: (value) => value };
}

function collectionValue(value) {
  return value?.collection?.type === 'result-collection' ? value.collection : value;
}

function projectionOptions(parameters, allowMode = false) {
  const allowed = new Set([
    ...(allowMode ? ['mode'] : []),
    'previewLimit', 'excerptLimit', 'includeEvidence', 'sizeLimit',
  ]);
  const unknown = Object.keys(parameters).find((key) => !allowed.has(key));
  if (unknown) throw protocolError('INVALID_COMMAND', `Unknown projection parameter: ${unknown}.`);
  return cloneJson(parameters);
}

function resultCount(value) {
  if (Array.isArray(value?.items)) return value.items.length;
  if (Array.isArray(value?.collection?.items)) return value.collection.items.length;
  if (Array.isArray(value?.acquiredEventIds)) return value.acquiredEventIds.length;
  if (Number.isSafeInteger(value?.memberCount)) return value.memberCount;
  return 0;
}

function ownHandleValue(value) {
  if (value?.type === 'result-collection') return stableSubjectCollection(value);
  if (value?.collection?.type === 'result-collection') {
    return { ...value, collection: stableSubjectCollection(value.collection) };
  }
  return value;
}

function stableSubjectCollection(collection) {
  return {
    ...collection,
    items: collection.items.map(({ record: ignored, ...item }) => cloneJson(item)),
  };
}

function externalStatus(result, operation, memory) {
  let boundsReached = result.completionReason === 'completed'
    ? [] : [result.completionReason];
  const contactedRelays = result.coverage.relays.filter(({ contacted }) => contacted);
  const relayOutcomeCounts = new Map();
  for (const { outcome } of contactedRelays) {
    relayOutcomeCounts.set(outcome, (relayOutcomeCounts.get(outcome) ?? 0) + 1);
  }
  const allRelayOutcomes = [...relayOutcomeCounts]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([outcome, count]) => ({ outcome, count }));
  const relayOutcomes = allRelayOutcomes.slice(0, 5);
  const completeRelays = relayOutcomeCounts.get('eose') ?? 0;
  const allUnsuccessfulRelays = contactedRelays
    .filter(({ outcome }) => UNSUCCESSFUL_RELAY_OUTCOMES.has(outcome))
    .map(({ relay, outcome }) => ({ relay, outcome }));
  if (allUnsuccessfulRelays.length) boundsReached.push('relay-errors');
  const unsuccessfulRelays = allUnsuccessfulRelays.slice(0, 5);
  const hydration = operation === 'hydrate';
  const requestedAuthors = hydration && Array.isArray(result.requested?.filter?.authors)
    ? new Set(result.requested.filter.authors) : null;
  const resolvedAuthors = requestedAuthors === null ? null : new Set(
    [...requestedAuthors].filter((id) => {
      try {
        return memory.inspect({ type: 'account', id }).resident;
      } catch {
        return false;
      }
    }),
  );
  const requested = requestedAuthors?.size ?? null;
  const resolved = resolvedAuthors?.size ?? null;
  const missing = requested === null ? null : Math.max(0, requested - resolved);
  if (missing > 0 && boundsReached.length === 0) boundsReached = ['unresolved-subjects'];
  const corpusChanges = acquisitionCorpusAccounting(result.additions);
  return {
    status: boundsReached.length ? 'partial' : 'complete',
    completeness: {
      requested,
      resolved,
      missing,
      boundsReached,
      requestBounds: {
        relays: result.requested.relays.length,
        observationLimit: result.budget.observationLimit,
        distinctEventLimit: result.budget.distinctEventLimit,
      },
      observed: result.counts.acceptedObservations,
      duplicateObservations: result.counts.duplicateObservations,
      distinctEvents: result.counts.distinctEventsAcquired,
      relays: {
        attempted: contactedRelays.length,
        complete: completeRelays,
        incomplete: contactedRelays.length - completeRelays,
        outcomes: relayOutcomes,
        omittedOutcomes: allRelayOutcomes.length - relayOutcomes.length,
      },
      unsuccessfulRelays,
      omittedUnsuccessfulRelays: allUnsuccessfulRelays.length - unsuccessfulRelays.length,
    },
    scope: {
      type: 'acquisition',
      subjects: result.collection?.items?.length ?? result.counts.distinctEventsAcquired,
    },
    corpus: {
      before: corpusStatus(result.corpusBefore),
      after: corpusStatus(result.corpusAfter),
      ...corpusChanges,
    },
  };
}

function corpusStatus(value) {
  if (!value) return null;
  return {
    eventCount: value.eventCount,
    capacity: value.capacity,
    remainingCapacity: value.remainingCapacity,
    pressure: value.capacity === 0 ? 0 : value.eventCount / value.capacity,
    evictions: value.evictions,
  };
}

function externalWarnings(result) {
  if (result?.type === 'research-plan-report') {
    return result.stages.flatMap(({ id, result: stageResult }) => (
      externalWarnings(stageResult).map((warning) => `Stage ${id}: ${warning}`)
    ));
  }
  if (!result?.coverage) return [];
  const warnings = result.completionReason === 'completed'
    ? [] : [`External operation completed with ${result.completionReason}.`];
  const unsuccessful = result.coverage.relays
    .filter(({ outcome }) => UNSUCCESSFUL_RELAY_OUTCOMES.has(outcome));
  if (unsuccessful.length) {
    warnings.push(`${unsuccessful.length} relay attempt${unsuccessful.length === 1 ? '' : 's'} did not complete successfully.`);
  }
  return warnings;
}

function semanticError(error) {
  if (error?.protocolCode) {
    return { code: error.protocolCode, message: error.message, details: error.details ?? {} };
  }
  if (!(error instanceof ResearchMemoryError)) {
    return { code: 'INTERNAL_ERROR', message: 'The command could not be completed.', details: {} };
  }
  let code = 'INVALID_OPERATION';
  if (/requires an? (accounts|subject) collection|not supported|contain no retainable/.test(error.message)) {
    code = 'TYPE_MISMATCH';
  } else if (/subject|public key|Event ID/.test(error.message)) {
    code = 'INVALID_SUBJECT';
  }
  return { code, message: error.message, details: {} };
}

function protocolError(code, message, details = {}) {
  const error = new Error(message);
  error.protocolCode = code;
  error.details = details;
  return error;
}

function rejectKeys(value, allowed) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw protocolError('INVALID_COMMAND', `Unknown command fields: ${unknown.join(', ')}.`);
  }
}

function assertJsonData(value) {
  const seen = new Set();
  const visit = (item) => {
    if (item === null || ['string', 'boolean'].includes(typeof item)) return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (typeof item !== 'object' || seen.has(item)) {
      throw protocolError('INVALID_COMMAND', 'Command must contain only plain JSON data.');
    }
    seen.add(item);
    if (Array.isArray(item)) item.forEach(visit);
    else {
      if (Object.getPrototypeOf(item) !== Object.prototype) {
        throw protocolError('INVALID_COMMAND', 'Command must contain only plain JSON data.');
      }
      Object.values(item).forEach(visit);
    }
    seen.delete(item);
  };
  visit(value);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
