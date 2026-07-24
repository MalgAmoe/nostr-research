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
