export function createNavigator({ controller, trailLimit = 20 } = {}) {
  if (!controller || typeof controller.execute !== 'function') {
    throw new TypeError('controller must expose an execute function.');
  }
  integerLimit(trailLimit, 'trailLimit');
  let home = null;
  let current = null;
  let nextMovement = 0;
  const known = new Map();
  const trail = [];
  const alternatives = new Map();

  function attach(source, role = 'current', reason = 'navigator') {
    const handle = handleFact(source);
    const why = nonEmptyString(reason, 'reason');
    known.set(handle.id, handle);
    if (role === 'home') {
      home = handle;
      record('home', handle, why);
    } else if (role === 'current') {
      current = handle;
      record('move', handle, why);
    } else if (role === 'alternative') {
      alternatives.set(handle.id, { handle, reason: why });
    } else {
      throw new TypeError('role must be home, current, or alternative.');
    }
    return state();
  }

  async function execute(command, { result = 'alternative', reason = 'result' } = {}) {
    commandDraft(command);
    if (!['current', 'alternative', 'none'].includes(result)) {
      throw new TypeError('result must be current, alternative, or none.');
    }
    const outcome = await controller.execute(structuredClone(command));
    if (outcome.receipt.handle && result !== 'none') {
      attach(outcome.receipt.handle, result, reason);
    }
    return { ...outcome, navigation: state() };
  }

  function returnTo(source, reason = 'navigator return') {
    const id = typeof source === 'string' ? source : handleFact(source).id;
    const handle = known.get(nonEmptyString(id, 'handle ID'));
    if (!handle) throw new TypeError(`Unknown navigator handle: ${id}.`);
    current = handle;
    record('return', handle, nonEmptyString(reason, 'reason'));
    return state();
  }

  function state() {
    return structuredClone({
      home,
      current,
      trail,
      alternatives: [...alternatives.values()],
      known: [...known.values()],
    });
  }

  function record(type, handle, reason) {
    trail.push({ sequence: ++nextMovement, type, handle, reason });
    while (trail.length > trailLimit) trail.shift();
  }

  return Object.freeze({ attach, execute, returnTo, state });
}

export function createQuestions({ limit = 8, evidenceLimit = 20 } = {}) {
  integerLimit(limit, 'limit');
  integerLimit(evidenceLimit, 'evidenceLimit');
  let nextQuestion = 0;
  const questions = [];

  function open(text) {
    const question = {
      id: `q${++nextQuestion}`,
      text: nonEmptyString(text, 'question'),
      status: 'open',
      evidence: [],
      omittedEvidence: 0,
    };
    questions.push(question);
    while (questions.length > limit) questions.shift();
    return structuredClone(question);
  }

  function attach(questionId, source, reason) {
    const question = requiredQuestion(questions, questionId);
    const handle = handleFact(source);
    question.evidence.push({
      handle,
      reason: nonEmptyString(reason, 'reason'),
    });
    while (question.evidence.length > evidenceLimit) {
      question.evidence.shift();
      question.omittedEvidence += 1;
    }
    return structuredClone(question);
  }

  function setStatus(questionId, status) {
    if (!['open', 'parked', 'answered', 'discarded'].includes(status)) {
      throw new TypeError('status must be open, parked, answered, or discarded.');
    }
    const question = requiredQuestion(questions, questionId);
    question.status = status;
    return structuredClone(question);
  }

  function state() {
    return structuredClone(questions);
  }

  return Object.freeze({ open, attach, setStatus, state });
}

export function createReservoirs({ entriesPerReservoir = 8 } = {}) {
  integerLimit(entriesPerReservoir, 'entriesPerReservoir');
  const reservoirs = new Map();

  function create(name) {
    const id = nonEmptyString(name, 'reservoir name');
    if (reservoirs.has(id)) throw new TypeError(`Reservoir already exists: ${id}.`);
    reservoirs.set(id, { name: id, entries: [], omitted: 0 });
    return state();
  }

  function pull(name, source, reason, intent = 'working') {
    const reservoir = requiredReservoir(reservoirs, name);
    if (!['working', 'remember', 'preserve', 'export'].includes(intent)) {
      throw new TypeError('intent must be working, remember, preserve, or export.');
    }
    reservoir.entries.push({
      handle: handleFact(source),
      reason: nonEmptyString(reason, 'reason'),
      intent,
    });
    while (reservoir.entries.length > entriesPerReservoir) {
      reservoir.entries.shift();
      reservoir.omitted += 1;
    }
    return state();
  }

  function state() {
    return structuredClone([...reservoirs.values()]);
  }

  return Object.freeze({ create, pull, state });
}

export function createComparison({ slots = ['A', 'B'] } = {}) {
  if (!Array.isArray(slots) || slots.length < 2) {
    throw new TypeError('slots must contain at least two names.');
  }
  const attached = new Map(slots.map((name) => [
    nonEmptyString(name, 'slot name'),
    null,
  ]));

  function attach(slot, source, reason = 'navigator') {
    if (!attached.has(slot)) throw new TypeError(`Unknown comparison slot: ${slot}.`);
    attached.set(slot, {
      handle: handleFact(source),
      reason: nonEmptyString(reason, 'reason'),
    });
    return state();
  }

  function clear(slot) {
    if (!attached.has(slot)) throw new TypeError(`Unknown comparison slot: ${slot}.`);
    attached.set(slot, null);
    return state();
  }

  function state() {
    return structuredClone(Object.fromEntries(attached));
  }

  return Object.freeze({ attach, clear, state });
}

function handleFact(source) {
  const handle = source?.receipt?.handle
    ?? source?.response?.result?.handle
    ?? source?.handle
    ?? source;
  if (!handle || typeof handle !== 'object' || Array.isArray(handle)) {
    throw new TypeError('value must expose an ordinary result handle.');
  }
  const id = nonEmptyString(handle.id, 'handle.id');
  if (typeof handle.kind !== 'string' || handle.kind.length === 0) {
    throw new TypeError('handle.kind must be a non-empty string.');
  }
  if (!Number.isSafeInteger(handle.count) || handle.count < 0) {
    throw new TypeError('handle.count must be a non-negative integer.');
  }
  return {
    id,
    kind: handle.kind,
    count: handle.count,
    ...(typeof handle.scope === 'string' ? { scope: handle.scope } : {}),
  };
}

function commandDraft(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || typeof value.command !== 'string') {
    throw new TypeError('command must be an ordinary command draft.');
  }
  if (Object.hasOwn(value, 'commandId')) {
    throw new TypeError('command drafts must not contain commandId.');
  }
  structuredClone(value);
}

function requiredQuestion(questions, id) {
  const question = questions.find(({ id: candidate }) => candidate === id);
  if (!question) throw new TypeError(`Unknown question: ${id}.`);
  return question;
}

function requiredReservoir(reservoirs, name) {
  const reservoir = reservoirs.get(nonEmptyString(name, 'reservoir name'));
  if (!reservoir) throw new TypeError(`Unknown reservoir: ${name}.`);
  return reservoir;
}

function integerLimit(value, label) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new TypeError(`${label} must be an integer from 1 to 100.`);
  }
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0
      || value !== value.trim()) {
    throw new TypeError(`${label} must be a non-empty trimmed string.`);
  }
  return value;
}
