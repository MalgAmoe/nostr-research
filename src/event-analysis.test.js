import test from "node:test";
import assert from "node:assert/strict";
import { dedupeForDisplay, eventDomains, kindName, ranked, tags } from "./event-analysis.js";

const event = (overrides = {}) => ({ id: "a", pubkey: "p1", kind: 1, content: "A sufficiently long repeated piece of content", tags: [], created_at: 1, ...overrides });

test("deduplicates normalized note content while preserving provenance", () => {
  const result = dedupeForDisplay([event(), event({ id: "b", pubkey: "p2", content: "a sufficiently  long repeated piece of content" })]);
  assert.equal(result.length, 1);
  assert.equal(result[0].duplicateCount, 2);
  assert.deepEqual(result[0].duplicateAuthors, ["p1", "p2"]);
  assert.deepEqual(result[0].duplicateIds, ["a", "b"]);
});

test("does not collapse short or protocol events", () => {
  assert.equal(dedupeForDisplay([event({ content: "short" }), event({ id: "b", content: "short" })]).length, 2);
  assert.equal(dedupeForDisplay([event({ kind: 3 }), event({ id: "b", kind: 3 })]).length, 2);
});

test("extracts unique normalized domains", () => {
  assert.deepEqual(eventDomains(event({ content: "https://www.example.com/a https://example.com/b. https://nostr.com/x" })), ["example.com", "nostr.com"]);
});

test("ranks values and reads typed tags", () => {
  assert.deepEqual(ranked(["b", "a", "b", "c"], 2), [["b", 2], ["a", 1]]);
  assert.deepEqual(tags(event({ tags: [["t", "nostr"], ["p", "abc"], ["t", "research"]] }), "t"), ["nostr", "research"]);
});

test("names known and unknown event kinds", () => {
  assert.equal(kindName(1111), "comment");
  assert.equal(kindName(999999), "event");
});
