import test from "node:test";
import assert from "node:assert/strict";
import { buildGraphModel, dedupeForDisplay, eventDomains, eventMedia, eventUrls, mediaTypeForUrl, parseKindList } from "./event-analysis.js";

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

test("extracts and classifies normalized event URLs once", () => {
  const sample = event({ content: "See https://example.com/a.jpg, https://example.com/b.mp4! and https://example.com/page." });
  assert.deepEqual(eventUrls(sample), ["https://example.com/a.jpg", "https://example.com/b.mp4", "https://example.com/page"]);
  assert.deepEqual(eventMedia(sample), [
    { url: "https://example.com/a.jpg", type: "image" },
    { url: "https://example.com/b.mp4", type: "video" },
  ]);
  assert.equal(mediaTypeForUrl("https://example.com/sound.flac"), "audio");
});

test("parses explicit kind constraints without turning an empty field into kind zero", () => {
  assert.deepEqual(parseKindList(""), []);
  assert.deepEqual(parseKindList("1, 30023 1"), [1, 30023]);
});

test("builds a bounded multi-entity graph and keeps in-corpus references", () => {
  const root = event({ id: "root", pubkey: "alice", content: "See https://example.com/root", tags: [["t", "Nostr"]], created_at: 2 });
  const reply = event({ id: "reply", pubkey: "bob", content: "Reply via https://example.com/reply", tags: [["e", "root", "", "reply"], ["t", "Research"]], created_at: 3 });
  const model = buildGraphModel([root, reply], { selectedId: "reply", sourcesFor: (item) => item.id === "root" ? ["wss://one.example"] : ["wss://one.example", "wss://two.example"] });
  assert.deepEqual(model.events.map((item) => item.id), ["reply", "root"]);
  assert.ok(model.edges.some((edge) => edge.type === "reply" && edge.from === "reply" && edge.to === "root"));
  assert.deepEqual(model.domains, [{ value: "example.com", count: 2 }]);
  assert.deepEqual(model.relays, [{ value: "wss://one.example", count: 2 }, { value: "wss://two.example", count: 1 }]);
  assert.ok(model.edges.some((edge) => edge.type === "relay" && edge.from === "reply" && edge.to === "wss://two.example"));
});
