import { ResearchMemoryError } from './protocol.js';
import {
  RESEARCH_CONSTRAINTS,
  normalizeSessionConfiguration,
  operationParametersWithSessionDefaults,
  presentationParametersWithSessionDefaults,
  researchConstraints,
} from './configuration.js';
import {
  executeResearchOperation,
  executeResearchPlan,
  normalizeResearchOperation,
  normalizeResearchPlan,
  preflightResearchOperation,
  preflightResearchPlan,
} from './plan.js';
import {
  acquisitionCorpusAccounting,
  explainResearchMembership,
  presentHandleList,
  presentSessionStatus,
  showResearchValue,
  validateResearchPresentationOptions,
} from './presentation.js';
import {
  contextualResearchOperationSchema,
  isExternalOperation,
  isSetOperation,
  operationMutation,
  operationSchema,
  researchOperationNames,
} from './operations.js';
import {
  describeResearchRelation,
  isResearchRelation,
} from './relation.js';
import { NOTEBOOK_JUDGMENTS, QUERY_LIMIT } from './contract-facts.js';

const COMMANDS = new Set([
  ...researchOperationNames(), 'plan',
  'show', 'inspect', 'explain', 'list', 'memberships', 'membership', 'status', 'schema',
  'configure', 'release', 'release-all', 'delete-membership', 'reset', 'close',
]);
const OBSERVATIONS = new Set([
  'show', 'inspect', 'explain', 'list', 'memberships', 'membership', 'status', 'schema',
]);
const LIFECYCLE = new Set([
  'release', 'release-all', 'delete-membership', 'reset', 'close',
]);
const UNSUCCESSFUL_RELAY_OUTCOMES = new Set([
  'connection-failure', 'peer-error', 'peer-closed', 'closed',
]);
const COMMAND_KEYS = new Set([
  'commandId', 'ifRevision', 'command', 'input', 'inputs', 'parameters', 'resultId', 'replace',
]);
const PLAN_KEYS = new Set([
  'commandId', 'ifRevision', 'command', 'plan', 'outputs', 'replace',
]);

export function createDeclarativeResearchSession(memory, configuration = {}) {
  return new DeclarativeResearchSession(memory, configuration);
}

export class DeclarativeResearchSession {
  #memory;
  #handles = new Map();
  #revision = 0;
  #closed = false;
  #closing;
  #active = new Set();
  #tail = Promise.resolve();
  #configuration;

