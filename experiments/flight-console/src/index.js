import { createNavigator } from '@nostrarium/spacecraft-organs';

const OBSERVATIONS = new Set([
  'show', 'inspect', 'explain', 'list', 'memberships', 'membership',
  'status', 'schema',
]);
const NO_RESULT = new Set([
  ...OBSERVATIONS, 'configure', 'release', 'forget', 'close',
]);
const SENSORS = Object.freeze({
  structure: { mode: 'summary' },
  preview: { mode: 'preview' },
  voices: { mode: 'preview' },
  identities: { mode: 'preview' },
  conversation: { mode: 'preview' },
  raw: { mode: 'details' },
});

export class FlightCommandError extends Error {
  constructor(response, command) {
    const code = response?.error?.code ?? 'COMMAND_FAILED';
    const message = response?.error?.message ?? 'The research command failed.';
    super(`${code}: ${message}`);
    this.name = 'FlightCommandError';
    this.code = code;
    this.command = structuredClone(command);
    this.response = structuredClone(response);
  }
}

export function createFlightConsole({
  controller,
  namePrefix = 'flight',
  trailLimit = 40,
} = {}) {
  if (!controller || typeof controller.execute !== 'function') {
    throw new TypeError('controller must expose execute().');
  }
  const prefix = slug(namePrefix, 'namePrefix');
  const navigator = createNavigator({ controller, trailLimit });
  let nextResult = 0;
  const movements = new Map();

  async function command(draft, {
    placement = 'alternative',
    reason = draft?.command ?? 'result',
  } = {}) {
    plainCommand(draft);
    placementValue(placement);
    const outcome = await controller.execute(structuredClone(draft));
    if (outcome.response.ok !== true) throw new FlightCommandError(outcome.response, draft);
    if (outcome.receipt.handle && placement !== 'none') {
      navigator.attach(outcome, placement, reason);
    }
    return flightResult(outcome, draft);
  }

  async function exec(operation, options = {}) {
    const commandName = nonEmpty(operation, 'operation');
    if (!isPlainObject(options)) throw new TypeError('options must be a plain object.');
    const {
      input,
      as,
      placement = OBSERVATIONS.has(commandName) ? 'none' : 'alternative',
      reason = commandName,
      replace,
      ...parameters
    } = options;
    const draft = {
      command: commandName,
      ...(input === undefined ? {} : { input: handleId(input) }),
      ...(Object.keys(parameters).length ? { parameters } : {}),
      ...(replace === undefined ? {} : { replace }),
    };
    if (!NO_RESULT.has(commandName)) {
      draft.resultId = as === undefined
        ? `${prefix}-${slug(commandName, 'operation')}-${++nextResult}`
        : nonEmpty(as, 'as');
    }
    return command(draft, { placement, reason });
  }

  async function sense(source, sensor = 'preview', options = {}) {
    const sensorName = nonEmpty(sensor, 'sensor');
    const definition = SENSORS[sensorName];
    if (!definition) throw new TypeError(`Unknown sensor: ${sensorName}.`);
    if (!isPlainObject(options)) throw new TypeError('sensor options must be a plain object.');
    const parameters = {
      ...definition,
      ...options,
    };
    const observed = await exec('show', {
      input: source,
      ...parameters,
      placement: 'none',
      reason: `sense:${sensorName}`,
    });
    return {
      sensor: sensorName,
      input: handleId(source),
      ...projectSensor(sensorName, observed.response.result),
      raw: observed.response.result,
    };
  }

  async function dashboard(specifications) {
    if (!Array.isArray(specifications) || specifications.length === 0) {
      throw new TypeError('dashboard specifications must be a non-empty array.');
    }
    const panels = [];
    for (const specification of specifications) {
      if (!isPlainObject(specification)) {
        throw new TypeError('each dashboard specification must be a plain object.');
      }
      panels.push(await sense(
        specification.input,
        specification.sensor,
        specification.options,
      ));
    }
    return panels;
  }

  function defineMovement(name, perform) {
    const id = slug(name, 'movement name');
    if (typeof perform !== 'function') throw new TypeError('movement must be a function.');
    if (movements.has(id)) throw new TypeError(`Movement already exists: ${id}.`);
    movements.set(id, perform);
    return api;
  }

  async function movement(name, inputs = {}) {
    const id = slug(name, 'movement name');
    const perform = movements.get(id);
    if (!perform) throw new TypeError(`Unknown movement: ${id}.`);
    const steps = [];
    const movementExec = async (operation, options) => {
      const result = await exec(operation, options);
      steps.push({
        operation,
        command: result.command,
        handle: result.handle,
        completeness: result.completeness,
        warnings: result.warnings,
      });
      return result;
    };
    const output = await perform({
      exec: movementExec,
      inputs: structuredClone(inputs),
      handleId,
    });
    const result = output?.handle ? output : output?.result;
    if (!result?.handle) {
      throw new TypeError(`Movement ${id} must return a flight result.`);
    }
    return {
      movement: id,
      result,
      steps,
      handles: steps.flatMap(({ handle }) => handle ? [handle] : []),
      outputs: structuredClone(output?.outputs ?? {}),
    };
  }

  function home(source, reason = 'home') {
    navigator.attach(source, 'home', reason);
    return navigator.state();
  }

  function current(source, reason = 'current') {
    navigator.attach(source, 'current', reason);
    return navigator.state();
  }

  function returnHome(reason = 'return home') {
    const state = navigator.state();
    if (!state.home) throw new TypeError('The flight has no Home.');
    navigator.returnTo(state.home, reason);
    return state.home;
  }

  function state() {
    return {
      navigation: navigator.state(),
      movements: [...movements.keys()],
      controller: controller.state(),
    };
  }

  const api = Object.freeze({
    command,
    exec,
    sense,
    dashboard,
    defineMovement,
    movement,
    home,
    current,
    returnHome,
    state,
    controller,
  });

  installStandardMovements(api);
  return api;
}

