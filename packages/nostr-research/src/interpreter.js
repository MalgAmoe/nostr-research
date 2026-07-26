import { ResearchMemoryError } from './index.js';
import {
  executeResearchOperation,
  executeResearchPlan,
  normalizeResearchPlan,
  preflightResearchOperation,
  preflightResearchPlan,
} from './plan.js';

const COMMANDS = new Set([
  'acquire', 'select', 'filter', 'group', 'summarize', 'move', 'hydrate', 'retain', 'plan',
]);
const EXTERNAL = new Set(['acquire', 'hydrate']);
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
    const response = this.#tail.then(() => this.#dispatch(command));
    this.#tail = response.catch(() => {});
    return response;
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
      const prepared = command.command === 'plan'
        ? this.#preparePlan(command) : this.#prepareOperation(command);
      const result = await prepared.run();
      let mutated = prepared.mutates(result);
      if (prepared.install) {
        const installed = prepared.install(result, this.#revision + (mutated ? 1 : 0));
        if (installed.length) mutated = true;
      }
      if (mutated) this.#revision += 1;
      return {
        ok: true,
        commandId,
        sessionRevision: this.#revision,
        result: prepared.present(result),
        warnings: externalWarnings(result),
      };
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
      .then(() => {
        this.#handles.clear();
        this.#memory.close();
      });
    return this.#closing;
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
    const operation = {
      operation: command.command,
      parameters: cloneJson(command.parameters),
    };
    const descriptor = preflightResearchOperation(
      this.#memory, operation, inputEntry?.descriptor,
    );
    validateResultTarget(command.resultId, command.replace, this.#handles);
    const execute = () => executeResearchOperation(
      this.#memory, operation, inputEntry?.value,
    );
    return {
      run: () => EXTERNAL.has(command.command)
        ? this.#runExternal(operation, inputEntry?.value) : execute(),
      mutates: (result) => command.command === 'retain'
        || (EXTERNAL.has(command.command) && result.counts.acceptedObservations > 0),
      install: command.resultId === undefined ? null : (result) => {
        this.#handles.set(command.resultId, {
          value: ownHandleValue(result),
          descriptor,
        });
        return [command.resultId];
      },
      present: (result) => presentResult(result, command.resultId, descriptor, this.#revision),
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
        || (EXTERNAL.has(operation) && result.counts.acceptedObservations > 0)
      )),
      install: outputs.size === 0 ? null : (report) => {
        for (const [stageId, resultId] of outputs) {
          const stage = report.stages.find(({ id }) => id === stageId);
          this.#handles.set(resultId, {
            value: ownHandleValue(stage.result),
            descriptor: descriptors.get(stageId),
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
          ...(EXTERNAL.has(operation) ? { external: externalStatus(result) } : {}),
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

function presentResult(result, id, descriptor, revision) {
  const metadata = id === undefined
    ? { kind: descriptor.kind, count: resultCount(result) }
    : handleMetadata(id, descriptor, result, revision);
  return EXTERNAL.has(resultOperation(result))
    ? { handle: metadata, external: externalStatus(result) }
    : { handle: metadata };
}

function handleMetadata(id, descriptor, value, revision) {
  return { id, kind: descriptor.kind, count: resultCount(value), revision };
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

function resultOperation(result) {
  return Array.isArray(result?.relays) && result?.coverage ? 'acquire' : null;
}

function externalStatus(result) {
  const boundsReached = result.completionReason === 'completed'
    ? [] : [result.completionReason];
  return {
    status: boundsReached.length ? 'partial' : 'complete',
    completeness: {
      requested: {
        relays: result.requested.relays.length,
        observationLimit: result.budget.observationLimit,
        distinctEventLimit: result.budget.distinctEventLimit,
      },
      observed: result.counts.acceptedObservations,
      distinctEvents: result.counts.distinctEventsAcquired,
      boundsReached,
    },
    coverage: cloneJson(result.coverage),
  };
}

function externalWarnings(result) {
  if (!result?.coverage || result.completionReason === 'completed') return [];
  return [`External operation completed with ${result.completionReason}.`];
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
