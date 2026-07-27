import {
  acquireRelayEvents,
  normalizeAcquisitionOptions,
  normalizeHydrationOptions,
} from './acquire.js';
import { ResearchMemoryError } from './protocol.js';
import {
  executeCollectionOperation,
  validateCollectionOperation,
} from './collection.js';
import {
  acquireContinuationEvidence,
  continueResearch,
  normalizeContinuation,
} from './continuation.js';
import {
  continuationSemantics,
  isExternalOperation,
  isRelationOperation,
  isSetOperation,
  isTransformOperation,
  operationResultKind,
  operationSemantics,
  supportsCollectionOperations,
} from './operations.js';
import {
  executeRelationOperation,
  isResearchRelation,
  validateRelationOperation,
} from './relation.js';
import {
  executePipelineExpand,
  executePipelineFetch,
  validatePipelineExpand,
  validatePipelineFetch,
} from './pipeline-source.js';

const MEMORY_TRANSACTION = Symbol.for('nostr-research.memory-plan-attempt');

/**
 * Executes a linear, JSON-serializable list of named research stages.
 *
 * Results stay available by stage ID for explicit reuse. The runner supplies
 * no judgments, performs no implicit acquisition, and does not update a
 * declarative session handle.
 */
export async function executeResearchPlan(memory, plan, execution = {}) {
  if (!memory || typeof memory.asCollection !== 'function') {
    throw new ResearchMemoryError('An open research memory is required.');
  }
  if (typeof memory[MEMORY_TRANSACTION] !== 'function') {
    throw new ResearchMemoryError('Research plan execution requires transactional research memory.');
  }
  const normalized = normalizeResearchPlan(plan);
  preflightResearchPlan(memory, normalized);
  return memory[MEMORY_TRANSACTION](async () => {
    const outputs = new Map();
    const stages = [];

    for (const stage of normalized) {
      const namedInputs = resolveStageInputs(stage, outputs);
      const input = namedInputs.input;
      const executable = isSetOperation(stage.operation)
        ? {
            ...stage,
            parameters: { ...stage.parameters, with: outputs.get(stage.parameters.with) },
          }
        : stage;
      const result = await executeResearchOperation(memory, {
        ...executable,
        parameters: execution.signal && (
          isExternalOperation(stage.operation, stage.parameters)
        )
          ? { ...executable.parameters, signal: execution.signal }
          : executable.parameters,
      }, input, namedInputs);
      outputs.set(stage.id, result);
      stages.push({
        id: stage.id,
        operation: stage.operation,
        ...(stage.input === undefined ? {} : { input: stage.input }),
        ...(stage.inputs === undefined ? {} : { inputs: stage.inputs }),
        resultKind: operationResultKind(stage.operation, result.kind) ?? result.kind ?? result.type,
        result,
      });
    }

    return {
      type: 'research-plan-report',
      plan: cloneJson(normalized),
      stages,
    };
  });
}

export function preflightResearchPlan(memory, plan) {
  const outputs = new Map();
  for (const stage of plan) {
    const inputs = resolveStageInputs(stage, outputs);
    const input = inputs.input;
    if (stage.operation === 'select' && input && input.resultKind !== 'acquisition-report') {
      throw new ResearchMemoryError(
        `Research plan select stage ${stage.id} input must name an acquisition stage.`,
      );
    }
    const output = preflightResearchOperation(memory, stage, input, outputs, inputs);
    outputs.set(stage.id, output);
  }
  return outputs;
}

