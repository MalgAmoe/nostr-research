import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import {
  createInMemoryResearchMemory,
  ResearchMemoryError,
} from '@nostr-research/memory';

const ALICE_KEY = Uint8Array.from(Buffer.from('1'.repeat(64), 'hex'));
const BOB_KEY = Uint8Array.from(Buffer.from('2'.repeat(64), 'hex'));
const CAROL_KEY = Uint8Array.from(Buffer.from('3'.repeat(64), 'hex'));
const alice = getPublicKey(ALICE_KEY);
const bob = getPublicKey(BOB_KEY);
const carol = getPublicKey(CAROL_KEY);

test('public local search composes constraints, explains matches, and preserves provenance', () => {
  withMemory((memory) => {
    const fixtures = makeFixtures();
    ingest(memory, fixtures.aliceOld, 'wss://one.example');
    ingest(memory, fixtures.aliceCurrent, 'wss://one.example');
    ingest(memory, fixtures.root, 'wss://one.example');
    ingest(memory, fixtures.reply, 'wss://one.example');
    ingest(memory, fixtures.reply, 'wss://two.example');
    ingest(memory, fixtures.quote, 'wss://two.example');

    const found = memory.select({
      authors: [bob.slice(0, 12)],
      kinds: [1],
      since: fixtures.reply.created_at,
      until: fixtures.quote.created_at,
      tags: { '#t': ['Research'] },
      text: ['LOCAL', 'memory'],
      limit: 5,
      order: 'oldest',
    });
    assert.deepEqual(found.items.map(({ record }) => record.event.id), [fixtures.reply.id]);
    assert.deepEqual(
      found.items[0].reasons.map(({ type }) => type),
      ['author', 'kind', 'created-at-since', 'created-at-until', 'tag', 'text', 'text'],
    );
    assert.deepEqual(
      found.items[0].provenance.map(({ relay }) => relay),
      ['wss://one.example', 'wss://two.example'],
    );

    assert.deepEqual(
      memory.select({ ids: fixtures.root.id.slice(0, 12), limit: 1 }).items[0].record.event,
      JSON.parse(JSON.stringify(fixtures.root)),
    );
    assert.deepEqual(
      memory.select({ tags: { t: ['Research'], '#t': ['missing'] } })
        .items.map(({ subject: item }) => item.id),
      [fixtures.reply.id, fixtures.root.id],
    );
    assert.throws(() => memory.select({ authors: ['abc'] }), /4 to 64/);
    assert.throws(() => memory.select({ since: 20, until: 10 }), ResearchMemoryError);
    assert.throws(() => memory.select({ limit: 0 }), ResearchMemoryError);
  });
});

function withMemory(run) {
  const memory = createInMemoryResearchMemory({ capacity: 1000 });
  try {
    run(memory);
  } finally {
    memory.close();
  }
}

function ingest(memory, event, relay) {
  memory.ingest(event, { relay, observedAt: '2026-01-01T00:00:00.000Z' });
}

function sign(template, key) {
  return finalizeEvent(template, key);
}

function makeFixtures() {
  const aliceOld = sign({
    kind: 0,
    created_at: 100,
    tags: [],
    content: JSON.stringify({ name: 'old-alice', display_name: 'Alice Old' }),
  }, ALICE_KEY);
  const aliceCurrent = sign({
    kind: 0,
    created_at: 200,
    tags: [],
    content: JSON.stringify({
      name: 'alice',
      display_name: 'Alice Current',
      nip05: 'alice@example.org',
      about: 'Applied cryptography researcher',
    }),
  }, ALICE_KEY);
  const bobMetadata = sign({
    kind: 0,
    created_at: 150,
    tags: [],
    content: JSON.stringify({ name: 'bob', display_name: 'Bob Builder' }),
  }, BOB_KEY);
  const root = sign({
    kind: 1,
    created_at: 300,
    tags: [['t', 'Research'], ['r', 'https://example.test/evidence']],
    content: 'Root evidence in local memory',
  }, ALICE_KEY);
  const absent = 'f'.repeat(64);
  const reply = sign({
    kind: 1,
    created_at: 400,
    tags: [
      ['e', root.id, '', 'root'],
      ['e', root.id, '', 'reply'],
      ['e', absent, '', 'mention'],
      ['q', absent],
      ['p', carol],
      ['t', 'Research'],
    ],
    content: 'LOCAL research in MEMORY',
  }, BOB_KEY);
  const quote = sign({
    kind: 1,
    created_at: 500,
    tags: [['q', root.id], ['p', alice]],
    content: 'A later quote',
  }, CAROL_KEY);
  const nip22 = sign({
    kind: 1111,
    created_at: 600,
    tags: [['E', root.id], ['e', reply.id], ['P', alice], ['p', bob]],
    content: 'NIP-22 comment',
  }, CAROL_KEY);
  const uppercaseETag = sign({
    kind: 1,
    created_at: 700,
    tags: [['E', root.id], ['e', reply.id]],
    content: 'An uppercase tag outside a NIP-22 comment',
  }, CAROL_KEY);
  return { aliceOld, aliceCurrent, bobMetadata, root, reply, quote, nip22, uppercaseETag };
}
