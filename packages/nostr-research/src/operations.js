import { RESEARCH_CONSTRAINTS, researchConstraints } from './configuration.js';

const RESULT_LIMIT_CONTRACT =
  `integer from 1 to ${RESEARCH_CONSTRAINTS.results.maximumLimit}`;
const ARCHIVE_EXCERPT_CONTRACT =
  `optional integer from ${RESEARCH_CONSTRAINTS.memory.archiveExcerptLimit.minimum} `
  + `to ${RESEARCH_CONSTRAINTS.memory.archiveExcerptLimit.maximum}`;

/*
 * Authoritative, dependency-free semantics for public research operations.
 *
 * Validation and execution stay with the deep modules that own those
 * behaviours. This registry owns the facts their consumers must agree on:
 * operation membership, input/output collection kinds, locality, transform
 * routes, and continuation relationship kinds.
 */

export const SUBJECT_COLLECTION_KINDS = Object.freeze([
  'subjects', 'events', 'accounts', 'relationships',
]);

export const MOVE_ROUTES = Object.freeze({
  'events:authors': 'accounts',
  'events:referencedAccounts': 'accounts',
  'events:referencedEvents': 'events',
  'accounts:authoredEvents': 'events',
  'accounts:followedAccounts': 'accounts',
});

export const CONTINUATION_RELATIONSHIPS = Object.freeze({
  'authored-notes': { inputKinds: ['accounts'], outputKind: 'events', external: true },
  profiles: { inputKinds: ['accounts'], outputKind: 'events', external: true },
  'follow-lists': { inputKinds: ['accounts'], outputKind: 'events', external: true },
  'followed-accounts': { inputKinds: ['accounts'], outputKind: 'accounts', external: true },
  followers: { inputKinds: ['accounts'], outputKind: 'accounts', external: true },
  replies: { inputKinds: ['events'], outputKind: 'events', external: true },
  ancestors: { inputKinds: ['events'], outputKind: 'events', external: true },
  mentions: { inputKinds: ['events'], outputKind: 'events', external: true },
  quotes: { inputKinds: ['events'], outputKind: 'events', external: true },
  'referenced-events': { inputKinds: ['events'], outputKind: 'events', external: true },
  conversation: { inputKinds: ['events'], outputKind: 'events', external: true },
  'shared-tags': { inputKinds: ['events'], outputKind: 'events', external: true },
  'linked-domains': { inputKinds: ['events'], outputKind: 'events', external: false },
});

const COLLECTION_OPERATIONS = [
  'filter', 'pick', 'limit', 'sample', 'move',
  'union', 'intersection', 'difference', 'compare',
];
const SET_OPERATIONS = ['union', 'intersection', 'difference', 'compare'];
const RELATION_OPERATIONS = [
  'relate', 'filter', 'project', 'distinct', 'sort',
  'join', 'aggregate', 'derive', 'slice', 'explode', 'scan', 'balance',
];

export const RESEARCH_OPERATIONS = Object.freeze({
  acquire: definition('forbidden', 'events', 'acquisition-report', 'external', 'buffer', 'bounded-attempt', 'acquire'),
  select: definition('optional-acquisition', 'events', 'events', 'local', 'none', 'resident-view', 'select'),
  ...Object.fromEntries(COLLECTION_OPERATIONS.map((name) => [name, {
    ...definition('required', undefined, undefined, 'local', 'none', 'bounded-view', 'collection'),
    transform: true,
    set: SET_OPERATIONS.includes(name),
  }])),
  hydrate: definition('accounts', 'events', 'hydration-report', 'external', 'buffer', 'bounded-attempt', 'hydrate'),
  continue: definition('subjects', undefined, 'continuation-report', 'by-source', 'by-source', 'bounded-attempt-or-view', 'continue'),
  'remember-membership': definition('subjects', undefined, 'notebook-membership', 'local', 'notebook', 'complete-input', 'remember-membership'),
  remember: definition('subjects', undefined, 'input', 'local', 'notebook', 'complete-input', 'remember'),
  forget: definition('subjects', undefined, 'input', 'local', 'notebook', 'complete-input', 'forget'),
  notebook: definition('forbidden', 'subjects', 'subjects', 'local', 'none', 'bounded-view', 'notebook'),
  preserve: definition('subjects', undefined, 'input', 'local', 'archive', 'complete-input', 'preserve'),
  archived: definition('forbidden', 'subjects', 'subjects', 'local', 'none', 'bounded-view', 'archived'),
  'release-archive': {
    ...definition('subjects', undefined, 'input', 'local', 'archive', 'complete-input', 'release-archive'),
  },
  relate: relationDefinition('required', 'relate'),
  filter: {
    ...definition('required', undefined, undefined, 'local', 'none', 'bounded-view',
      'collection-or-relation'),
    transform: true,
    relation: true,
  },
  project: relationDefinition('required', 'relation'),
  distinct: relationDefinition('required', 'relation'),
  sort: relationDefinition('required', 'relation'),
  join: relationDefinition('named', 'relation'),
  aggregate: relationDefinition('required', 'relation'),
  derive: relationDefinition('required', 'relation'),
  slice: relationDefinition('required', 'relation'),
  explode: relationDefinition('required', 'relation'),
  scan: relationDefinition('required', 'relation'),
  balance: relationDefinition('required', 'relation'),
  fetch: definition('relation', 'events', 'acquisition-report', 'external', 'buffer', 'bounded-attempt', 'fetch'),
  extract: definition('relation', undefined, undefined, 'local', 'none', 'bounded-view', 'extract'),
});

