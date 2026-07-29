import { arrangeObservation } from '@nostrarium/schema-composer';

const DEFAULT_LIMITS = Object.freeze({
  questions: 7,
  routes: 3,
  stepsPerRoute: 5,
  recentOutcomes: 5,
});

export function createAirlockComposer({ controller, limits: suppliedLimits } = {}) {
  if (!isController(controller)) {
    throw new TypeError('controller must expose an execute function.');
  }
  const limits = normalizeLimits(suppliedLimits);
  let nextQuestion = 0;
  let nextOutcome = 0;
  let home = emptyHome();
  let weather = {
    observedAt: null,
    facts: [],
    language: ['Weather has not been observed yet.'],
  };
  const questions = [];
  const routes = new Map();
  const alternatives = new Map();
  const outcomes = [];

  function setHome({ primary, references = [], evidence = [] } = {}, reason = 'navigator') {
    home = {
      primary: handleFact(primary),
      references: handleFacts(references, 'references'),
      evidence: handleFacts(evidence, 'evidence'),
      reason: nonEmptyString(reason, 'reason'),
    };
    return sensors();
  }

  function addQuestion(text) {
    const question = {
      id: `q${++nextQuestion}`,
      text: nonEmptyString(text, 'question'),
      status: 'active',
    };
    questions.push(question);
    while (questions.length > limits.questions) questions.shift();
    return structuredClone(question);
  }

  function setQuestionStatus(id, status) {
    if (!['active', 'parked', 'answered', 'discarded'].includes(status)) {
      throw new TypeError('status must be active, parked, answered, or discarded.');
    }
    const question = questions.find((candidate) => candidate.id === id);
    if (!question) throw new TypeError(`Unknown question: ${id}.`);
    question.status = status;
    return structuredClone(question);
  }

  function stageRoute({ id, label, steps } = {}) {
    const routeId = nonEmptyString(id, 'route.id');
    if (routes.has(routeId)) throw new TypeError(`Route already exists: ${routeId}.`);
    if (routes.size >= limits.routes) {
      throw new TypeError(`The Airlock can hold at most ${limits.routes} routes.`);
    }
    if (!Array.isArray(steps) || steps.length === 0
        || steps.length > limits.stepsPerRoute) {
      throw new TypeError(
        `route.steps must contain 1 to ${limits.stepsPerRoute} commands.`,
      );
    }
    const route = {
      id: routeId,
      label: nonEmptyString(label, 'route.label'),
      steps: steps.map((draft, index) => commandDraft(draft, index)),
      cursor: 0,
      status: 'staged',
      outcomes: [],
    };
    routes.set(routeId, route);
    return structuredClone(route);
  }

  function discardRoute(id) {
    const route = requiredRoute(routes, id);
    routes.delete(route.id);
    return structuredClone(route);
  }

  async function executeNext(id) {
    const route = requiredRoute(routes, id);
    if (route.cursor >= route.steps.length) {
      throw new TypeError(`Route has no remaining step: ${route.id}.`);
    }
    const command = structuredClone(route.steps[route.cursor]);
    const outcome = await controller.execute(command);
    const record = {
      sequence: ++nextOutcome,
      routeId: route.id,
      step: route.cursor,
      command,
      receipt: structuredClone(outcome.receipt),
    };
    route.cursor += 1;
    route.status = route.cursor === route.steps.length ? 'complete' : 'paused';
    route.outcomes.push(record);
    outcomes.push(record);
    while (outcomes.length > limits.recentOutcomes) outcomes.shift();
    if (outcome.receipt.handle) {
      alternatives.set(outcome.receipt.handle.id, structuredClone(outcome.receipt.handle));
    }
    return {
      command,
      ...outcome,
      airlock: routeView(route),
      sensors: sensors(),
    };
  }

  function adopt(source, role = 'primary', reason = 'navigator') {
    const handle = handleFact(source);
    if (role === 'primary') {
      home = { ...home, primary: handle, reason: nonEmptyString(reason, 'reason') };
    } else if (role === 'reference' || role === 'evidence') {
      const key = role === 'reference' ? 'references' : 'evidence';
      home = {
        ...home,
        [key]: uniqueHandles([...home[key], handle]),
        reason: nonEmptyString(reason, 'reason'),
      };
    } else {
      throw new TypeError('role must be primary, reference, or evidence.');
    }
    return sensors();
  }

  async function observeWeather() {
    if (!home.primary) throw new TypeError('Choose Home before observing Weather.');
    const outcome = await controller.execute({
      command: 'show',
      input: home.primary.id,
      parameters: { mode: 'summary' },
    });
    if (outcome.response.ok === true) {
      const panels = arrangeObservation(outcome.response);
      weather = weatherFrom(panels, outcomes.at(-1));
      return { ...outcome, panels, sensors: sensors() };
    }
    return { ...outcome, sensors: sensors() };
  }

  function sensors() {
    return structuredClone({
      home,
      questions,
      weather,
      alternatives: [...alternatives.values()],
      airlock: [...routes.values()].map(routeView),
      limits,
    });
  }

  return Object.freeze({
    setHome,
    addQuestion,
    setQuestionStatus,
    stageRoute,
    discardRoute,
    executeNext,
    adopt,
    observeWeather,
    sensors,
  });
}

