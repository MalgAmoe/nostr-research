import { SimplePool } from "nostr-tools";

export function createNostrRuntime({
  defaultRelays,
  isEventAllowed,
  isRelayAllowed,
  persistEvents,
  logUsage,
  relayPool,
  maxWait = 4500,
  cacheTtl = 60_000,
  cacheLimit = 200,
}) {
  const pool = relayPool ?? new SimplePool({ enableReconnect: true });
  const cache = new Map();
  const sources = new Map();
  const allowedEvents = (events = []) => events.filter(isEventAllowed);
  const unique = (events) => [...new Map(events.filter((event) => event?.id).map((event) => [event.id, event])).values()];
  const sourcesFor = (eventOrId) => sources.get(typeof eventOrId === "string" ? eventOrId : eventOrId?.id) ?? [];
  const recordSources = (id, relays = []) => sources.set(id, [...new Set([...sourcesFor(id), ...relays])]);
  const removeSources = (ids = []) => ids.forEach((id) => sources.delete(id));
  const result = (events, state, detail = "") => {
    Object.defineProperty(events, "queryState", { value: { state, detail }, enumerable: false });
    return events;
  };

  async function queryRelay(relay, filter, label) {
    const started = performance.now();
    if (!isRelayAllowed(relay)) {
      logUsage("relay_query", { relay, label, state: "muted", count: 0, durationMs: 0 });
      return result([], "muted");
    }
    try {
      let timer;
      const timedOut = Symbol("relay-timeout");
      const received = await Promise.race([
        pool.querySync([relay], filter, { maxWait, label }),
        new Promise((resolve) => { timer = setTimeout(() => resolve(timedOut), maxWait); }),
      ]);
      clearTimeout(timer);
      if (received === timedOut) {
        logUsage("relay_query", { relay, label, state: "timeout", count: 0, durationMs: Math.round(performance.now() - started) });
        return result([], "timeout");
      }
      const events = allowedEvents(received);
      for (const event of events) recordSources(event.id, [...sourcesFor(event), relay]);
      void Promise.resolve(persistEvents(events, sourcesFor)).catch((error) => {
        logUsage("local_storage_failed", { operation: "store relay events", detail: error.message });
      });
      logUsage("relay_query", { relay, label, state: "ok", count: events.length, blocked: received.length - events.length, durationMs: Math.round(performance.now() - started) });
      return result(events, "ok");
    } catch (error) {
      logUsage("relay_query", { relay, label, state: "error", detail: error.message, count: 0, durationMs: Math.round(performance.now() - started) });
      return result([], "error", error.message);
    }
  }

  async function readEvents(filter, label, relays = defaultRelays) {
    const key = `${relays.join(",")}:${JSON.stringify(filter)}`;
    const cached = cache.get(key);
    if (cached?.events && Date.now() - cached.at < cacheTtl) return allowedEvents(cached.events);
    if (cached?.promise) return cached.promise;
    for (const [cachedKey, value] of cache) if (value.events && Date.now() - value.at >= cacheTtl) cache.delete(cachedKey);
    while (cache.size >= cacheLimit) cache.delete(cache.keys().next().value);
    const promise = Promise.all(relays.map((relay) => queryRelay(relay, filter, label))).then((batches) => {
      const events = allowedEvents(unique(batches.flat()));
      cache.set(key, { at: Date.now(), events });
      return events;
    });
    cache.set(key, { promise });
    return promise;
  }

  return {
    queryRelay,
    readEvents,
    sourcesFor,
    recordSources,
    removeSources,
    clearCache: () => cache.clear(),
    destroy: () => pool.destroy(),
  };
}
