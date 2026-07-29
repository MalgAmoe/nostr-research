import {
  acquireRelayEvents,
  normalizeAcquisitionOptions,
} from './acquire.js';
import { FETCH_BINDING_KEYS, RESULT_LIMIT } from './contract-facts.js';
import { ResearchMemoryError, subject } from './protocol.js';
import {
  isResearchRelation,
  requireAvailableRelationFields,
  resolveRelationForPresentation,
} from './relation.js';

const FETCH_KEYS = new Set([
  'relays', 'filter', 'bindings', 'timeoutMs', 'observationLimit',
  'distinctEventLimit', 'concurrency', 'excludeContentWarnings', 'signal',
]);
const EXTRACT_KEYS = new Set(['field', 'subjectType', 'limit']);
const BINDABLE_FILTERS = new Set(FETCH_BINDING_KEYS);

export function validatePipelineFetch(parameters, input) {
  relationInput(input, 'fetch');
  plainObject(parameters, 'fetch parameters');
  rejectUnknown(parameters, FETCH_KEYS, 'fetch');
  plainObject(parameters.filter, 'fetch filter');
  plainObject(parameters.bindings, 'fetch bindings');
  if (Object.keys(parameters.bindings).length === 0) {
    throw new ResearchMemoryError('fetch bindings must not be empty.');
  }
  for (const [filterField, relationField] of Object.entries(parameters.bindings)) {
    if (!BINDABLE_FILTERS.has(filterField)) {
      throw new ResearchMemoryError(`Unsupported fetch binding: ${filterField}.`);
    }
    field(relationField, `fetch ${filterField} relation field`);
  }
  const placeholder = Object.fromEntries(Object.keys(parameters.bindings).map((name) => [
    name, [name === 'authors' || name === 'ids' || name === '#e' || name === '#p'
      ? '0'.repeat(64) : 'placeholder'],
  ]));
  normalizeAcquisitionOptions({
    ...without(parameters, ['bindings']),
    filter: { ...parameters.filter, ...placeholder },
  });
  return {
    kind: 'events', itemKind: 'events', resultKind: 'acquisition-report',
    scope: 'pipeline-fetch',
  };
}

export async function executePipelineFetch(memory, parameters, input) {
  validatePipelineFetch(parameters, { kind: 'relation' });
  if (!isResearchRelation(input)) throw new ResearchMemoryError('fetch requires a research relation.');
  const resolvedInput = resolveRelationForPresentation(memory, input);
  const bindings = Object.fromEntries(Object.entries(parameters.bindings).map(
    ([filterField, relationField]) => [
      filterField,
      unique(resolvedInput.rows.flatMap((row) => {
        const value = row.values[relationField];
        return Array.isArray(value) ? value : value == null ? [] : [value];
      })),
    ],
  ));
  const empty = Object.entries(bindings).filter(([, values]) => values.length === 0)
    .map(([name]) => name);
  if (empty.length) {
    throw new ResearchMemoryError(
      `fetch could not resolve values for bindings: ${empty.join(', ')}.`,
      'UNRESOLVED_EVIDENCE',
    );
  }
  const result = await acquireRelayEvents(memory, {
    ...without(parameters, ['bindings']),
    filter: { ...parameters.filter, ...bindings },
  });
  result.inputResolution = {
    rowCount: resolvedInput.rows.length,
    bindings: Object.fromEntries(Object.entries(bindings).map(([name, values]) => [
      name, { count: values.length },
    ])),
  };
  return result;
}

