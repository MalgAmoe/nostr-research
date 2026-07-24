import test from "node:test";
import assert from "node:assert/strict";
import { applyLocalConstraints, compileRelayPlan, constraintChips, createResearchDraft, createSearchRequest, emptyQueryConstraints, removeConstraint, researchPatchFromFacets, searchRequestProblem } from "./query-spec.js";

test("normalizes one editable research draft into one immutable search request", () => {
  const draft = createResearchDraft({ text: "  nostr  ", mode: "words", operation: "union", limit: 500, constraints: { kinds: [1] } });
  const request = createSearchRequest(draft);
  assert.deepEqual(request, {
    text: "nostr",
    mode: "words",
    operation: "union",
    limit: 500,
    constraints: { ...emptyQueryConstraints(), kinds: [1] },
  });
  draft.text = "changed later";
  draft.constraints.kinds.push(30023);
  assert.equal(request.text, "nostr");
  assert.deepEqual(request.constraints.kinds, [1]);
});

test("explains whether a draft can retrieve events from relays", () => {
  assert.equal(searchRequestProblem(createSearchRequest(createResearchDraft({ constraints: { kinds: [1] } }))), "");
  assert.match(searchRequestProblem(createSearchRequest(createResearchDraft({ constraints: { domain: "example.com" } }))), /refine retrieved events locally/);
  assert.match(searchRequestProblem(createSearchRequest(createResearchDraft())), /Enter something/);
});

test("compiles a resolved request into a stable relay plan", () => {
  const request = createSearchRequest(createResearchDraft({
    text: "privacy",
    mode: "words",
    operation: "intersect",
    limit: 250,
    constraints: { kinds: [1], days: 7, promotedTopic: "nostr", domain: "example.com", relay: "wss://one" },
  }));
  const plan = compileRelayPlan(
    { filter: { search: "privacy", limit: 250 }, relays: ["wss://default"], mode: "NIP-50" },
    request,
    request.constraints,
    ["wss://search"],
    ["a", "b"],
  );
  assert.equal(plan.filter.search, "privacy nostr");
  assert.deepEqual(plan.filter.kinds, [1]);
  assert.equal(plan.filter.domain, undefined);
  assert.deepEqual(plan.relays, ["wss://one"]);
  assert.deepEqual(plan.intersectionBaseIds, ["a", "b"]);
  assert.equal(plan.constraints.domain, "example.com");
  assert.equal(plan.limit, 250);
  assert.equal(plan.exactLookup, false);
  const exactRequest = createSearchRequest(createResearchDraft({ text: "event", mode: "note" }));
  const exactPlan = compileRelayPlan({ filter: { ids: ["event"] }, relays: ["wss://one"], mode: "note" }, exactRequest);
  assert.equal(exactPlan.exactLookup, true);
});

test("facet research follows the same draft, request, and plan stages as manual search", () => {
  const compiled = researchPatchFromFacets({ topic: "nostr", kind: 1 }, "previous words", emptyQueryConstraints());
  const draft = createResearchDraft({ ...compiled, mode: "topic", limit: 100 });
  const request = createSearchRequest(draft);
  const plan = compileRelayPlan({ filter: { limit: 100 }, relays: ["wss://read"], mode: "constraints" }, request, request.constraints, ["wss://search"]);
  assert.equal(request.text, "");
  assert.equal(searchRequestProblem(request), "");
  assert.deepEqual(plan.filter["#t"], ["nostr"]);
  assert.deepEqual(plan.filter.kinds, [1]);
  assert.deepEqual(plan.relays, ["wss://read"]);
  assert.equal(plan.operation, "replace");
  const localDraft = researchPatchFromFacets({ domain: "example.com" }, "previous words", emptyQueryConstraints());
  assert.equal(localDraft.text, "previous words");
  assert.equal(localDraft.constraints.domain, "example.com");
});

test("presents and edits structured constraints through the composer interface", () => {
  const constraints = { ...emptyQueryConstraints(), kinds: [1, 30023], tag: "t", tagValue: "nostr", domain: "example.com" };
  const chips = constraintChips(constraints);
  assert.deepEqual(chips.map(({ key, scope }) => [key, scope]), [["kinds", "relay"], ["tag", "relay"], ["domain", "local"]]);
  assert.match(chips[0].label, /Short notes · kind 1/);
  assert.deepEqual(removeConstraint(constraints, "tag"), { ...constraints, tag: "", tagValue: "" });
});

test("applies structured constraints consistently to local archive results", () => {
  const events = [
    { id: "a", pubkey: "alice", kind: 1, created_at: 900, content: "See https://example.com/a.jpg", tags: [["t", "nostr"]] },
    { id: "b", pubkey: "bob", kind: 1, created_at: 900, content: "plain", tags: [["t", "nostr"]] },
  ];
  const result = applyLocalConstraints(events, { ...emptyQueryConstraints(), author: "alice", kinds: [1], domain: "example.com", media: "image", promotedTopic: "nostr", relay: "wss://one" }, (event) => event.id === "a" ? ["wss://one"] : [], 1_000);
  assert.deepEqual(result.map((event) => event.id), ["a"]);
});