export function normalizeResearchPlan(plan) {
  assertJsonData(plan, 'Research plan');
  if (!Array.isArray(plan) || plan.length === 0) {
    throw new ResearchMemoryError('Research plan must be a non-empty array of stages.');
  }
  const ids = new Set();
  return plan.map((stage, index) => {
    if (!isPlainObject(stage)) {
      throw new ResearchMemoryError(`Research plan stage ${index + 1} must be an object.`);
    }
    rejectUnknownKeys(stage, new Set(['id', 'operation', 'input', 'inputs', 'parameters']), index);
    if (typeof stage.id !== 'string' || stage.id.trim().length === 0) {
      throw new ResearchMemoryError(`Research plan stage ${index + 1} ID must be a non-empty string.`);
    }
    const id = stage.id.trim();
    if (ids.has(id)) throw new ResearchMemoryError(`Duplicate research plan stage ID: ${id}.`);
    if (!operationSemantics(stage.operation)) {
      throw new ResearchMemoryError(
        `Unsupported research plan operation at stage ${id}: ${stage.operation}.`,
      );
    }
    const normalizedOperation = normalizeResearchOperation(stage);
    const hasInput = stage.input !== undefined;
    const hasInputs = stage.inputs !== undefined;
    if (hasInput && hasInputs) {
      throw new ResearchMemoryError(`Research plan stage ${id} cannot contain both input and inputs.`);
    }
    const semantics = operationSemantics(normalizedOperation.operation);
    if (semantics.input === 'forbidden' && hasInput) {
      throw new ResearchMemoryError(`Research plan acquire stage ${id} must not have an input.`);
    }
    if (hasInput && (typeof stage.input !== 'string' || !ids.has(stage.input))) {
      throw new ResearchMemoryError(
        `Research plan stage ${id} input must name an earlier stage.`,
      );
    }
    if (hasInputs) {
      if (!isPlainObject(stage.inputs) || Object.keys(stage.inputs).length === 0) {
        throw new ResearchMemoryError(`Research plan stage ${id} inputs must be a non-empty object.`);
      }
      for (const [name, reference] of Object.entries(stage.inputs)) {
        if (typeof name !== 'string' || name.trim().length === 0
            || typeof reference !== 'string' || !ids.has(reference)) {
          throw new ResearchMemoryError(
            `Research plan stage ${id} input ${name} must name an earlier stage.`,
          );
        }
      }
    }
    if (!hasInput && !hasInputs && !['forbidden', 'optional-acquisition'].includes(semantics.input)) {
        throw new ResearchMemoryError(
          `Research plan stage ${id} input must name an earlier stage.`,
        );
    }
    if (isSetOperation(stage.operation)
        && (typeof stage.parameters.with !== 'string' || !ids.has(stage.parameters.with))) {
      throw new ResearchMemoryError(
        `Research plan ${stage.operation} stage ${id} parameter with must name an earlier stage.`,
      );
    }
    if (stage.operation === 'remember-membership') {
      rejectUnknownParameterKeys(stage, new Set(['name', 'reason', 'attribution']));
      if (typeof stage.parameters.name !== 'string' || stage.parameters.name.trim().length === 0) {
        throw new ResearchMemoryError(`Research plan remember-membership stage ${id} requires a name.`);
      }
      if (stage.parameters.reason !== undefined) {
        const reason = stage.parameters.reason;
        if (!isPlainObject(reason)
            || typeof reason.type !== 'string'
            || reason.type.trim().length === 0) {
          throw new ResearchMemoryError(
            `Research plan remember-membership stage ${id} reason requires a non-empty type.`,
          );
        }
      }
    }
    ids.add(id);
    return {
      id,
      operation: normalizedOperation.operation,
      ...(hasInput ? { input: stage.input } : {}),
      ...(hasInputs ? { inputs: cloneJson(stage.inputs) } : {}),
      parameters: normalizedOperation.parameters,
    };
  });
}

/** Normalizes the operation representation shared by direct, plan, and session callers. */
export function normalizeResearchOperation(value) {
  if (!isPlainObject(value) || typeof value.operation !== 'string'
      || !operationSemantics(value.operation)) {
    throw new ResearchMemoryError(`Unsupported research operation: ${value?.operation}.`);
  }
  if (!isPlainObject(value.parameters)) {
    throw new ResearchMemoryError('Research operation parameters must be an object.');
  }
  const { signal, ...parameters } = value.parameters;
  assertJsonData({ operation: value.operation, parameters }, 'Research operation');
  return {
    operation: value.operation,
    parameters: { ...cloneJson(parameters), ...(signal === undefined ? {} : { signal }) },
  };
}

/**
 * Validates one normalized operation against an input descriptor without
 * performing local mutation or contacting a relay.
 */
