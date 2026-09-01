const DEFAULT_LIMITS = Object.freeze({
  entries: 12,
  entryBytes: 4_000,
  totalBytes: 24_000,
});

export function createVoyageAttention({ limits: suppliedLimits } = {}) {
  const limits = normalizeLimits(suppliedLimits);
  const entries = new Map();

  function view() {
    return state();
  }

  function get(key) {
    const normalizedKey = attentionKey(key);
    if (!entries.has(normalizedKey)) {
      throw new TypeError(`Unknown attention entry: ${normalizedKey}.`);
    }
    return structuredClone(entryFact(normalizedKey, entries.get(normalizedKey)));
  }

  function put(key, value) {
    const normalizedKey = attentionKey(key);
    const normalizedValue = jsonValue(value);
    const valueBytes = jsonBytes(normalizedValue);
    if (valueBytes > limits.entryBytes) {
      throw new TypeError(
        `Attention entry ${normalizedKey} uses ${valueBytes} bytes; limit is ${limits.entryBytes}.`,
      );
    }
    if (!entries.has(normalizedKey) && entries.size >= limits.entries) {
      throw new TypeError(`Attention already contains its ${limits.entries} entry limit.`);
    }
    const nextTotal = totalBytes()
      - (entries.has(normalizedKey) ? entryBytes(normalizedKey, entries.get(normalizedKey)) : 0)
      + entryBytes(normalizedKey, normalizedValue);
    if (nextTotal > limits.totalBytes) {
      throw new TypeError(
        `Attention would use ${nextTotal} bytes; total limit is ${limits.totalBytes}.`,
      );
    }
    entries.set(normalizedKey, normalizedValue);
    return {
      entry: structuredClone(entryFact(normalizedKey, normalizedValue)),
      attention: accounting(),
    };
  }

  function remove(key) {
    const normalizedKey = attentionKey(key);
    if (!entries.has(normalizedKey)) {
      throw new TypeError(`Unknown attention entry: ${normalizedKey}.`);
    }
    const removed = entryFact(normalizedKey, entries.get(normalizedKey));
    entries.delete(normalizedKey);
    return { removed: structuredClone(removed), attention: accounting() };
  }

  function clear() {
    const removedCount = entries.size;
    entries.clear();
    return { removedCount, attention: accounting() };
  }

  function state() {
    return structuredClone({
      entries: Object.fromEntries(entries),
      ...accounting(),
    });
  }

  function accounting() {
    return {
      entryCount: entries.size,
      totalBytes: totalBytes(),
      keys: [...entries.keys()],
      limits,
    };
  }

  function totalBytes() {
    let total = 0;
    for (const [key, value] of entries) total += entryBytes(key, value);
    return total;
  }

  return Object.freeze({ view, get, put, remove, clear, state });
}

function entryFact(key, value) {
  return { key, value, bytes: entryBytes(key, value) };
}

function entryBytes(key, value) {
  return new TextEncoder().encode(key).length + jsonBytes(value);
}

function jsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function jsonValue(value) {
  assertJsonValue(value, new Set(), 0);
  return structuredClone(value);
}

function assertJsonValue(value, ancestors, depth) {
  if (depth > 12) throw new TypeError('Attention values may not exceed 12 levels of nesting.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Attention numbers must be finite.');
    return;
  }
  if (typeof value !== 'object') {
    throw new TypeError('Attention values must be JSON data.');
  }
  if (ancestors.has(value)) throw new TypeError('Attention values may not contain cycles.');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Attention values must contain only JSON objects and arrays.');
  }
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (const item of value) assertJsonValue(item, ancestors, depth + 1);
  } else {
    for (const [key, item] of Object.entries(value)) {
      attentionObjectKey(key);
      assertJsonValue(item, ancestors, depth + 1);
    }
  }
  ancestors.delete(value);
}

function attentionKey(value) {
  const key = nonEmptyString(value, 'attention key');
  if (key.length > 100) throw new TypeError('attention key may not exceed 100 characters.');
  return key;
}

function attentionObjectKey(value) {
  if (value.length > 200) throw new TypeError('Attention object keys may not exceed 200 characters.');
}

function normalizeLimits(value) {
  if (value === undefined) return DEFAULT_LIMITS;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('attention limits must be a plain object.');
  }
  if (Object.keys(value).some((key) => !Object.hasOwn(DEFAULT_LIMITS, key))) {
    throw new TypeError('Unknown attention limit.');
  }
  const limits = { ...DEFAULT_LIMITS, ...value };
  for (const [name, limit] of Object.entries(limits)) {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new TypeError(`attention limit ${name} must be a positive integer.`);
    }
  }
  return Object.freeze(limits);
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
    throw new TypeError(`${label} must be a non-empty trimmed string.`);
  }
  return value;
}
