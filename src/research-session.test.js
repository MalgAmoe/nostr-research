import assert from "node:assert/strict";
import test from "node:test";
import { createRoot } from "solid-js";
import { createResearchSession } from "./research-session.js";

const noop = () => {};

test("research facets can be selected and cleared through the session boundary", () => {
  createRoot((dispose) => {
    const session = createResearchSession({
      runtime: { sourcesFor: () => [], recordSources: noop },
      eventFor: noop,
      sessionEventLimit: 10,
      storeEvents: noop,
      short: String,
      readRelays: [],
      allEvents: () => [],
      allowedEvents: (events) => events,
      rememberEvents: (events) => events,
      logUsage: noop,
    });

    session.toggleFacet("topic", "bitcoin");
    assert.equal(session.activeFacets().topic, "bitcoin");
    session.toggleFacet("topic", "bitcoin");
    assert.equal(session.activeFacets().topic, "");
    dispose();
  });
});

test("successive searches use the latest term and reset corpus combination to replace", () => {
  createRoot((dispose) => {
    const started = [];
    const session = createResearchSession({
      runtime: { sourcesFor: () => [], recordSources: noop, queryRelay: async () => [] },
      eventFor: noop,
      allEvents: () => [],
      sessionEventLimit: 10,
      storeEvents: noop,
      loadEvents: async () => [],
      searchStoredEvents: async () => [],
      searchRelays: () => [],
      readRelays: [],
      relayInformation: () => new Map(),
      relayQueryLimit: (limit) => limit,
      inspectRelays: noop,
      allowedEvents: (events) => events,
      rememberEvents: (events) => events,
      recordDecision: noop,
      recordResearchRun: noop,
      hydrateProfiles: noop,
      openSearchRoute: noop,
      focusComposer: noop,
      notice: noop,
      short: String,
      logUsage: (type, detail) => { if (type === "search_started") started.push(detail.query); },
    });

    session.updateDraft({ text: "bitcoin", operation: "union" });
    session.startRelaySearch();
    assert.equal(session.draft.text, "bitcoin");
    assert.equal(session.draft.operation, "replace");

    session.updateDraft({ text: "nostr" });
    session.startRelaySearch();
    assert.equal(session.draft.text, "nostr");
    assert.deepEqual(started, ["bitcoin", "nostr"]);
    dispose();
  });
});

test("searching wider from a facet replaces the old draft with an exact constraint", () => {
  createRoot((dispose) => {
    const session = createResearchSession({
      runtime: { sourcesFor: () => [], recordSources: noop },
      eventFor: noop,
      allEvents: () => [],
      sessionEventLimit: 10,
      storeEvents: noop,
      allowedEvents: (events) => events,
      rememberEvents: (events) => events,
      recordDecision: noop,
      notice: noop,
      openSearchRoute: noop,
      focusComposer: noop,
      logUsage: noop,
    });

    session.updateDraft({ text: "old term", mode: "words" });
    session.prepareFacetSearch("topic", "nostr");

    assert.equal(session.draft.text, "");
    assert.equal(session.draft.mode, "topic");
    assert.equal(session.draft.constraints.tag, "t");
    assert.equal(session.draft.constraints.tagValue, "nostr");
    assert.equal(session.draft.operation, "replace");
    dispose();
  });
});

test("an older failed search cannot restore over a newer successful search", async () => {
  await new Promise((resolve, reject) => createRoot((dispose) => {
    let rejectOld;
    const newer = { id: "b".repeat(64), pubkey: "c".repeat(64), kind: 1, created_at: 2, content: "newer", tags: [] };
    const session = createResearchSession({
      runtime: {
        sourcesFor: () => [],
        recordSources: noop,
        queryRelay: async (_relay, filter) => filter.search === "old"
          ? new Promise((_resolve, reject) => { rejectOld = reject; })
          : [newer],
      },
      eventFor: noop, allEvents: () => [], sessionEventLimit: 10, storeEvents: noop,
      loadEvents: async () => [], searchStoredEvents: async () => [], searchRelays: () => ["wss://search.test"],
      readRelays: [], relayInformation: () => new Map(), relayQueryLimit: (limit) => limit, inspectRelays: noop,
      allowedEvents: (events) => events, rememberEvents: (events) => events, recordDecision: noop,
      recordResearchRun: noop, hydrateProfiles: noop, openSearchRoute: noop, focusComposer: noop,
      notice: noop, short: String, logUsage: noop,
    });

    session.startRelaySearch({ text: "old", mode: "words" });
    setTimeout(() => {
      session.startRelaySearch({ text: "new", mode: "words" });
      setTimeout(() => {
        try {
          assert.deepEqual(session.corpus().map((event) => event.id), [newer.id]);
          rejectOld(new Error("old failed"));
        } catch (error) { dispose(); reject(error); return; }
        setTimeout(() => {
          try {
          assert.deepEqual(session.corpus().map((event) => event.id), [newer.id]);
          assert.equal(session.error(), "");
          dispose(); resolve();
          } catch (error) { dispose(); reject(error); }
        }, 0);
      }, 0);
    }, 0);
  }));
});