function definition(input, outputKind, resultKind, locality, mutation, completeness, executor) {
  return Object.freeze({
    input, outputKind, resultKind, locality, mutation, completeness, executor,
    external: locality === 'external' ? true : locality === 'by-source' ? 'by-source' : false,
  });
}

function relationDefinition(input, executor) {
  return {
    ...definition(input, 'relation', 'relation', 'local', 'none', 'bounded-view', executor),
    relation: true,
  };
}

export function researchOperationNames() {
  return Object.keys(RESEARCH_OPERATIONS);
}

export function operationSemantics(name) {
  return RESEARCH_OPERATIONS[name];
}

export function operationResultKind(name, inputKind = undefined) {
  const resultKind = operationSemantics(name)?.resultKind;
  return resultKind === 'input' ? inputKind : resultKind;
}

export function supportsCollectionOperations(descriptor) {
  return SUBJECT_COLLECTION_KINDS.includes(descriptor?.kind)
    && !['acquisition-report', 'hydration-report'].includes(descriptor?.resultKind);
}

export function operationMutation(name, result, parameters = {}) {
  const mutation = operationSemantics(name)?.mutation;
  if (mutation === 'notebook') {
    if (name === 'remember' || name === 'forget') {
      return (result?.context?.notebookMutation?.count ?? 0) > 0;
    }
    return true;
  }
  if (mutation === 'archive') {
    if (name === 'preserve') return (result?.context?.archiveMutation?.count ?? 0) > 0;
    return resultCount(result) > 0;
  }
  if (mutation === 'buffer' || (mutation === 'by-source' && parameters.source === 'relays')) {
    return (result?.counts?.acceptedObservations ?? 0) > 0;
  }
  return false;
}

function resultCount(result) {
  return result?.items?.length ?? result?.collection?.items?.length ?? 0;
}

export function isTransformOperation(name) {
  return RESEARCH_OPERATIONS[name]?.transform === true;
}

export function isSetOperation(name) {
  return RESEARCH_OPERATIONS[name]?.set === true;
}

export function isRelationOperation(name) {
  return RESEARCH_OPERATIONS[name]?.relation === true;
}

export function isExternalOperation(name, parameters = {}) {
  const external = RESEARCH_OPERATIONS[name]?.external;
  return external === true || (external === 'by-source' && parameters.source === 'relays');
}

export function continuationSemantics(relationship) {
  return CONTINUATION_RELATIONSHIPS[relationship];
}

export function continuationOutputKind(relationship) {
  return continuationSemantics(relationship)?.outputKind;
}

export function transformOutputKind(inputKind, itemKind, operation) {
  if (operation.operation === 'filter') {
    const refined = refinedSubjectKind(operation.where);
    if (inputKind === 'subjects' && refined) return { kind: refined, itemKind: refined };
    return { kind: inputKind, itemKind };
  }
  if (operation.operation === 'compare') return { kind: 'summaries', itemKind: 'summaries' };
  if (['pick', 'limit', 'sample', 'union', 'intersection', 'difference']
    .includes(operation.operation)) return { kind: inputKind, itemKind };
  const kind = MOVE_ROUTES[`${inputKind}:${operation.to}`];
  return { kind, itemKind: kind };
}