export function preflightResearchOperation(
  memory,
  operation,
  input = undefined,
  references = undefined,
  namedInputs = undefined,
) {
  const { operation: name, parameters } = normalizeResearchOperation(operation);
  const semantics = operationSemantics(name);
  if (!semantics || !isPlainObject(parameters)) {
    throw new ResearchMemoryError(`Unsupported research operation: ${name}.`);
  }
  if (name === 'acquire') {
    if (input !== undefined) {
      throw new ResearchMemoryError('Research acquire operation must not have an input.');
    }
    normalizeAcquisitionOptions(parameters);
    return {
      kind: semantics.outputKind,
      itemKind: semantics.outputKind,
      resultKind: semantics.resultKind,
      scope: 'acquisition',
    };
  }
  if (name === 'select') {
    if (input && input.resultKind !== 'acquisition-report') {
      throw new ResearchMemoryError('Research select input must be an acquisition result.');
    }
    const query = normalizeSelectionScope(parameters, Boolean(input));
    memory.validateSelection(query);
    return {
      kind: semantics.outputKind,
      itemKind: semantics.outputKind,
      resultKind: semantics.resultKind,
      scope: input ? 'acquisition' : 'corpus',
    };
  }
  if (name === 'archived') {
    if (input !== undefined) {
      throw new ResearchMemoryError('Research archived operation must not have an input.');
    }
    memory.archived(parameters);
    return {
      kind: 'subjects', itemKind: 'subjects', resultKind: 'subjects', scope: 'archive',
    };
  }
  if (name === 'notebook') {
    if (input !== undefined) throw new ResearchMemoryError('Research notebook operation must not have an input.');
    memory.notebook(parameters);
    return { kind: 'subjects', itemKind: 'subjects', resultKind: 'subjects', scope: 'notebook' };
  }
  if (name === 'fetch') return validatePipelineFetch(parameters, input);
  if (name === 'expand') return validatePipelineExpand(memory, parameters, input);
  if ((isRelationOperation(name) && operationSemantics(name).executor !== 'collection-or-relation')
      || (input?.kind === 'relation' && isRelationOperation(name))) {
    const inputs = namedInputs ?? { input };
    return validateRelationOperation(name, parameters, inputs);
  }
  if (!input) throw new ResearchMemoryError(`Research ${name} operation requires an input.`);
  if (isTransformOperation(name)) {
    const transformParameters = isSetOperation(name)
      ? {
          ...parameters,
          with: typeof parameters.with === 'string'
            ? descriptorCollection(inputForSetOperation(references, parameters.with, name))
            : parameters.with,
        }
      : parameters;
    const transformed = validateCollectionOperation(
      { operation: name, ...transformParameters }, input.kind, input.itemKind,
    );
    return { ...transformed, resultKind: transformed.kind };
  }
  if (name === 'hydrate') {
    if (input.kind !== 'accounts') {
      throw new ResearchMemoryError('Research hydrate operation requires an accounts collection.');
    }
    normalizeHydrationOptions(parameters);
    return {
      kind: semantics.outputKind,
      itemKind: semantics.outputKind,
      resultKind: semantics.resultKind,
    };
  }
  if (name === 'continue') {
    normalizeContinuation(memory, descriptorCollection(input), parameters);
    const relationship = continuationSemantics(parameters.relationship);
    return {
      kind: relationship.outputKind,
      itemKind: relationship.outputKind,
      resultKind: semantics.resultKind,
    };
  }
  if (name === 'preserve') {
    memory.validatePreservation(parameters, input.kind);
    return { ...input, resultKind: operationResultKind(name, input.kind) };
  }
  if (name === 'release-archive') {
    if (Object.keys(parameters).length) {
      throw new ResearchMemoryError('Research release-archive parameters must be empty.');
    }
    return { ...input, resultKind: operationResultKind(name, input.kind) };
  }
  if (name === 'remember') {
    normalizeRememberParameters(parameters);
    return { ...input, resultKind: input.kind };
  }
  if (name === 'forget') {
    if (Object.keys(parameters).length) {
      throw new ResearchMemoryError('Research forget parameters must be empty.');
    }
    return { ...input, resultKind: input.kind };
  }
  const { name: membershipName, ...options } = parameters;
  rejectUnknownParameterKeys(
    { id: 'operation', operation: 'remember-membership', parameters },
    new Set(['name', 'reason', 'attribution']),
  );
  memory.validateNotebookMembership(membershipName, options, input.kind);
  return { ...input, resultKind: semantics.resultKind };
}

