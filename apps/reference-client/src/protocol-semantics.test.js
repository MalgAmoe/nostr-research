import test from "node:test";
import assert from "node:assert/strict";
import { describeTag, parseEventSemantics, reconcileEventState } from "./protocol-semantics.js";

const event = (overrides = {}) => ({ id: "a", pubkey: "p1", kind: 1, content: "", created_at: 1, tags: [], ...overrides });

test("classifies Nostr event lifecycles and addressable identities", () => {
  assert.equal(parseEventSemantics(event({ kind: 1 })).class, "regular");
  assert.equal(parseEventSemantics(event({ kind: 10002 })).class, "replaceable");
  assert.equal(parseEventSemantics(event({ kind: 20001 })).class, "ephemeral");
  assert.deepEqual(parseEventSemantics(event({ kind: 30023, tags: [["d", "article"]] })), {
    class: "addressable",
    address: "30023:p1:article",
    root: null,
    parent: null,
    quotes: [],
    mentions: [],
    topics: [],
    addresses: [],
    external: [],
    relayHints: [],
    references: [],
  });
});

test("parses marked NIP-10 roots, parents, quotes, and relay hints", () => {
  const result = parseEventSemantics(event({ tags: [["e", "root", "wss://root", "root"], ["e", "parent", "wss://parent", "reply"], ["q", "quote", "wss://quote"], ["p", "person"]] }));
  assert.equal(result.root.value, "root");
  assert.equal(result.parent.value, "parent");
  assert.deepEqual(result.quotes, ["quote"]);
  assert.deepEqual(result.relayHints, ["wss://root", "wss://parent", "wss://quote"]);
});

test("parses NIP-22 root scope separately from direct parent", () => {
  const comment = event({ kind: 1111, tags: [["A", "30023:p1:article", "wss://root"], ["K", "30023"], ["e", "parent", "wss://parent"], ["k", "1111"], ["P", "p1"], ["p", "p2"]] });
  const result = parseEventSemantics(comment);
  assert.deepEqual(result.root, { type: "A", value: "30023:p1:article", kind: "30023", relay: "wss://root" });
  assert.deepEqual(result.parent, { type: "e", value: "parent", kind: "1111", relay: "wss://parent" });
  assert.equal(describeTag(comment, comment.tags[0]).role, "thread root");
  assert.equal(describeTag(comment, comment.tags[2]).role, "direct parent");
});

test("marks older replaceable versions and authorized deletion requests", () => {
  const oldProfile = event({ id: "old", kind: 0, created_at: 1 });
  const newProfile = event({ id: "new", kind: 0, created_at: 2 });
  const deletion = event({ id: "delete", kind: 5, created_at: 3, tags: [["e", "new"]] });
  const foreignDeletion = event({ id: "foreign", pubkey: "p2", kind: 5, tags: [["e", "old"]] });
  const state = reconcileEventState([oldProfile, newProfile, deletion, foreignDeletion]);
  assert.deepEqual(state.get("old"), { state: "superseded", replacedBy: "new", deletionBy: "" });
  assert.deepEqual(state.get("new"), { state: "deletion requested", replacedBy: "", deletionBy: "delete" });
});
