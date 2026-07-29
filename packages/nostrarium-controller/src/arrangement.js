const CONTROL_GROUPS = Object.freeze([
  {
    id: 'contact',
    label: 'Contact',
    operations: ['configure', 'acquire', 'hydrate', 'fetch', 'continue', 'relay-info', 'relay-count'],
  },
  {
    id: 'movement',
    label: 'Movement',
    operations: [
      'select', 'move', 'extract', 'pick', 'limit', 'sample',
      'union', 'intersection', 'difference', 'compare',
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    operations: [
      'relate', 'filter', 'project', 'distinct', 'sort', 'join',
      'aggregate', 'derive', 'slice', 'explode', 'scan', 'balance',
    ],
  },
  {
    id: 'judgment',
    label: 'Judgment',
    operations: ['remember', 'forget', 'remember-membership'],
  },
  {
    id: 'collection',
    label: 'Collection',
    operations: ['preserve', 'release-archive'],
  },
]);

const OPERATION_GROUP = new Map(CONTROL_GROUPS.flatMap(({ id, operations }) => (
  operations.map((operation) => [operation, id])
)));

/**
 * Arrange factual schema responses for a navigator without recommending an
 * operation or changing its contract.
 *
 * Pass one successful broad schema response and any focused operation-schema
 * responses already requested by the caller. The function performs no session
 * commands.
 */
export function arrangeControls(schemaResponse, focusedResponses = []) {
  const schema = successfulResult(schemaResponse, 'schemaResponse');
  if (!Array.isArray(focusedResponses)) {
    throw new TypeError('focusedResponses must be an array.');
  }

  const available = schema.compatibleOperations ?? [];
  if (!Array.isArray(available) || available.some((value) => typeof value !== 'string')) {
    throw new TypeError('schemaResponse must expose compatibleOperations as strings.');
  }

  const focused = new Map();
  for (const [index, response] of focusedResponses.entries()) {
    const result = successfulResult(response, `focusedResponses[${index}]`);
    const name = result.operation?.name;
    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError(`focusedResponses[${index}] must expose operation.name.`);
    }
    focused.set(name, result.operation);
  }

  const groups = CONTROL_GROUPS.map(({ id, label }) => ({
    id,
    label,
    controls: available
      .filter((operation) => OPERATION_GROUP.get(operation) === id)
      .map((operation) => controlFact(operation, focused.get(operation))),
  })).filter(({ controls }) => controls.length > 0);

  const uncategorized = available
    .filter((operation) => !OPERATION_GROUP.has(operation))
    .map((operation) => controlFact(operation, focused.get(operation)));
  if (uncategorized.length) {
    groups.push({ id: 'other', label: 'Other', controls: uncategorized });
  }

  return structuredClone({
    context: pickPresent(schema, ['type', 'handle', 'structure']),
    groups,
  });
}

/**
 * Arrange an existing show response into stable panels. Values are selected
 * from the response, never inferred or recomputed.
 */
export function arrangeObservation(showResponse) {
  const result = successfulResult(showResponse, 'showResponse');
  if (typeof result.observation !== 'string') {
    throw new TypeError('showResponse must be the result of a show command.');
  }

  const summary = isPlainObject(result.summary) ? result.summary : {};
  return structuredClone({
    orientation: {
      ...pickPresent(result, ['type', 'observation', 'count']),
      ...pickPresent(summary, ['countUnit', 'lineage', 'bounds', 'completeness']),
    },
    evidence: {
      ...pickPresent(summary, ['evidenceResolution', 'eventFacts']),
      ...pickPresent(result, ['preview', 'coverage', 'details']),
    },
    paging: pickPresent(result, [
      'offset', 'limit', 'nextOffset', 'omittedBefore', 'omittedAfter',
      'omitted', 'sizeBounded',
    ]),
    context: pickPresent(result, ['context', 'external']),
  });
}

/**
 * Arrange one already-requested focused operation contract for command
 * composition. This does not request schema, choose values, or execute.
 */