function refinedSubjectKind(predicate) {
  if (predicate?.field === 'subject.type') {
    const value = predicate.equals
      ?? (Array.isArray(predicate.in) && predicate.in.length === 1 ? predicate.in[0] : undefined);
    return value === 'event' ? 'events' : value === 'account' ? 'accounts' : undefined;
  }
  if (Array.isArray(predicate?.all)) {
    const kinds = [...new Set(predicate.all.map(refinedSubjectKind).filter(Boolean))];
    return kinds.length === 1 ? kinds[0] : undefined;
  }
  if (Array.isArray(predicate?.any)) {
    const kinds = predicate.any.map(refinedSubjectKind);
    return kinds.length > 0 && kinds.every((kind) => kind === kinds[0]) ? kinds[0] : undefined;
  }
  return undefined;
}

export function operationSchema() {
  return {
    constraints: researchConstraints(),
    operations: researchOperationNames(),
    definitions: Object.fromEntries(Object.entries(RESEARCH_OPERATIONS).map(([name, value]) => [
      name,
      {
        input: value.input,
        outputKind: value.outputKind ?? 'from-input-or-parameters',
        resultKind: value.resultKind ?? 'from-input',
        locality: value.locality,
        mutation: value.mutation,
        completeness: value.completeness,
        executor: value.executor,
      },
    ])),
    collectionKinds: [...SUBJECT_COLLECTION_KINDS],
    moveRoutes: { ...MOVE_ROUTES },
    continuations: Object.fromEntries(Object.entries(CONTINUATION_RELATIONSHIPS).map(
      ([name, semantics]) => [name, {
        inputKinds: [...semantics.inputKinds],
        outputKind: semantics.outputKind,
        sources: semantics.external ? ['local', 'relays'] : ['local'],
      }],
    )),
    parameterContracts: {
      filter: {
        collection: 'identity predicates on subject.type or subject.id',
        relation: 'row-value predicate',
        limit: 'non-negative output bound',
      },
      pick: {
        positions: 'non-empty one-based positions from the current stable collection order',
      },
      limit: { limit: RESULT_LIMIT_CONTRACT },
      sample: {
        limit: RESULT_LIMIT_CONTRACT,
        seed: 'optional non-empty deterministic string',
      },
      move: {
        to: 'route accepted for the input collection kind',
        limit: 'non-negative output bound',
      },
      union: {
        with: 'named compatible subject collection',
        limit: RESULT_LIMIT_CONTRACT,
      },
      intersection: {
        with: 'named compatible subject collection',
        limit: RESULT_LIMIT_CONTRACT,
      },
      difference: {
        with: 'named compatible subject collection',
        limit: RESULT_LIMIT_CONTRACT,
      },
      compare: {
        with: 'named compatible subject collection',
        limit: RESULT_LIMIT_CONTRACT,
      },
      relate: {
        transition: 'subject collection to research relation',
      },
      project: {
        fields: 'bounded relation field selections',
      },
      distinct: {
        by: 'non-empty relation-field array',
        limit: RESULT_LIMIT_CONTRACT,
      },
      sort: {
        by: 'non-empty array of field and ascending or descending direction',
      },
      join: {
        on: 'left and right relation fields',
        kind: ['inner', 'left'],
        select: 'right-side field mappings',
        limit: RESULT_LIMIT_CONTRACT,
      },
      aggregate: {
        by: 'bounded relation grouping fields',
        aggregations: 'bounded count, sample, collect, minimum, or maximum values',
      },
      derive: { fields: 'non-empty named expression array' },
      slice: {
        offset: 'non-negative integer',
        limit: RESULT_LIMIT_CONTRACT,
      },
      explode: {
        field: 'array-valued relation field',
        as: 'optional output value field name',
        indexAs: 'optional output index field name',
        limit: RESULT_LIMIT_CONTRACT,
      },
      extract: {
        field: 'relation field containing stable subject IDs',
        subjectType: ['account', 'event'],
        limit: RESULT_LIMIT_CONTRACT,
      },
      acquire: {
        relays: 'non-empty relay URL array',
        filter: 'normalized NIP-01 filter',
        timeoutMs: 'positive integer',
        observationLimit: 'positive operation-wide accepted-observation bound',
        distinctEventLimit: 'positive operation-wide distinct-event bound',
        concurrency: 'positive relay concurrency',
      },
      select: {
        scope: ['corpus'],
        filter: 'local selection fields; no relay access',
      },
      hydrate: {
        relays: 'non-empty relay URL array',
        kinds: 'optional profile/contact-list kind array',
        timeoutMs: 'positive integer',
        observationLimit: 'positive operation-wide accepted-observation bound',
        distinctEventLimit: 'positive operation-wide distinct-event bound',
        concurrency: 'positive relay concurrency',
      },
      continue: {
        relationship: 'one documented continuation relationship',
        source: ['local', 'relays'],
        relays: 'required only for relay source',
        since: 'optional Unix timestamp',
        until: 'optional Unix timestamp',
        offset: 'non-negative result offset',
        eventLimit: 'global result bound; multi-input projections are balanced by input',
        timeoutMs: 'relay source only',
        observationLimit: 'relay source only',
        distinctEventLimit: 'relay source only',
        concurrency: 'relay source only',
      },
      'remember-membership': {
        name: 'required membership name',
        reason: 'optional object with a non-empty type',
        attribution: 'optional non-empty caller attribution',
      },
      remember: {
        kind: 'optional notebook classification',
        labels: 'optional string labels',
        note: 'optional caller note',
        judgment: 'optional caller judgment',
        strength: 'optional judgment strength',
        reason: 'caller-supplied reason',
        attribution: 'caller attribution',
        sourceReferences: 'optional evidence references',
        summary: 'optional caller summary',
      },
      forget: {},
      notebook: {
        labels: 'optional label filter',
        judgments: 'optional judgment filter',
        limit: 'optional result bound',
      },
      preserve: {
        level: ['reference', 'excerpt', 'canonical'],
        reason: 'required object with a non-empty type',
        excerptLimit: ARCHIVE_EXCERPT_CONTRACT,
      },
      archived: {
        level: 'optional preservation level',
        subject: 'optional exact event or account subject',
        limit: 'optional bound',
      },
      'release-archive': {},
      scan: {
        fields: 'non-empty relation-field array',
        terms: '1 to 50 strings',
        match: ['any', 'all'],
        matchMode: ['substring', 'word', 'phrase'],
        caseSensitive: 'boolean',
        limit: 'global emitted-match-row bound',
        resultShape: 'one relation row per matching field and term',
      },
      balance: {
        by: 'non-empty relation-field array',
        limitPer: `${RESULT_LIMIT_CONTRACT} per distinct key`,
        limit: RESULT_LIMIT_CONTRACT,
      },
      fetch: {
        relays: 'non-empty relay URL array',
        filter: 'normalized NIP-01 filter with relation-field bindings',
        bindings: 'relation fields mapped into relay filter fields',
        timeoutMs: 'positive integer',
        observationLimit: 'positive operation-wide accepted-observation bound',
        distinctEventLimit: 'positive operation-wide distinct-event bound',
        concurrency: 'positive relay concurrency',
      },
    },
  };
}