function inputForSetOperation(outputs, id, operation) {
  if (typeof id !== 'string' || !outputs?.has(id)) {
    throw new ResearchMemoryError(
      `Research ${operation} parameter with must name an earlier stage.`,
    );
  }
  return outputs.get(id);
}

function descriptorCollection(descriptor) {
  if (!supportsCollectionOperations(descriptor)) {
    throw new ResearchMemoryError(
      'Set composition requires a compatible subject collection result.',
    );
  }
  return { type: 'result-collection', kind: descriptor.kind, items: [], context: {} };
}

/** Executes one preflighted operation through the same path used by plans. */
export async function executeResearchOperation(memory, operation, input = undefined, namedInputs = undefined) {
  const normalized = normalizeResearchOperation(operation);
  preflightResearchOperation(
    memory,
    normalized,
    input === undefined ? undefined : resultDescriptor(input),
    undefined,
    namedInputs === undefined ? undefined : Object.fromEntries(
      Object.entries(namedInputs).map(([key, value]) => [key, resultDescriptor(value)]),
    ),
  );
  const { operation: name, parameters } = normalized;
  if (name === 'fetch') return executePipelineFetch(memory, parameters, input);
  if (name === 'expand') return executePipelineExpand(memory, parameters, input);
  if ((isRelationOperation(name) && operationSemantics(name).executor !== 'collection-or-relation')
      || isResearchRelation(input)) {
    return executeRelationOperation(memory, name, parameters, namedInputs ?? { input });
  }
  if (name === 'acquire') return acquireRelayEvents(memory, parameters);
  if (name === 'select') {
    const query = normalizeSelectionScope(parameters, input !== undefined);
    if (input === undefined) return memory.select(query);
    const scoped = memory.asCollection(input);
    const scopedItems = new Map(scoped.items.map((item) => [item.subject.id, item]));
    const residentItems = scoped.items.filter(({ subject, record }) => (
      subject.type === 'event' && record?.event
    ));
    const scopedIds = residentItems.map(({ subject }) => subject.id);
    if (scopedIds.length === 0) {
      return {
        ...scoped,
        kind: 'events',
        itemKind: 'events',
        items: [],
        context: scopedSelectionContext(scoped, query),
      };
    }
    const requestedIds = resolveScopedPrefixes(query.ids, scopedIds, 'event ID');
    const selectedIds = requestedIds ?? scopedIds;
    const requestedAuthors = resolveScopedPrefixes(
      query.authors,
      residentItems.map(({ record }) => record.event.pubkey),
      'author public key',
    );
    if (selectedIds.length === 0 || requestedAuthors?.length === 0) {
      return {
        ...scoped,
        kind: 'events',
        itemKind: 'events',
        items: [],
        context: scopedSelectionContext(scoped, query),
      };
    }
    const selected = memory.select({
      ...query,
      ids: selectedIds,
      ...(requestedAuthors === null ? {} : { authors: requestedAuthors }),
    });
    return {
      ...selected,
      items: selected.items
        .filter(({ subject }) => scopedItems.has(subject.id))
        .map((item) => ({
          subject: item.subject,
          role: item.role,
          record: item.record,
          reasons: [
            ...(scopedItems.get(item.subject.id)?.reasons ?? []),
            ...item.reasons,
          ],
          provenance: item.provenance,
        })),
      context: {
        ...scopedSelectionContext(scoped, selected.context.query),
      },
    };
  }
  if (name === 'archived') {
    const archive = memory.archived(parameters);
    return memory.collection(archive.entries.map((entry) => ({
      subject: entry.subject,
      reasons: [{ type: 'archived-evidence', level: entry.level, reason: entry.reason }],
      provenance: entry.excerpt?.provenance ?? entry.canonical?.observations ?? [],
    })), {
      operation: 'archived',
      query: cloneJson(parameters),
      count: archive.count,
      omitted: archive.omitted,
    }, 'subjects');
  }
  if (name === 'notebook') return memory.notebook(parameters);
  if (isTransformOperation(name)) {
    return executeCollectionOperation(memory, input, { operation: name, ...parameters });
  }
  if (name === 'hydrate') {
    const normalized = normalizeHydrationOptions(parameters);
    const accounts = memory.asCollection(input).items
      .filter(({ subject }) => subject.type === 'account');
    if (accounts.length === 0) return emptyHydrationReport(memory, normalized);
    return {
      ...await acquireContinuationEvidence(memory, input, normalized),
      type: 'hydration-report',
    };
  }
  if (name === 'continue') return continueResearch(memory, input, parameters);
  if (name === 'preserve') {
    const collection = memory.asCollection(input);
    const mutation = memory.preserve(collection, parameters);
    return {
      ...collection,
      context: { operation: 'preserve', input: collection.context, archiveMutation: mutation },
    };
  }
  if (name === 'release-archive') {
    const collection = memory.asCollection(input);
    const mutation = memory.releaseEvidence(collection.items.map(({ subject }) => subject));
    return memory.collection(mutation.subjects.map((item) => ({
      subject: item,
      reasons: [{ type: 'released-archived-evidence' }],
      provenance: [],
    })), { operation: 'release-archive', archiveMutation: mutation }, collection.kind);
  }
  if (name === 'remember') {
    const collection = memory.asCollection(input);
    const notebook = memory.describe().notebook;
    const additions = collection.items.filter(
      ({ subject }) => memory.getNotebookEntry(subject) === null,
    ).length;
    if (notebook.entryCount + additions > notebook.capacity) {
      throw new ResearchMemoryError(
        `Research notebook entry capacity ${notebook.capacity} has been reached.`,
      );
    }
    for (const item of collection.items) memory.remember(item.subject, parameters);
    return {
      ...collection,
      context: {
        operation: 'remember',
        input: collection.context,
        notebookMutation: { count: collection.items.length },
      },
    };
  }
  if (name === 'forget') {
    const collection = memory.asCollection(input);
    let count = 0;
    for (const item of collection.items) {
      if (memory.forget(item.subject).removed) count += 1;
    }
    return {
      ...collection,
      context: {
        operation: 'forget',
        input: collection.context,
        notebookMutation: { count },
      },
    };
  }
  const { name: membershipName, ...options } = parameters;
  const collection = memory.asCollection(input);
  return {
    ...memory.rememberMembership(collection, membershipName, options),
    type: 'notebook-membership',
    collection,
  };
}

