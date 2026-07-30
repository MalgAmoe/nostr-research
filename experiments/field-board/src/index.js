const DEFAULT_BRANCH_LIMIT = 8;
const MAX_FACTS = 24;

export function createFieldBoard({
  ground,
  branches = [],
  focus,
  branchLimit = DEFAULT_BRANCH_LIMIT,
} = {}) {
  integer(branchLimit, 'branchLimit', 1, 20);
  if (!Array.isArray(branches)) throw new TypeError('branches must be an array.');
  if (branches.length > branchLimit) {
    throw new TypeError(`branches must contain at most ${branchLimit} frames.`);
  }

  const groundFrame = normalizeFrame(ground, 'ground');
  let branchFrames = branches.map((branch) => normalizeFrame(
    branch,
    'branch',
    groundFrame.key,
  ));
  uniqueKeys([groundFrame, ...branchFrames]);
  let focusedKey = focus === undefined
    ? groundFrame.key
    : requiredFrameKey([groundFrame, ...branchFrames], focus);

  function select(key) {
    focusedKey = requiredFrameKey([groundFrame, ...branchFrames], key);
    return snapshot();
  }

  function addBranch(value) {
    if (branchFrames.length >= branchLimit) {
      throw new TypeError(`Field board already contains its ${branchLimit} branch limit.`);
    }
    const added = normalizeFrame(value, 'branch', groundFrame.key);
    uniqueKeys([groundFrame, ...branchFrames, added]);
    branchFrames = [...branchFrames, added];
    return {
      added: structuredClone(added.handle),
      board: snapshot(),
    };
  }

  function replaceBranch(key, replacement) {
    const index = branchFrames.findIndex((frame) => frame.key === key);
    if (index === -1) throw new TypeError(`Unknown branch frame: ${key}.`);
    const next = normalizeFrame(replacement, 'branch', groundFrame.key);
    uniqueKeys([
      groundFrame,
      ...branchFrames.filter((_, candidate) => candidate !== index),
      next,
    ]);
    const displaced = branchFrames[index];
    branchFrames = branchFrames.with(index, next);
    if (focusedKey === displaced.key) focusedKey = next.key;
    return {
      displaced: structuredClone(displaced.handle),
      board: snapshot(),
    };
  }

  function handle(key = focusedKey) {
    const frame = [groundFrame, ...branchFrames]
      .find(({ key: candidate }) => candidate === key);
    if (!frame) throw new TypeError(`Unknown board frame: ${key}.`);
    return structuredClone(frame.handle);
  }

  function snapshot() {
    const frames = [groundFrame, ...branchFrames];
    return structuredClone({
      type: 'field-board',
      ground: groundFrame,
      branches: branchFrames,
      focus: focusedKey,
      focusedHandle: handle(focusedKey),
      contrasts: {
        againstGround: branchFrames.map((branch) => contrast(groundFrame, branch)),
        betweenBranches: pairwise(branchFrames),
      },
      limits: {
        branchLimit,
        branchCount: branchFrames.length,
        remainingBranches: branchLimit - branchFrames.length,
      },
    });
  }

  return Object.freeze({ select, addBranch, replaceBranch, handle, snapshot });
}

export function formatFieldBoard(board, { contrastLimit = 20 } = {}) {
  if (!plain(board) || board.type !== 'field-board') {
    throw new TypeError('board must be a field-board snapshot.');
  }
  integer(contrastLimit, 'contrastLimit', 0, 100);
  const lines = [
    `FIELD BOARD · ${1 + board.branches.length} frames · focus ${board.focus}`,
    '',
    formatFrame(board.ground, board.focus),
  ];

  if (board.branches.length) {
    lines.push('', `BRANCHES FROM ${board.ground.label}`);
    for (const branch of board.branches) {
      lines.push('', formatFrame(branch, board.focus, board.ground.label));
      const groundContrast = board.contrasts.againstGround
        .find(({ right }) => right === branch.key);
      lines.push(formatGroundContrast(groundContrast, board.ground, branch));
    }
  }

  const contrasts = board.contrasts.betweenBranches.slice(0, contrastLimit);
  if (board.contrasts.betweenBranches.length) {
    lines.push('', 'BRANCH CONTRASTS');
    for (const item of contrasts) lines.push(formatPair(item, board));
    const omitted = board.contrasts.betweenBranches.length - contrasts.length;
    if (omitted > 0) lines.push(`${omitted} pairwise contrasts omitted`);
  }

  lines.push('', `exit handle: ${board.focusedHandle.id}`);
  return lines.join('\n');
}