export function arrangeCommand(schemaResponse) {
  const schema = successfulResult(schemaResponse, 'schemaResponse');
  const operation = schema.operation;
  if (!isPlainObject(operation) || typeof operation.name !== 'string') {
    throw new TypeError('schemaResponse must expose a focused operation contract.');
  }
  if (!isPlainObject(schema.handle) || typeof schema.handle.id !== 'string') {
    throw new TypeError('schemaResponse must expose the focused input handle.');
  }
  const contracts = isPlainObject(operation.parameters) ? operation.parameters : {};
  return structuredClone({
    type: 'command-composition',
    context: pickPresent(schema, ['type', 'handle', 'structure']),
    operation: operation.name,
    input: schema.handle.id,
    facts: pickPresent(operation, [
      'choices', 'usableFields', 'availableFields', 'populatedFields',
      'numericFields', 'effectiveDefaults', 'relaySourceDefaults',
    ]),
    parameters: Object.entries(contracts).map(([name, contract]) => ({
      name,
      required: parameterRequired(name, contract, operation.remainingChoices),
      contract,
      ...parameterChoices(name, contract, operation),
    })),
    ...pickPresent(operation, ['parameterRequirements']),
    remainingChoices: Array.isArray(operation.remainingChoices)
      ? operation.remainingChoices
      : [],
  });
}

/**
 * Compose one visible controller command from navigator-supplied values.
 * Validation is deliberately limited to facts present in the focused contract.
 */
export function composeCommand(composition, values = {}) {
  if (!isPlainObject(composition) || composition.type !== 'command-composition') {
    throw new TypeError('composition must be produced by arrangeCommand.');
  }
  if (!isPlainObject(values)) throw new TypeError('values must be a plain object.');
  rejectUnknownKeys(values, ['parameters', 'resultId', 'replace'], 'values');

  const supplied = values.parameters ?? {};
  if (!isPlainObject(supplied)) throw new TypeError('values.parameters must be a plain object.');
  const contracts = new Map(composition.parameters.map((parameter) => [
    parameter.name, parameter,
  ]));
  rejectUnknownKeys(supplied, [...contracts.keys()], 'values.parameters');

  for (const parameter of composition.parameters) {
    if (!Object.hasOwn(supplied, parameter.name)) {
      if (parameter.required) {
        throw new TypeError(`Missing required parameter: ${parameter.name}.`);
      }
      continue;
    }
    validateParameter(parameter, supplied[parameter.name]);
  }
  validateParameterRequirements(composition.parameterRequirements, supplied);

  if (Object.hasOwn(values, 'resultId') && (
    typeof values.resultId !== 'string' || values.resultId.trim().length === 0
  )) {
    throw new TypeError('values.resultId must be a non-empty trimmed string.');
  }
  if (Object.hasOwn(values, 'replace') && typeof values.replace !== 'boolean') {
    throw new TypeError('values.replace must be a boolean.');
  }

  return structuredClone({
    command: composition.operation,
    input: composition.input,
    parameters: supplied,
    ...pickPresent(values, ['resultId', 'replace']),
  });
}

function controlFact(name, operation) {
  return {
    name,
    ...(operation === undefined ? { contractLoaded: false } : {
      contractLoaded: true,
      ...pickPresent(operation, [
        'locality', 'mutation', 'completeness', 'reason', 'parameters',
        'choices', 'usableFields', 'populatedFields', 'remainingChoices',
      ]),
    }),
  };
}

function validateParameterRequirements(requirements, supplied) {
  if (!isPlainObject(requirements)) return;
  if (Array.isArray(requirements.atLeastOne)
      && !requirements.atLeastOne.some((name) => Object.hasOwn(supplied, name))) {
    throw new TypeError(
      `At least one parameter is required: ${requirements.atLeastOne.join(', ')}.`,
    );
  }
}

function parameterRequired(name, contract, remainingChoices) {
  if (isPlainObject(contract) && contract.required === true) return true;
  if (isPlainObject(contract) && Object.hasOwn(contract, 'default')) return false;
  if (typeof contract === 'string' && /^required\b(?! only)/u.test(contract)) return true;
  if (!Array.isArray(remainingChoices)) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return remainingChoices.some((choice) => (
    typeof choice === 'string'
    && new RegExp(`\\b(?:choose|supply)\\b[^.]*\\b${escaped}\\b`, 'iu').test(choice)
  ));
}

