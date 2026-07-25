import { isCanonicalNostrEvent, ResearchMemoryError } from './index.js';

export function planAcquisitionSlices(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new ResearchMemoryError('Acquisition slice options are required.');
  }
  const allowed = new Set(['relays', 'filter', 'since', 'until', 'targetSeconds']);
  const unknown = Object.keys(options).filter((key) => !allowed.has(key));
  if (unknown.length) throw new ResearchMemoryError(`Unknown acquisition slice option: ${unknown[0]}.`);
  if (!Array.isArray(options.relays) || options.relays.length === 0) {
    throw new ResearchMemoryError('Time slicing requires explicit relays.');
  }
  for (const key of ['since', 'until', 'targetSeconds']) {
    if (!Number.isSafeInteger(options[key]) || options[key] < (key === 'targetSeconds' ? 1 : 0)) {
      throw new ResearchMemoryError(`${key} must be a ${key === 'targetSeconds' ? 'positive' : 'non-negative'} integer.`);
    }
  }
  if (options.since > options.until) {
    throw new ResearchMemoryError('Slice since must be less than or equal to until.');
  }
  if (!options.filter || typeof options.filter !== 'object' || Array.isArray(options.filter)) {
    throw new ResearchMemoryError('Time slicing requires a NIP-01 filter object.');
  }
  const slices = [];
  for (let since = options.since; since <= options.until; since += options.targetSeconds) {
    const until = Math.min(options.until, since + options.targetSeconds - 1);
    slices.push({
      relays: structuredClone(options.relays),
      filter: { ...structuredClone(options.filter), since, until },
      slice: { since, until, exhaustive: false },
    });
  }
  return slices;
}

export function relayQueryLimit(filter, relayInformation) {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    throw new ResearchMemoryError('A NIP-01 filter object is required.');
  }
  const advertised = (relayInformation?.advertised ?? relayInformation)?.limitation?.max_limit;
  if (advertised === undefined) return structuredClone(filter);
  if (!Number.isSafeInteger(advertised) || advertised <= 0) {
    throw new ResearchMemoryError('Advertised relay max_limit must be a positive integer.');
  }
  return {
    ...structuredClone(filter),
    limit: Math.min(filter.limit ?? advertised, advertised),
  };
}

export async function fetchRelayInformation(relay, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new ResearchMemoryError('NIP-11 options must be an object.');
  }
  const timeoutMs = options.timeoutMs ?? 3_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new ResearchMemoryError('NIP-11 timeoutMs must be a positive integer.');
  }
  let url;
  try {
    url = new URL(relay);
  } catch {
    throw new ResearchMemoryError(`Invalid relay URL: ${relay}`);
  }
  if (url.protocol !== 'wss:' || url.username || url.password || url.hash) {
    throw new ResearchMemoryError('NIP-11 retrieval requires an explicit wss:// relay URL.');
  }
  url.protocol = 'https:';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await (options.fetch ?? globalThis.fetch)(url, {
      headers: { Accept: 'application/nostr+json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ResearchMemoryError(`NIP-11 request failed with HTTP ${response.status}.`);
    }
    const information = await response.json();
    if (!information || typeof information !== 'object' || Array.isArray(information)) {
      throw new ResearchMemoryError('NIP-11 response must be a JSON object.');
    }
    return {
      relay: relay,
      retrievedAt: new Date().toISOString(),
      advertised: structuredClone(information),
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ResearchMemoryError(
        options.signal?.aborted ? 'NIP-11 retrieval was cancelled.' : 'NIP-11 retrieval timed out.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

export function parseNip65RelayList(event) {
  if (!isCanonicalNostrEvent(event) || event.kind !== 10002) {
    throw new ResearchMemoryError('NIP-65 parsing requires a canonical kind-10002 event.');
  }
  const relays = new Map();
  for (const tag of event.tags) {
    if (tag[0] !== 'r' || typeof tag[1] !== 'string') continue;
    let relay;
    try {
      const url = new URL(tag[1]);
      if (!['wss:', 'ws:'].includes(url.protocol)) continue;
      relay = url.href;
    } catch {
      continue;
    }
    const marker = tag[2];
    if (marker !== undefined && !['read', 'write'].includes(marker)) continue;
    const entry = relays.get(relay) ?? { relay, read: false, write: false };
    if (marker === undefined || marker === 'read') entry.read = true;
    if (marker === undefined || marker === 'write') entry.write = true;
    relays.set(relay, entry);
  }
  return {
    eventId: event.id,
    author: event.pubkey,
    createdAt: event.created_at,
    relays: [...relays.values()].sort((left, right) => left.relay.localeCompare(right.relay)),
    evidence: { kind: 10002, protocol: 'NIP-65', advertisedBy: event.pubkey },
  };
}