function installStandardMovements(console) {
  console.defineMovement('diversity-aperture', async ({ exec, inputs }) => {
    const field = requiredInput(inputs, 'field');
    const maxLocalNotes = bounded(inputs.maxLocalNotes ?? 3, 'maxLocalNotes', 1_000);
    const sampleLimit = bounded(inputs.sampleLimit ?? 40, 'sampleLimit', 1_000);
    const seed = inputs.seed ?? 'nostrarium-diversity';
    const rows = await exec('relate', {
      input: field, as: inputs.rowsAs, placement: 'current',
      reason: 'resolve field evidence',
    });
    const authors = await exec('aggregate', {
      input: rows,
      by: [{ field: 'event.author', name: 'account' }],
      aggregations: [
        { name: 'noteCount', operation: 'count' },
        { name: 'examples', operation: 'sample', field: 'event.text', limit: 2 },
      ],
      as: inputs.authorsAs,
      placement: 'current',
      reason: 'measure local author concentration',
    });
    const quiet = await exec('filter', {
      input: authors,
      where: { field: 'noteCount', lte: maxLocalNotes },
      limit: inputs.groupLimit ?? 500,
      as: inputs.quietAs,
      placement: 'current',
      reason: `authors with at most ${maxLocalNotes} visible notes`,
    });
    const accounts = await exec('extract', {
      input: quiet,
      field: 'account',
      subjectType: 'account',
      limit: inputs.accountLimit ?? 500,
      as: inputs.accountsAs,
      placement: 'current',
      reason: 'recover author identities',
    });
    const sample = await exec('sample', {
      input: accounts,
      limit: sampleLimit,
      seed,
      as: inputs.as,
      placement: inputs.placement ?? 'alternative',
      reason: 'bounded deterministic author cross-section',
    });
    return {
      result: sample,
      outputs: { rows, authors, quiet, accounts, sample },
    };
  });

  console.defineMovement('local-recognition', async ({ exec, inputs }) => {
    const field = requiredInput(inputs, 'field');
    const candidates = requiredInput(inputs, 'candidates');
    const references = await exec('move', {
      input: field,
      to: 'referencedAccounts',
      limit: inputs.referenceLimit ?? 500,
      as: inputs.referencesAs,
      placement: 'alternative',
      reason: 'accounts explicitly referenced in the field',
    });
    const recognized = await exec('intersection', {
      input: candidates,
      with: references.handle.id,
      limit: inputs.limit ?? 500,
      as: inputs.as,
      placement: inputs.placement ?? 'alternative',
      reason: 'candidate accounts explicitly recognized in the field',
    });
    return {
      result: recognized,
      outputs: { references, recognized },
    };
  });

  console.defineMovement('profile-descent', async ({ exec, inputs }) => {
    const accounts = requiredInput(inputs, 'accounts');
    const events = await exec('hydrate', {
      input: accounts,
      relays: requiredRelays(inputs),
      kinds: [0],
      timeoutMs: inputs.timeoutMs ?? 18_000,
      observationLimit: inputs.observationLimit ?? 100,
      distinctEventLimit: inputs.distinctEventLimit ?? 80,
      concurrency: inputs.concurrency ?? 3,
      as: inputs.eventsAs,
      placement: 'alternative',
      reason: 'acquire profile evidence',
    });
    const rows = await exec('relate', {
      input: accounts,
      as: inputs.as,
      placement: inputs.placement ?? 'current',
      reason: 'resolve account profiles',
    });
    return { result: rows, outputs: { events, rows } };
  });

  console.defineMovement('authored-descent', async ({ exec, inputs }) => {
    const accounts = requiredInput(inputs, 'accounts');
    const events = await exec('continue', {
      input: accounts,
      relationship: 'authored-notes',
      source: 'relays',
      relays: requiredRelays(inputs),
      timeoutMs: inputs.timeoutMs ?? 18_000,
      observationLimit: inputs.observationLimit ?? 180,
      distinctEventLimit: inputs.distinctEventLimit ?? 120,
      eventLimit: inputs.eventLimit ?? 120,
      concurrency: inputs.concurrency ?? 3,
      as: inputs.eventsAs,
      placement: 'alternative',
      reason: 'acquire bounded authored evidence',
    });
    const rows = await exec('relate', {
      input: events,
      as: inputs.as,
      placement: inputs.placement ?? 'current',
      reason: 'resolve authored evidence',
    });
    return { result: rows, outputs: { events, rows } };
  });
}

