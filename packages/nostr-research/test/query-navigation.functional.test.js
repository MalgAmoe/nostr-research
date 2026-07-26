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

    const found = memory.searchEvents({
      authors: [bob.slice(0, 12)],
      kinds: [1],
      since: fixtures.reply.created_at,
      until: fixtures.quote.created_at,
      tags: { '#t': ['Research'] },
      text: ['LOCAL', 'memory'],
      limit: 5,
      order: 'oldest',
    });
    assert.deepEqual(found.results.map(({ event }) => event.id), [fixtures.reply.id]);
    assert.deepEqual(
      found.results[0].matchReasons.map(({ type }) => type),
      ['author', 'kind', 'created-at-since', 'created-at-until', 'tag', 'text', 'text'],
    );
    assert.deepEqual(
      found.results[0].observations.map(({ relay }) => relay),
      ['wss://one.example', 'wss://two.example'],
    );

    assert.deepEqual(
      memory.searchEvents({ ids: fixtures.root.id.slice(0, 12), limit: 1 }).results[0].event,
      JSON.parse(JSON.stringify(fixtures.root)),
    );
    assert.deepEqual(
      memory.searchEvents({ tags: { t: ['Research'], '#t': ['missing'] } })
        .results.map(({ event }) => event.id),
      [fixtures.reply.id, fixtures.root.id],
    );
    assert.throws(() => memory.searchEvents({ authors: ['abc'] }), /4 to 64/);
    assert.throws(() => memory.searchEvents({ since: 20, until: 10 }), ResearchMemoryError);
    assert.throws(() => memory.searchEvents({ limit: 0 }), ResearchMemoryError);
  });
});

test('current account metadata uses replaceable semantics and profile search returns source evidence', () => {
  withMemory((memory) => {
    const fixtures = makeFixtures();
    for (const event of [fixtures.aliceOld, fixtures.aliceCurrent, fixtures.bobMetadata]) {
      ingest(memory, event, 'wss://profiles.example');
    }
    const account = memory.resolveAccount(alice.slice(0, 12));
    assert.equal(account.metadataEvent.id, fixtures.aliceCurrent.id);
    assert.equal(account.profile.display_name, 'Alice Current');
    assert.equal(account.observations[0].relay, 'wss://profiles.example');

    const search = memory.searchAccounts({ text: ['alice', 'example.org'], limit: 10 });
    assert.deepEqual(search.results.map(({ publicKey }) => publicKey), [alice]);
    assert.deepEqual(search.results[0].matchReasons.map(({ type }) => type), [
      'profile-term', 'profile-term',
    ]);
    assert.throws(() => memory.resolveAccount(carol), /No stored account public key matches/);
  });
});

test('navigation exposes direction, protocol interpretation, unresolved targets, and provenance', () => {
  withMemory((memory) => {
    const fixtures = makeFixtures();
    for (const event of [
      fixtures.aliceCurrent, fixtures.bobMetadata, fixtures.root, fixtures.reply, fixtures.quote,
      fixtures.nip22, fixtures.uppercaseETag,
    ]) ingest(memory, event, 'wss://graph.example');

    const replyNavigation = memory.relatedEvent(fixtures.reply.id.slice(0, 12));
    const outbound = replyNavigation.relationships.filter(({ direction }) => direction === 'outbound');
    assert.equal(
      outbound.find((relation) => relation.type === 'author').target.resolved,
      true,
    );
    assert.ok(outbound.some((relation) => (
      relation.type === 'reply-root'
      && relation.target.id === fixtures.root.id
      && relation.evidence.protocol === 'NIP-10'
      && relation.evidence.interpretation === 'known'
    )));
    assert.ok(outbound.some((relation) => relation.type === 'mentioned-account' && relation.target.id === carol));
    assert.ok(outbound.some((relation) => (
      relation.type === 'quoted-event'
      && relation.target.resolved === false
      && relation.sourceEvent.observations[0].relay === 'wss://graph.example'
    )));

    const rootNavigation = memory.relatedEvent(fixtures.root.id);
    assert.ok(rootNavigation.relationships.some((relation) => (
      relation.direction === 'inbound'
      && relation.sourceEventId === fixtures.reply.id
      && relation.type === 'reply-root'
    )));
    assert.ok(rootNavigation.relationships.some((relation) => (
      relation.direction === 'inbound'
      && relation.sourceEventId === fixtures.nip22.id
      && relation.evidence.protocol === 'NIP-22'
    )));

    const accountNavigation = memory.relatedAccount(bob.slice(0, 12));
    assert.ok(accountNavigation.relationships.some((relation) => (
      relation.direction === 'inbound'
      && relation.type === 'author'
      && relation.sourceEventId === fixtures.reply.id
    )));

    const nonCommentNavigation = memory.relatedEvent(fixtures.uppercaseETag.id);
    assert.ok(nonCommentNavigation.relationships.some((relation) => (
      relation.direction === 'outbound'
      && relation.type === 'mentioned-event'
      && relation.target.id === fixtures.root.id
      && relation.evidence.protocol === 'NIP-01'
      && relation.evidence.interpretation === 'best-effort-fallback'
    )));
    assert.ok(!nonCommentNavigation.relationships.some((relation) => (
      relation.evidence.protocol === 'NIP-22'
    )));
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
