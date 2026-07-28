import { ResearchMemoryError } from './protocol.js';
import { RESULT_LIMIT } from './contract-facts.js';
import {
  MOVE_ROUTES,
  SUBJECT_COLLECTION_KINDS,
  operationSchema,
  transformOutputKind,
} from './operations.js';
import {
  ACCOUNT_REFERENCE_RELATIONSHIP_TYPES,
  ADDRESS_REFERENCE_RELATIONSHIP_TYPES,
  EVENT_REFERENCE_RELATIONSHIP_TYPES,
} from './protocol-relationships.js';

const MAX_LIMIT = RESULT_LIMIT.maximum;
const DEFAULT_LIMIT = RESULT_LIMIT.default;
const KINDS = new Set(SUBJECT_COLLECTION_KINDS);
const SET_OPERATIONS = new Set(['union', 'intersection', 'difference', 'compare']);

export function validateCollectionOperation(stages, inputKind, itemKind = inputKind) {
  const operations = stageList(stages);
  let kind = inputKind;
  let memberKind = itemKind;
  for (const [index, stage] of operations.entries()) {
    const operation = normalize(stage, kind, index);
    ({ kind, itemKind: memberKind } = transformOutputKind(kind, memberKind, operation));
  }
  return { kind, itemKind: memberKind };
}

/**
 * Collection values are explicit operation inputs. This executor owns their
 * identity algebra; memory only resolves evidence and indexed relationships.
 */
export function executeCollectionOperation(memory, value, stages) {
  const operations = stageList(stages);
  let current = memory.asCollection(value);
  let kind = current.kind;
  const normalized = operations.map((stage, index) => {
    const operation = normalize(stage, kind, index);
    kind = transformOutputKind(kind, kind, operation).kind;
    return operation;
  });
  for (const operation of normalized) current = apply(memory, current, operation);
  return current;
}

export function collectionPipelineSchema() {
  return copy({
    type: 'collection-pipeline-schema',
    version: 2,
    research: operationSchema(),
    statement: 'Collections hold stable identities; relations own value-oriented analysis.',
    operations: {
      filter: {
        inputKinds: [...KINDS],
        fields: ['subject.type', 'subject.id'],
        operators: ['equals', 'in'],
        limit: 'bound',
      },
      pick: {
        inputKinds: [...KINDS],
        positions: `non-empty distinct 1-based integer[] up to ${MAX_LIMIT}`,
      },
      limit: { inputKinds: [...KINDS], limit: 'bound' },
      sample: { inputKinds: [...KINDS], limit: 'bound', seed: 'string' },
      move: { routes: copy(MOVE_ROUTES), limit: 'bound' },
      set: {
        operations: [...SET_OPERATIONS],
        inputKinds: [...KINDS],
        limit: 'union, intersection, and difference only; compare emits one summary row',
      },
      relation: {
        operations: [
          'relate', 'filter', 'project', 'distinct', 'sort', 'join', 'aggregate',
          'derive', 'slice', 'explode', 'scan', 'balance',
        ],
        statement: 'Use relate before field filtering, projection, ordering, or aggregation.',
      },
    },
  });
}

function stageList(stages) {
  const operations = Array.isArray(stages) ? stages : [stages];
  if (operations.length === 0) {
    throw new ResearchMemoryError('A transform requires at least one stage.');
  }
  return operations;
}

