import test from "node:test";
import assert from "node:assert/strict";
import { createResearchManifest, eventMatchesMuteRules, muteEventDraft, muteRulesFromEvent } from "./research-portability.js";

test("round-trips public NIP-51 mute-list tags", () => {
  const rules = { accounts: ["a".repeat(64)], topics: ["spam"], words: ["giveaway"], events: ["b".repeat(64)], relays: ["wss://bad.example"] };
  assert.deepEqual(muteRulesFromEvent(muteEventDraft(rules)), rules);
});

test("explains why an event is hidden", () => {
  const event = { id: "1".repeat(64), pubkey: "2".repeat(64), content: "Another Giveaway", tags: [] };
  assert.equal(eventMatchesMuteRules(event, { words: ["giveaway"] }), "word");
});

test("research manifests are stable regardless of event order", () => {
  const first = createResearchManifest({ events: [{ id: "b" }, { id: "a" }] });
  const second = createResearchManifest({ events: [{ id: "a" }, { id: "b" }] });
  assert.equal(first.corpusFingerprint, second.corpusFingerprint);
  assert.deepEqual(first.eventIds, ["a", "b"]);
});