  constructor(memory, configuration = {}) {
    if (!memory || typeof memory.asCollection !== 'function'
        || typeof memory.describe !== 'function') {
      throw new ResearchMemoryError('An open bounded research memory is required.');
    }
    memory.describe();
    this.#memory = memory;
    this.#configuration = normalizeSessionConfiguration(configuration);
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
      const prepared = command.command === 'configure' ? this.#prepareConfiguration(command)
        : command.command === 'plan' ? this.#preparePlan(command)
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
        warnings: externalWarnings(result, command.command),
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
      const options = projectionOptions(
        presentationParametersWithSessionDefaults(parameters, this.#configuration), true,
      );
      if (['relay-information-report', 'relay-count-report'].includes(
        entry.descriptor.resultKind,
      )
          && options.mode === 'explain') {
        throw protocolError(
          'INVALID_OPERATION',
          `show explain is not compatible with ${entry.descriptor.kind}.`,
        );
      }
      return readOnly(() => showResearchValue(this.#memory, entry.value, options));
    }
    if (command.command === 'inspect') {
      const { subject, ...rawOptions } = parameters;
      if (command.input !== undefined) {
        throw protocolError('INVALID_COMMAND', 'inspect does not accept an input handle.');
      }
      const options = projectionOptions(
        presentationParametersWithSessionDefaults(rawOptions, this.#configuration),
      );
      return readOnly(() => showResearchValue(this.#memory, this.#memory.inspect(subject), options));
    }
    if (command.command === 'explain') {
      const entry = this.#requireHandle(command.input);
      if (['relay-information-report', 'relay-count-report'].includes(
        entry.descriptor.resultKind,
      )) {
        throw protocolError(
          'INVALID_OPERATION',
          `explain is not compatible with ${entry.descriptor.kind}.`,
        );
      }
      const { subject, ...rawOptions } = parameters;
      const options = projectionOptions(
        presentationParametersWithSessionDefaults(rawOptions, this.#configuration),
      );
      return readOnly(() => explainResearchMembership(
        this.#memory, collectionValue(entry.value), subject, options,
      ));
    }
    if (command.command === 'schema') {
      if (command.input !== undefined) {
        const operation = contextualSchemaOperation(parameters);
        const entry = this.#requireHandle(command.input);
        return readOnly(() => contextualHandleSchema(
          this.#memory, command.input, entry, operation, this.#configuration,
        ));
      }
      const detail = globalSchemaDetail(parameters);
      return readOnly(() => globalSessionSchema(
        this.#memory, this.#configuration, detail,
      ));
    }
    if (command.input !== undefined) {
      throw protocolError('INVALID_COMMAND', `${command.command} does not accept an input handle.`);
    }
    if (command.command === 'list') {
      const unknown = Object.keys(parameters)
        .find((key) => !['limit', 'sizeLimit'].includes(key));
      if (unknown) {
        throw protocolError('INVALID_COMMAND', `Unknown list parameter: ${unknown}.`);
      }
      return readOnly(() => presentHandleList(
        [...this.#handles].map(([id, entry]) => handleMetadata(
          id, entry.descriptor, entry.value, entry.revision,
        )),
        {
          limit: this.#configuration.presentation.previewLimit,
          sizeLimit: this.#configuration.presentation.sizeLimit,
          ...parameters,
        },
      ));
    }
    if (command.command === 'memberships') {
      const unknown = Object.keys(parameters).find((key) => key !== 'limit');
      if (unknown) {
        throw protocolError('INVALID_COMMAND', `Unknown memberships parameter: ${unknown}.`);
      }
      const limit = parameters.limit ?? RESEARCH_CONSTRAINTS.results.defaultQueryLimit;
      if (!Number.isSafeInteger(limit) || limit < 0) {
        throw protocolError(
          'INVALID_COMMAND', 'memberships limit must be a non-negative integer.',
        );
      }
      return readOnly(() => {
        const all = this.#memory.listMemberships();
        return {
          type: 'notebook-membership-list',
          count: all.length,
          memberships: all.slice(0, limit),
          omitted: Math.max(0, all.length - limit),
        };
      });
    }
    if (command.command === 'membership') {
      rejectKeys(parameters, new Set(['name']));
      return readOnly(() => this.#memory.getMembership(parameters.name));
    }
    return readOnly(() => presentSessionStatus(this.#memory, {
      revision: this.#revision,
      activeOperationCount: this.#active.size,
      handleCount: this.#handles.size,
      configuration: structuredClone(this.#configuration),
    }, {
      limit: this.#configuration.presentation.previewLimit,
      sizeLimit: this.#configuration.presentation.sizeLimit,
      ...parameters,
    }));
  }

  #prepareConfiguration(command) {
    rejectKeys(command, new Set(['commandId', 'ifRevision', 'command', 'parameters']));
    if (!isPlainObject(command.parameters)) {
      throw protocolError('INVALID_COMMAND', 'configure parameters must be a plain object.');
    }
    let next;
    try {
      next = normalizeSessionConfiguration(command.parameters, this.#configuration);
    } catch (error) {
      if (error instanceof ResearchMemoryError) {
        throw protocolError('INVALID_COMMAND', error.message);
      }
      throw error;
    }
    const changed = JSON.stringify(next) !== JSON.stringify(this.#configuration);
    return {
      run: () => ({ type: 'session-configuration', configuration: next }),
      mutates: () => changed,
      install: null,
      present: (result) => {
        this.#configuration = result.configuration;
        return structuredClone(result);
      },
    };
  }

  #prepareLifecycle(command) {
    rejectKeys(command, new Set(['commandId', 'ifRevision', 'command', 'input', 'parameters']));
    const parameters = command.parameters ?? {};
    if (!isPlainObject(parameters)) {
      throw protocolError('INVALID_COMMAND', 'Lifecycle command parameters must be a plain object.');
    }
    if (command.command === 'release') {
      if (Object.keys(parameters).length) {
        throw protocolError('INVALID_COMMAND', 'release parameters must be an empty object.');
      }
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
    if (command.command === 'release-all') {
      if (command.input !== undefined || Object.keys(parameters).length) {
        throw protocolError(
          'INVALID_COMMAND', 'release-all accepts no input and empty parameters.',
        );
      }
      return {
        run: () => ({ type: 'released-result-handles', count: this.#handles.size }),
        mutates: (result) => result.count > 0,
        install: null,
        present: (result) => {
          this.#handles.clear();
          return result;
        },
      };
    }
    if (command.command === 'delete-membership') {
      if (command.input !== undefined) {
        throw protocolError('INVALID_COMMAND', `${command.command} does not accept an input handle.`);
      }
      rejectKeys(parameters, new Set(['name']));
      return mutation(() => this.#memory.deleteMembership(parameters.name));
    }
    if (Object.keys(parameters).length) {
      throw protocolError(
        'INVALID_COMMAND', `${command.command} parameters must be an empty object.`,
      );
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
    const rawParameters = command.parameters === undefined ? {} : command.parameters;
    if (!isPlainObject(rawParameters)) {
      throw protocolError('INVALID_OPERATION', 'Command parameters must be a plain object.');
    }
    if (command.input !== undefined && command.inputs !== undefined) {
      throw protocolError('INVALID_COMMAND', 'A command cannot contain both input and inputs.');
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
    const namedEntries = this.#resolveInputs(command.inputs);
    const namedValues = namedEntries === undefined ? undefined
      : Object.fromEntries([...namedEntries].map(([name, entry]) => [name, entry.value]));
    const namedDescriptors = namedEntries === undefined ? undefined
      : Object.fromEntries([...namedEntries].map(([name, entry]) => [name, entry.descriptor]));
    const operationParameters = operationParametersWithSessionDefaults(
      command.command, rawParameters, this.#configuration,
    );
    const referenced = isSetOperation(command.command)
      ? this.#requireHandle(rawParameters.with) : undefined;
    const operation = normalizeResearchOperation({
      operation: command.command,
      parameters: isSetOperation(command.command)
        ? { ...operationParameters, with: referenced.value }
        : operationParameters,
    });
    const externallyBacked = isExternalOperation(command.command, operationParameters);
    const descriptorOperation = isSetOperation(command.command)
      ? { operation: command.command, parameters: cloneJson(operationParameters) }
      : operation;
    const references = referenced === undefined ? undefined
      : new Map([[rawParameters.with, referenced.descriptor]]);
    const descriptor = preflightResearchOperation(
      this.#memory, descriptorOperation, inputEntry?.descriptor, references, namedDescriptors,
    );
    validateResultTarget(command.resultId, command.replace, this.#handles);
    const execute = () => executeResearchOperation(
      this.#memory, operation, inputEntry?.value, namedValues,
    );
    return {
      run: () => externallyBacked
        ? this.#runExternal(operation, inputEntry?.value, namedValues) : execute(),
      mutates: (result) => operationMutation(command.command, result, operationParameters),
      install: command.resultId === undefined ? null : (result) => {
        this.#handles.set(command.resultId, {
          value: ownHandleValue(result),
          descriptor,
          revision: this.#revision + 1,
        });
        return [command.resultId];
      },
      present: (result) => ({
        ...presentResult(
          result,
          command.resultId,
          descriptor,
          this.#revision,
          command.command,
          operationParameters,
          this.#memory,
          command.input,
          this.#configuration.presentation.previewLimit,
        ),
      }),
    };
  }

  #resolveInputs(inputs) {
    if (inputs === undefined) return undefined;
    if (!isPlainObject(inputs) || Object.keys(inputs).length === 0) {
      throw protocolError('INVALID_COMMAND', 'inputs must map names to result IDs.');
    }
    const resolved = new Map();
    for (const [name, id] of Object.entries(inputs)) {
      if (name.trim().length === 0 || name !== name.trim()) {
        throw protocolError('INVALID_COMMAND', 'Input names must be non-empty trimmed strings.');
      }
      validateId(id, `Input result ID for ${name}`);
      const entry = this.#handles.get(id);
      if (!entry) {
        throw protocolError('UNKNOWN_RESULT', `No named result exists for ${id}.`, { id });
      }
      resolved.set(name, entry);
    }
    return resolved;
  }

  #preparePlan(command) {
    rejectKeys(command, PLAN_KEYS);
    const configuredPlan = Array.isArray(command.plan)
      ? command.plan.map((stage) => (
          isPlainObject(stage) ? {
            ...stage,
            parameters: operationParametersWithSessionDefaults(
              stage.operation, stage.parameters, this.#configuration,
            ),
          } : stage
        ))
      : command.plan;
    const plan = normalizeResearchPlan(configuredPlan);
    const descriptors = preflightResearchPlan(this.#memory, plan);
    const outputs = normalizeOutputs(command.outputs, plan);
    const targetIds = [...outputs.values()];
    if (new Set(targetIds).size !== targetIds.length) {
      throw protocolError('DUPLICATE_RESULT', 'Plan output result IDs must be unique.');
    }
    for (const id of targetIds) validateResultTarget(id, command.replace, this.#handles);
    return {
      run: () => this.#runPlan(plan),
      mutates: (report) => report.stages.some(({ id, operation, result }) => (
        operationMutation(operation, result, report.plan.find((stage) => stage.id === id)?.parameters)
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
        stages: report.stages.map(({ id, operation, resultKind, result }) => {
          const stage = report.plan.find((candidate) => candidate.id === id);
          const parameters = stage?.parameters ?? {};
          return {
            id, operation, resultKind,
            ...(outputs.has(id) ? {
              handle: handleMetadata(
                outputs.get(id), descriptors.get(id), result, this.#revision,
              ),
            } : {}),
            ...(operation === 'continue' ? {
                  completeness: compactContinuationCompleteness(result.completeness, {
                    input: stage?.input,
                    limit: this.#configuration.presentation.previewLimit,
                  }),
                  ...(isExternalOperation(operation, parameters) && result.coverage
                    ? externalPresentation(result, operation, this.#memory) : {}),
                } : isExternalOperation(operation, parameters)
              ? externalPresentation(result, operation, this.#memory)
              : {}),
          };
        }),
      }),
    };
  }

  async #runExternal(operation, input, namedInputs) {
    const controller = new AbortController();
    const active = { controller, done: null };
    this.#active.add(controller);
    const parameters = { ...operation.parameters, signal: controller.signal };
    const done = executeResearchOperation(
      this.#memory, { ...operation, parameters }, input, namedInputs,
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

function presentResult(
  result,
  id,
  descriptor,
  revision,
  operation,
  parameters,
  memory,
  input,
  outcomeLimit,
) {
  const metadata = id === undefined
    ? { kind: descriptor.kind, count: resultCount(result) }
    : handleMetadata(id, descriptor, result, revision);
  if (operation === 'continue') {
    return {
      handle: metadata,
      completeness: compactContinuationCompleteness(result.completeness, {
        input,
        limit: outcomeLimit,
      }),
      ...(isExternalOperation(operation, parameters) && result.coverage
        ? externalPresentation(result, operation, memory) : {}),
    };
  }
  return isExternalOperation(operation, parameters)
    ? {
        handle: metadata,
        ...externalPresentation(result, operation, memory),
      }
    : { handle: metadata };
}

function externalPresentation(result, operation, memory) {
  return {
    external: externalStatus(result, operation, memory),
  };
}

function compactContinuationCompleteness(value = {}, options = {}) {
  const inputs = value.inputs ?? [];
  const omissions = value.omissions ?? [];
  const limit = options.limit ?? RESEARCH_CONSTRAINTS.presentation.previewLimit.default;
  const outcomes = inputs.slice(0, limit).map((input) => ({
    subject: input.subject,
    status: input.status,
    resultCount: input.resultCount ?? 0,
    ...(input.omittedCount === undefined ? {} : { omittedCount: input.omittedCount }),
  }));
  const retryable = inputs.filter(({ status }) => (
    !['matched', 'empty-valid-result'].includes(status)
  ));
  return {
    attemptStatus: value.status,
    dataScope: value.scope,
    exhaustive: value.exhaustive,
    emptyValidResult: value.emptyValidResult,
    inputs: {
      count: inputs.length,
      resultCount: inputs.reduce((total, input) => total + (input.resultCount ?? 0), 0),
      statuses: countedValues(inputs.map(({ status }) => status)),
    },
    omissions: {
      count: omissions.length,
      reasons: countedValues(omissions.map(({ reason }) => reason)),
    },
    outcomes,
    omittedOutcomeCount: Math.max(0, inputs.length - outcomes.length),
    ...(retryable.length === 0 ? {} : {
      sequentialRetry: {
        ...(typeof options.input === 'string' ? { input: options.input } : {}),
        count: retryable.length,
        subjects: retryable.slice(0, limit).map(({ subject }) => subject),
        omittedSubjectCount: Math.max(0, retryable.length - limit),
      },
    }),
    boundsReached: value.boundsReached ?? [],
  };
}

function countedValues(values) {
  return [...values.reduce((counts, value) => {
    if (value !== undefined) counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map())]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value, count]) => ({ value, count }));
}

function handleMetadata(id, descriptor, value, revision) {
  return {
    id, kind: descriptor.kind, count: resultCount(value), revision,
    ...(descriptor.scope ? { scope: descriptor.scope } : {}),
  };
}

function contextualHandleSchema(memory, id, entry, selectedOperation, configuration) {
  const handle = handleMetadata(id, entry.descriptor, entry.value, entry.revision);
  const value = entry.value?.collection ?? entry.value;
  const structure = entry.descriptor.resultKind === 'relay-information-report'
    ? {
        kind: 'relay-information',
        count: entry.value.outcomes.length,
        fields: {
          report: ['requested', 'startedAt', 'finishedAt', 'bounds', 'outcomes', 'omissions'],
          outcome: [
            'relay', 'endpoint', 'outcome', 'http', 'responseBytes', 'document',
            'advertised', 'malformedFields', 'diagnostic', 'omissions',
          ],
        },
        observationModes: ['summary', 'preview', 'coverage', 'details'],
        facts: operationSchema().operationFacts['relay-info'].resultFacts,
      }
    : entry.descriptor.resultKind === 'relay-count-report'
    ? {
        kind: 'relay-count',
        count: entry.value.outcomes.length,
        fields: {
          report: ['requested', 'startedAt', 'finishedAt', 'bounds', 'outcomes', 'omissions'],
          outcome: [
            'relay', 'contacted', 'outcome', 'response', 'notice', 'closedReason',
            'authChallengeObserved', 'authChallenge', 'diagnostic',
          ],
        },
        observationModes: ['summary', 'preview', 'coverage', 'details'],
        facts: operationSchema().operationFacts['relay-count'].resultFacts,
      }
    : isResearchRelation(value)
    ? describeResearchRelation(memory, value)
    : collectionStructure(memory.asCollection(value));
  if (['acquisition-report', 'hydration-report'].includes(entry.descriptor.resultKind)) {
    const operation = entry.descriptor.resultKind === 'hydration-report' ? 'hydrate' : 'acquire';
    structure.reportFacts = operationSchema().operationFacts[operation].resultFacts;
  }
    const operations = contextualResearchOperationSchema({
      descriptor: entry.descriptor,
      structure,
      value,
      configuration,
  });
  const compatibleOperations = Object.keys(operations);
  if (selectedOperation !== undefined) {
    const contextual = operations[selectedOperation];
    if (!contextual) {
      throw protocolError(
        'INVALID_OPERATION',
        `${selectedOperation} is not compatible with ${entry.descriptor.kind}.`,
        { operation: selectedOperation, compatibleOperations },
      );
    }
    const global = operationSchema();
    return {
      type: 'handle-operation-schema',
      handle,
      structure: { kind: structure.kind, count: structure.count },
      operation: {
        name: selectedOperation,
        parameters: global.parameterContracts[selectedOperation] ?? {},
        ...(global.operationFacts[selectedOperation] ?? {}),
        ...contextual,
      },
    };
  }
  return {
    type: 'handle-schema',
    handle,
    structure,
    compatibleOperations,
  };
}

function contextualSchemaOperation(parameters) {
  const unknown = Object.keys(parameters).find((name) => name !== 'operation');
  if (unknown) {
    throw protocolError('INVALID_COMMAND', `Unknown contextual schema parameter: ${unknown}.`);
  }
  if (parameters.operation === undefined) return undefined;
  if (typeof parameters.operation !== 'string'
      || parameters.operation.trim().length === 0
      || parameters.operation !== parameters.operation.trim()) {
    throw protocolError(
      'INVALID_COMMAND',
      'Contextual schema operation must be a non-empty trimmed string.',
    );
  }
  if (!operationSchema().operations.includes(parameters.operation)) {
    throw protocolError(
      'INVALID_OPERATION',
      `Unknown research operation: ${parameters.operation}.`,
      { operation: parameters.operation },
    );
  }
  return parameters.operation;
}

function globalSchemaDetail(parameters) {
  const unknown = Object.keys(parameters).find((name) => name !== 'detail');
  if (unknown) {
    throw protocolError('INVALID_COMMAND', `Unknown global schema parameter: ${unknown}.`);
  }
  const detail = parameters.detail ?? 'summary';
  if (!['summary', 'full'].includes(detail)) {
    throw protocolError('INVALID_COMMAND', 'Global schema detail must be summary or full.');
  }
  return detail;
}

function globalSessionSchema(memory, configuration, detail) {
  const schema = memory.describeCollectionPipeline();
  if (detail === 'summary') {
    const {
      parameterContracts: ignoredContracts,
      operationFacts: ignoredFacts,
      constraints: ignoredConstraints,
      definitions,
      ...research
    } = schema.research;
    schema.research = {
      ...research,
      definitions: Object.fromEntries(Object.entries(definitions).map(([name, value]) => [
        name,
        {
          input: value.input,
          outputKind: value.outputKind,
          resultKind: value.resultKind,
          locality: value.locality,
        },
      ])),
      contractAccess: 'Use schema with an input handle and parameters.operation, or request global detail "full".',
    };
  }
  return {
    ...schema,
    detail,
    session: sessionSchema(configuration),
    constraints: researchConstraints(),
  };
}

function collectionStructure(collection) {
  const subjectTypes = [...collection.items.reduce((counts, { subject }) => {
    counts.set(subject.type, (counts.get(subject.type) ?? 0) + 1);
    return counts;
  }, new Map())].map(([type, count]) => ({ type, count }));
  return {
    kind: collection.kind,
    count: collection.items.length,
    subjectTypes,
  };
}

function readOnly(run) {
  return { run, mutates: () => false, install: null, present: (value) => value };
}

function mutation(run) {
  return { run, mutates: () => true, install: null, present: (value) => value };
}

function collectionValue(value) {
  return value?.collection?.type === 'result-collection' ? value.collection : value;
}

function projectionOptions(parameters, allowMode = false) {
  const allowed = new Set([
    ...(allowMode ? ['mode', 'offset'] : []),
    'previewLimit', 'excerptLimit', 'includeEvidence', 'sizeLimit',
  ]);
  const unknown = Object.keys(parameters).find((key) => !allowed.has(key));
  if (unknown) throw protocolError('INVALID_COMMAND', `Unknown projection parameter: ${unknown}.`);
  try {
    validateResearchPresentationOptions(parameters);
  } catch (error) {
    if (error instanceof TypeError) {
      throw protocolError('INVALID_COMMAND', error.message);
    }
    throw error;
  }
  return cloneJson(parameters);
}

function resultCount(value) {
  if (Array.isArray(value?.items)) return value.items.length;
  if (Array.isArray(value?.rows)) return value.rows.length;
  if (Array.isArray(value?.collection?.items)) return value.collection.items.length;
  if (Array.isArray(value?.acquiredEventIds)) return value.acquiredEventIds.length;
  if (Number.isSafeInteger(value?.memberCount)) return value.memberCount;
  if (value?.type === 'relay-information-report' && Array.isArray(value.outcomes)) {
    return value.outcomes.length;
  }
  if (value?.type === 'relay-count-report' && Array.isArray(value.outcomes)) {
    return value.outcomes.length;
  }
  return 0;
}

function ownHandleValue(value) {
  if (value?.type === 'research-relation') return cloneJson(value);
  if (value?.type === 'result-collection') return stableSubjectCollection(value);
  if (value?.collection?.type === 'result-collection') {
    return { ...value, collection: stableSubjectCollection(value.collection) };
  }
  return value;
}

function stableSubjectCollection(collection) {
  return {
    ...collection,
    items: collection.items.map(({ record: ignored, ...item }) => ({
      ...cloneJson(item),
      provenance: observationReferences(item),
    })),
  };
}

function observationReferences(item) {
  const provenance = item.provenance ?? [];
  if (!provenance.some((entry) => entry?.relay || entry?.observedAt)) {
    return cloneJson(provenance);
  }
  return [{
    type: 'stored-subject-observations',
    subject: cloneJson(item.subject),
  }];
}

function externalStatus(result, operation, memory) {
  if (operation === 'relay-info') {
    const outcomes = result.outcomes ?? [];
    const successful = outcomes.filter(({ outcome }) => outcome === 'success').length;
    return {
      status: successful === outcomes.length ? 'complete' : 'partial',
      scope: { type: 'relay-information', relays: outcomes.length },
      retrieval: {
        requested: outcomes.length,
        successful,
        unsuccessful: outcomes.length - successful,
        outcomes: countedValues(outcomes.map(({ outcome }) => outcome)),
        bounds: cloneJson(result.bounds),
      },
      distinction: 'Advertised NIP-11 claims are not observed acquisition behavior.',
    };
  }
  if (operation === 'relay-count') {
    const outcomes = result.outcomes ?? [];
    const successful = outcomes.filter(({ outcome }) => outcome === 'success').length;
    return {
      status: successful === outcomes.length ? 'complete' : 'partial',
      scope: { type: 'relay-count', relays: outcomes.length },
      retrieval: {
        requested: outcomes.length,
        successful,
        unsuccessful: outcomes.length - successful,
        outcomes: countedValues(outcomes.map(({ outcome }) => outcome)),
        bounds: cloneJson(result.bounds),
      },
      distinction: 'Counts remain relay-local and are never summed into a global total.',
    };
  }
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
  const noticeCount = contactedRelays.reduce(
    (count, relay) => count + relay.notices.length + relay.omittedNotices, 0,
  );
  const authChallengeRelays = contactedRelays
    .filter(({ authChallengeObserved }) => authChallengeObserved).length;
  const refusedRelays = contactedRelays.filter(({ outcome }) => outcome === 'closed').length;
  const eoseHintCounts = contactedRelays.flatMap(({ eoseHints }) => eoseHints)
    .reduce((counts, { hint }) => ({ ...counts, [hint]: (counts[hint] ?? 0) + 1 }), {});
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
        return memory.inspect({ type: 'account', id }).resolved;
      } catch {
        return false;
      }
    }),
  );
  const requested = requestedAuthors?.size ?? null;
  const resolved = resolvedAuthors?.size ?? null;
  const missing = requested === null ? null : Math.max(0, requested - resolved);
  const hydratedEventAuthors = hydration
    ? result.acquiredEventIds.map((eventId) => {
      try {
        return memory.inspect({ type: 'event', id: eventId }).evidence?.event?.pubkey ?? null;
      } catch {
        return null;
      }
    }).filter(Boolean)
    : [];
  const hydratedEventsByAccount = countedValues(hydratedEventAuthors);
  const accountsWithMultipleMetadataEvents = hydratedEventsByAccount
    .filter(({ count }) => count > 1).length;
  if (missing > 0 && boundsReached.length === 0) boundsReached = ['unresolved-subjects'];
  const corpusChanges = acquisitionCorpusAccounting(result.additions);
  return {
    status: boundsReached.length ? 'partial' : 'complete',
    completeness: {
      requested,
      resolved,
      missing,
      ...(hydration ? {
        units: 'accounts',
        acquiredMetadataEvents: result.counts.distinctEventsAcquired,
        accountsWithMultipleMetadataEvents,
        distinction: 'Account completeness counts resolved account subjects; the result handle counts immutable metadata events and may contain multiple events per account.',
      } : {}),
      boundsReached,
      requestBounds: {
        relays: result.requested.relays.length,
        observationLimit: result.budget.observationLimit,
        distinctEventLimit: result.budget.distinctEventLimit,
      },
      ...(result.inputResolution ? { inputResolution: cloneJson(result.inputResolution) } : {}),
      observed: result.counts.acceptedObservations,
      duplicateObservations: result.counts.duplicateObservations,
      distinctEvents: result.counts.distinctEventsAcquired,
      relays: {
        attempted: contactedRelays.length,
        complete: completeRelays,
        incomplete: contactedRelays.length - completeRelays,
        outcomes: relayOutcomes,
        omittedOutcomes: allRelayOutcomes.length - relayOutcomes.length,
        notices: noticeCount,
        authChallengeObserved: authChallengeRelays,
        explicitRefusals: refusedRelays,
        eoseHints: eoseHintCounts,
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
  const buffer = value.observationBuffer ?? value;
  return {
    eventCount: buffer.eventCount,
    capacity: buffer.capacity,
    remainingCapacity: buffer.remainingCapacity,
    pressure: buffer.capacity === 0 ? 0 : buffer.eventCount / buffer.capacity,
    evictions: buffer.evictions,
  };
}

function externalWarnings(result, operation) {
  if (result?.type === 'research-plan-report') {
    return result.stages.flatMap(({ id, operation: stageOperation, result: stageResult }) => (
      externalWarnings(stageResult, stageOperation).map((warning) => `Stage ${id}: ${warning}`)
    ));
  }
  if (!Array.isArray(result?.coverage?.relays)) return [];
  const warnings = result.completionReason === 'completed'
    ? [] : [`External operation completed with ${result.completionReason}.`];
  const unsuccessful = result.coverage.relays
    .filter(({ outcome }) => UNSUCCESSFUL_RELAY_OUTCOMES.has(outcome));
  if (unsuccessful.length) {
    warnings.push(`${unsuccessful.length} relay attempt${unsuccessful.length === 1 ? '' : 's'} did not complete successfully.`);
  }
  return warnings;
}

function sessionSchema(configuration) {
  const constraints = researchConstraints();
  const previewRange = `integer from ${constraints.presentation.previewLimit.minimum} `
    + `to ${constraints.presentation.previewLimit.maximum}`;
  const excerptRange = `integer from ${constraints.presentation.excerptLimit.minimum} `
    + `to ${constraints.presentation.excerptLimit.maximum}`;
  const sizeRange = `integer from ${constraints.presentation.sizeLimit.minimum} `
    + `to ${constraints.presentation.sizeLimit.maximum} bytes approximately`;
  return {
    envelope: {
      required: { commandId: 'non-empty string', command: 'documented command' },
      optional: {
        ifRevision: 'non-negative integer',
        input: 'named result handle ID',
        inputs: 'map of input names to named result handle IDs',
        parameters: 'plain JSON object',
        resultId: 'new named result handle ID',
        replace: 'boolean; true is required to overwrite a handle',
      },
    },
    commands: {
      research: [...researchOperationNames(), 'plan'],
      notebook: {
        remember: {
          input: 'subject result handle',
          parameters: {
            judgment: NOTEBOOK_JUDGMENTS,
            strength: 'optional number from 0 to 1',
            reason: 'required caller-authored string',
            attribution: 'required caller or operation name',
            sourceReferences: 'stable references; resolution is not implied',
            labels: 'optional caller-defined string array',
            note: 'optional caller-authored string',
          },
        },
        query: {
          command: 'notebook',
          input: 'forbidden',
          parameters: {
            judgments: 'optional judgment array (OR)',
            labels: 'optional label array (AND)',
            limit: { ...QUERY_LIMIT, required: false },
          },
        },
        forget: { input: 'subject result handle', parameters: {} },
      },
      plan: {
        required: {
          commandId: 'non-empty string',
          command: '"plan"',
          plan: 'non-empty research stage array',
        },
        optional: {
          ifRevision: 'non-negative integer',
          outputs: 'map of stage IDs to new named result handle IDs',
          replace: 'boolean; true is required to overwrite a handle',
        },
        stage: {
          required: {
            id: 'non-empty unique string',
            operation: 'research operation name',
            parameters: 'plain JSON object; use an empty object when the operation has no fields',
          },
          optional: {
            input: 'earlier stage ID',
            inputs: 'map of names to earlier stage IDs',
          },
        },
      },
      observation: {
        show: {
          input: 'named result handle',
          parameters: {
            mode: ['preview', 'summary', 'coverage', 'details', 'explain'],
            offset: 'non-negative integer',
            previewLimit: previewRange,
            excerptLimit: excerptRange,
            includeEvidence: 'boolean',
            sizeLimit: sizeRange,
          },
        },
        inspect: {
          input: 'forbidden',
          parameters: {
            subject: 'subject object or bare/NIP-21 nostr: npub, nprofile, note, nevent, or naddr reference; encoded author, kind, and relay hints are unverified and never followed automatically',
            previewLimit: previewRange,
            excerptLimit: excerptRange,
            includeEvidence: 'boolean',
            sizeLimit: sizeRange,
          },
        },
        explain: {
          input: 'named result handle',
          parameters: {
            subject: 'subject object or bare/NIP-21 nostr: npub, nprofile, note, nevent, or naddr reference; encoded author, kind, and relay hints are unverified and never followed automatically',
            previewLimit: previewRange,
            excerptLimit: excerptRange,
            includeEvidence: 'boolean',
            sizeLimit: sizeRange,
          },
        },
        list: { parameters: { limit: previewRange, sizeLimit: sizeRange } },
        memberships: { parameters: { limit: 'non-negative integer' } },
        membership: { parameters: { name: 'membership name' } },
        status: { parameters: { limit: previewRange, sizeLimit: sizeRange } },
        schema: {
          input: 'optional named result handle; omitted returns the global schema',
          parameters: {
            operation: 'optional research operation name; accepted only with an input handle',
            detail: 'summary or full; accepted only without an input handle and defaults to summary',
          },
        },
      },
      configuration: {
        configure: {
          input: 'forbidden',
          parameters: 'partial session configuration',
          effect: 'changes defaults for future commands without rewriting memory',
        },
      },
      lifecycle: [
        'release', 'release-all', 'delete-membership', 'reset', 'close',
      ],
    },
    configuration: {
      effective: structuredClone(configuration),
      mutable: {
        relays: 'default wss:// relay URL array for future external operations',
        acquisition: {
          timeoutMs: 'positive integer',
          observationLimit: 'positive integer',
          distinctEventLimit: 'positive integer',
          concurrency: 'positive integer',
        },
        presentation: {
          previewLimit: 'bounded integer',
          excerptLimit: 'bounded integer',
          sizeLimit: 'bounded integer',
        },
      },
      precedence: [
        'per-command parameters',
        'session configuration',
        'engine defaults',
        'engine hard constraints',
      ],
      capacityChanges: 'Memory, archive, and notebook capacity are construction-time settings; generic session configuration never evicts evidence.',
    },
    notebookMemberships: {
      list: { command: 'memberships', parameters: { limit: 'optional non-negative integer' } },
      inspect: { command: 'membership', parameters: { name: 'membership name' } },
      replace: {
        command: 'remember-membership',
        input: 'subject result handle',
        parameters: {
          name: 'membership name',
          reason: 'optional membership reason object',
        },
      },
      delete: { command: 'delete-membership', parameters: { name: 'membership name' } },
      distinction: 'Releasing handles, deleting membership, and releasing archived evidence are independent.',
    },
    accountFields: {
      'account.name': 'literal Nostr kind-0 profile field "name"',
      'account.display_name': 'literal Nostr kind-0 profile field "display_name"',
    },
    locality: 'Handles, notebook knowledge, and archived evidence are process-local and disappear on reset, close, or process exit.',
  };
}

function semanticError(error) {
  if (error?.protocolCode) {
    return { code: error.protocolCode, message: error.message, details: error.details ?? {} };
  }
  if (!(error instanceof ResearchMemoryError)) {
    return { code: 'INTERNAL_ERROR', message: 'The command could not be completed.', details: {} };
  }
  let code = 'INVALID_OPERATION';
  if (/could not resolve values|unresolved evidence/i.test(error.message)) {
    code = 'UNRESOLVED_EVIDENCE';
  } else if (/requires an? (accounts|subject) collection|not supported|contain no stable subjects/.test(error.message)) {
    code = 'TYPE_MISMATCH';
  } else if (/(?:invalid|unknown) subject|subject (?:must|requires)|public key|Event ID/i
    .test(error.message)) {
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