function normalize(value, inputKind, index) {
  object(value, `Transform stage ${index + 1}`);
  const operation = value.operation;
  if (!['filter', 'pick', 'limit', 'sample', 'move', ...SET_OPERATIONS].includes(operation)) {
    throw new ResearchMemoryError(`Unsupported transform operation at stage ${index + 1}: ${operation}.`);
  }
  if (value.as !== undefined && (typeof value.as !== 'string' || value.as.trim().length === 0)) {
    throw new ResearchMemoryError(`Transform stage ${index + 1} as must be a non-empty string.`);
  }
  const common = { operation, ...(value.as === undefined ? {} : { as: value.as.trim() }) };
  if (SET_OPERATIONS.has(operation)) {
    keys(
      value,
      operation === 'compare'
        ? ['operation', 'as', 'with']
        : ['operation', 'as', 'with', 'limit'],
      `${operation} stage`,
    );
    requireKind(inputKind, operation);
    if (!value.with || value.with.type !== 'result-collection' || !Array.isArray(value.with.items)) {
      throw new ResearchMemoryError('Expected a result collection.');
    }
    if (value.with.kind !== inputKind) {
      throw new ResearchMemoryError(
        `Incompatible ${operation} collections: ${inputKind} and ${value.with.kind}.`,
      );
    }
    return {
      ...common,
      with: copy(value.with),
      ...(operation === 'compare' ? {} : { limit: bound(value.limit) }),
    };
  }
  if (operation === 'filter') {
    keys(value, ['operation', 'as', 'where', 'limit'], 'filter stage');
    object(value.where, 'Filter predicate');
    keys(value.where, ['field', 'equals', 'in'], 'filter predicate');
    if (!['subject.type', 'subject.id'].includes(value.where.field)) {
      throw new ResearchMemoryError(
        'Collection filter accepts only subject.type or subject.id; use relate for value analysis.',
      );
    }
    const operators = ['equals', 'in'].filter((key) => key in value.where);
    if (operators.length !== 1
        || (operators[0] === 'in' && (!Array.isArray(value.where.in)
          || value.where.in.some((item) => typeof item !== 'string')))
        || (operators[0] === 'equals' && typeof value.where.equals !== 'string')) {
      throw new ResearchMemoryError('Collection identity filter requires one string equals or in predicate.');
    }
    return { ...common, where: copy(value.where), limit: bound(value.limit) };
  }
  if (operation === 'limit' || operation === 'sample') {
    keys(value, ['operation', 'as', 'limit', 'seed'], `${operation} stage`);
    requireKind(inputKind, operation);
    if (operation === 'sample' && value.seed !== undefined
        && (typeof value.seed !== 'string' || value.seed.length === 0)) {
      throw new ResearchMemoryError('Sample seed must be a non-empty string.');
    }
    return {
      ...common,
      limit: bound(value.limit),
      ...(operation === 'sample' ? { seed: value.seed ?? 'nostr-research' } : {}),
    };
  }
  if (operation === 'pick') {
    keys(value, ['operation', 'as', 'positions'], 'pick stage');
    requireKind(inputKind, 'Pick');
    if (!Array.isArray(value.positions) || value.positions.length === 0
        || value.positions.some((position) => (
          !Number.isSafeInteger(position) || position < 1 || position > MAX_LIMIT
        ))) {
      throw new ResearchMemoryError(
        `Pick positions must be a non-empty array of integers from 1 to ${MAX_LIMIT}.`,
      );
    }
    if (new Set(value.positions).size !== value.positions.length) {
      throw new ResearchMemoryError('Pick positions must be distinct.');
    }
    return { ...common, positions: [...value.positions].sort((a, b) => a - b) };
  }
  keys(value, ['operation', 'as', 'to', 'limit'], 'move stage');
  if (!MOVE_ROUTES[`${inputKind}:${value.to}`]) {
    throw new ResearchMemoryError(`Move from ${inputKind} to ${value.to} is not supported.`);
  }
  return { ...common, to: value.to, limit: bound(value.limit) };
}