/**
 * Describes every operation applicable to one current handle. This is factual
 * schema, not ranking: callers can use it to construct commands without
 * reading implementation code.
 */
export function contextualResearchOperationSchema({
  descriptor,
  input,
  structure,
  value,
}) {
  const contracts = operationSchema().parameterContracts;
  const operations = {};
  const add = (name, details = {}) => {
    const semantics = operationSemantics(name);
    operations[name] = {
      locality: semantics.locality,
      mutation: semantics.mutation,
      completeness: semantics.completeness,
      parameters: contracts[name] ?? {},
      ...details,
    };
  };

  if (descriptor?.kind === 'relation') {
    contextualRelationOperations(add, input, structure, value);
    return operations;
  }
  if (descriptor?.resultKind === 'acquisition-report') {
    add('select', {
      ready: true,
      reason: 'This handle names one bounded acquisition attempt.',
      example: commandExample('select', input, { kinds: [1], limit: 20 }),
    });
    return operations;
  }
  if (!supportsCollectionOperations(descriptor)) return operations;
  contextualCollectionOperations(add, descriptor.kind, input, structure);
  return operations;
}

function contextualCollectionOperations(add, kind, input, structure) {
  const count = structure?.count ?? 0;
  const subjectTypes = structure?.subjectTypes?.map(({ type }) => type) ?? [];
  const firstType = subjectTypes[0];
  add('filter', {
    ready: firstType !== undefined,
    reason: 'Subject collections support stable identity predicates.',
    usableFields: {
      where: ['subject.type', 'subject.id'],
    },
    ...(firstType === undefined ? {
      remainingChoices: ['Choose an identity predicate.'],
    } : {
      example: commandExample('filter', input, {
        where: { field: 'subject.type', equals: firstType },
        limit: 20,
      }),
    }),
  });
  add('pick', {
    ready: count > 0,
    reason: 'Pick addresses the stable order exposed by a preview.',
    remainingChoices: count > 0 ? [] : ['The collection needs at least one member.'],
    ...(count > 0 ? { example: commandExample('pick', input, { positions: [1] }) } : {}),
  });
  add('limit', {
    ready: true,
    reason: 'Limit takes a bounded prefix of this collection.',
    example: commandExample('limit', input, { limit: 20 }),
  });
  add('sample', {
    ready: true,
    reason: 'Sample takes a deterministic bounded sample.',
    example: commandExample('sample', input, { limit: 20, seed: 'research' }),
  });

  const routes = Object.entries(MOVE_ROUTES).filter(([route]) => route.startsWith(`${kind}:`))
    .map(([route, outputKind]) => ({
      to: route.slice(kind.length + 1),
      outputKind,
    }));
  if (routes.length) {
    add('move', {
      ready: true,
      reason: 'This collection kind has explicit identity transition routes.',
      choices: { to: routes },
      example: commandExample('move', input, { to: routes[0].to, limit: 20 }),
    });
  }

  for (const name of SET_OPERATIONS) {
    add(name, {
      ready: false,
      reason: 'Set operations require another named collection of the same kind.',
      remainingChoices: [`Name another ${kind} handle as parameters.with.`],
    });
  }
  add('relate', {
    ready: true,
    reason: 'Relate crosses stable subjects into value-oriented analysis.',
    example: commandExample('relate', input, {}),
  });

  const continuations = Object.entries(CONTINUATION_RELATIONSHIPS)
    .filter(([, semantics]) => semantics.inputKinds.includes(kind))
    .map(([relationship, semantics]) => ({
      relationship,
      outputKind: semantics.outputKind,
      sources: semantics.external ? ['local', 'relays'] : ['local'],
    }));
  if (continuations.length) {
    add('continue', {
      ready: true,
      reason: 'This subject kind supports explicit protocol relationships.',
      choices: { relationships: continuations },
      example: commandExample('continue', input, {
        relationship: continuations[0].relationship,
        source: 'local',
        eventLimit: 20,
      }),
    });
  }
  if (kind === 'accounts') {
    add('hydrate', {
      ready: false,
      reason: 'Account handles can acquire profile or contact-list evidence.',
      remainingChoices: ['Choose one or more relay URLs.'],
    });
  }

  add('remember-membership', {
    ready: true,
    reason: 'Named membership preserves this stable candidate set with a reason.',
    example: commandExample('remember-membership', input, {
      name: 'candidate-set',
      reason: { type: 'explicit-selection' },
    }),
  });
  add('remember', {
    ready: false,
    reason: 'Notebook entries record attributed researcher judgment.',
    remainingChoices: ['Supply a reason and attribution.'],
  });
  add('forget', {
    ready: true,
    reason: 'Forget removes notebook entries for these subjects.',
    example: commandExample('forget', input, {}),
  });
  add('preserve', {
    ready: false,
    reason: 'Preservation explicitly copies available evidence into the archive.',
    remainingChoices: ['Choose a preservation level and reason.'],
  });
  add('release-archive', {
    ready: true,
    reason: 'Release removes archived evidence for these stable subjects.',
    example: commandExample('release-archive', input, {}),
  });
}

