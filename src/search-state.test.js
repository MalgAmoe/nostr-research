import test from "node:test";
import assert from "node:assert/strict";
import { mergeSearchResults, pageAdditions, presentCorpus } from "./search-state.js";

const event = (id) => ({ id });

test("replace, union, and intersection preserve their distinct set semantics", () => {
  const base = [event("a"), event("b")];
  const incoming = [event("b"), event("c")];
  assert.deepEqual(mergeSearchResults(incoming, base, "replace").map((item) => item.id), ["b", "c"]);
  assert.deepEqual(mergeSearchResults(incoming, base, "union").map((item) => item.id), ["a", "b", "c"]);
  assert.deepEqual(mergeSearchResults(incoming, base, "intersect").map((item) => item.id), ["b"]);
});

test("intersection pagination cannot introduce events outside the original base", () => {
  const additions = pageAdditions([event("a"), event("c")], [event("b")], { operation: "intersect", intersectionBaseIds: ["a", "b"] });
  assert.deepEqual(additions.map((item) => item.id), ["a"]);
});

test("keeps corpus retrieval separate from presentation filters", () => {
  const events = [
    { id: "a", pubkey: "alice", kind: 1, created_at: 99_900, content: "https://example.com/a.jpg", tags: [["t", "nostr"]] },
    { id: "b", pubkey: "bob", kind: 30023, created_at: 99_900, content: "article", tags: [["t", "nostr"]] },
    { id: "c", pubkey: "carol", kind: 1, created_at: 100, content: "old", tags: [["t", "other"]] },
  ];
  const presented = presentCorpus(events, {
    kindFilter: "notes",
    sinceDays: 1,
    facets: { topic: "nostr", domain: "example.com", media: "image" },
    dedupe: true,
  }, () => ["wss://one"], 100_000);
  assert.deepEqual(presented.eligible.map((item) => item.id), ["a"]);
  assert.deepEqual(presented.visible.map((item) => item.id), ["a"]);
  assert.equal(events.length, 3);
});
