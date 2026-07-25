import test from "node:test";
import assert from "node:assert/strict";
import { analyzePulse, pulseKinds, pulseTimeSlices } from "./pulse-analysis.js";

const event = (id, pubkey, topic, relayCount = 1) => ({ id, pubkey, kind: 1, content: `Read https://example.com/${id}`, created_at: 1, tags: [["t", topic]], relayCount });

test("pulse scopes map friendly choices to Nostr kinds", () => {
  assert.deepEqual(pulseKinds("media"), [20, 21, 22]);
  assert.ok(pulseKinds("notes_articles").includes(30023));
});

test("large pulse targets are spread across contiguous relay-safe time slices", () => {
  const slices = pulseTimeSlices(10_000, 7_000, 5_001, 500);
  assert.equal(slices.length, 11);
  assert.equal(slices.reduce((sum, slice) => sum + slice.limit, 0), 5_001);
  assert.ok(slices.every((slice) => slice.limit <= 500));
  assert.equal(slices[0].until, 10_000);
  assert.equal(slices.at(-1).since, 3_000);
  for (let index = 1; index < slices.length; index += 1) assert.equal(slices[index - 1].since, slices[index].until);
});

test("pulse analysis exposes relay coverage and directed signals", () => {
  const current = [event("a", "p1", "nostr", 2), event("b", "p2", "nostr"), event("c", "p1", "research")];
  const previous = [event("d", "p3", "nostr")];
  const sources = (item) => item.relayCount === 2 ? ["wss://one", "wss://two"] : ["wss://one"];
  const result = analyzePulse(current, previous, ["wss://one", "wss://two"], sources);
  assert.equal(result.topicSignals[0].topic, "nostr");
  assert.equal(result.topicSignals[0].before, 1);
  assert.equal(result.authors[0].pubkey, "p1");
  assert.equal(result.relayRows[1].count, 1);
  assert.equal(result.relayRows[0].authors, 2);
  assert.equal(result.relayRows[0].overlap[0].shared, 1);
  assert.equal(result.relayRows[1].uniqueShare, 0);
  assert.equal(typeof result.relayRows[0].role, "string");
  assert.equal(result.received, 4);
  assert.equal(result.duplicates, 1);
  assert.deepEqual(result.domains[0], ["example.com", 3]);
});

test("topic signals favor independent participation over one prolific author", () => {
  const events = [
    ...Array.from({ length: 20 }, (_, index) => event(`spam-${index}`, "spammer", "spam")),
    event("useful-1", "a", "useful"), event("useful-2", "b", "useful"), event("useful-3", "c", "useful"),
  ];
  const signals = analyzePulse(events, [], ["wss://one"], () => ["wss://one"]).topicSignals;
  assert.equal(signals[0].topic, "useful");
  assert.ok(!signals.some((item) => item.topic === "spam"));
});

test("account signals separate repetitive high-volume accounts", () => {
  const repeated = Array.from({ length: 10 }, (_, index) => ({ ...event(`r-${index}`, "spam", "x"), content: "same message" }));
  const original = Array.from({ length: 4 }, (_, index) => ({ ...event(`o-${index}`, "person", "x"), content: `original thought ${index}` }));
  const result = analyzePulse([...repeated, ...original], [], ["wss://one"], () => ["wss://one"]);
  assert.equal(result.noiseAccounts[0].pubkey, "spam");
  assert.equal(result.accountSignals[0].pubkey, "person");
});