function resultDescriptor(value) {
  if (isResearchRelation(value)) return { kind: 'relation', resultKind: 'relation' };
  const collection = value?.collection ?? value;
  return {
    kind: collection?.kind,
    itemKind: collection?.itemKind ?? collection?.kind,
    resultKind: value?.type ?? collection?.kind,
  };
}

function normalizeRememberParameters(parameters) {
  if (!isPlainObject(parameters)) throw new ResearchMemoryError('Remember parameters must be an object.');
  const allowed = new Set(['kind', 'labels', 'note', 'judgment', 'strength', 'reason',
    'attribution', 'sourceReferences', 'summary']);
  const unknown = Object.keys(parameters).find((key) => !allowed.has(key));
  if (unknown) throw new ResearchMemoryError(`Unknown remember parameter: ${unknown}.`);
}

function resolveStageInputs(stage, outputs) {
  if (stage.inputs) {
    return Object.fromEntries(
      Object.entries(stage.inputs).map(([name, id]) => [name, outputs.get(id)]),
    );
  }
  return stage.input === undefined ? {} : { input: outputs.get(stage.input) };
}

function emptyHydrationReport(memory, options) {
  const timestamp = new Date().toISOString();
  const requested = {
    filter: { authors: [], kinds: options.kinds },
    relays: options.relays,
  };
  const budget = {
    timeoutMs: options.timeoutMs,
    observationLimit: options.observationLimit,
    distinctEventLimit: options.distinctEventLimit,
    concurrency: options.concurrency,
  };
  const counts = {
    receivedPackets: 0,
    invalid: 0,
    nonMatching: 0,
    acceptedObservations: 0,
    duplicateObservations: 0,
    newlyStoredCorpusEvents: 0,
    distinctEventsAcquired: 0,
  };
  const corpus = memory.describe();
  const result = {
    type: 'hydration-report',
    requested,
    budget,
    startedAt: timestamp,
    finishedAt: timestamp,
    completionReason: 'no-account-subjects',
    acquiredEventIds: [],
    acquiredObservations: [],
    relays: options.relays.map((relay) => ({
      relay,
      contacted: false,
      outcome: 'no-account-subjects',
      receivedPackets: 0,
      invalid: 0,
      nonMatching: 0,
      duplicateObservations: 0,
      newlyStoredCorpusEvents: 0,
      acceptedObservations: 0,
      distinctEventsAcquired: 0,
      diagnostic: 'The input collection contained no account subjects.',
    })),
    counts,
    additions: { added: [], refreshed: [], evicted: [] },
    corpusBefore: corpus,
    corpusAfter: corpus,
  };
  result.collection = memory.collection([], { operation: 'hydration' }, 'events');
  result.coverage = {
    requested,
    budget,
    startedAt: timestamp,
    finishedAt: timestamp,
    completionReason: result.completionReason,
    exhaustive: false,
    uncertainty: 'No relay attempt was made because the input contained no account subjects.',
    relays: cloneJson(result.relays),
    observedEvents: [],
  };
  return result;
}