function normalizeFrame(value, role, groundKey = null) {
  if (!plain(value)) throw new TypeError(`${role} frame must be a plain object.`);
  const key = text(value.key, `${role}.key`);
  const label = text(value.label, `${role}.label`);
  const reason = text(value.reason, `${role}.reason`);
  const handle = handleFact(value.source);
  const observed = summaryFact(value.observation, handle);
  if (observed.count !== handle.count) {
    throw new TypeError(
      `${role} handle count ${handle.count} does not match observed count ${observed.count}.`,
    );
  }
  return {
    key,
    label,
    role,
    ...(role === 'branch' ? { parent: groundKey } : {}),
    reason,
    handle,
    resultKind: observed.resultKind,
    countUnit: observed.countUnit,
    bounds: observed.bounds,
    resolution: observed.resolution,
    completeness: observed.completeness,
    lineage: observed.lineage,
  };
}

function summaryFact(observation, handle) {
  if (!plain(observation)) {
    throw new TypeError('frame observation must contain a command and outcome.');
  }
  const command = observation.command;
  if (!plain(command) || command.command !== 'show'
      || command.input !== handle.id || command.parameters?.mode !== 'summary') {
    throw new TypeError(
      `frame observation must be an already-requested summary for ${handle.id}.`,
    );
  }
  const response = observation.outcome?.response ?? observation.outcome;
  if (!plain(response) || response.ok !== true || !plain(response.result)) {
    throw new TypeError('frame observation outcome must be a successful response.');
  }
  const result = response.result;
  if (result.observation !== 'summary' || !plain(result.summary)) {
    throw new TypeError('frame observation outcome must contain a summary result.');
  }
  const summary = result.summary;
  if (!Number.isSafeInteger(summary.count) || summary.count < 0) {
    throw new TypeError('frame summary count must be a non-negative integer.');
  }
  return {
    count: summary.count,
    resultKind: optionalText(summary.resultKind),
    countUnit: optionalText(summary.countUnit),
    bounds: finiteFacts(summary.bounds),
    resolution: numericFacts(summary.evidenceResolution),
    completeness: completenessFact(summary.completeness),
    lineage: lineageFact(summary.lineage),
  };
}

function handleFact(source) {
  const candidate = source?.receipt?.handle
    ?? source?.response?.result?.handle
    ?? source?.result?.handle
    ?? source?.handle
    ?? source;
  if (!plain(candidate)) throw new TypeError('frame source must expose an ordinary handle.');
  const handle = {
    id: text(candidate.id, 'handle.id'),
    kind: text(candidate.kind, 'handle.kind'),
  };
  if (!Number.isSafeInteger(candidate.count) || candidate.count < 0) {
    throw new TypeError('handle.count must be a non-negative integer.');
  }
  handle.count = candidate.count;
  if (Number.isSafeInteger(candidate.revision) && candidate.revision >= 0) {
    handle.revision = candidate.revision;
  }
  if (typeof candidate.scope === 'string' && candidate.scope.length) {
    handle.scope = candidate.scope;
  }
  return handle;
}

function contrast(left, right) {
  const sameKind = left.handle.kind === right.handle.kind;
  return {
    left: left.key,
    right: right.key,
    sameKind,
    counts: { left: left.handle.count, right: right.handle.count },
    countDifference: right.handle.count - left.handle.count,
    rightCountRatioToLeft: sameKind ? ratio(right.handle.count, left.handle.count) : null,
    resolutionDifferences: changedFacts(
      resolutionProfile(left.resolution),
      resolutionProfile(right.resolution),
    ),
    boundComparison: compareBounds(boundProfile(left.bounds), boundProfile(right.bounds)),
  };
}