function apply(memory, collection, operation) {
  let output;
  if (operation.operation === 'filter') {
    const { field, equals, in: choices } = operation.where;
    const items = collection.items.filter(({ subject }) => (
      (field === 'subject.type' ? subject.type : subject.id) === equals
      || choices?.includes(field === 'subject.type' ? subject.type : subject.id)
    )).slice(0, operation.limit);
    const refined = field === 'subject.type' && choices === undefined
      ? {
        event: 'events', account: 'accounts', address: 'addresses', relationship: 'relationships',
      }[equals]
      : undefined;
    output = result(items, refined ?? collection.kind);
  } else if (operation.operation === 'pick') {
    const last = operation.positions.at(-1);
    if (last > collection.items.length) {
      throw new ResearchMemoryError(
        `Pick position ${last} exceeds the input collection count ${collection.items.length}.`,
      );
    }
    output = result(operation.positions.map((position) => collection.items[position - 1]),
      collection.kind);
  } else if (operation.operation === 'limit') {
    output = result(collection.items.slice(0, operation.limit), collection.kind);
  } else if (operation.operation === 'sample') {
    const ranked = collection.items.map((item, index) => ({
      item, index, rank: hash(`${operation.seed}\u0000${itemKey(item)}`),
    })).sort((a, b) => a.rank - b.rank || a.index - b.index);
    output = result(ranked.slice(0, operation.limit).map(({ item }) => item), collection.kind);
  } else if (operation.operation === 'move') {
    output = move(memory, collection, operation);
  } else output = setOperation(collection, operation);
  output.bounds ??= cardinality(collection.items.length, output.items.length);
  output.context = {
    operation: 'transform',
    input: copy(collection.context),
    stages: [
      ...copy(collection.context?.stages ?? []),
      copy('with' in operation ? {
        ...operation,
        with: {
          type: 'collection-reference',
          kind: operation.with.kind,
          count: operation.with.items.length,
        },
      } : operation),
    ],
    ...(operation.as ? { name: operation.as } : {}),
    cardinality: copy(output.bounds),
  };
  return output;
}

function move(memory, collection, operation) {
  const found = new Map();
  const add = (candidate, source, transition) => {
    const key = itemKey(candidate);
    const target = found.get(key) ?? { ...candidate, reasons: [], provenance: [] };
    merge(target.reasons, source.reasons);
    merge(target.reasons, candidate.reasons);
    merge(target.reasons, [{ type: 'collection-move', transition, source: source.subject }]);
    merge(target.provenance, source.provenance);
    merge(target.provenance, candidate.provenance);
    found.set(key, target);
  };
  for (const item of collection.items) {
    if (operation.to === 'authors' && item.record?.event) {
      add(memory.lookup({ type: 'account', id: item.record.event.pubkey }).items[0],
        item, 'event-author');
    } else if (['referencedAccounts', 'referencedEvents', 'referencedAddresses']
      .includes(operation.to)) {
      const target = {
        referencedAccounts: 'account',
        referencedEvents: 'event',
        referencedAddresses: 'address',
      }[operation.to];
      const relationshipTypes = target === 'account'
        ? ACCOUNT_REFERENCE_RELATIONSHIP_TYPES
        : target === 'event'
          ? EVENT_REFERENCE_RELATIONSHIP_TYPES : ADDRESS_REFERENCE_RELATIONSHIP_TYPES;
      const traversed = memory.traverse([item.subject], {
        relationshipTypes, direction: 'outbound', depth: 1, limit: MAX_LIMIT,
      });
      for (const candidate of traversed.items) {
        if (candidate.role !== 'seed' && candidate.subject.type === target) {
          add(candidate, item, `event-${operation.to}`);
        }
      }
    } else if (operation.to === 'currentEvents') {
      const candidate = memory.lookup(item.subject).items[0];
      if (candidate.record?.event) {
        add(memory.lookup({ type: 'event', id: candidate.record.event.id }).items[0],
          item, 'address-current-event');
      }
    } else if (operation.to === 'authoredEvents') {
      for (const candidate of memory.select({
        authors: [item.subject.id], limit: MAX_LIMIT, order: 'oldest',
      }).items) add(candidate, item, 'account-authored-event');
    } else if (operation.to === 'followedAccounts') {
      for (const candidate of memory.follows(item.subject).items) {
        add(candidate, item, 'account-followed-account');
      }
    }
  }
  const discovered = [...found.values()]
    .sort((a, b) => itemKey(a).localeCompare(itemKey(b)));
  const items = discovered.slice(0, operation.limit);
  const output = result(items, MOVE_ROUTES[`${collection.kind}:${operation.to}`]);
  output.bounds = {
    inputCount: collection.items.length,
    discoveredCount: discovered.length,
    outputCount: items.length,
    omittedCount: Math.max(0, discovered.length - items.length),
    truncated: discovered.length > items.length,
  };
  return output;
}

