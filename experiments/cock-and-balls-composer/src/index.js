const DEFAULT_LIMITS = Object.freeze({
  reservoirEntries: 6,
  shaftLength: 12,
});

export function createCockAndBallsComposer({
  controller,
  limits: suppliedLimits,
} = {}) {
  if (!controller || typeof controller.execute !== 'function') {
    throw new TypeError('controller must expose an execute function.');
  }
  const limits = normalizeLimits(suppliedLimits);
  let root = null;
  let tip = null;
  let nextStep = 0;
  const shaft = [];
  const balls = {
    left: { label: 'left', entries: [], omitted: 0 },
    right: { label: 'right', entries: [], omitted: 0 },
  };

  function setRoot(source, reason = 'navigator') {
    root = { ...handleFact(source), reason: nonEmptyString(reason, 'reason') };
    tip = handleFact(source);
    shaft.length = 0;
    shaft.push({
      sequence: ++nextStep,
      type: 'root',
      handle: structuredClone(tip),
    });
    return sensors();
  }

  function nameBall(side, label) {
    const ball = requiredBall(balls, side);
    ball.label = nonEmptyString(label, 'label');
    return sensors();
  }

  async function thrust(draft) {
    if (!tip) throw new TypeError('Choose a root before extending the probe.');
    const command = commandDraft(draft);
    const from = structuredClone(tip);
    const outcome = await controller.execute(command);
    const landed = outcome.receipt.handle
      ? handleFact(outcome.receipt.handle)
      : null;
    const step = {
      sequence: ++nextStep,
      type: 'thrust',
      command: command.command,
      from,
      landed,
      ok: outcome.response.ok,
      partial: outcome.receipt.partial ?? false,
      warningCount: outcome.receipt.warningCount ?? 0,
      error: outcome.receipt.error ?? null,
    };
    shaft.push(step);
    if (landed) tip = landed;
    trimShaft();
    return { ...outcome, penetration: structuredClone(step), sensors: sensors() };
  }

  function pull(side, reason) {
    if (!tip) throw new TypeError('The probe has no current tip.');
    const ball = requiredBall(balls, side);
    ball.entries.push({
      handle: structuredClone(tip),
      reason: nonEmptyString(reason, 'reason'),
      collectedAtStep: nextStep,
    });
    while (ball.entries.length > limits.reservoirEntries) {
      ball.entries.shift();
      ball.omitted += 1;
    }
    return sensors();
  }

  function retract(target = 'root') {
    if (!root) throw new TypeError('Choose a root before retracting.');
    if (target === 'root') {
      tip = handleFact(root);
      shaft.length = 1;
      shaft.push({
        sequence: ++nextStep,
        type: 'retract',
        handle: structuredClone(tip),
      });
      trimShaft();
      return sensors();
    }
    if (!Number.isSafeInteger(target) || target < 0 || target >= shaft.length) {
      throw new TypeError('target must be root or a visible shaft index.');
    }
    const selected = shaft[target];
    const handle = selected.landed ?? selected.handle ?? selected.from;
    if (!handle) throw new TypeError('The selected shaft point has no handle.');
    tip = structuredClone(handle);
    shaft.splice(target + 1);
    shaft.push({
      sequence: ++nextStep,
      type: 'retract',
      handle: structuredClone(tip),
    });
    trimShaft();
    return sensors();
  }

  function sensors() {
    return structuredClone({
      root,
      balls,
      probe: {
        tip,
        shaft,
        pressure: shaft.length / limits.shaftLength,
      },
      limits,
    });
  }

  function trimShaft() {
    while (shaft.length > limits.shaftLength) {
      // Preserve the root landmark while forgetting the oldest movable step.
      shaft.splice(1, 1);
    }
  }

  return Object.freeze({
    setRoot,
    nameBall,
    thrust,
    pull,
    retract,
    sensors,
  });
}

function requiredBall(balls, side) {
  if (side !== 'left' && side !== 'right') {
    throw new TypeError('side must be left or right.');
  }
  return balls[side];
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
    throw new TypeError('thrust requires a command draft.');
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
