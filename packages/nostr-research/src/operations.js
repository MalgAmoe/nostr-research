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
  expansion: { inputKinds: ['subjects', 'events', 'accounts'], outputKind: 'subjects', external: true },
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
  expand: definition('relation', undefined, 'continuation-report', 'by-source', 'by-source', 'bounded-attempt-or-view', 'expand'),
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

export function operationMutation(name, result, parameters = {}) {
  const mutation = operationSemantics(name)?.mutation;
  if (mutation === 'notebook') return true;
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
      preserve: {
        level: ['reference', 'excerpt', 'canonical'],
        reason: 'required object with a non-empty type',
        excerptLimit: 'optional integer from 1 to 2000',
      },
      archived: {
        levels: 'optional preservation-level array',
        subjectTypes: 'optional subject-type array',
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
    },
  };
}
