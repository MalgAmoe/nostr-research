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
        where: 'predicate object; collections accept subject.type or subject.id, relations accept row fields',
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
      relate: {},
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
        scope: '"corpus" without an input; omitted or "acquisition" with an acquisition input',
        ids: 'optional event ID prefix or prefix array',
        authors: 'optional author public-key prefix or prefix array',
        kinds: 'optional non-negative kind or kind array',
        since: 'optional non-negative Unix timestamp',
        until: 'optional non-negative Unix timestamp',
        tags: 'optional single-letter tag constraints',
        text: 'optional text term or term array',
        limit: RESULT_LIMIT_CONTRACT,
        order: ['newest', 'oldest'],
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
  structure,
  value,
  configuration,
}) {
  const operations = {};
  const add = (name, details = {}) => {
    const semantics = operationSemantics(name);
    operations[name] = {
      locality: semantics.locality,
      mutation: semantics.mutation,
      completeness: semantics.completeness,
      ...details,
    };
  };

  if (descriptor?.kind === 'relation') {
    contextualRelationOperations(add, structure, value, configuration);
    return operations;
  }
  if (descriptor?.resultKind === 'acquisition-report') {
    add('select', {
      reason: 'This handle names one bounded acquisition attempt.',
    });
    return operations;
  }
  if (!supportsCollectionOperations(descriptor)) return operations;
  contextualCollectionOperations(add, descriptor.kind, structure, configuration);
  return operations;
}

function contextualCollectionOperations(add, kind, structure, configuration) {
  const count = structure?.count ?? 0;
  add('filter', {
    reason: 'Subject collections support stable identity predicates.',
    usableFields: {
      where: ['subject.type', 'subject.id'],
    },
    remainingChoices: ['Choose an identity predicate.'],
  });
  add('pick', {
    reason: 'Pick addresses the stable order exposed by a preview.',
    remainingChoices: count > 0
      ? ['Choose one or more positions from the current preview.']
      : ['The collection needs at least one member.'],
  });
  add('limit', {
    reason: 'Limit takes a bounded prefix of this collection.',
    remainingChoices: ['Choose the output bound.'],
  });
  add('sample', {
    reason: 'Sample takes a deterministic bounded sample.',
    remainingChoices: ['Choose the sample bound.'],
  });

  const routes = Object.entries(MOVE_ROUTES).filter(([route]) => route.startsWith(`${kind}:`))
    .map(([route, outputKind]) => ({
      to: route.slice(kind.length + 1),
      outputKind,
    }));
  if (routes.length) {
    add('move', {
      reason: 'This collection kind has explicit identity transition routes.',
      choices: { to: routes },
      remainingChoices: ['Choose one transition route.'],
    });
  }

  for (const name of SET_OPERATIONS) {
    add(name, {
      reason: 'Set operations require another named collection of the same kind.',
      remainingChoices: [`Name another ${kind} handle as parameters.with.`],
    });
  }
  add('relate', {
    reason: 'Relate crosses stable subjects into value-oriented analysis.',
  });

  const continuations = Object.entries(CONTINUATION_RELATIONSHIPS)
    .filter(([, semantics]) => semantics.inputKinds.includes(kind))
    .map(([relationship, semantics]) => ({
      relationship,
      outputKind: semantics.outputKind,
      sources: semantics.external ? ['local', 'relays'] : ['local'],
    }));
  if (continuations.length) {
    const defaults = externalDefaults(configuration);
    add('continue', {
      reason: 'This subject kind supports explicit protocol relationships.',
      choices: { relationships: continuations },
      remainingChoices: ['Choose a relationship and source.'],
      ...(defaults ? { relaySourceDefaults: defaults } : {}),
    });
  }
  if (kind === 'accounts') {
    const defaults = externalDefaults(configuration);
    const hasRelays = defaults?.relays.length > 0;
    add('hydrate', {
      reason: 'Account handles can acquire profile or contact-list evidence.',
      choices: { kinds: [0, 3] },
      ...(defaults ? { effectiveDefaults: { ...defaults, kinds: [0] } } : {}),
      remainingChoices: hasRelays ? [] : ['Configure or supply one or more relay URLs.'],
    });
  }

  add('remember-membership', {
    reason: 'Named membership preserves this stable candidate set with a reason.',
    remainingChoices: ['Supply a membership name and optional reason.'],
  });
  add('remember', {
    reason: 'Notebook entries record attributed researcher judgment.',
    remainingChoices: ['Supply a reason and attribution.'],
  });
  add('forget', {
    reason: 'Forget removes notebook entries for these subjects.',
  });
  add('preserve', {
    reason: 'Preservation explicitly copies available evidence into the archive.',
    remainingChoices: ['Choose a preservation level and reason.'],
  });
  add('release-archive', {
    reason: 'Release removes archived evidence for these stable subjects.',
  });
}

