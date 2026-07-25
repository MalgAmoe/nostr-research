import assert from "node:assert/strict";
import test from "node:test";
import { analyzeNeighborhood } from "./neighborhood-analysis.js";

const seed = "a".repeat(64);
const candidate = "b".repeat(64);
const unrelated = "c".repeat(64);
const makeEvent = (id, pubkey, kind, content, tags) => ({ id: id.repeat(64), pubkey, kind, created_at: 1, content, tags });

test("neighborhood candidates include transparent direction-relative reasons", () => {
  const events = [
    makeEvent("1", seed, 1, "privacy protocol relays", [["t", "privacy"]]),
    makeEvent("2", seed, 3, "", [["p", candidate]]),
    makeEvent("3", candidate, 1, "privacy protocol research", [["t", "privacy"], ["p", seed]]),
    makeEvent("4", unrelated, 1, "unrelated material", [["t", "other"]]),
  ];
  const sources = new Map([[events[0].id, ["wss://one.test"]], [events[2].id, ["wss://one.test"]]]);
  const result = analyzeNeighborhood(events, { authors: [seed], topics: [], domains: [], events: [] }, (id) => sources.get(id) ?? []);

  assert.equal(result.length, 1);
  assert.equal(result[0].pubkey, candidate);
  assert.ok(result[0].reasons.some((reason) => reason.includes("followed by")));
  assert.ok(result[0].reasons.some((reason) => reason.includes("conversation link")));
  assert.ok(result[0].reasons.some((reason) => reason.includes("shared topics")));
});
