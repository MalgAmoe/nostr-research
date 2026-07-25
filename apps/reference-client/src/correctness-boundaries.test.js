import assert from "node:assert/strict";
import test from "node:test";
import { createModerationPolicy } from "./moderation.js";
import { createNostrRuntime } from "./nostr-runtime.js";
import { storeEvents } from "./research-store.js";

const event = { id: "a".repeat(64), pubkey: "b".repeat(64), kind: 1, created_at: 1, content: "test", tags: [] };

test("restored events survive a muted source only when another allowed source observed them", () => {
  const policy = createModerationPolicy({ muteRules: { topics: [], words: [], events: [], relays: ["wss://muted.test"] } });
  assert.deepEqual(policy.allowedEvents([event], () => ["wss://muted.test"]), []);
  assert.deepEqual(policy.allowedEvents([event], () => ["wss://muted.test", "wss://allowed.test"]), [event]);
});

test("restored provenance merges with newer in-memory provenance", () => {
  const runtime = createNostrRuntime({
    defaultRelays: [],
    isEventAllowed: () => true,
    isRelayAllowed: () => true,
    persistEvents: () => {},
    logUsage: () => {},
  });
  runtime.recordSources(event.id, ["wss://new.test"]);
  runtime.recordSources(event.id, ["wss://stored.test"]);
  assert.deepEqual(runtime.sourcesFor(event.id), ["wss://new.test", "wss://stored.test"]);
  runtime.destroy();
});

test("relay timeout remains distinguishable from a successful empty response", async () => {
  const runtime = createNostrRuntime({
    defaultRelays: [],
    isEventAllowed: () => true,
    isRelayAllowed: () => true,
    persistEvents: () => {},
    logUsage: () => {},
    maxWait: 1,
    relayPool: { querySync: () => new Promise(() => {}), destroy: () => {} },
  });
  const events = await runtime.queryRelay("wss://slow.test", { kinds: [1] }, "timeout-test");
  assert.deepEqual(events, []);
  assert.equal(events.queryState.state, "timeout");
  runtime.destroy();
});

test("event storage reports that IndexedDB is unavailable instead of silently succeeding", async () => {
  await assert.rejects(() => storeEvents([event]), /IndexedDB is unavailable/);
});
