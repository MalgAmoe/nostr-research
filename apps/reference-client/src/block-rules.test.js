import test from "node:test";
import assert from "node:assert/strict";
import { findBlockedNamePattern, normalizeNamePattern } from "./block-rules.js";

test("name blocks use case-insensitive contains matching", () => {
  assert.equal(findBlockedNamePattern(["Official AIRDROP Helper"], ["airdrop"]), "airdrop");
  assert.equal(findBlockedNamePattern(["Ordinary account"], ["airdrop"]), "");
});

test("name block patterns are trimmed and normalized", () => {
  assert.equal(normalizeNamePattern("  Spam Bot  "), "spam bot");
});
