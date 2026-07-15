import test from "node:test";
import assert from "node:assert/strict";
import { applyRelayConstraints, constraintChips, constraintsFromFacets, emptyQueryConstraints, hasRelayConstraints, removeConstraint } from "./query-spec.js";

test("compiles corpus facets into an editable query draft", () => {
  const draft = constraintsFromFacets({ topic: "nostr", author: "alice", kind: 1, day: "2026-07-15", domain: "example.com", relay: "wss://nos.lol", media: "image" });
  assert.equal(draft.promotedTopic, "nostr");
  assert.equal(draft.author, "alice");
  assert.deepEqual(draft.kinds, [1]);
  assert.equal(draft.facetDay, "2026-07-15");
  assert.equal(draft.domain, "example.com");
});

test("labels relay and local constraints visibly", () => {
  const chips = constraintChips({ ...emptyQueryConstraints(), kinds: [1, 30023], domain: "example.com" });
  assert.deepEqual(chips.map(({ key, scope }) => [key, scope]), [["kinds", "relay"], ["domain", "local"]]);
  assert.match(chips[0].label, /Short notes · kind 1/);
});

test("applies relay-capable constraints without leaking local refinements", () => {
  const filter = applyRelayConstraints({ search: "privacy", limit: 100 }, { ...emptyQueryConstraints(), author: "alice", kinds: [1], days: 7, domain: "example.com" }, 1_000_000);
  assert.deepEqual(filter.authors, ["alice"]);
  assert.deepEqual(filter.kinds, [1]);
  assert.equal(filter.since, 395_200);
  assert.equal(filter.domain, undefined);
});

test("removes composite constraints as a whole", () => {
  assert.deepEqual(removeConstraint({ ...emptyQueryConstraints(), tag: "t", tagValue: "nostr" }, "tag"), { ...emptyQueryConstraints(), tag: "", tagValue: "" });
});

test("allows a search with relay constraints and no primary text", () => {
  assert.equal(hasRelayConstraints({ ...emptyQueryConstraints(), kinds: [1] }), true);
  assert.equal(hasRelayConstraints({ ...emptyQueryConstraints(), promotedTopic: "nostr" }), true);
  assert.equal(hasRelayConstraints({ ...emptyQueryConstraints(), domain: "example.com", media: "image" }), false);
});
