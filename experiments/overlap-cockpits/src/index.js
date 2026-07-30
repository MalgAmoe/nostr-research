import {
  createContextPalette,
  createFourChannelDock,
} from '@nostrarium/local-interfaces';
import {
  createQuestions,
  createReservoirs,
} from '@nostrarium/spacecraft-organs';

export function createBridgeCockpit({
  flight,
  sensorLimit = 3,
  actionLimit = 40,
} = {}) {
  requiredFlight(flight);
  integer(sensorLimit, 'sensorLimit', 1, 10);
  integer(actionLimit, 'actionLimit', 1, 1_000);
  const docks = createFourChannelDock({ flight });
  const palettes = createContextPalette({ flight });
  let home = null;
  let current = null;
  let question = null;
  const instruments = new Map();
  const actions = [];
  let omittedActions = 0;

  function board(source, { ask } = {}) {
    current = handle(source);
    home ??= current;
    if (ask !== undefined) question = text(ask, 'question');
    return state();
  }

  function ask(value) {
    question = text(value, 'question');
    return state();
  }

  function mount(name, {
    source,
    follow,
    sensor = 'preview',
    options = {},
  } = {}) {
    if (follow !== undefined && !['current', 'home'].includes(follow)) {
      throw new TypeError('follow must be current or home.');
    }
    if (follow !== undefined && source !== undefined) {
      throw new TypeError('an instrument cannot set both source and follow.');
    }
    const mountedSource = follow === undefined ? (source ?? current) : null;
    if (!mountedSource && follow === undefined) {
      throw new TypeError('The bridge has no current position.');
    }
    const id = text(name, 'instrument name');
    if (!instruments.has(id) && instruments.size >= sensorLimit) {
      throw new TypeError(`The bridge holds at most ${sensorLimit} instruments.`);
    }
    instruments.set(id, {
      name: id,
      ...(follow === undefined
        ? { source: handle(mountedSource) }
        : { follow }),
      sensor: text(sensor, 'sensor'),
      options: structuredClone(options),
    });
    return state();
  }

  function unmount(name) {
    instruments.delete(text(name, 'instrument name'));
    return state();
  }

  async function read({ includeRaw = false } = {}) {
    const panels = [];
    for (const instrument of instruments.values()) {
      const source = instrument.follow === 'current'
        ? current
        : instrument.follow === 'home'
          ? home
          : instrument.source;
      panels.push({
        name: instrument.name,
        observation: finiteObservation(await flight.sense(
          source,
          instrument.sensor,
          instrument.options,
        ), includeRaw),
      });
    }
    return {
      question,
      home,
      current,
      panels,
      recentActions: structuredClone(actions.slice(-8)),
    };
  }

  async function chart() {
    if (!current) throw new TypeError('The bridge has no current position.');
    const palette = await palettes.open(current);
    return {
      position: current,
      groups: Object.groupBy(palette.controls, ({ group }) => group),
      advanced: palette.advanced,
    };
  }

  async function gate(action) {
    if (!current) throw new TypeError('The bridge has no current position.');
    if (!plain(action)) throw new TypeError('action must be a plain object.');
    const kind = text(action.kind, 'action.kind');
    let result;
    if (kind === 'go') {
      result = await docks.dock(current).go(
        text(action.route, 'action.route'),
        action.options,
      );
      current = result.handle;
    } else if (kind === 'work') {
      result = await docks.dock(current).work(
        text(action.operation, 'action.operation'),
        action.parameters,
      );
      current = result.handle;
    } else if (kind === 'movement') {
      result = await flight.movement(
        text(action.movement, 'action.movement'),
        { ...action.inputs, field: action.inputs?.field ?? current },
      );
      current = result.result.handle;
    } else if (kind === 'control') {
      const palette = await palettes.open(current);
      result = await palette.invoke(
        text(action.control, 'action.control'),
        action.parameters,
      );
      if (result.handle) current = result.handle;
    } else if (kind === 'adopt') {
      current = handle(action.source);
      result = { handle: current };
    } else if (kind === 'escape') {
      result = await flight.command(action.command, action.options);
      if (result.handle) current = result.handle;
    } else {
      throw new TypeError(`Unknown bridge action: ${kind}.`);
    }
    recordAction({
      kind,
      position: current,
      reason: action.reason ? text(action.reason, 'reason') : kind,
    });
    return { result, state: state() };
  }

  function returnHome() {
    if (!home) throw new TypeError('The bridge has no Home.');
    current = home;
    recordAction({ kind: 'return', position: current, reason: 'return Home' });
    return state();
  }

  function state() {
    return structuredClone({
      home,
      current,
      question,
      instruments: [...instruments.values()],
      recentActions: actions.slice(-8),
      omittedActions,
    });
  }

  function recordAction(action) {
    actions.push(action);
    while (actions.length > actionLimit) {
      actions.shift();
      omittedActions += 1;
    }
  }

  return Object.freeze({
    board, ask, mount, unmount, read, chart, gate, returnHome, state,
  });
}

