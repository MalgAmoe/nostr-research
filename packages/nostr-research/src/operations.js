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

const TRANSFORMS = [
  'filter', 'pick', 'project', 'distinct', 'sort', 'limit', 'sample', 'group', 'summarize', 'move',
  'union', 'intersection', 'difference', 'compare',
];
const SET_OPERATIONS = ['union', 'intersection', 'difference', 'compare'];
const RELATION_OPERATIONS = [
  'relate', 'join', 'aggregate', 'derive', 'slice', 'explode', 'scan', 'balance',
];

export const RESEARCH_OPERATIONS = Object.freeze({
  acquire: { input: 'forbidden', outputKind: 'events', resultKind: 'acquisition-report', external: true },
  select: { input: 'optional-acquisition', outputKind: 'events', resultKind: 'events', external: false },
  ...Object.fromEntries(TRANSFORMS.map((name) => [name, {
    input: 'required', transform: true, set: SET_OPERATIONS.includes(name), external: false,
  }])),
  hydrate: { input: 'accounts', outputKind: 'events', resultKind: 'hydration-report', external: true },
  continue: { input: 'subjects', resultKind: 'continuation-report', external: 'by-source' },
  retain: { input: 'subjects', resultKind: 'retained-selection', external: false },
  relate: { input: 'required', outputKind: 'relation', resultKind: 'relation', relation: true, external: false },
  join: { input: 'named', outputKind: 'relation', resultKind: 'relation', relation: true, external: false },
  aggregate: { input: 'required', outputKind: 'relation', resultKind: 'relation', relation: true, external: false },
  derive: { input: 'required', outputKind: 'relation', resultKind: 'relation', relation: true, external: false },
  slice: { input: 'required', outputKind: 'relation', resultKind: 'relation', relation: true, external: false },
  explode: { input: 'required', outputKind: 'relation', resultKind: 'relation', relation: true, external: false },
  scan: { input: 'required', outputKind: 'relation', resultKind: 'relation', relation: true, external: false },
  balance: { input: 'required', outputKind: 'relation', resultKind: 'relation', relation: true, external: false },
  fetch: { input: 'relation', outputKind: 'events', resultKind: 'acquisition-report', external: true },
  expand: { input: 'relation', resultKind: 'continuation-report', external: 'by-source' },
});

export function researchOperationNames() {
  return Object.keys(RESEARCH_OPERATIONS);
}

export function operationSemantics(name) {
  return RESEARCH_OPERATIONS[name];
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
  if (['project', 'distinct'].includes(operation.operation)) {
    return { kind: 'projections', itemKind };
  }
  if (operation.operation === 'compare') return { kind: 'summaries', itemKind: 'summaries' };
  if (['pick', 'sort', 'limit', 'sample', 'union', 'intersection', 'difference']
    .includes(operation.operation)) return { kind: inputKind, itemKind };
  if (operation.operation === 'group') return { kind: 'groups', itemKind };
  if (operation.operation === 'summarize') return { kind: 'summaries', itemKind: 'summaries' };
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
    collectionKinds: [...SUBJECT_COLLECTION_KINDS],
    moveRoutes: { ...MOVE_ROUTES },
    continuations: Object.fromEntries(Object.entries(CONTINUATION_RELATIONSHIPS).map(
      ([name, semantics]) => [name, {
        inputKinds: [...semantics.inputKinds],
        outputKind: semantics.outputKind,
        sources: semantics.external ? ['local', 'relays'] : ['local'],
      }],
    )),
  };
}
