import {
  acquireRelayEvents,
  hydrateAccounts,
  normalizeAcquisitionOptions,
  normalizeHydrationOptions,
} from './acquire.js';
import { ResearchMemoryError } from './index.js';

const OPERATIONS = new Set([
  'acquire', 'select', 'filter', 'group', 'summarize', 'move', 'hydrate', 'retain',
]);
const LOCAL_TRANSFORMS = new Set(['filter', 'group', 'summarize', 'move']);

/**
 * Executes a linear, JSON-serializable list of named research stages.
 *
 * Results stay available by stage ID for explicit reuse. The runner supplies
 * no judgments, performs no implicit acquisition, and does not activate a
 * session selection.
 */
export async function executeResearchPlan(memory, plan, execution = {}) {
  if (!memory || typeof memory.asCollection !== 'function') {
    throw new ResearchMemoryError('An open research memory is required.');
  }
  const normalized = normalizeResearchPlan(plan);
  preflightResearchPlan(memory, normalized);
  const outputs = new Map();
  const stages = [];

  for (const stage of normalized) {
    const input = stage.input === undefined ? undefined : outputs.get(stage.input);
    const result = await executeResearchOperation(memory, {
      ...stage,
      parameters: execution.signal && ['acquire', 'hydrate'].includes(stage.operation)
        ? { ...stage.parameters, signal: execution.signal }
        : stage.parameters,
    }, input);
    outputs.set(stage.id, result);
    stages.push({
      id: stage.id,
      operation: stage.operation,
      ...(stage.input === undefined ? {} : { input: stage.input }),
      resultKind: planResultKind(stage.operation, result),
      result,
    });
  }

  return {
    type: 'research-plan-report',
    plan: cloneJson(normalized),
    stages,
  };
}

export function preflightResearchPlan(memory, plan) {
  const outputs = new Map();
  for (const stage of plan) {
    const input = stage.input === undefined ? undefined : outputs.get(stage.input);
    if (stage.operation === 'select' && input && input.resultKind !== 'acquisition-report') {
      throw new ResearchMemoryError(
        `Research plan select stage ${stage.id} input must name an acquisition stage.`,
      );
    }
    const output = preflightResearchOperation(memory, stage, input);
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
    rejectUnknownKeys(stage, new Set(['id', 'operation', 'input', 'parameters']), index);
    if (typeof stage.id !== 'string' || stage.id.trim().length === 0) {
      throw new ResearchMemoryError(`Research plan stage ${index + 1} ID must be a non-empty string.`);
    }
    const id = stage.id.trim();
    if (ids.has(id)) throw new ResearchMemoryError(`Duplicate research plan stage ID: ${id}.`);
    if (!OPERATIONS.has(stage.operation)) {
      throw new ResearchMemoryError(
        `Unsupported research plan operation at stage ${id}: ${stage.operation}.`,
      );
    }
    if (!isPlainObject(stage.parameters)) {
      throw new ResearchMemoryError(`Research plan stage ${id} parameters must be an object.`);
    }
    const hasInput = stage.input !== undefined;
    if (stage.operation === 'acquire' && hasInput) {
      throw new ResearchMemoryError(`Research plan acquire stage ${id} must not have an input.`);
    }
    if (hasInput && (typeof stage.input !== 'string' || !ids.has(stage.input))) {
      throw new ResearchMemoryError(
        `Research plan stage ${id} input must name an earlier stage.`,
      );
    }
    if (!hasInput && !['acquire', 'select'].includes(stage.operation)) {
        throw new ResearchMemoryError(
          `Research plan stage ${id} input must name an earlier stage.`,
        );
    }
    if (stage.operation === 'retain') {
      rejectUnknownParameterKeys(stage, new Set(['name', 'options']));
      if (typeof stage.parameters.name !== 'string' || stage.parameters.name.trim().length === 0) {
        throw new ResearchMemoryError(`Research plan retain stage ${id} requires a name.`);
      }
      if (stage.parameters.options !== undefined && !isPlainObject(stage.parameters.options)) {
        throw new ResearchMemoryError(`Research plan retain stage ${id} options must be an object.`);
      }
      if (stage.parameters.options !== undefined) {
        rejectUnknownParameterKeys(
          { ...stage, operation: 'retain options', parameters: stage.parameters.options },
          new Set(['reason']),
        );
        if (stage.parameters.options.reason !== undefined) {
          const reason = stage.parameters.options.reason;
          if (!isPlainObject(reason)
              || typeof reason.type !== 'string'
              || reason.type.trim().length === 0) {
            throw new ResearchMemoryError(
              `Research plan retain stage ${id} reason requires a non-empty type.`,
            );
          }
        }
      }
    }
    ids.add(id);
    return {
      id,
      operation: stage.operation,
      ...(hasInput ? { input: stage.input } : {}),
      parameters: cloneJson(stage.parameters),
    };
  });
}

/**
 * Validates one normalized operation against an input descriptor without
 * performing local mutation or contacting a relay.
 */
export function preflightResearchOperation(memory, operation, input = undefined) {
  const { operation: name, parameters } = operation;
  if (!OPERATIONS.has(name) || !isPlainObject(parameters)) {
    throw new ResearchMemoryError(`Unsupported research operation: ${name}.`);
  }
  if (name === 'acquire') {
    if (input !== undefined) {
      throw new ResearchMemoryError('Research acquire operation must not have an input.');
    }
    normalizeAcquisitionOptions(parameters);
    return {
      kind: 'events', itemKind: 'events', resultKind: 'acquisition-report',
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
      kind: 'events', itemKind: 'events', resultKind: 'events',
      scope: input ? 'acquisition' : 'corpus',
    };
  }
  if (!input) throw new ResearchMemoryError(`Research ${name} operation requires an input.`);
  if (LOCAL_TRANSFORMS.has(name)) {
    const transformed = memory.validateTransform(
      { operation: name, ...parameters }, input.kind, input.itemKind,
    );
    return { ...transformed, resultKind: transformed.kind };
  }
  if (name === 'hydrate') {
    if (input.kind !== 'accounts') {
      throw new ResearchMemoryError('Research hydrate operation requires an accounts collection.');
    }
    normalizeHydrationOptions(parameters);
    return { kind: 'events', itemKind: 'events', resultKind: 'hydration-report' };
  }
  const { name: retainedName, options = {} } = parameters;
  rejectUnknownParameterKeys(
    { id: 'operation', operation: 'retain', parameters },
    new Set(['name', 'options']),
  );
  memory.validateRetention(retainedName, options, input.kind);
  return { ...input, resultKind: 'retained-selection' };
}

/** Executes one preflighted operation through the same path used by plans. */
export async function executeResearchOperation(memory, operation, input = undefined) {
  const { operation: name, parameters } = operation;
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
  if (LOCAL_TRANSFORMS.has(name)) {
    return memory.transform(input, { operation: name, ...parameters });
  }
  if (name === 'hydrate') {
    const normalized = normalizeHydrationOptions(parameters);
    const accounts = memory.asCollection(input).items
      .filter(({ subject }) => subject.type === 'account');
    if (accounts.length === 0) return emptyHydrationReport(memory, normalized);
    return hydrateAccounts(memory, input, parameters);
  }
  const { name: retainedName, options = {} } = parameters;
  return memory.retain(input, retainedName, options);
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
  result.collection = memory.asCollection(result);
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

function planResultKind(operation, result) {
  if (operation === 'acquire') return 'acquisition-report';
  if (operation === 'hydrate') return 'hydration-report';
  if (operation === 'retain') return 'retained-selection';
  return result.kind ?? result.type;
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
