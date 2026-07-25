import test from "node:test";
import assert from "node:assert/strict";
import { planEntityRelays, relayListFromEvent, relayQueryLimit } from "./relay-planner.js";

test("reads NIP-65 read and write relay markers", () => {
  const list = relayListFromEvent({ kind: 10002, tags: [["r", "wss://both.example/"], ["r", "wss://write.example", "write"], ["r", "wss://read.example", "read"]] });
  assert.deepEqual(list.write, ["wss://both.example", "wss://write.example"]);
  assert.deepEqual(list.read, ["wss://both.example", "wss://read.example"]);
});

test("prioritizes explicit hints then purpose-specific advertised relays", () => {
  const relays = planEntityRelays({ purpose: "mentions", hints: ["wss://hint.example"], relayList: { read: ["wss://inbox.example"], write: ["wss://outbox.example"] }, fallback: ["wss://fallback.example"] });
  assert.deepEqual(relays, ["wss://hint.example", "wss://inbox.example", "wss://fallback.example"]);
});

test("respects an advertised relay maximum without inventing one", () => {
  assert.equal(relayQueryLimit(1000, { limitations: { max_limit: 250 } }), 250);
  assert.equal(relayQueryLimit(1000, {}), 1000);
});
