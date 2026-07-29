import {
  arrangeCommand,
  arrangeObservation,
  composeCommand,
} from '@nostrarium/schema-composer';

/**
 * A field-centered command loop over one neutral controller.
 *
 * The workbench owns only local attention: which named handle is currently
 * treated as the field and which handles have previously occupied that role.
 * Schema requests and research commands remain visible controller traffic.
 */
export function createFieldWorkbench({ controller } = {}) {
  if (!isController(controller)) {
    throw new TypeError('controller must expose an execute function.');
  }

  let currentId = null;
  let nextAdoption = 0;
  const known = new Map();
  const history = [];

  async function open(input) {
    const id = handleId(input);
    const outcome = await controller.execute({
      command: 'schema',
      input: id,
      parameters: {},
    });
    if (outcome.response.ok === true) {
      adoptHandle(outcome.response.result.handle, 'open');
    }
    return {
      ...outcome,
      field: state(),
    };
  }

  function adopt(source, reason = 'navigator') {
    const handle = handleFact(source);
    adoptHandle(handle, normalizedReason(reason));
    return state();
  }

  function returnTo(input) {
    const id = handleId(input);
    const handle = known.get(id);
    if (handle === undefined) {
      throw new TypeError(`Unknown field handle: ${id}.`);
    }
    adoptHandle(handle, 'return');
    return state();
  }

  async function prepare(operation) {
    if (currentId === null) {
      throw new TypeError('Open or adopt a field before preparing an operation.');
    }
    if (typeof operation !== 'string' || operation.trim().length === 0
        || operation !== operation.trim()) {
      throw new TypeError('operation must be a non-empty trimmed string.');
    }
    const outcome = await controller.execute({
      command: 'schema',
      input: currentId,
      parameters: { operation },
    });
    return {
      ...outcome,
      ...(outcome.response.ok === true
        ? { composition: arrangeCommand(outcome.response) }
        : {}),
      field: state(),
    };
  }

  async function execute(composition, values = {}, options = {}) {
    if (!isPlainObject(options)) {
      throw new TypeError('options must be a plain object.');
    }
    rejectUnknownKeys(options, ['adopt'], 'options');
    const shouldAdopt = options.adopt ?? false;
    if (typeof shouldAdopt !== 'boolean') {
      throw new TypeError('options.adopt must be a boolean.');
    }
    const command = composeCommand(composition, values);
    const outcome = await controller.execute(command);
    if (outcome.response.ok === true && outcome.receipt.handle) {
      const handle = normalizedHandle(outcome.receipt.handle);
      known.set(handle.id, handle);
      if (shouldAdopt) adoptHandle(handle, 'result');
    }
    return {
      command,
      ...outcome,
      field: state(),
    };
  }

  async function observe(parameters = {}) {
    if (currentId === null) {
      throw new TypeError('Open or adopt a field before observing it.');
    }
    if (!isPlainObject(parameters)) {
      throw new TypeError('parameters must be a plain object.');
    }
    const command = structuredClone({
      command: 'show',
      input: currentId,
      parameters,
    });
    const outcome = await controller.execute(command);
    return {
      command,
      ...outcome,
      ...(outcome.response.ok === true
        ? { panels: arrangeObservation(outcome.response) }
        : {}),
      field: state(),
    };
  }

  function state() {
    return structuredClone({
      current: currentId === null ? null : known.get(currentId),
      known: [...known.values()],
      history,
    });
  }

  function adoptHandle(handle, reason) {
    const fact = normalizedHandle(handle);
    known.set(fact.id, fact);
    currentId = fact.id;
    history.push({
      sequence: ++nextAdoption,
      handle: fact,
      reason,
    });
  }

  return Object.freeze({
    open,
    adopt,
    returnTo,
    prepare,
    execute,
    observe,
    state,
  });
}

function handleFact(source) {
  if (isPlainObject(source?.handle)) return source.handle;
  if (isPlainObject(source?.receipt?.handle)) return source.receipt.handle;
  if (isPlainObject(source?.response?.result?.handle)) {
    return source.response.result.handle;
  }
  if (isPlainObject(source) && typeof source.id === 'string') return source;
  throw new TypeError('source must expose an ordinary result handle.');
}

function normalizedHandle(handle) {
  const id = handleId(handle.id);
  if (typeof handle.kind !== 'string' || handle.kind.length === 0) {
    throw new TypeError('handle.kind must be a non-empty string.');
  }
  if (!Number.isSafeInteger(handle.count) || handle.count < 0) {
    throw new TypeError('handle.count must be a non-negative integer.');
  }
  return structuredClone({
    id,
    kind: handle.kind,
    count: handle.count,
    ...(Number.isSafeInteger(handle.revision) ? { revision: handle.revision } : {}),
    ...(typeof handle.scope === 'string' ? { scope: handle.scope } : {}),
  });
}

function handleId(value) {
  const id = typeof value === 'string' ? value : value?.handle?.id;
  if (typeof id !== 'string' || id.trim().length === 0 || id !== id.trim()) {
    throw new TypeError('input must expose a non-empty trimmed handle ID.');
  }
  return id;
}

function normalizedReason(value) {
  if (typeof value !== 'string' || value.trim().length === 0
      || value !== value.trim()) {
    throw new TypeError('reason must be a non-empty trimmed string.');
  }
  return value;
}

function rejectUnknownKeys(value, allowed, label) {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unknown !== undefined) {
    throw new TypeError(`${label} contains unknown field: ${unknown}.`);
  }
}

function isController(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.execute === 'function';
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