function weatherFrom(panels, lastOutcome) {
  const orientation = panels.orientation;
  const evidence = panels.evidence;
  const completeness = orientation.completeness;
  const facts = [{
    type: 'home-shape',
    count: orientation.count,
    countUnit: orientation.countUnit,
  }];
  const language = [
    `Home contains ${orientation.count} ${orientation.countUnit ?? 'items'}.`,
  ];
  if (completeness) {
    facts.push({ type: 'completeness', value: completeness });
    if (completeness.status === 'partial' || completeness.exhaustive === false) {
      language.push('The visible field is bounded; absence is not global absence.');
    }
  }
  if (evidence.evidenceResolution) {
    facts.push({ type: 'evidence-resolution', value: evidence.evidenceResolution });
    if ((evidence.evidenceResolution.unresolved ?? 0) > 0) {
      language.push(
        `${evidence.evidenceResolution.unresolved} subjects lack resolved evidence.`,
      );
    }
  }
  if (evidence.eventFacts) {
    facts.push({ type: 'event-facts', value: evidence.eventFacts });
    const leadingKind = [...(evidence.eventFacts.kindHistogram ?? [])]
      .sort((left, right) => right.count - left.count)[0];
    if (leadingKind) {
      language.push(
        `The most visible event kind is ${leadingKind.kind} (${leadingKind.count} events).`,
      );
    }
    if (Number.isSafeInteger(evidence.eventFacts.distinctAuthorCount)) {
      language.push(
        `${evidence.eventFacts.distinctAuthorCount} distinct authors are visible.`,
      );
    }
  }
  if (lastOutcome?.receipt?.handle?.count === 0) {
    facts.push({ type: 'recent-dead-end', routeId: lastOutcome.routeId });
    language.push(`Route ${lastOutcome.routeId} most recently produced an empty handle.`);
  }
  return {
    observedAt: new Date().toISOString(),
    facts,
    language,
  };
}

function routeView(route) {
  return {
    id: route.id,
    label: route.label,
    status: route.status,
    cursor: route.cursor,
    stepCount: route.steps.length,
    remaining: route.steps.length - route.cursor,
    nextCommand: route.steps[route.cursor] ?? null,
    outcomes: route.outcomes,
  };
}

function emptyHome() {
  return { primary: null, references: [], evidence: [], reason: null };
}

function handleFacts(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  return uniqueHandles(value.map(handleFact));
}

function uniqueHandles(handles) {
  return [...new Map(handles.map((handle) => [handle.id, handle])).values()];
}

function handleFact(source) {
  const handle = source?.receipt?.handle
    ?? source?.response?.result?.handle
    ?? source?.handle
    ?? source;
  if (!isPlainObject(handle)) {
    throw new TypeError('A Home value must expose an ordinary result handle.');
  }
  const id = nonEmptyString(handle.id, 'handle.id');
  if (typeof handle.kind !== 'string' || handle.kind.length === 0) {
    throw new TypeError('handle.kind must be a non-empty string.');
  }
  if (!Number.isSafeInteger(handle.count) || handle.count < 0) {
    throw new TypeError('handle.count must be a non-negative integer.');
  }
  return structuredClone({
    id,
    kind: handle.kind,
    count: handle.count,
    ...(typeof handle.scope === 'string' ? { scope: handle.scope } : {}),
  });
}

function commandDraft(value, index) {
  if (!isPlainObject(value) || typeof value.command !== 'string') {
    throw new TypeError(`route.steps[${index}] must be a command draft.`);
  }
  if (Object.hasOwn(value, 'commandId')) {
    throw new TypeError(`route.steps[${index}] must not contain commandId.`);
  }
  try {
    return structuredClone(value);
  } catch {
    throw new TypeError(`route.steps[${index}] must be structured-cloneable.`);
  }
}

function requiredRoute(routes, id) {
  const route = routes.get(nonEmptyString(id, 'route ID'));
  if (!route) throw new TypeError(`Unknown route: ${id}.`);
  return route;
}

function normalizeLimits(value) {
  if (value === undefined) return DEFAULT_LIMITS;
  if (!isPlainObject(value)) throw new TypeError('limits must be a plain object.');
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

function isController(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.execute === 'function';
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