function setOperation(collection, operation) {
  const left = new Map(collection.items.map((item) => [itemKey(item), item]));
  const right = new Map(operation.with.items.map((item) => [itemKey(item), item]));
  const selected = operation.operation === 'union'
    ? [...new Set([...left.keys(), ...right.keys()])]
    : operation.operation === 'intersection'
      ? [...left.keys()].filter((key) => right.has(key))
      : operation.operation === 'difference'
        ? [...left.keys()].filter((key) => !right.has(key)) : [];
  if (operation.operation === 'compare') {
    const shared = [...left.keys()].filter((key) => right.has(key)).length;
    return {
      type: 'typed-collection',
      kind: 'summaries',
      itemKind: 'summaries',
      items: [{
        key: null,
        values: {
          left: left.size, right: right.size, shared,
          leftOnly: left.size - shared, rightOnly: right.size - shared,
        },
        reasons: unique([...left.values(), ...right.values()].flatMap((item) => item.reasons)),
        provenance: unique(
          [...left.values(), ...right.values()].flatMap((item) => item.provenance),
        ),
      }],
      context: {},
      bounds: {
        leftCount: left.size, rightCount: right.size, outputCount: 1,
        omittedCount: 0, truncated: false,
      },
    };
  }
  const items = selected.sort().slice(0, operation.limit).map((key) => {
    const first = left.get(key);
    const second = right.get(key);
    return {
      ...(first ?? second),
      reasons: unique([...(first?.reasons ?? []), ...(second?.reasons ?? [])]),
      provenance: unique([...(first?.provenance ?? []), ...(second?.provenance ?? [])]),
    };
  });
  const output = result(items, collection.kind);
  output.bounds = {
    ...cardinality(selected.length, items.length),
    leftCount: left.size,
    rightCount: right.size,
  };
  return output;
}

function result(items, kind) {
  return {
    type: 'result-collection', kind, itemKind: kind,
    items: copy(items), context: {},
  };
}

function cardinality(inputCount, outputCount) {
  return {
    inputCount, outputCount,
    omittedCount: Math.max(0, inputCount - outputCount),
    truncated: outputCount < inputCount,
  };
}

function merge(target, values = []) {
  const seen = new Set(target.map(stable));
  for (const value of values) {
    const key = stable(value);
    if (!seen.has(key)) {
      target.push(copy(value));
      seen.add(key);
    }
  }
}

function unique(values) {
  const found = new Map(values.map((value) => [stable(value), copy(value)]));
  return [...found.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
}

function bound(value) {
  if (value === undefined) return DEFAULT_LIMIT;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_LIMIT) {
    throw new ResearchMemoryError(`Limit must be an integer from 1 to ${MAX_LIMIT}.`);
  }
  return value;
}

function requireKind(kind, operation) {
  if (!KINDS.has(kind)) throw new ResearchMemoryError(`${operation} requires a subject collection.`);
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ResearchMemoryError(`${label} must be an object.`);
  }
}

function keys(value, allowed, label) {
  const accepted = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !accepted.has(key));
  if (unknown) throw new ResearchMemoryError(`Unknown ${label} field: ${unknown}.`);
}

function itemKey(item) {
  return `${item.subject.type}:${item.subject.id}`;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
}

function copy(value) {
  return structuredClone(value);
}
