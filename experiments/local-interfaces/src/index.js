const SHAPES = new Set([
  'relate', 'filter', 'project', 'distinct', 'sort', 'slice', 'aggregate', 'derive',
  'explode', 'scan', 'join', 'extract', 'sample', 'limit', 'union',
  'intersection', 'difference',
]);
const SENSORS = ['structure', 'preview', 'voices', 'identities', 'conversation', 'raw'];

export function createContextPalette({ flight } = {}) {
  requiredFlight(flight);

  async function open(source) {
    const handle = handleFact(source);
    const context = await contextualControls(flight, handle);
    const controls = [
      ...context.senses.map((name) => ({
        id: `see:${name}`, group: 'see', label: name,
      })),
      ...context.moves.map(({ to, outputKind }) => ({
        id: `move:${to}`, group: 'move', label: to, outputKind,
      })),
      ...context.continuations.map(({ relationship, outputKind, sources }) => ({
        id: `continue:${relationship}`,
        group: 'continue',
        label: relationship,
        outputKind,
        sources,
      })),
      ...context.shapes.map((operation) => ({
        id: `shape:${operation}`, group: 'shape', label: operation,
      })),
    ];

    async function invoke(id, parameters = {}) {
      const control = controls.find(({ id: candidate }) => candidate === id);
      if (!control) throw new TypeError(`Unknown local control: ${id}.`);
      if (control.group === 'see') {
        return flight.sense(handle, control.label, parameters);
      }
      if (control.group === 'move') {
        return flight.exec('move', { input: handle, to: control.label, ...parameters });
      }
      if (control.group === 'continue') {
        return flight.exec('continue', {
          input: handle,
          relationship: control.label,
          ...parameters,
        });
      }
      return flight.exec(control.label, { input: handle, ...parameters });
    }

    return Object.freeze({
      handle,
      controls: structuredClone(controls),
      advanced: structuredClone(context.advanced),
      invoke,
      open: async (result) => open(result),
    });
  }

  return Object.freeze({ open });
}

export function createFourChannelDock({ flight } = {}) {
  requiredFlight(flight);

  function dock(source) {
    const handle = handleFact(source);
    return Object.freeze({
      handle,
      map: () => contextualControls(flight, handle),
      look: (sensor = 'preview', options) => flight.sense(handle, sensor, options),
      go: async (route, options = {}) => {
        const [family, value] = route.includes(':')
          ? route.split(/:(.*)/s, 2)
          : ['move', route];
        const result = family === 'continue'
          ? await flight.exec('continue', { input: handle, relationship: value, ...options })
          : await flight.exec('move', { input: handle, to: value, ...options });
        return dock(result);
      },
      work: async (operation, parameters = {}) => dock(
        await flight.exec(operation, { input: handle, ...parameters }),
      ),
      escape: (draft, options) => flight.command(draft, options),
    });
  }

  return Object.freeze({ dock });
}

async function contextualControls(flight, source) {
  const handle = handleFact(source);
  const base = await flight.exec('schema', {
    input: handle,
    placement: 'none',
  });
  const compatible = base.result.compatibleOperations ?? [];
  const moves = compatible.includes('move')
    ? await focusedChoices(flight, handle, 'move', 'to')
    : [];
  const continuations = compatible.includes('continue')
    ? await focusedChoices(flight, handle, 'continue', 'relationships')
    : [];
  const shapes = compatible.filter((operation) => SHAPES.has(operation));
  const exposed = new Set(['move', 'continue', ...shapes]);
  return {
    handle,
    senses: [...SENSORS],
    moves,
    continuations,
    shapes,
    advanced: compatible.filter((operation) => !exposed.has(operation)),
  };
}

async function focusedChoices(flight, handle, operation, choice) {
  const response = await flight.exec('schema', {
    input: handle,
    operation,
    placement: 'none',
  });
  return structuredClone(response.result.operation?.choices?.[choice] ?? []);
}

function handleFact(value) {
  const handle = value?.handle
    ?? value?.receipt?.handle
    ?? value?.response?.result?.handle
    ?? value;
  if (!handle || typeof handle.id !== 'string' || typeof handle.kind !== 'string') {
    throw new TypeError('source must expose a result handle.');
  }
  return structuredClone(handle);
}

function requiredFlight(flight) {
  if (!flight || typeof flight.exec !== 'function' || typeof flight.sense !== 'function') {
    throw new TypeError('flight must expose exec() and sense().');
  }
}