function pairwise(frames) {
  const pairs = [];
  for (let left = 0; left < frames.length; left += 1) {
    for (let right = left + 1; right < frames.length; right += 1) {
      pairs.push(contrast(frames[left], frames[right]));
    }
  }
  return pairs;
}

function changedFacts(left, right) {
  return [...new Set([...Object.keys(left ?? {}), ...Object.keys(right ?? {})])]
    .filter((key) => left?.[key] !== right?.[key])
    .slice(0, MAX_FACTS)
    .map((key) => ({ key, left: left?.[key] ?? null, right: right?.[key] ?? null }));
}

function compareBounds(left, right) {
  const leftKeys = Object.keys(left ?? {});
  const rightKeys = Object.keys(right ?? {});
  const rightSet = new Set(rightKeys);
  const leftSet = new Set(leftKeys);
  const sharedKeys = leftKeys.filter((key) => rightSet.has(key)).slice(0, MAX_FACTS);
  return {
    comparable: sharedKeys.length > 0,
    sharedKeys,
    sharedDifferences: sharedKeys
      .filter((key) => !sameFact(left[key], right[key]))
      .map((key) => ({ key, left: left[key], right: right[key] })),
    leftOnly: leftKeys.filter((key) => !rightSet.has(key)).slice(0, MAX_FACTS),
    rightOnly: rightKeys.filter((key) => !leftSet.has(key)).slice(0, MAX_FACTS),
  };
}

