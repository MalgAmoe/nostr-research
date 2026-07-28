import { RESEARCH_CONSTRAINTS } from './configuration.js';

/*
 * Execution-independent public facts shared by runtime normalizers and
 * factual schema projections. The only dependency is the immutable engine
 * constraints. This is intentionally not a validation language:
 * state-dependent and semantic validation remains in the owning modules.
 */

export const RESULT_LIMIT = deepFreeze({
  type: 'integer',
  minimum: 1,
  maximum: RESEARCH_CONSTRAINTS.results.maximumLimit,
  default: RESEARCH_CONSTRAINTS.results.defaultLimit,
});

export const QUERY_LIMIT = deepFreeze({
  type: 'integer',
  minimum: 1,
  maximum: RESEARCH_CONSTRAINTS.results.maximumLimit,
  default: RESEARCH_CONSTRAINTS.results.defaultQueryLimit,
});

export const ACQUISITION = deepFreeze({
  excludeContentWarnings: {
    type: 'boolean',
    default: RESEARCH_CONSTRAINTS.acquisition.excludeContentWarnings.default,
    effect: 'exclude directly self-warned matching events before budgets and ingestion',
  },
  timeoutMs: {
    type: 'integer',
    minimum: RESEARCH_CONSTRAINTS.acquisition.timeoutMs.minimum,
    default: RESEARCH_CONSTRAINTS.acquisition.timeoutMs.default,
  },
  observationLimit: {
    type: 'integer',
    minimum: RESEARCH_CONSTRAINTS.acquisition.observationLimit.minimum,
    default: RESEARCH_CONSTRAINTS.acquisition.observationLimit.default,
    effect: 'operation-wide accepted-observation bound',
  },
  distinctEventLimit: {
    type: 'integer',
    minimum: RESEARCH_CONSTRAINTS.acquisition.distinctEventLimit.minimum,
    default: RESEARCH_CONSTRAINTS.acquisition.distinctEventLimit.default,
    effect: 'operation-wide distinct-event bound',
  },
  concurrency: {
    type: 'integer',
    minimum: RESEARCH_CONSTRAINTS.acquisition.concurrency.minimum,
    default: RESEARCH_CONSTRAINTS.acquisition.concurrency.default,
  },
});

export const RELATION_FIELDS = deepFreeze({
  type: 'field name or non-empty field-name array',
});

export const COLLECTION_PREDICATE = deepFreeze({
  type: 'object',
  required: ['field'],
  fields: ['subject.type', 'subject.id'],
  exactlyOne: {
    equals: 'string',
    in: 'non-empty string array',
  },
});

export const RELATION_PREDICATE = deepFreeze({
  type: 'recursive predicate',
  compositions: {
    all: 'non-empty predicate array',
    any: 'non-empty predicate array',
    not: 'predicate',
  },
  leaf: {
    required: ['field'],
    exactlyOne: {
      equals: 'JSON value',
      in: 'non-empty JSON-value array',
      contains: 'string',
      gte: 'number',
      lte: 'number',
    },
  },
});

export const FIELD_MAPPINGS = deepFreeze({
  type: 'array',
  items: [
    'field name',
    { field: 'source field name', name: 'output field name' },
  ],
});

export const AGGREGATIONS = deepFreeze({
  type: 'non-empty array',
  item: {
    required: ['name', 'operation'],
    operation: ['count', 'countDistinct', 'collect', 'sample', 'min', 'max', 'sum'],
    field: 'required except for count',
    limit: {
      applicableTo: ['collect', 'sample'],
      ...RESULT_LIMIT,
    },
  },
});

export const DERIVE_EXPRESSIONS = deepFreeze({
  type: 'recursive expression',
  variants: [
    { constant: 'JSON value' },
    { field: 'field name' },
    {
      operation: ['add', 'subtract', 'multiply', 'divide', 'coalesce'],
      args: 'non-empty expression array',
    },
  ],
});

export const SCAN = deepFreeze({
  terms: {
    type: 'string array',
    minimumItems: RESEARCH_CONSTRAINTS.scan.terms.minimum,
    maximumItems: RESEARCH_CONSTRAINTS.scan.terms.maximum,
    minimumLength: RESEARCH_CONSTRAINTS.scan.termLength.minimum,
    maximumLength: RESEARCH_CONSTRAINTS.scan.termLength.maximum,
  },
  match: { values: ['any', 'all'], default: 'any' },
  matchMode: { values: ['substring', 'word', 'phrase'], default: 'substring' },
  caseSensitive: { type: 'boolean', default: false },
  resultShape: 'one relation row per matching field and term',
});

export const CONTINUATION = deepFreeze({
  source: { values: ['local', 'relays'], default: 'local' },
  offset: {
    type: 'integer',
    minimum: RESEARCH_CONSTRAINTS.continuation.offset.minimum,
    maximum: RESEARCH_CONSTRAINTS.continuation.offset.maximum,
    default: RESEARCH_CONSTRAINTS.continuation.offset.default,
  },
  eventLimit: {
    type: 'integer',
    minimum: RESEARCH_CONSTRAINTS.continuation.eventLimit.minimum,
    maximum: RESEARCH_CONSTRAINTS.continuation.eventLimit.maximum,
    default: RESEARCH_CONSTRAINTS.continuation.eventLimit.default,
  },
  depth: {
    type: 'integer',
    minimum: RESEARCH_CONSTRAINTS.continuation.depth.minimum,
    maximum: RESEARCH_CONSTRAINTS.continuation.depth.maximum,
    default: RESEARCH_CONSTRAINTS.continuation.depth.default,
  },
});

export const FETCH_BINDING_KEYS = Object.freeze(['ids', 'authors', '#e', '#p', '#t']);
export const NOTEBOOK_JUDGMENTS = Object.freeze([
  'interested', 'uninterested', 'uncertain', 'anchor',
]);

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}
