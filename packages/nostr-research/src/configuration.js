import { ResearchMemoryError } from './protocol.js';
import { normalizeRelayUrl } from './relay-url.js';

export const RESEARCH_CONSTRAINTS = deepFreeze({
  memory: {
    capacity: { minimum: 1, maximum: 1000 },
    traversalDepth: { minimum: 1, maximum: 100 },
    archiveExcerptLimit: { minimum: 1, maximum: 2000 },
  },
  results: {
    defaultLimit: 100,
    maximumLimit: 1000,
    defaultQueryLimit: 50,
  },
  presentation: {
    previewLimit: { default: 5, minimum: 1, maximum: 20 },
    excerptLimit: { default: 160, minimum: 1, maximum: 1000 },
    sizeLimit: { default: 12000, minimum: 1000, maximum: 50000 },
  },
  acquisition: {
    timeoutMs: { default: 10000, minimum: 1, maximum: 60000 },
    observationLimit: { default: 100, minimum: 1 },
    distinctEventLimit: { default: 100, minimum: 1 },
    concurrency: { default: 4, minimum: 1, maximum: 10 },
  },
  relayInformation: {
    relayLimit: { maximum: 20 },
    timeoutMs: { default: 10000, minimum: 1, maximum: 60000 },
    concurrency: { default: 4, minimum: 1, maximum: 10 },
    responseByteLimit: { maximum: 65536 },
    stringLength: { maximum: 2000 },
    arrayLength: { maximum: 100 },
    fieldLimit: { maximum: 100 },
    nestingLimit: { maximum: 8 },
  },
  relayCount: {
    relayLimit: { maximum: 20 },
    timeoutMs: { default: 10000, minimum: 1, maximum: 60000 },
    concurrency: { default: 4, minimum: 1, maximum: 10 },
  },
  continuation: {
    eventLimit: { default: 50, minimum: 1, maximum: 1000 },
    offset: { default: 0, minimum: 0, maximum: 1000000 },
    depth: { default: 3, minimum: 1, maximum: 100 },
  },
  scan: {
    terms: { minimum: 1, maximum: 50 },
    termLength: { minimum: 1, maximum: 200 },
  },
  notebook: {
    capacity: { default: 1000, minimum: 1, maximum: 1000 },
    sourceReferences: { maximum: 50 },
    summaryLength: { maximum: 2000 },
  },
  derivedValues: {
    stringLength: { maximum: 280 },
    arrayLength: { maximum: 20 },
  },
});

export const DEFAULT_SESSION_CONFIGURATION = deepFreeze({
  relays: [],
  acquisition: {
    timeoutMs: RESEARCH_CONSTRAINTS.acquisition.timeoutMs.default,
    observationLimit: RESEARCH_CONSTRAINTS.acquisition.observationLimit.default,
    distinctEventLimit: RESEARCH_CONSTRAINTS.acquisition.distinctEventLimit.default,
    concurrency: RESEARCH_CONSTRAINTS.acquisition.concurrency.default,
  },
  presentation: {
    previewLimit: RESEARCH_CONSTRAINTS.presentation.previewLimit.default,
    excerptLimit: RESEARCH_CONSTRAINTS.presentation.excerptLimit.default,
    sizeLimit: RESEARCH_CONSTRAINTS.presentation.sizeLimit.default,
  },
});

export function normalizeSessionConfiguration(value = {}, base = DEFAULT_SESSION_CONFIGURATION) {
  plainObject(value, 'Session configuration');
  rejectUnknown(value, ['relays', 'acquisition', 'presentation'], 'session configuration');
  const next = structuredClone(base);
  if (value.relays !== undefined) next.relays = normalizeRelays(value.relays);
  if (value.acquisition !== undefined) {
    plainObject(value.acquisition, 'Session acquisition configuration');
    rejectUnknown(value.acquisition, [
      'timeoutMs', 'observationLimit', 'distinctEventLimit', 'concurrency',
    ], 'session acquisition configuration');
    for (const name of Object.keys(value.acquisition)) {
      const constraint = RESEARCH_CONSTRAINTS.acquisition[name];
      next.acquisition[name] = constraint.maximum === undefined
        ? atLeast(value.acquisition[name], constraint.minimum, name)
        : bounded(value.acquisition[name], constraint, name);
    }
  }
  if (value.presentation !== undefined) {
    plainObject(value.presentation, 'Session presentation configuration');
    rejectUnknown(value.presentation, [
      'previewLimit', 'excerptLimit', 'sizeLimit',
    ], 'session presentation configuration');
    for (const name of Object.keys(value.presentation)) {
      const constraint = RESEARCH_CONSTRAINTS.presentation[name];
      next.presentation[name] = bounded(value.presentation[name], constraint, name);
    }
  }
  return next;
}

export function operationParametersWithSessionDefaults(operation, parameters, configuration) {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    return structuredClone(parameters);
  }
  const next = structuredClone(parameters);
  const external = ['acquire', 'hydrate', 'fetch', 'relay-info', 'relay-count'].includes(operation)
    || (operation === 'continue' && next.source === 'relays');
  if (!external) return next;
  if (next.relays === undefined && configuration.relays.length) {
    next.relays = structuredClone(configuration.relays);
  }
  if (operation === 'relay-info' || operation === 'relay-count') {
    for (const name of ['timeoutMs', 'concurrency']) {
      if (next[name] === undefined) next[name] = configuration.acquisition[name];
    }
    return next;
  }
  for (const [name, value] of Object.entries(configuration.acquisition)) {
    if (next[name] === undefined) next[name] = value;
  }
  return next;
}

export function presentationParametersWithSessionDefaults(parameters, configuration) {
  return { ...structuredClone(configuration.presentation), ...structuredClone(parameters) };
}

export function researchConstraints() {
  return structuredClone(RESEARCH_CONSTRAINTS);
}

function normalizeRelays(value) {
  if (!Array.isArray(value) || value.some((relay) => typeof relay !== 'string')) {
    throw new ResearchMemoryError('Session relays must be an array of wss:// URLs.');
  }
  const relays = value.map((relay) => normalizeRelayUrl(relay, 'Session relay URL'));
  if (new Set(relays).size !== relays.length) {
    throw new ResearchMemoryError('Session relay URLs must not be repeated.');
  }
  return relays;
}

function bounded(value, constraint, name) {
  if (!Number.isSafeInteger(value)
      || value < constraint.minimum || value > constraint.maximum) {
    throw new ResearchMemoryError(
      `${name} must be an integer from ${constraint.minimum} to ${constraint.maximum}.`,
    );
  }
  return value;
}

function atLeast(value, minimum, name) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new ResearchMemoryError(`${name} must be an integer of at least ${minimum}.`);
  }
  return value;
}

function plainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new ResearchMemoryError(`${label} must be a plain object.`);
  }
}

function rejectUnknown(value, allowed, label) {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new ResearchMemoryError(`Unknown ${label} field: ${unknown}.`);
}

function deepFreeze(value) {
  Object.values(value).forEach((item) => {
    if (item && typeof item === 'object') deepFreeze(item);
  });
  return Object.freeze(value);
}
