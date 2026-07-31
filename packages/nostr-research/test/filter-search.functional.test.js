import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeFilter } from '../src/acquire.js';

// NIP-50 defines `search` as an optional string extension on an ordinary
// subscription filter. Matching semantics remain relay-owned.
test('NIP-50 search strings pass through normalized relay filters unchanged', () => {
  assert.deepEqual(
    normalizeFilter({ kinds: [1], search: 'best nostr apps', limit: 20 }),
    { kinds: [1], search: 'best nostr apps', limit: 20 },
  );
  assert.throws(
    () => normalizeFilter({ search: ['not', 'a', 'string'] }),
    /Filter search must be a string/,
  );
});