function contextualRelationOperations(add, structure, value, configuration) {
  const fields = structure?.fields ?? [];
  const names = fields.map(({ name }) => name);
  const populated = fields.filter(({ rowsWithValue }) => rowsWithValue > 0);
  const fieldsByType = (type) => fields
    .filter(({ rowsWithValue, types }) => rowsWithValue > 0 && types.includes(type));
  const stringFields = fieldsByType('string');
  const numberFields = fieldsByType('number');
  const arrayFields = fieldsByType('array');

  const fieldOperation = (name, populatedFields, details = {}) => {
    const { remainingChoices, ...rest } = details;
    add(name, {
      availableFields: names,
      populatedFields,
      ...rest,
      remainingChoices: populatedFields.length === 0
        ? ['No current field satisfies this operation’s useful field shape.']
        : remainingChoices,
    });
  };

  fieldOperation('filter', populated, {
    reason: 'Filter applies predicates to current row values.',
    operators: {
      allFields: ['equals', 'in'],
      stringFields: stringFields.map(({ name }) => name),
      numberFields: numberFields.map(({ name }) => name),
    },
    remainingChoices: ['Choose a field, predicate, and comparison value.'],
  });
  fieldOperation('project', populated, {
    reason: 'Project chooses and renames fields present in this relation.',
    remainingChoices: ['Choose fields and output names.'],
  });
  fieldOperation('distinct', populated, {
    reason: 'Distinct keeps one row for each selected field tuple.',
    remainingChoices: ['Choose one or more fields.'],
  });
  fieldOperation('sort', populated, {
    reason: 'Sort orders rows by fields present in this relation.',
    choices: { direction: ['ascending', 'descending'] },
    remainingChoices: ['Choose fields and directions.'],
  });
  add('join', {
    reason: 'Join combines this relation with another named relation.',
    availableFields: { left: names },
    populatedFields: { left: populated },
    remainingChoices: [
      'Name a right-hand relation handle.',
      'Choose a right-hand field and selected right-hand output fields.',
    ],
  });
  fieldOperation('aggregate', populated, {
    reason: 'Aggregate groups rows and computes bounded derived values.',
    choices: {
      operations: ['count', 'countDistinct', 'collect', 'sample', 'min', 'max', 'sum'],
      numericFields: numberFields.map(({ name }) => name),
    },
    remainingChoices: ['Choose grouping fields and aggregations.'],
  });
  fieldOperation('derive', populated, {
    reason: 'Derive adds fields computed from current row values.',
    remainingChoices: ['Choose output names and declarative expressions.'],
  });
  add('slice', {
    reason: 'Slice selects an explicit relation window.',
    remainingChoices: ['Choose an offset and limit.'],
  });
  fieldOperation('explode', arrayFields, {
    reason: 'Explode emits one row for each element of an array-valued field.',
    remainingChoices: ['Choose an array-valued field and output name.'],
  });
  fieldOperation('scan', stringFields, {
    reason: 'Scan mechanically matches caller-supplied terms in selected text fields.',
    remainingChoices: ['Choose populated text fields and supply one or more search terms.'],
  });
  fieldOperation('balance', populated, {
    reason: 'Balance caps rows retained for each selected field tuple.',
    remainingChoices: ['Choose grouping fields and per-group bounds.'],
  });

  const transitions = relationSubjectTransitions(value, structure);
  add('extract', {
    reason: 'Extract crosses stable identifier values back into subject collections.',
    recognizedTransitions: transitions,
    remainingChoices: transitions.length
      ? [] : ['Choose a field and assert whether it contains account or event IDs.'],
  });
  const defaults = externalDefaults(configuration);
  const hasRelays = defaults?.relays.length > 0;
  add('fetch', {
    reason: 'Fetch binds current relation values into one explicit relay request.',
    availableFields: {
      all: names,
      strings: stringFields.map(({ name }) => name),
      arrays: arrayFields.map(({ name }) => name),
    },
    populatedFields: [...stringFields, ...arrayFields],
    choices: { bindings: ['ids', 'authors', '#e', '#p', '#t'] },
    ...(defaults ? { effectiveDefaults: defaults } : {}),
    remainingChoices: [
      ...(!hasRelays ? ['Configure or supply one or more relay URLs.'] : []),
      'Supply a relay filter and relation-field bindings.',
    ],
  });
}

function externalDefaults(configuration) {
  if (!configuration) return null;
  return {
    relays: [...configuration.relays],
    ...configuration.acquisition,
  };
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
