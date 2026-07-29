import { arrangeObservation } from '@nostrarium/schema-composer';

const SET_OPERATIONS = new Set(['intersection', 'difference', 'compare']);

/**
 * A caller-side interpretation of field contact.
 *
 * Every action below emits exactly one ordinary controller command. The
 * returned draft keeps that command visible beside its outcome.
 */
export function createFieldSystem({ controller } = {}) {
  if (!isController(controller)) {
    throw new TypeError('controller must expose an execute function.');
  }

  function execute(draft) {
    const command = cloneDraft(draft);
    return controller.execute(command).then((outcome) => ({
      command,
      ...outcome,
    }));
  }

  function configure(parameters) {
    return execute({
      command: 'configure',
      parameters: cloneObject(parameters, 'parameters'),
    });
  }

  function acquire({ resultId, replace, ...parameters } = {}) {
    return execute({
      command: 'acquire',
      parameters: cloneObject(parameters, 'acquire options'),
      ...resultTarget(resultId, replace),
    });
  }

  function sample({ input, resultId, replace, ...parameters } = {}) {
    return execute({
      command: 'sample',
      input: handleId(input),
      parameters: cloneObject(parameters, 'sample options'),
      ...resultTarget(resultId, replace),
    });
  }

  function compare(operation, {
    input, with: other, resultId, replace, ...parameters
  } = {}) {
    if (!SET_OPERATIONS.has(operation)) {
      throw new TypeError(
        'operation must be intersection, difference, or compare.',
      );
    }
    return execute({
      command: operation,
      input: handleId(input),
      parameters: {
        ...cloneObject(parameters, 'comparison options'),
        with: handleId(other),
      },
      ...resultTarget(resultId, replace),
    });
  }

  async function observe({ input, ...parameters } = {}) {
    const outcome = await execute({
      command: 'show',
      input: handleId(input),
      parameters: cloneObject(parameters, 'observation options'),
    });
    return {
      ...outcome,
      ...(outcome.response.ok === true
        ? { panels: arrangeObservation(outcome.response) }
        : {}),
    };
  }

  async function handoff(input) {
    const outcome = await execute({
      command: 'schema',
      input: handleId(input),
      parameters: {},
    });
    if (outcome.response.ok !== true) return outcome;
    const { handle, structure, compatibleOperations } = outcome.response.result;
    return {
      ...outcome,
      handoff: structuredClone({
        type: 'nostrarium-handle-handoff',
        from: 'field',
        handle,
        structure,
        compatibleOperations,
      }),
    };
  }

  return Object.freeze({
    configure,
    acquire,
    sample,
    compare,
    observe,
    handoff,
  });
}

function isController(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.execute === 'function';
}

function cloneDraft(value) {
  try {
    return structuredClone(value);
  } catch {
    throw new TypeError('Field commands must be structured-cloneable.');
  }
}

function cloneObject(value, label) {
  const candidate = value ?? {};
  if (!isPlainObject(candidate)) {
    throw new TypeError(`${label} must be a plain object.`);
  }
  return cloneDraft(candidate);
}

function handleId(value) {
  const id = typeof value === 'string' ? value : value?.handle?.id;
  if (typeof id !== 'string' || id.trim().length === 0 || id !== id.trim()) {
    throw new TypeError('input must be a handle ID or handoff with a handle ID.');
  }
  return id;
}

function resultTarget(resultId, replace) {
  const target = {};
  if (resultId !== undefined) {
    if (
      typeof resultId !== 'string'
      || resultId.trim().length === 0
      || resultId !== resultId.trim()
    ) {
      throw new TypeError('resultId must be a non-empty trimmed string.');
    }
    target.resultId = resultId;
  }
  if (replace !== undefined) {
    if (typeof replace !== 'boolean') {
      throw new TypeError('replace must be a boolean.');
    }
    target.replace = replace;
  }
  return target;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