export function validatePipelineExtract(parameters, input) {
  relationInput(input, 'extract');
  plainObject(parameters, 'extract parameters');
  rejectUnknown(parameters, EXTRACT_KEYS, 'extract');
  field(parameters.field, 'extract field');
  if (!['account', 'event', 'address'].includes(parameters.subjectType)) {
    throw new ResearchMemoryError('extract subjectType must be account, event, or address.');
  }
  resultLimit(parameters.limit);
  return {
    kind: parameters.subjectType === 'account' ? 'accounts'
      : parameters.subjectType === 'address' ? 'addresses' : 'events',
    itemKind: parameters.subjectType === 'account' ? 'accounts'
      : parameters.subjectType === 'address' ? 'addresses' : 'events',
    resultKind: parameters.subjectType === 'account' ? 'accounts'
      : parameters.subjectType === 'address' ? 'addresses' : 'events',
  };
}

export function executePipelineExtract(memory, parameters, input) {
  validatePipelineExtract(parameters, { kind: 'relation' });
  if (!isResearchRelation(input)) throw new ResearchMemoryError('extract requires a research relation.');
  const knownSubjectType = input.fieldDefinitions?.[parameters.field]?.subjectType;
  if (knownSubjectType !== undefined && knownSubjectType !== parameters.subjectType) {
    throw new ResearchMemoryError(
      `extract field ${parameters.field} has known ${knownSubjectType} subject lineage `
      + `and cannot be extracted as ${parameters.subjectType}.`,
      'TYPE_MISMATCH',
    );
  }
  const resolvedInput = resolveRelationForPresentation(memory, input);
  requireAvailableRelationFields(resolvedInput, [parameters.field], 'extract');
  const limit = resultLimit(parameters.limit);
  const extracted = new Map();
  let absentRows = 0;
  let invalidValues = 0;
  let duplicateValues = 0;
  for (const row of resolvedInput.rows) {
    const raw = row.values[parameters.field];
    const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    if (values.length === 0) absentRows += 1;
    for (const value of values) {
      let extractedSubject;
      try {
        extractedSubject = subject(parameters.subjectType, value);
      } catch {
        invalidValues += 1;
        continue;
      }
      const key = `${extractedSubject.type}:${extractedSubject.id}`;
      const reason = { type: 'relation-extraction', field: parameters.field };
      const existing = extracted.get(key);
      if (existing) {
        duplicateValues += 1;
        existing.reasons.push(...row.reasons, reason);
        existing.provenance.push(...row.provenance);
      } else {
        extracted.set(key, {
          subject: extractedSubject,
          reasons: [...row.reasons, reason],
          provenance: [...row.provenance],
        });
      }
    }
  }
  const items = [...extracted.values()];
  return memory.collection(items.slice(0, limit), {
    operation: 'extract',
    field: parameters.field,
    subjectType: parameters.subjectType,
    rowCount: resolvedInput.rows.length,
    absentRows,
    invalidValues,
    duplicateValues,
    distinctSubjects: items.length,
    retainedSubjects: Math.min(items.length, limit),
    omittedByLimit: Math.max(0, items.length - limit),
  }, parameters.subjectType === 'account' ? 'accounts'
    : parameters.subjectType === 'address' ? 'addresses' : 'events');
}

function relationInput(input, operation) {
  if (input?.kind !== 'relation') {
    throw new ResearchMemoryError(`${operation} requires a research relation input.`);
  }
}

function without(value, keys) {
  return Object.fromEntries(Object.entries(value).filter(([name]) => !keys.includes(name)));
}

function rejectUnknown(value, allowed, label) {
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) throw new ResearchMemoryError(`Unknown ${label} parameter: ${unknown}.`);
}

function plainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new ResearchMemoryError(`${label} must be a plain object.`);
  }
}

function field(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
    throw new ResearchMemoryError(`${label} must be a non-empty trimmed string.`);
  }
}

function unique(values) {
  return [...new Set(values)];
}

function resultLimit(value) {
  const limit = value ?? RESULT_LIMIT.default;
  if (!Number.isSafeInteger(limit) || limit < 1
      || limit > RESULT_LIMIT.maximum) {
    throw new ResearchMemoryError(
      `extract limit must be an integer from 1 to `
      + `${RESULT_LIMIT.maximum}.`,
    );
  }
  return limit;
}
