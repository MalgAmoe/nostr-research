const DEFAULT_LIMITS = Object.freeze({
  curiosities: 8,
  collisions: 8,
});

export function createPinballComposer({ controller, limits: suppliedLimits } = {}) {
  if (!controller || typeof controller.execute !== 'function') {
    throw new TypeError('controller must expose an execute function.');
  }
  const limits = normalizeLimits(suppliedLimits);
  let table = null;
  let ball = null;
  let nextCuriosity = 0;
  let nextCollision = 0;
  const curiosities = [];
  const collisions = [];

  function setTable(source, reason = 'navigator') {
    table = handleFact(source);
    ball = structuredClone(table);
    return sensors();
  }

  function addCuriosity(text) {
    const curiosity = {
      id: `c${++nextCuriosity}`,
      text: nonEmptyString(text, 'curiosity'),
      status: 'live',
      hits: 0,
    };
    curiosities.push(curiosity);
    while (curiosities.length > limits.curiosities) curiosities.shift();
    return structuredClone(curiosity);
  }

  function settleCuriosity(id, status = 'spent') {
    if (!['live', 'spent', 'parked'].includes(status)) {
      throw new TypeError('status must be live, spent, or parked.');
    }
    const curiosity = curiosities.find((candidate) => candidate.id === id);
    if (!curiosity) throw new TypeError(`Unknown curiosity: ${id}.`);
    curiosity.status = status;
    return structuredClone(curiosity);
  }

  function bounce(source) {
    ball = handleFact(source);
    return sensors();
  }

  async function fire(draft, { curiosityId } = {}) {
    const command = commandDraft(draft);
    const curiosity = curiosityId === undefined
      ? null
      : curiosities.find((candidate) => candidate.id === curiosityId);
    if (curiosityId !== undefined && !curiosity) {
      throw new TypeError(`Unknown curiosity: ${curiosityId}.`);
    }
    const from = ball ? structuredClone(ball) : null;
    const outcome = await controller.execute(command);
    const landed = outcome.receipt.handle
      ? handleFact(outcome.receipt.handle)
      : null;
    if (landed) ball = landed;
    if (curiosity) curiosity.hits += 1;
    const collision = {
      sequence: ++nextCollision,
      curiosityId: curiosity?.id ?? null,
      command: command.command,
      from,
      landed,
      ok: outcome.response.ok,
      partial: outcome.receipt.partial ?? false,
      warningCount: outcome.receipt.warningCount ?? 0,
      error: outcome.receipt.error ?? null,
    };
    collisions.push(collision);
    while (collisions.length > limits.collisions) collisions.shift();
    return { ...outcome, collision, sensors: sensors() };
  }

  function sensors() {
    return structuredClone({
      table,
      curiosities,
      momentum: {
        ball,
        collisions,
        direction: collisions.length === 0
          ? 'still'
          : collisions.at(-1).landed
            ? 'moving'
            : 'deflected',
      },
      limits,
    });
  }

  return Object.freeze({
    setTable,
    addCuriosity,
    settleCuriosity,
    bounce,
    fire,
    sensors,
  });
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
    throw new TypeError('fire requires a command draft.');
  }
  if (Object.hasOwn(value, 'commandId')) {
    throw new TypeError('command drafts must not contain commandId.');
  }
  return structuredClone(value);
}

function normalizeLimits(value) {
  if (value === undefined) return DEFAULT_LIMITS;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('limits must be a plain object.');
  }
  const limits = { ...DEFAULT_LIMITS, ...value };
  for (const [name, limit] of Object.entries(limits)) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new TypeError(`limits.${name} must be an integer from 1 to 100.`);
    }
  }
  return Object.freeze(limits);
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0
      || value !== value.trim()) {
    throw new TypeError(`${label} must be a non-empty trimmed string.`);
  }
  return value;
}