export function createParallaxCockpit({ flight } = {}) {
  requiredFlight(flight);
  const slots = new Map([['left', null], ['right', null]]);

  function place(slot, source, sensor = 'preview', options = {}) {
    slotName(slot);
    slots.set(slot, {
      handle: handle(source),
      sensor: text(sensor, 'sensor'),
      options: structuredClone(options),
    });
    return state();
  }

  async function read({ includeRaw = false } = {}) {
    const views = {};
    for (const [slot, value] of slots) {
      views[slot] = value
        ? finiteObservation(
          await flight.sense(value.handle, value.sensor, value.options),
          includeRaw,
        )
        : null;
    }
    return views;
  }

  async function combine(operation, {
    as,
    placement = 'alternative',
    limit = 500,
  } = {}) {
    if (!['compare', 'union', 'intersection', 'difference'].includes(operation)) {
      throw new TypeError('operation must be compare, union, intersection, or difference.');
    }
    const left = requiredSlot(slots, 'left');
    const right = requiredSlot(slots, 'right');
    return flight.exec(operation, {
      input: left.handle,
      with: right.handle.id,
      ...(operation === 'compare' ? {} : { limit }),
      ...(as === undefined ? {} : { as }),
      placement,
      reason: `parallax ${operation}`,
    });
  }

  function state() {
    return structuredClone(Object.fromEntries(slots));
  }

  return Object.freeze({ place, read, combine, state });
}

export function createExpeditionCockpit({
  flight,
  cargoLimit = 8,
  logLimit = 40,
} = {}) {
  requiredFlight(flight);
  integer(logLimit, 'logLimit', 1, 1_000);
  const questions = createQuestions({ limit: 8 });
  const reservoirs = createReservoirs({ entriesPerReservoir: cargoLimit });
  reservoirs.create('cargo');
  let home = null;
  let current = null;
  let activeQuestionId = null;
  const log = [];
  let omittedLog = 0;

  function depart(source, question) {
    home = handle(source);
    current = home;
    const opened = questions.open(question);
    activeQuestionId = opened.id;
    record({ type: 'depart', handle: home, question: opened.text });
    return state();
  }

  async function maneuver(name, inputs = {}) {
    if (!current) throw new TypeError('The expedition has not departed.');
    const moved = await flight.movement(name, {
      ...inputs,
      field: inputs.field ?? current,
    });
    current = moved.result.handle;
    questions.attach(activeQuestionId, current, `movement:${name}`);
    record({
      type: 'movement',
      name,
      handle: current,
      steps: moved.steps.map(({ operation, handle: stepHandle }) => ({
        operation,
        handle: stepHandle,
      })),
    });
    return moved;
  }

  async function look(sensor = 'preview', options, { includeRaw = false } = {}) {
    if (!current) throw new TypeError('The expedition has not departed.');
    return finiteObservation(
      await flight.sense(current, sensor, options),
      includeRaw,
    );
  }

  function collect(reason, intent = 'working') {
    if (!current) throw new TypeError('The expedition has not departed.');
    reservoirs.pull('cargo', current, reason, intent);
    record({ type: 'collect', handle: current, reason, intent });
    return state();
  }

  function adopt(source, reason = 'adopt') {
    current = handle(source);
    record({ type: 'adopt', handle: current, reason });
    return state();
  }

  function returnHome() {
    if (!home) throw new TypeError('The expedition has not departed.');
    current = home;
    record({ type: 'return', handle: current });
    return state();
  }

  function state() {
    const questionState = questions.state();
    return structuredClone({
      home,
      current,
      activeQuestion: questionState.find(({ id }) => id === activeQuestionId) ?? null,
      questions: questionState,
      cargo: reservoirs.state()[0],
      log,
      omittedLog,
    });
  }

  function record(entry) {
    log.push(entry);
    while (log.length > logLimit) {
      log.shift();
      omittedLog += 1;
    }
  }

  return Object.freeze({
    depart, maneuver, look, collect, adopt, returnHome, state,
  });
}

function handle(value) {
  const candidate = value?.handle
    ?? value?.receipt?.handle
    ?? value?.response?.result?.handle
    ?? value;
  if (!candidate || typeof candidate.id !== 'string' || typeof candidate.kind !== 'string') {
    throw new TypeError('value must expose a result handle.');
  }
  return structuredClone(candidate);
}

function requiredFlight(flight) {
  if (!flight || typeof flight.exec !== 'function' || typeof flight.sense !== 'function') {
    throw new TypeError('flight must expose exec() and sense().');
  }
}

function requiredSlot(slots, name) {
  const value = slots.get(name);
  if (!value) throw new TypeError(`Parallax slot ${name} is empty.`);
  return value;
}

function slotName(value) {
  if (!['left', 'right'].includes(value)) {
    throw new TypeError('slot must be left or right.');
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function integer(value, name, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
}

function plain(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function finiteObservation(value, includeRaw) {
  if (includeRaw) return value;
  const { raw, ...finite } = value;
  return finite;
}