function contextualRelationOperations(add, input, structure, value) {
  const fields = structure?.fields ?? [];
  const names = fields.map(({ name }) => name);
  const fieldsByType = (type) => fields
    .filter(({ types }) => types.includes(type))
    .map(({ name }) => name);
  const stringFields = fieldsByType('string');
  const numberFields = fieldsByType('number');
  const arrayFields = fieldsByType('array');
  const first = names[0];

  const fieldOperation = (name, usableFields, details = {}) => add(name, {
    ready: usableFields.length > 0,
    usableFields,
    ...(usableFields.length === 0 ? {
      remainingChoices: ['No current field satisfies this operation’s useful field shape.'],
    } : {}),
    ...details,
  });

  fieldOperation('filter', names, {
    reason: 'Filter applies predicates to current row values.',
    operators: {
      allFields: ['equals', 'in'],
      stringFields: ['contains'],
      numberFields: ['gte', 'lte'],
    },
    ...(first ? {
      example: commandExample('filter', input, {
        where: { field: first, equals: null },
        limit: 20,
      }),
    } : {}),
  });
  fieldOperation('project', names, {
    reason: 'Project chooses and renames fields present in this relation.',
    ...(first ? {
      example: commandExample('project', input, {
        fields: [{ field: first, name: 'value' }],
        limit: 20,
      }),
    } : {}),
  });
  fieldOperation('distinct', names, {
    reason: 'Distinct keeps one row for each selected field tuple.',
    ...(first ? {
      example: commandExample('distinct', input, { by: [first], limit: 20 }),
    } : {}),
  });
  fieldOperation('sort', names, {
    reason: 'Sort orders rows by fields present in this relation.',
    choices: { direction: ['ascending', 'descending'] },
    ...(first ? {
      example: commandExample('sort', input, {
        by: [{ field: first, direction: 'ascending' }],
      }),
    } : {}),
  });
  add('join', {
    ready: false,
    reason: 'Join combines this relation with another named relation.',
    usableFields: { left: names },
    remainingChoices: [
      'Name a right-hand relation handle.',
      'Choose a right-hand field and selected right-hand output fields.',
    ],
  });
  fieldOperation('aggregate', names, {
    reason: 'Aggregate groups rows and computes bounded derived values.',
    choices: {
      operations: ['count', 'countDistinct', 'collect', 'sample', 'min', 'max', 'sum'],
      numericFields: numberFields,
    },
    ...(first ? {
      example: commandExample('aggregate', input, {
        by: [{ field: first, name: 'group' }],
        aggregations: [{ name: 'count', operation: 'count' }],
        limit: 20,
      }),
    } : {}),
  });
  fieldOperation('derive', names, {
    reason: 'Derive adds fields computed from current row values.',
    remainingChoices: ['Choose output names and declarative expressions.'],
  });
  add('slice', {
    ready: true,
    reason: 'Slice selects an explicit relation window.',
    example: commandExample('slice', input, { offset: 0, limit: 20 }),
  });
  fieldOperation('explode', arrayFields, {
    reason: 'Explode emits one row for each element of an array-valued field.',
    ...(arrayFields[0] ? {
      example: commandExample('explode', input, {
        field: arrayFields[0], as: 'value', limit: 20,
      }),
    } : {}),
  });
  fieldOperation('scan', stringFields, {
    reason: 'Scan mechanically matches caller-supplied terms in selected text fields.',
    remainingChoices: ['Supply one or more search terms.'],
  });
  fieldOperation('balance', names, {
    reason: 'Balance caps rows retained for each selected field tuple.',
    ...(first ? {
      example: commandExample('balance', input, {
        by: [first], limitPer: 2, limit: 20,
      }),
    } : {}),
  });

  const transitions = relationSubjectTransitions(value, structure);
  add('extract', {
    ready: transitions.length > 0,
    reason: 'Extract crosses stable identifier values back into subject collections.',
    recognizedTransitions: transitions,
    remainingChoices: transitions.length
      ? [] : ['Choose a field and assert whether it contains account or event IDs.'],
    ...(transitions[0] ? {
      example: commandExample('extract', input, {
        ...transitions[0], limit: 20,
      }),
    } : {}),
  });
  add('fetch', {
    ready: names.length > 0,
    reason: 'Fetch binds current relation values into one explicit relay request.',
    usableFields: names,
    choices: { bindings: ['ids', 'authors', '#e', '#p', '#t'] },
    remainingChoices: ['Choose relays, a relay filter, and relation-field bindings.'],
  });
}