function normalizeSelectionScope(parameters, hasInput) {
  if (!isPlainObject(parameters)) {
    throw new ResearchMemoryError('Research select parameters must be an object.');
  }
  const { scope, ...query } = parameters;
  if (hasInput) {
    if (scope !== undefined && scope !== 'acquisition') {
      throw new ResearchMemoryError(
        'Research select with an acquisition input must use acquisition scope.',
      );
    }
    return query;
  }
  if (scope !== 'corpus') {
    throw new ResearchMemoryError(
      'Whole-corpus selection requires parameters.scope to be corpus.',
    );
  }
  return query;
}

function resolveScopedPrefixes(prefixes, candidates, label) {
  if (prefixes === undefined) return null;
  const uniqueCandidates = [...new Set(candidates)];
  const resolved = new Set();
  for (const prefix of prefixes) {
    const matches = uniqueCandidates.filter((candidate) => candidate.startsWith(prefix));
    if (matches.length > 1) {
      throw new ResearchMemoryError(
        `Ambiguous ${label} prefix ${prefix}: ${matches.length} scoped values match.`,
      );
    }
    if (matches.length === 1) resolved.add(matches[0]);
  }
  return [...resolved];
}

function scopedSelectionContext(scoped, query) {
  return {
    operation: 'selection',
    scope: 'acquisition',
    sourceOperation: scoped.context.operation,
    query: cloneJson(query),
  };
}

function assertJsonData(value, label) {
  const seen = new Set();
  const visit = (item) => {
    if (item === null || ['string', 'boolean'].includes(typeof item)) return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (typeof item !== 'object') {
      throw new ResearchMemoryError(`${label} must contain only JSON-serializable data.`);
    }
    if (seen.has(item)) {
      throw new ResearchMemoryError(`${label} must not contain circular references.`);
    }
    seen.add(item);
    if (Array.isArray(item)) item.forEach(visit);
    else {
      if (Object.getPrototypeOf(item) !== Object.prototype) {
        throw new ResearchMemoryError(`${label} must contain only plain objects and arrays.`);
      }
      Object.values(item).forEach(visit);
    }
    seen.delete(item);
  };
  visit(value);
}

function rejectUnknownKeys(value, allowed, index) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new ResearchMemoryError(`Unknown research plan stage ${index + 1} field: ${key}.`);
    }
  }
}

function rejectUnknownParameterKeys(stage, allowed) {
  for (const key of Object.keys(stage.parameters)) {
    if (!allowed.has(key)) {
      throw new ResearchMemoryError(
        `Unknown ${stage.operation} parameters field at stage ${stage.id}: ${key}.`,
      );
    }
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