function parameterChoices(name, contract, operation) {
  if (isPlainObject(contract) && Array.isArray(contract.values)) {
    return { choices: contract.values };
  }
  if (name === 'relationship' && Array.isArray(operation.choices?.relationships)) {
    return {
      choices: operation.choices.relationships.map(({ relationship }) => relationship),
    };
  }
  if (
    (name === 'field' || name === 'fields')
    && Array.isArray(operation.populatedFields)
    && operation.populatedFields.length > 0
  ) {
    return {
      choices: operation.populatedFields.map((field) => (
        isPlainObject(field) ? field.name : field
      )).filter((field) => typeof field === 'string'),
    };
  }
  return {};
}

function validateParameter(parameter, value) {
  const { name, contract } = parameter;
  if (Array.isArray(parameter.choices)) {
    const values = Array.isArray(value) ? value : [value];
    const unknown = values.find((item) => !parameter.choices.includes(item));
    if (unknown !== undefined) {
      throw new TypeError(
        `${name} must use a value exposed by its focused contract: ${JSON.stringify(unknown)}.`,
      );
    }
  }
  if (typeof contract === 'string') {
    validateDescribedValue(name, value, contract);
    return;
  }
  if (!isPlainObject(contract)) return;
  validateTypedValue(name, value, contract);
  validateItemContract(name, value, contract.item);
}

function validateDescribedValue(name, value, contract) {
  if (contract.includes('object with a non-empty type')) {
    if (!isPlainObject(value) || typeof value.type !== 'string' || value.type.trim().length === 0) {
      throw new TypeError(`${name} must be an object with a non-empty type.`);
    }
    return;
  }
  if (contract.includes('non-empty') && contract.includes('string')) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new TypeError(`${name} must be a non-empty string.`);
    }
  }
}

function validateTypedValue(name, value, contract) {
  if (contract.type === 'integer') {
    if (!Number.isInteger(value)) throw new TypeError(`${name} must be an integer.`);
    if (Number.isInteger(contract.minimum) && value < contract.minimum) {
      throw new TypeError(`${name} must be at least ${contract.minimum}.`);
    }
    if (Number.isInteger(contract.maximum) && value > contract.maximum) {
      throw new TypeError(`${name} must be at most ${contract.maximum}.`);
    }
  }
  if (contract.type === 'boolean' && typeof value !== 'boolean') {
    throw new TypeError(`${name} must be a boolean.`);
  }
  if (
    (contract.type === 'array' || contract.type === 'non-empty array')
    && !Array.isArray(value)
  ) {
    throw new TypeError(`${name} must be an array.`);
  }
  if (contract.type === 'non-empty array' && value.length === 0) {
    throw new TypeError(`${name} must not be empty.`);
  }
  if (Array.isArray(value) && Number.isInteger(contract.minimumItems)
    && value.length < contract.minimumItems) {
    throw new TypeError(`${name} must contain at least ${contract.minimumItems} items.`);
  }
}

function validateItemContract(name, value, item) {
  if (!Array.isArray(value) || !isPlainObject(item)) return;
  const metadata = new Set(['required', 'type', 'description']);
  const allowed = [
    ...(Array.isArray(item.required) ? item.required : []),
    ...Object.keys(item).filter((key) => !metadata.has(key)),
  ];
  for (const [index, entry] of value.entries()) {
    if (!isPlainObject(entry)) {
      throw new TypeError(`${name}[${index}] must be an object.`);
    }
    if (Array.isArray(item.required)) {
      for (const required of item.required) {
        if (!Object.hasOwn(entry, required)) {
          throw new TypeError(`${name}[${index}] is missing required field: ${required}.`);
        }
      }
    }
    rejectUnknownKeys(entry, allowed, `${name}[${index}]`);
    for (const [field, choices] of Object.entries(item)) {
      if (Array.isArray(choices) && Object.hasOwn(entry, field)
        && !choices.includes(entry[field])) {
        throw new TypeError(
          `${name}[${index}].${field} must use a value exposed by its contract.`,
        );
      }
    }
  }
}

function rejectUnknownKeys(value, allowed, label) {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unknown !== undefined) throw new TypeError(`${label} contains unknown field: ${unknown}.`);
}

function successfulResult(response, label) {
  if (!isPlainObject(response) || response.ok !== true || !isPlainObject(response.result)) {
    throw new TypeError(`${label} must be a successful session response.`);
  }
  return response.result;
}

function pickPresent(source, keys) {
  return Object.fromEntries(keys
    .filter((key) => Object.hasOwn(source, key))
    .map((key) => [key, structuredClone(source[key])]));
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