function commandExample(command, input, parameters) {
  return { command, input, parameters };
}

function relationSubjectTransitions(value, structure = undefined) {
  if (value?.type !== 'research-relation' || !Array.isArray(value.rows)
      || value.rows.length === 0) return [];
  const transitions = [];
  const types = new Set(value.rows.map(({ values }) => values?.['subject.type']));
  if (types.size === 1 && ['event', 'account'].includes([...types][0])
      && value.rows.every(({ values }) => typeof values?.['subject.id'] === 'string')) {
    transitions.push({ field: 'subject.id', subjectType: [...types][0] });
  }
  if (value.rows.every(({ values }) => typeof values?.['event.author'] === 'string')) {
    transitions.push({ field: 'event.author', subjectType: 'account' });
  } else {
    const authorField = structure?.fields?.find(({ name }) => name === 'event.author');
    if (structure && authorField?.rowsWithValue === structure.count
        && authorField.types.includes('string')) {
      transitions.push({ field: 'event.author', subjectType: 'account' });
    }
  }
  return transitions;
}

/**
 * Returns bounded, contextual navigation help derived from the authoritative
 * operation registry. Examples are session envelopes minus caller correlation
 * and result IDs, so callers can supply their own names without rewriting
 * subjects from a preview.
 */
export function discoverResearchOperations(descriptor, input, value = undefined) {
  const kind = descriptor?.kind;
  const collectionCapable = supportsCollectionOperations(descriptor);
  const candidates = [];
  const add = (operation, parameters, purpose, extra = {}) => {
    const semantics = operationSemantics(operation);
    if (!semantics) return;
    candidates.push({
      operation,
      purpose,
      accepts: extra.accepts ?? operationSchema().parameterContracts[operation] ?? {},
      example: {
        command: operation,
        ...(semantics.input === 'named' ? extra : { input }),
        parameters,
      },
    });
  };

  if (descriptor?.resultKind === 'acquisition-report') {
    add('select', { kinds: [1], limit: 20 },
      'Select stable subjects from this bounded acquisition attempt.', {
        accepts: {
          scope: ['acquisition', 'omitted'],
          filter: 'local selection fields applied only to events from this acquisition attempt',
        },
      });
  } else if (collectionCapable) {
    if (kind === 'subjects') {
      add('filter', { where: { field: 'subject.type', equals: 'event' }, limit: 20 },
        'Refine a mixed subject collection by stable identity.');
    }
    add('pick', { positions: [1] },
      'Select members from the current preview page without copying stable IDs.');
    add('relate', {}, 'Cross explicitly from subjects into value analysis.');
    add('remember-membership', {
      name: 'candidate-set', reason: { type: 'explicit-selection' },
    }, 'Preserve named subject membership and its caller-authored reason.');
  } else if (kind === 'relation') {
    const fields = relationFields(value);
    const scalarFields = fields.filter((field) => relationFieldHasScalar(value, field));
    const projected = scalarFields.slice(0, 3);
    if (projected.length) {
      add('project', {
        fields: projected.map((field, index) => ({
          field,
          name: `field${index + 1}`,
        })),
      }, 'Choose a bounded relation shape from fields present in this result.');
    }
    const numericField = fields.find((field) => relationFieldHasType(value, field, 'number'));
    if (numericField) {
      add('sort', {
        by: [{ field: numericField, direction: 'descending' }],
      }, 'Order this relation by a numeric field present in the result.');
    }
    const subjectField = relationSubjectSuggestion(value);
    if (subjectField) {
      add('extract', {
        field: subjectField.field, subjectType: subjectField.subjectType, limit: 20,
      }, 'Extract a known stable-subject field into a pure subject collection.');
    }
    const groupingField = scalarFields[0];
    if (groupingField) {
      add('aggregate', {
        by: [{ field: groupingField, name: 'group' }],
        aggregations: [{ name: 'count', operation: 'count' }],
      }, 'Summarize this relation using a field present in the result.');
    }
    if (candidates.length === 0) {
      add('slice', { offset: 0, limit: 20 }, 'Take an explicit bounded relation window.');
    }
  }

  if (collectionCapable && kind === 'events') {
    add('move', { to: 'authors', limit: 20 },
      'Cross explicitly from event subjects to author subjects.');
  } else if (collectionCapable && kind === 'accounts') {
    add('move', { to: 'authoredEvents', limit: 20 },
      'Cross explicitly from account subjects to resident event subjects.');
  }
  return candidates.slice(0, 4);
}

function relationSubjectSuggestion(value) {
  return relationSubjectTransitions(value)[0] ?? null;
}

function relationFields(value) {
  if (value?.type !== 'research-relation' || !Array.isArray(value.rows)) return [];
  return [...new Set(value.rows.flatMap(({ values }) => Object.keys(values ?? {})))].sort();
}

function relationFieldHasType(value, field, type) {
  return value.rows.some(({ values }) => (
    values?.[field] !== null && values?.[field] !== undefined
    && typeof values[field] === type
  ));
}

function relationFieldHasScalar(value, field) {
  return value.rows.some(({ values }) => {
    const fieldValue = values?.[field];
    return ['string', 'number', 'boolean'].includes(typeof fieldValue);
  });
}