function flightResult(outcome, command) {
  const result = outcome.response.result ?? {};
  return {
    command: structuredClone(command),
    handle: outcome.receipt.handle ? structuredClone(outcome.receipt.handle) : null,
    completeness: structuredClone(
      result.completeness ?? result.external?.completeness ?? null,
    ),
    bounds: structuredClone(result.bounds ?? result.external?.boundsReached ?? null),
    warnings: structuredClone(outcome.response.warnings ?? []),
    result: structuredClone(result),
    response: structuredClone(outcome.response),
  };
}

function projectSensor(sensor, result = {}) {
  const preview = Array.isArray(result.preview) ? result.preview : [];
  return {
    count: result.count ?? result.summary?.count ?? null,
    omitted: result.omitted ?? null,
    sizeBounded: result.sizeBounded ?? false,
    summary: result.summary ?? null,
    items: preview.map((item) => sensorItem(sensor, item)),
  };
}

function sensorItem(sensor, item) {
  const values = item.values ?? {};
  const common = {
    subject: item.subject
      ?? values.subject
      ?? (values['subject.id']
        ? { type: values['subject.type'] ?? null, id: values['subject.id'] }
        : item.id
          ? { id: item.id }
          : null),
    resolved: item.resolved ?? null,
  };
  if (sensor === 'identities') {
    const profile = profileContent(values['event.text']);
    return {
      ...common,
      name: item.displayName
        ?? values['account.display_name']
        ?? values['account.name']
        ?? profile?.display_name
        ?? profile?.name
        ?? null,
      description: excerpt(values['account.description'] ?? profile?.about),
    };
  }
  if (sensor === 'voices') {
    return {
      ...common,
      account: values.account ?? values['event.author'] ?? null,
      noteCount: values.noteCount ?? null,
      examples: values.examples ?? null,
    };
  }
  if (sensor === 'conversation') {
    return {
      ...common,
      role: values['event.conversationRole'] ?? values.conversationRole ?? null,
      author: values['event.author'] ?? null,
      text: excerpt(values['event.text']),
    };
  }
  return {
    ...common,
    values: structuredClone(values),
    text: excerpt(values['event.text']),
  };
}

function plainCommand(value) {
  if (!isPlainObject(value) || typeof value.command !== 'string') {
    throw new TypeError('command must be an ordinary command draft.');
  }
  if (Object.hasOwn(value, 'commandId')) {
    throw new TypeError('command drafts must not contain commandId.');
  }
}

function handleId(value) {
  const id = typeof value === 'string'
    ? value
    : value?.handle?.id
      ?? value?.receipt?.handle?.id
      ?? value?.response?.result?.handle?.id
      ?? value?.id;
  return nonEmpty(id, 'input handle');
}

function requiredInput(inputs, name) {
  if (!isPlainObject(inputs) || inputs[name] === undefined) {
    throw new TypeError(`Movement requires ${name}.`);
  }
  return inputs[name];
}

function requiredRelays(inputs) {
  if (!Array.isArray(inputs.relays) || inputs.relays.length === 0) {
    throw new TypeError('Movement requires a non-empty relays array.');
  }
  return structuredClone(inputs.relays);
}

function placementValue(value) {
  if (!['home', 'current', 'alternative', 'none'].includes(value)) {
    throw new TypeError('placement must be home, current, alternative, or none.');
  }
}

function bounded(value, name, maximum) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new TypeError(`${name} must be an integer from 1 to ${maximum}.`);
  }
  return value;
}

function slug(value, name) {
  const text = nonEmpty(value, name).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!text) throw new TypeError(`${name} must contain letters or numbers.`);
  return text;
}

function nonEmpty(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function excerpt(value) {
  return typeof value === 'string' ? value.slice(0, 280) : null;
}

function profileContent(value) {
  if (typeof value !== 'string' || value[0] !== '{') return null;
  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}
