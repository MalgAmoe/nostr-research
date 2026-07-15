import test from "node:test";
import assert from "node:assert/strict";
import { buildFacetResearchFilter, buildGraphModel, dedupeForDisplay, eventDomains, kindName, parseKindList, ranked, tags } from "./event-analysis.js";
import { indexTerms } from "./research-store.js";

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

test("parses explicit kind constraints without turning an empty field into kind zero", () => {
  assert.deepEqual(parseKindList(""), []);
  assert.deepEqual(parseKindList("1, 30023 1"), [1, 30023]);
});

test("builds searchable terms from content, tags, and domains", () => {
  const terms = indexTerms(event({ content: "Researching Nostr through https://www.example.com/article", tags: [["t", "Discovery"]] }));
  assert.ok(terms.includes("researching"));
  assert.ok(terms.includes("nostr"));
  assert.ok(terms.includes("discovery"));
  assert.ok(terms.includes("example.com"));
});

test("builds a bounded multi-entity graph and keeps in-corpus references", () => {
  const root = event({ id: "root", pubkey: "alice", content: "See https://example.com/root", tags: [["t", "Nostr"]], created_at: 2 });
  const reply = event({ id: "reply", pubkey: "bob", content: "Reply via https://example.com/reply", tags: [["e", "root", "", "reply"], ["t", "Research"]], created_at: 3 });
  const model = buildGraphModel([root, reply], { selectedId: "reply" });
  assert.deepEqual(model.events.map((item) => item.id), ["reply", "root"]);
  assert.ok(model.edges.some((edge) => edge.type === "reference" && edge.from === "reply" && edge.to === "root"));
  assert.deepEqual(model.domains, [{ value: "example.com", count: 2 }]);
});

test("promotes topic facets to broad text research instead of repeating the exact tag filter", () => {
  const filter = buildFacetResearchFilter({ topic: "fiatnews", domain: "example.com", author: "alice", kind: 1, day: "2026-07-15" }, 250);
  assert.equal(filter.search, "fiatnews example.com");
  assert.equal(filter["#t"], undefined);
  assert.deepEqual(filter.authors, ["alice"]);
  assert.deepEqual(filter.kinds, [1]);
  assert.equal(filter.limit, 250);
  assert.equal(filter.until - filter.since, 86_399);
});
