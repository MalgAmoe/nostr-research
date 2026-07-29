const DEFAULT_LIMITS = Object.freeze({
  questions: 7,
  negatives: 4,
});

export function createDarkroomComposer({ controller, limits: suppliedLimits } = {}) {
  if (!controller || typeof controller.execute !== 'function') {
    throw new TypeError('controller must expose an execute function.');
  }
  const limits = normalizeLimits(suppliedLimits);
  let ground = null;
  let nextQuestion = 0;
  let nextNegative = 0;
  const questions = [];
  const negatives = [];

  function setGround(source, reason = 'navigator') {
    ground = { ...handleFact(source), reason: nonEmptyString(reason, 'reason') };
    return sensors();
  }

  function addQuestion(text) {
    const question = {
      id: `q${++nextQuestion}`,
      text: nonEmptyString(text, 'question'),
      status: 'open',
    };
    questions.push(question);
    while (questions.length > limits.questions) questions.shift();
    return structuredClone(question);
  }

  function setQuestionStatus(id, status) {
    if (!['open', 'parked', 'answered', 'discarded'].includes(status)) {
      throw new TypeError('status must be open, parked, answered, or discarded.');
    }
    const question = questions.find((candidate) => candidate.id === id);
    if (!question) throw new TypeError(`Unknown question: ${id}.`);
    question.status = status;
    return structuredClone(question);
  }

  async function develop({ label, questionId = null, a, b } = {}) {
    if (!ground) throw new TypeError('Choose Ground before developing an exposure.');
    if (questionId !== null && !questions.some(({ id }) => id === questionId)) {
      throw new TypeError(`Unknown question: ${questionId}.`);
    }
    const aCommand = commandDraft(a, 'a');
    const bCommand = commandDraft(b, 'b');
    const aOutcome = await controller.execute(aCommand);
    const bOutcome = await controller.execute(bCommand);
    const aFact = outcomeFact(aOutcome);
    const bFact = outcomeFact(bOutcome);
    const negative = {
      id: `n${++nextNegative}`,
      label: nonEmptyString(label, 'label'),
      questionId,
      ground: structuredClone(ground),
      a: { command: aCommand, outcome: aFact },
      b: { command: bCommand, outcome: bFact },
      contrast: mechanicalContrast(aFact, bFact, ground),
    };
    negatives.push(negative);
    while (negatives.length > limits.negatives) negatives.shift();
    return {
      negative: structuredClone(negative),
      outcomes: { a: aOutcome, b: bOutcome },
      sensors: sensors(),
    };
  }

  function sensors() {
    return structuredClone({
      ground,
      questions,
      negatives,
      limits,
    });
  }

  return Object.freeze({
    setGround,
    addQuestion,
    setQuestionStatus,
    develop,
    sensors,
  });
}

function outcomeFact(outcome) {
  return {
    ok: outcome.response.ok,
    handle: outcome.receipt.handle ? handleFact(outcome.receipt.handle) : null,
    partial: outcome.receipt.partial ?? false,
    warningCount: outcome.receipt.warningCount ?? 0,
    error: outcome.receipt.error ?? null,
  };
}

function mechanicalContrast(a, b, ground) {
  const aCount = a.handle?.count ?? null;
  const bCount = b.handle?.count ?? null;
  const groundCount = ground?.count ?? null;
  return {
    comparable: aCount !== null && bCount !== null
      && a.handle.kind === b.handle.kind,
    aCount,
    bCount,
    countDifference: aCount !== null && bCount !== null ? aCount - bCount : null,
    groundCount,
    aShare: share(aCount, groundCount),
    bShare: share(bCount, groundCount),
    sameKind: a.handle && b.handle ? a.handle.kind === b.handle.kind : null,
    anyPartial: a.partial || b.partial,
  };
}

function share(count, groundCount) {
  if (count === null || groundCount === null || groundCount === 0) return null;
  return count / groundCount;
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

function commandDraft(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || typeof value.command !== 'string') {
    throw new TypeError(`${label} must be a command draft.`);
  }
  if (Object.hasOwn(value, 'commandId')) {
    throw new TypeError(`${label} must not contain commandId.`);
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
