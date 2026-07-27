import {
  acquireRelayEvents,
  normalizeAcquisitionOptions,
} from './acquire.js';
import { continueResearch, normalizeContinuation } from './continuation.js';
import { ResearchMemoryError } from './index.js';
import { isResearchRelation, resolveRelationForPresentation } from './relation.js';

const FETCH_KEYS = new Set([
  'relays', 'filter', 'bindings', 'timeoutMs', 'observationLimit',
  'distinctEventLimit', 'concurrency', 'signal',
]);
const EXPAND_KEYS = new Set([
  'relationship', 'field', 'subjectType', 'source', 'relays', 'since', 'until',
  'offset', 'eventLimit', 'depth', 'timeoutMs', 'observationLimit',
  'distinctEventLimit', 'concurrency', 'signal',
]);
const BINDABLE_FILTERS = new Set(['ids', 'authors', '#e', '#p', '#t']);

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

export function validatePipelineExpand(memory, parameters, input) {
  relationInput(input, 'expand');
  plainObject(parameters, 'expand parameters');
  rejectUnknown(parameters, EXPAND_KEYS, 'expand');
  field(parameters.field, 'expand field');
  if (!['account', 'event'].includes(parameters.subjectType)) {
    throw new ResearchMemoryError('expand subjectType must be account or event.');
  }
  normalizeContinuation(memory, memory.collection([], {}, parameters.subjectType === 'account'
    ? 'accounts' : 'events'), without(parameters, ['field', 'subjectType']));
  return {
    kind: continuationKind(parameters.relationship),
    itemKind: continuationKind(parameters.relationship),
    resultKind: 'continuation-report',
  };
}

export async function executePipelineExpand(memory, parameters, input) {
  if (!isResearchRelation(input)) throw new ResearchMemoryError('expand requires a research relation.');
  const resolvedInput = resolveRelationForPresentation(memory, input);
  const ids = unique(resolvedInput.rows.flatMap((row) => {
    const value = row.values[parameters.field];
    return Array.isArray(value) ? value : value == null ? [] : [value];
  }));
  const starts = memory.collection(ids.map((id) => ({
    subject: { type: parameters.subjectType, id },
    reasons: [{ type: 'relation-expansion-input', field: parameters.field }],
    provenance: [],
  })), { operation: 'relation-expansion-input' },
  parameters.subjectType === 'account' ? 'accounts' : 'events');
  const result = await continueResearch(memory, starts, without(
    parameters, ['field', 'subjectType'],
  ));
  result.inputResolution = {
    rowCount: resolvedInput.rows.length,
    distinctSubjects: ids.length,
    field: parameters.field,
  };
  return result;
}

function continuationKind(relationship) {
  return ['followed-accounts', 'followers'].includes(relationship) ? 'accounts'
    : relationship === 'expansion' ? 'subjects' : 'events';
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