function sameFact(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatFrame(frame, focusedKey, parentLabel = null) {
  const lines = [
    `${frame.role.toUpperCase()} · ${frame.label}${frame.key === focusedKey ? ' · FOCUSED' : ''}`,
    `${frame.handle.kind} · ${frame.handle.count} ${frame.countUnit ?? 'items'}${frame.resultKind ? ` · ${frame.resultKind}` : ''}`,
    `reason (caller): ${frame.reason}`,
  ];
  if (frame.parent) lines.push(`from: ${parentLabel ?? frame.parent}`);
  const lineage = inlineFacts(frame.lineage);
  if (lineage) lines.push(`lineage · ${lineage}`);
  const resolution = inlineFacts(frame.resolution);
  if (resolution) lines.push(`resolution · ${resolution}`);
  const bounds = inlineFacts(frame.bounds);
  if (bounds) lines.push(`bounds · ${bounds}`);
  const completeness = inlineFacts(frame.completeness);
  if (completeness) lines.push(`completeness · ${completeness}`);
  lines.push(`handle: ${frame.handle.id}`);
  return lines.join('\n');
}

function formatGroundContrast(item, ground, branch) {
  const ratioText = !item.sameKind
    ? 'count ratio unavailable for different kinds'
    : item.rightCountRatioToLeft === null
      ? 'count ratio unavailable for zero Ground count'
      : `same-kind count ratio ${(item.rightCountRatioToLeft * 100).toFixed(1)}% · overlap not established`;
  const bounds = formatBoundComparison(item.boundComparison, ground.label, branch.label);
  return `beside Ground · counts ${branch.handle.count} ${branch.handle.kind} / ${ground.handle.count} ${ground.handle.kind} · ${ratioText}\nbound contrast · ${bounds}`;
}

function formatPair(item, board) {
  const left = frameByKey(board, item.left);
  const right = frameByKey(board, item.right);
  const resolution = item.resolutionDifferences.length
    ? `resolution profile differs: ${item.resolutionDifferences.map(({ key }) => key).join(', ')}`
    : 'resolution profile same';
  const bounds = formatBoundComparison(item.boundComparison, left.label, right.label);
  const kinds = item.sameKind
    ? `kind ${left.handle.kind}`
    : `kinds ${left.handle.kind} / ${right.handle.kind}`;
  return `${left.label} ↔ ${right.label} · ${kinds} · counts ${item.counts.left} / ${item.counts.right} · ${resolution} · bounds: ${bounds}`;
}

function formatBoundComparison(comparison, leftLabel, rightLabel) {
  const facts = [comparison.comparable
    ? comparison.sharedDifferences.length
      ? `shared values differ: ${comparison.sharedDifferences.map(({ key }) => key).join(', ')}`
      : 'shared values same'
    : 'no comparable keys'];
  if (comparison.leftOnly.length) {
    facts.push(`${leftLabel} only: ${comparison.leftOnly.join(', ')}`);
  }
  if (comparison.rightOnly.length) {
    facts.push(`${rightLabel} only: ${comparison.rightOnly.join(', ')}`);
  }
  return facts.join(' · ');
}

function frameByKey(board, key) {
  return [board.ground, ...board.branches].find(({ key: candidate }) => candidate === key);
}

function finiteFacts(value) {
  if (!plain(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, MAX_FACTS).flatMap(([key, fact]) => {
    if (fact === null || ['string', 'number', 'boolean'].includes(typeof fact)) {
      return [[key, fact]];
    }
    if (Array.isArray(fact)) {
      return [[key, fact.slice(0, MAX_FACTS).filter((item) => (
        item === null || ['string', 'number', 'boolean'].includes(typeof item)
      ))]];
    }
    return [];
  }));
}

function numericFacts(value) {
  if (!plain(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, MAX_FACTS)
    .filter(([, fact]) => Number.isFinite(fact)));
}

function completenessFact(value) {
  if (!plain(value)) return {};
  return finiteFacts(value);
}

function lineageFact(value) {
  if (!plain(value)) return {};
  const names = [
    'operation', 'sourceOperation', 'stageCount', 'relationship', 'source',
    'field', 'subjectType', 'inputCount', 'startCount', 'limit', 'rowCount',
    'distinctSubjects', 'retainedSubjects', 'omittedByLimit',
  ];
  const facts = Object.fromEntries(names
    .filter((name) => Object.hasOwn(value, name))
    .map((name) => [name, value[name]]));
  if (plain(value.latestStage)) {
    if (value.latestStage.operation !== undefined) {
      facts.latestOperation = value.latestStage.operation;
    }
    if (value.latestStage.to !== undefined) facts.latestTo = value.latestStage.to;
    if (value.latestStage.limit !== undefined) facts.latestLimit = value.latestStage.limit;
  }
  return finiteFacts(facts);
}

function inlineFacts(value) {
  return Object.entries(value ?? {}).map(([key, fact]) => (
    Array.isArray(fact) ? `${key} ${fact.join(',')}` : `${key} ${fact}`
  )).join(' · ');
}

function resolutionProfile(resolution) {
  const total = Object.values(resolution ?? {})
    .filter((value) => Number.isFinite(value) && value >= 0)
    .reduce((sum, value) => sum + value, 0);
  if (total === 0) return {};
  return Object.fromEntries(Object.entries(resolution)
    .filter(([, value]) => Number.isFinite(value) && value >= 0)
    .map(([key, value]) => [key, value / total]));
}

function boundProfile(bounds) {
  const cardinalityFacts = new Set(['inputCount', 'discoveredCount', 'outputCount']);
  return Object.fromEntries(Object.entries(bounds ?? {})
    .filter(([key]) => !cardinalityFacts.has(key)));
}

function ratio(part, whole) {
  if (whole === 0) return null;
  return part / whole;
}

function requiredFrameKey(frames, key) {
  const normalized = text(key, 'frame key');
  if (!frames.some(({ key: candidate }) => candidate === normalized)) {
    throw new TypeError(`Unknown board frame: ${normalized}.`);
  }
  return normalized;
}

function uniqueKeys(frames) {
  const seen = new Set();
  for (const frame of frames) {
    if (seen.has(frame.key)) throw new TypeError(`Duplicate board frame: ${frame.key}.`);
    seen.add(frame.key);
  }
}

function optionalText(value) {
  return typeof value === 'string' && value.length ? value : null;
}

function text(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
    throw new TypeError(`${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
}

function plain(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
