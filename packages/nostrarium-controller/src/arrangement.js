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
