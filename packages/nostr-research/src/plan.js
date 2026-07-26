import { acquireRelayEvents, hydrateAccounts } from './acquire.js';
import { ResearchMemoryError } from './index.js';

const OPERATIONS = new Set([
  'acquire', 'select', 'filter', 'group', 'summarize', 'move', 'hydrate', 'retain',
]);
const LOCAL_TRANSFORMS = new Set(['filter', 'group', 'summarize', 'move']);

/**
 * Executes a linear, JSON-serializable list of named research stages.
 *
 * Results stay available by stage ID for explicit reuse. The runner supplies
 * no judgments, performs no implicit acquisition, and does not activate a
 * session selection.
 */
export async function executeResearchPlan(memory, plan) {
  if (!memory || typeof memory.asCollection !== 'function') {
    throw new ResearchMemoryError('An open research memory is required.');
  }
  const normalized = normalizePlan(plan);
  const outputs = new Map();
  const stages = [];

  for (const stage of normalized) {
    const input = stage.input === undefined ? undefined : outputs.get(stage.input);
    let result;
    if (stage.operation === 'acquire') {
      result = await acquireRelayEvents(memory, stage.parameters);
    } else if (stage.operation === 'select') {
      result = memory.select(stage.parameters);
    } else if (LOCAL_TRANSFORMS.has(stage.operation)) {
      result = memory.transform(input, {
        operation: stage.operation,
        ...stage.parameters,
      });
    } else if (stage.operation === 'hydrate') {
      result = await hydrateAccounts(memory, input, stage.parameters);
    } else {
      const { name, options = {} } = stage.parameters;
      result = memory.retain(input, name, options);
    }
    outputs.set(stage.id, result);
    stages.push({
      id: stage.id,
      operation: stage.operation,
      ...(stage.input === undefined ? {} : { input: stage.input }),
      resultKind: planResultKind(stage.operation, result),
      result,
    });
  }

  return {
    type: 'research-plan-report',
    plan: cloneJson(normalized),
    stages,
  };
}

function normalizePlan(plan) {
  assertJsonData(plan, 'Research plan');
  if (!Array.isArray(plan) || plan.length === 0) {
    throw new ResearchMemoryError('Research plan must be a non-empty array of stages.');
  }
  const ids = new Set();
  return plan.map((stage, index) => {
    if (!isPlainObject(stage)) {
      throw new ResearchMemoryError(`Research plan stage ${index + 1} must be an object.`);
    }
    rejectUnknownKeys(stage, new Set(['id', 'operation', 'input', 'parameters']), index);
    if (typeof stage.id !== 'string' || stage.id.trim().length === 0) {
      throw new ResearchMemoryError(`Research plan stage ${index + 1} ID must be a non-empty string.`);
    }
    const id = stage.id.trim();
    if (ids.has(id)) throw new ResearchMemoryError(`Duplicate research plan stage ID: ${id}.`);
    if (!OPERATIONS.has(stage.operation)) {
      throw new ResearchMemoryError(
        `Unsupported research plan operation at stage ${id}: ${stage.operation}.`,
      );
    }
    if (!isPlainObject(stage.parameters)) {
      throw new ResearchMemoryError(`Research plan stage ${id} parameters must be an object.`);
    }
    const hasInput = stage.input !== undefined;
    if (stage.operation === 'acquire' && hasInput) {
      throw new ResearchMemoryError(`Research plan acquire stage ${id} must not have an input.`);
    }
    if (hasInput && (typeof stage.input !== 'string' || !ids.has(stage.input))) {
      throw new ResearchMemoryError(
        `Research plan stage ${id} input must name an earlier stage.`,
      );
    }
    if (!hasInput && !['acquire', 'select'].includes(stage.operation)) {
        throw new ResearchMemoryError(
          `Research plan stage ${id} input must name an earlier stage.`,
        );
    }
    if (stage.operation === 'retain') {
      rejectUnknownParameterKeys(stage, new Set(['name', 'options']));
      if (typeof stage.parameters.name !== 'string' || stage.parameters.name.trim().length === 0) {
        throw new ResearchMemoryError(`Research plan retain stage ${id} requires a name.`);
      }
      if (stage.parameters.options !== undefined && !isPlainObject(stage.parameters.options)) {
        throw new ResearchMemoryError(`Research plan retain stage ${id} options must be an object.`);
      }
      if (stage.parameters.options !== undefined) {
        rejectUnknownParameterKeys(
          { ...stage, operation: 'retain options', parameters: stage.parameters.options },
          new Set(['reason']),
        );
        if (stage.parameters.options.reason !== undefined) {
          const reason = stage.parameters.options.reason;
          if (!isPlainObject(reason)
              || typeof reason.type !== 'string'
              || reason.type.trim().length === 0) {
            throw new ResearchMemoryError(
              `Research plan retain stage ${id} reason requires a non-empty type.`,
            );
          }
        }
      }
    }
    ids.add(id);
    return {
      id,
      operation: stage.operation,
      ...(hasInput ? { input: stage.input } : {}),
      parameters: cloneJson(stage.parameters),
    };
  });
}

function planResultKind(operation, result) {
  if (operation === 'acquire') return 'acquisition-report';
  if (operation === 'hydrate') return 'hydration-report';
  if (operation === 'retain') return 'retained-selection';
  return result.kind ?? result.type;
}

function assertJsonData(value, label) {
  const seen = new Set();
  const visit = (item) => {
    if (item === null || ['string', 'boolean'].includes(typeof item)) return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (typeof item !== 'object') {
      throw new ResearchMemoryError(`${label} must contain only JSON-serializable data.`);
    }
    if (seen.has(item)) {
      throw new ResearchMemoryError(`${label} must not contain circular references.`);
    }
    seen.add(item);
    if (Array.isArray(item)) item.forEach(visit);
    else {
      if (Object.getPrototypeOf(item) !== Object.prototype) {
        throw new ResearchMemoryError(`${label} must contain only plain objects and arrays.`);
      }
      Object.values(item).forEach(visit);
    }
    seen.delete(item);
  };
  visit(value);
}

function rejectUnknownKeys(value, allowed, index) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new ResearchMemoryError(`Unknown research plan stage ${index + 1} field: ${key}.`);
    }
  }
}

function rejectUnknownParameterKeys(stage, allowed) {
  for (const key of Object.keys(stage.parameters)) {
    if (!allowed.has(key)) {
      throw new ResearchMemoryError(
        `Unknown ${stage.operation} parameters field at stage ${stage.id}: ${key}.`,
      );
    }
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
