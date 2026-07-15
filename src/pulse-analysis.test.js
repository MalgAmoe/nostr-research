import test from "node:test";
import assert from "node:assert/strict";
import { analyzePulse, pulseKinds } from "./pulse-analysis.js";

const event = (id, pubkey, topic, relayCount = 1) => ({ id, pubkey, kind: 1, content: `Read https://example.com/${id}`, created_at: 1, tags: [["t", topic]], relayCount });

test("pulse scopes map friendly choices to Nostr kinds", () => {
  assert.deepEqual(pulseKinds("media"), [20, 21, 22]);
  assert.ok(pulseKinds("notes_articles").includes(30023));
});

test("pulse analysis compares windows and exposes relay coverage", () => {
  const current = [event("a", "p1", "nostr", 2), event("b", "p1", "nostr"), event("c", "p2", "research")];
  const previous = [event("d", "p3", "nostr")];
  const sources = (item) => item.relayCount === 2 ? ["wss://one", "wss://two"] : ["wss://one"];
  const result = analyzePulse(current, previous, ["wss://one", "wss://two"], sources);
  assert.deepEqual(result.rising[0], { topic: "nostr", count: 2, before: 1, delta: 1, growth: 1, state: "recurring" });
  assert.equal(result.authors[0].pubkey, "p1");
  assert.equal(result.relayRows[1].count, 1);
  assert.equal(result.received, 4);
  assert.equal(result.duplicates, 1);
  assert.deepEqual(result.domains[0], ["example.com", 3]);
});
