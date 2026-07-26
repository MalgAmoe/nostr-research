import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import {
  acquireRelayEvents,
  createInMemoryResearchMemory,
  expandResearch,
  loadFixtureEvents,
  ResearchMemoryError,
  resolveReplyContexts,
  subject,
} from '@nostr-research/memory';
import { createResearchEnvironment } from '../src/console.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const loopbackAvailable = await supportsLoopbackListener();

test('public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
  const [firstEvent] = loadFixtureEvents();
  const invalidEvent = { ...firstEvent, id: '0'.repeat(64) };
  let firstClosed = false;
  let secondClosed = false;
  const firstRelay = await startRelay((connection) => {
    connection.onRequest((_subscriptionId, send) => {
      send(['EVENT', _subscriptionId, invalidEvent]);
      send(['EVENT', _subscriptionId, firstEvent]);
      send(['EOSE', _subscriptionId]);
    });
    connection.onSocketClose(() => { firstClosed = true; });
  }, context.directory);
  const secondRelay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send) => {
      send(['EVENT', subscriptionId, firstEvent]);
      send(['EOSE', subscriptionId]);
    });
    connection.onSocketClose(() => { secondClosed = true; });
  }, context.directory);

  try {
    const result = await acquireRelayEvents(context.memory, {
      relays: [firstRelay.url, secondRelay.url],
      filter: { kinds: [1], limit: 5 },
      timeoutMs: 2_000,
      observationLimit: 5,
      concurrency: 2,
    });

    assert.equal(result.completionReason, 'completed');
    assert.deepEqual(result.relays.map((relay) => relay.outcome), ['eose', 'eose']);
    assert.deepEqual(result.counts, {
      receivedPackets: 3,
      invalid: 1,
      acceptedObservations: 2,
      duplicateObservations: 1,
      newlyStoredCorpusEvents: 1,
      distinctEventsAcquired: 1,
    });
    assert.deepEqual(result.acquiredEventIds, [firstEvent.id]);
    assert.deepEqual(result.coverage.requested, {
      filter: { kinds: [1], limit: 5 },
      relays: [firstRelay.url, secondRelay.url].sort(),
    });
    assert.deepEqual(result.coverage.budget, result.budget);
    assert.equal(result.coverage.completionReason, 'completed');
    assert.equal(result.coverage.exhaustive, false);
    assert.match(result.coverage.uncertainty, /not implied/);
    assert.deepEqual(
      result.coverage.observedEvents.map(({ eventId, relay }) => ({ eventId, relay })),
      [
        { eventId: firstEvent.id, relay: firstRelay.url },
        { eventId: firstEvent.id, relay: secondRelay.url },
      ],
    );
    assert.deepEqual(
      result.coverage.relays.map(({ outcome }) => outcome),
      ['eose', 'eose'],
    );
    assert.deepEqual(
      context.memory.getEvent(firstEvent.id).observations.map(({ relay }) => relay).sort(),
      [firstRelay.url, secondRelay.url].sort(),
    );
    await eventually(() => firstClosed && secondClosed);
  } finally {
    await firstRelay.close();
    await secondRelay.close();
    context.close();
  }
});

test('global limit and cancellation are distinguishable and close owned sockets', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
  const events = loadFixtureEvents();
  let limitSocketClosed = false;
  const limitRelay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send) => {
      for (const event of events) send(['EVENT', subscriptionId, event]);
    });
    connection.onSocketClose(() => { limitSocketClosed = true; });
  }, context.directory);

  try {
    const limited = await acquireRelayEvents(context.memory, {
      relays: [limitRelay.url],
      filter: {},
      timeoutMs: 2_000,
      observationLimit: 1,
    });
    assert.equal(limited.completionReason, 'observation-budget');
    assert.equal(limited.counts.acceptedObservations, 1);
    await eventually(() => limitSocketClosed);

    const controller = new AbortController();
    const cancellationRelay = await startRelay(() => {}, context.directory);
    const pending = acquireRelayEvents(context.memory, {
      relays: [cancellationRelay.url],
      filter: {},
      timeoutMs: 2_000,
      observationLimit: 2,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 20);
    const cancelled = await pending;
    assert.equal(cancelled.completionReason, 'cancelled');
    assert.equal(cancelled.relays[0].outcome, 'cancelled');
    await cancellationRelay.close();

    let connectingSocketClosed = false;
    const connectingRelay = await startRelay((connection) => {
      connection.onSocketClose(() => { connectingSocketClosed = true; });
    }, context.directory, { handshakeDelayMs: 10_000 });
    try {
      const connectingController = new AbortController();
      const connectingStartedAt = Date.now();
      const connectingPending = acquireRelayEvents(context.memory, {
        relays: [connectingRelay.url],
        filter: {},
        timeoutMs: 2_000,
        observationLimit: 2,
        signal: connectingController.signal,
      });
      setTimeout(() => connectingController.abort(), 10);
      const connectingCancelled = await connectingPending;
      assert.equal(connectingCancelled.completionReason, 'cancelled');
      assert.equal(connectingCancelled.relays[0].outcome, 'cancelled');
      assert.ok(Date.now() - connectingStartedAt < 500, 'cancellation bounds a stalled handshake');
      await eventually(() => connectingSocketClosed);
    } finally {
      await connectingRelay.close();
    }
  } finally {
    await limitRelay.close();
    context.close();
  }
});

test('distinct-event budget ignores duplicate observations while observation budget stays hard', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
  const [first, second, third] = loadFixtureEvents();
  const relay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send) => {
      send(['EVENT', subscriptionId, first]);
      send(['EVENT', subscriptionId, first]);
      send(['EVENT', subscriptionId, second]);
      send(['EVENT', subscriptionId, third]);
    });
  }, context.directory);
  try {
    const distinctBounded = await acquireRelayEvents(context.memory, {
      relays: [relay.url],
      filter: {},
      timeoutMs: 2_000,
      observationLimit: 10,
      distinctEventLimit: 2,
    });
    assert.equal(distinctBounded.completionReason, 'distinct-event-budget');
    assert.deepEqual(distinctBounded.counts, {
      receivedPackets: 3,
      invalid: 0,
      acceptedObservations: 3,
      duplicateObservations: 1,
      newlyStoredCorpusEvents: 2,
      distinctEventsAcquired: 2,
    });

    const observationBounded = await acquireRelayEvents(context.memory, {
      relays: [relay.url],
      filter: {},
      timeoutMs: 2_000,
      observationLimit: 2,
      distinctEventLimit: 3,
    });
    assert.equal(observationBounded.completionReason, 'observation-budget');
    assert.equal(observationBounded.counts.acceptedObservations, 2);
    assert.equal(observationBounded.counts.distinctEventsAcquired, 1);
    assert.equal(observationBounded.counts.duplicateObservations, 1);

    const equalBudgetExpansion = await expandResearch(
      context.memory,
      accountCollection(context.memory, [first.pubkey]),
      {
        relays: [relay.url],
        relationshipTypes: ['author'],
        direction: 'inbound',
        authoredLimit: 1,
        depth: 1,
        limit: 5,
        timeoutMs: 2_000,
        observationLimit: 1,
        distinctEventLimit: 1,
      },
    );
    assert.equal(
      equalBudgetExpansion.context.expansion.completionReason,
      'observation-budget',
      'expansion uses acquisition observation-first precedence when both budgets are reached',
    );
    assert.equal(
      equalBudgetExpansion.context.expansion.boundedBy.observationBudget,
      true,
    );
    assert.equal(
      equalBudgetExpansion.context.expansion.boundedBy.distinctEventBudget,
      false,
    );
  } finally {
    await relay.close();
    context.close();
  }
});

test('timeout force-closes a peer that ignores the WebSocket closing handshake', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
  let socketClosed = false;
  const relay = await startRelay((connection) => {
    connection.onSocketClose(() => { socketClosed = true; });
  }, context.directory, { ignoreCloseHandshake: true });
  try {
    const startedAt = Date.now();
    const result = await acquireRelayEvents(context.memory, {
      relays: [relay.url],
      filter: {},
      timeoutMs: 50,
      observationLimit: 2,
    });
    assert.equal(result.completionReason, 'timeout');
    assert.ok(Date.now() - startedAt < 500, 'timeout bounds an ignored closing handshake');
    await eventually(() => socketClosed);
  } finally {
    await relay.close();
    context.close();
  }
});

test('timeout and partial connection failure remain observable', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
  const silentRelay = await startRelay(() => {}, context.directory);
  try {
    const unavailablePort = await reserveClosedPort();
    const result = await acquireRelayEvents(context.memory, {
      relays: [silentRelay.url, `wss://127.0.0.1:${unavailablePort}/`],
      filter: {},
      timeoutMs: 100,
      observationLimit: 2,
      concurrency: 2,
    });
    assert.equal(result.completionReason, 'timeout');
    assert.deepEqual(
      new Set(result.relays.map(({ outcome }) => outcome)),
      new Set(['timeout', 'connection-failure']),
    );
    const failedRelay = result.relays.find(({ outcome }) => outcome === 'connection-failure');
    assert.match(failedRelay.diagnostic, /ECONNREFUSED/);
  } finally {
    await silentRelay.close();
    context.close();
  }
});

test('acquisition rejects unusable public inputs before networking', async () => {
  const context = createContext();
  try {
    await assert.rejects(
      acquireRelayEvents(context.memory, { relays: ['ws://localhost:1'], filter: {} }),
      ResearchMemoryError,
    );
    await assert.rejects(
      acquireRelayEvents(context.memory, { relays: ['wss://localhost:1'], filter: { nope: true } }),
      ResearchMemoryError,
    );
  } finally {
    context.close();
  }
});

test('console expansion rejects invalid bounds and semantics before networking', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 2 });
  const environment = createResearchEnvironment(memory);
  const selection = memory.collection([], { operation: 'empty-start' });
  try {
    const valid = {
      relays: ['wss://relay.example/'],
      relationshipTypes: ['quoted-event'],
    };
    await assert.rejects(
      environment.research.expand(selection, { ...valid, surprise: true }),
      /Unknown expansion options/,
    );
    await assert.rejects(
      environment.research.expand(selection, { ...valid, relays: [] }),
      /at least one explicit/,
    );
    await assert.rejects(
      environment.research.expand(selection, { ...valid, relationshipTypes: ['recommends'] }),
      /Unsupported expansion relationship types/,
    );
    await assert.rejects(
      environment.research.expand(selection, { ...valid, observationLimit: 0 }),
      /observationLimit must be a positive integer/,
    );
    await assert.rejects(
      environment.research.expand(selection, { ...valid, authoredLimit: 0 }),
      /authoredLimit must be a positive integer/,
    );
    await assert.rejects(
      environment.research.expand(selection, { ...valid, authoredLimit: 2 }),
      /requires the "author" relationship/,
    );
    await assert.rejects(
      environment.research.expand(selection, {
        ...valid,
        relationshipTypes: ['author'],
        direction: 'outbound',
        authoredLimit: 2,
      }),
      /requires an inbound-capable direction/,
    );
    await assert.rejects(
      environment.research.expand(selection, { ...valid, signal: {} }),
      {
        name: 'ResearchMemoryError',
        message: 'Expansion signal must be an AbortSignal.',
      },
    );
    const account = subject('account', '1'.repeat(64));
    const replyOptions = { relays: ['wss://relay.example/'] };
    await assert.rejects(
      environment.research.replyContexts([account], { ...replyOptions, parentLimit: 0 }),
      /parentLimit must be a positive integer/,
    );
    await assert.rejects(
      environment.research.replyContexts([account], { ...replyOptions, observationLimit: 0 }),
      /observationLimit must be a positive integer/,
    );
    await assert.rejects(
      environment.research.replyContexts([subject('event', '2'.repeat(64))], replyOptions),
      /explicit account subjects only/,
    );
    await assert.rejects(
      environment.research.replyContexts([account], {
        ...replyOptions, relays: ['ws://relay.example/'],
      }),
      /explicit wss/,
    );
    await assert.rejects(
      environment.research.replyContexts([account], { ...replyOptions, surprise: true }),
      /Unknown reply-context options/,
    );
  } finally {
    environment.close();
  }
});

test('authored-note expansion samples only explicit account starts within per-account and global bounds', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createCorpusContext(20);
  const aliceKey = Uint8Array.from(Buffer.from('8'.repeat(64), 'hex'));
  const bobKey = Uint8Array.from(Buffer.from('9'.repeat(64), 'hex'));
  const carolKey = Uint8Array.from(Buffer.from('a'.repeat(64), 'hex'));
  const alice = getPublicKey(aliceKey);
  const bob = getPublicKey(bobKey);
  const carol = getPublicKey(carolKey);
  const notes = [
    ...Array.from({ length: 3 }, (_, index) => finalizeEvent({
      kind: 1,
      created_at: 100 + index,
      tags: index === 2 ? [['p', carol]] : [],
      content: `alice ${index}`,
    }, aliceKey)),
    ...Array.from({ length: 3 }, (_, index) => finalizeEvent({
      kind: 1, created_at: 200 + index, tags: [], content: `bob ${index}`,
    }, bobKey)),
    finalizeEvent({
      kind: 1, created_at: 300, tags: [], content: 'carol must not be sampled',
    }, carolKey),
  ];
  const profiles = [aliceKey, bobKey, carolKey].map((key, index) => finalizeEvent({
    kind: 0, created_at: 50, tags: [], content: `{"name":"account-${index}"}`,
  }, key));
  const available = [...notes, ...profiles];
  const receivedFilters = [];
  const relay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send, filter) => {
      receivedFilters.push(filter);
      const matches = available
        .filter((candidate) => matchesFilter(candidate, filter))
        .sort((left, right) => right.created_at - left.created_at)
        .slice(0, filter.limit);
      for (const event of matches) send(['EVENT', subscriptionId, event]);
      send(['EOSE', subscriptionId]);
    });
  }, context.directory);
  const unavailablePort = await reserveClosedPort();
  const environment = createResearchEnvironment(context.memory);

  try {
    const singleStart = accountCollection(context.memory, [alice]);
    const single = await expandResearch(
      context.memory,
      singleStart,
      {
        relays: [relay.url],
        relationshipTypes: ['author'],
        direction: 'inbound',
        authoredLimit: 1,
        depth: 1,
        limit: 10,
        timeoutMs: 2_000,
        observationLimit: 5,
      },
    );
    assert.equal(
      single.items.filter(({ subject: item }) => (
        item.type === 'event' && context.memory.getEvent(item.id)?.event.kind === 1
      )).length,
      1,
      'one explicit account receives one bounded recent note',
    );
    assert.equal(
      single.context.expansion.requests.filter(
        ({ purpose }) => purpose === 'authored-notes',
      ).length,
      1,
    );
    const starts = context.memory.collection([
      { subject: subject('account', alice) },
      { subject: subject('account', bob) },
    ], { operation: 'explicit-account-starts' });
    const sessionBefore = environment.research.session.selection.items.map((item) => item.subject);
    const expanded = await environment.research.expand(starts, {
      relays: [relay.url, `wss://127.0.0.1:${unavailablePort}/`],
      relationshipTypes: ['author', 'mentioned-account'],
      direction: 'both',
      authoredLimit: 2,
      depth: 2,
      limit: 20,
      timeoutMs: 2_000,
      observationLimit: 10,
      concurrency: 2,
    });

    const authoredRequests = expanded.context.expansion.requests.filter(
      ({ purpose }) => purpose === 'authored-notes',
    );
    assert.equal(authoredRequests.length, 2);
    assert.deepEqual(
      authoredRequests.map(({ filter }) => filter.authors[0]),
      [alice, bob],
      'each explicit starting account receives its own request',
    );
    assert.ok(authoredRequests.every(({ filter, ordering }) => (
      filter.kinds[0] === 1
      && filter.limit === 2
      && ordering === 'relay-recent-created-at-descending'
    )));
    assert.ok(authoredRequests.every(({ counts }) => counts.distinctEventsAcquired <= 2));
    assert.ok(authoredRequests.every(({ relays }) => relays.some(
      ({ outcome }) => outcome === 'connection-failure',
    )), 'partial relay failures remain visible per authored request');
    assert.ok(!receivedFilters.some((filter) => (
      filter.kinds?.[0] === 1 && filter.authors?.[0] === carol
    )), 'an account discovered from a sampled note is not sampled');

    const sampledNotes = expanded.items.filter(({ subject: item }) => (
      item.type === 'event' && context.memory.getEvent(item.id)?.event.kind === 1
    ));
    assert.equal(sampledNotes.length, 4);
    assert.ok(sampledNotes.every((item) => item.reasons.some((reason) => (
      reason.type === 'relationship'
      && reason.relationshipType === 'author'
      && reason.direction === 'inbound'
    ))));
    assert.ok(sampledNotes.every((item) => item.provenance.some(
      ({ relay: source }) => source === relay.url,
    )));
    assert.ok(expanded.items.some(({ subject: item }) => (
      item.type === 'account' && item.id === carol
    )), 'the mentioned non-starting account is discoverable');
    assert.equal(expanded.context.expansion.options.authoredLimit, 2);
    assert.ok(expanded.context.expansion.counts.acceptedObservations <= 10);
    assert.deepEqual(
      environment.research.session.selection.items.map((item) => item.subject),
      sessionBefore,
      'authored expansion does not mutate session selection',
    );

    const retained = environment.research.retain(expanded, 'bounded authored samples');
    const saved = context.memory.getSet(retained.id);
    assert.equal(saved.members.filter(({ type }) => type === 'event').length >= 4, true);
    assert.ok(sampledNotes.every(({ subject: item }) => context.memory.getEvent(item.id)));
  } finally {
    await relay.close();
    environment.close();
    context.close();
  }
});

test('authored-note expansion obeys the complete operation budget and stays disabled by default', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createCorpusContext(20);
  const firstKey = Uint8Array.from(Buffer.from('b'.repeat(64), 'hex'));
  const secondKey = Uint8Array.from(Buffer.from('c'.repeat(64), 'hex'));
  const accounts = [getPublicKey(firstKey), getPublicKey(secondKey)];
  const notes = [firstKey, secondKey].flatMap((key, authorIndex) => (
    Array.from({ length: 3 }, (_, index) => finalizeEvent({
      kind: 1,
      created_at: (authorIndex + 1) * 100 + index,
      tags: [],
      content: `sample ${authorIndex}-${index}`,
    }, key))
  ));
  const filters = [];
  const relay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send, filter) => {
      filters.push(filter);
      const matches = notes
        .filter((event) => matchesFilter(event, filter))
        .sort((left, right) => right.created_at - left.created_at)
        .slice(0, filter.limit);
      for (const event of matches) send(['EVENT', subscriptionId, event]);
      send(['EOSE', subscriptionId]);
    });
  }, context.directory);

  try {
    const starts = accountCollection(context.memory, accounts);
    const bounded = await expandResearch(context.memory, starts, {
      relays: [relay.url],
      relationshipTypes: ['author'],
      direction: 'inbound',
      authoredLimit: 2,
      depth: 1,
      limit: 10,
      timeoutMs: 2_000,
      observationLimit: 3,
    });
    assert.equal(bounded.context.expansion.counts.acceptedObservations, 3);
    assert.equal(bounded.context.expansion.boundedBy.observationBudget, true);
    assert.deepEqual(
      bounded.context.expansion.requests
        .filter(({ purpose }) => purpose === 'authored-notes')
        .map(({ filter }) => filter.limit),
      [2, 1],
    );
    const authoredFiltersBeforeDefaultExpansion = filters.filter((filter) => (
      filter.kinds?.[0] === 1 && Array.isArray(filter.authors)
    )).length;
    const defaultStart = accountCollection(context.memory, [accounts[0]]);
    const withoutOption = await expandResearch(
      context.memory,
      defaultStart,
      {
        relays: [relay.url],
        relationshipTypes: ['author'],
        direction: 'inbound',
        depth: 1,
        limit: 10,
        timeoutMs: 2_000,
        observationLimit: 5,
      },
    );
    assert.equal(
      withoutOption.context.expansion.requests.some(
        ({ purpose }) => purpose === 'authored-notes',
      ),
      false,
    );
    assert.equal(
      filters.filter((filter) => (
        filter.kinds?.[0] === 1 && Array.isArray(filter.authors)
      )).length,
      authoredFiltersBeforeDefaultExpansion,
      'omitting authoredLimit sends no authored-note acquisition request',
    );
  } finally {
    await relay.close();
    context.close();
  }
});

test('bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createCorpusContext(20);
  const authorKey = Uint8Array.from(Buffer.from('d'.repeat(64), 'hex'));
  const otherKey = Uint8Array.from(Buffer.from('e'.repeat(64), 'hex'));
  const author = getPublicKey(authorKey);
  const storedParent = finalizeEvent({
    kind: 1, created_at: 10, tags: [], content: 'stored parent',
  }, otherKey);
  const acquiredParent = finalizeEvent({
    kind: 1, created_at: 11, tags: [], content: 'acquired parent',
  }, otherKey);
  const root = finalizeEvent({
    kind: 1, created_at: 9, tags: [], content: 'thread root',
  }, otherKey);
  const mention = finalizeEvent({
    kind: 1, created_at: 8, tags: [], content: 'mere mention',
  }, otherKey);
  const unavailableId = 'f'.repeat(64);
  const parentLimitedId = '0'.repeat(64);
  const marked = finalizeEvent({
    kind: 1,
    created_at: 30,
    tags: [
      ['e', root.id, '', 'root'],
      ['e', mention.id, '', 'mention'],
      ['e', acquiredParent.id, '', 'reply'],
    ],
    content: 'marked reply',
  }, authorKey);
  const legacy = finalizeEvent({
    kind: 1,
    created_at: 29,
    tags: [['e', root.id], ['e', mention.id], ['e', storedParent.id]],
    content: 'legacy reply',
  }, authorKey);
  const duplicateParent = finalizeEvent({
    kind: 1,
    created_at: 28,
    tags: [['e', acquiredParent.id, '', 'reply']],
    content: 'same parent again',
  }, authorKey);
  const unavailable = finalizeEvent({
    kind: 1,
    created_at: 27,
    tags: [['e', unavailableId, '', 'reply']],
    content: 'missing parent',
  }, authorKey);
  const parentLimited = finalizeEvent({
    kind: 1,
    created_at: 26,
    tags: [['e', parentLimitedId, '', 'reply']],
    content: 'parent beyond target limit',
  }, authorKey);
  const notReply = finalizeEvent({
    kind: 1, created_at: 25, tags: [], content: 'not a reply',
  }, authorKey);
  const foreign = finalizeEvent({
    kind: 1, created_at: 40, tags: [['e', acquiredParent.id, '', 'reply']], content: 'foreign',
  }, otherKey);
  context.memory.ingest(storedParent, {
    relay: 'wss://stored.example/', observedAt: '2026-07-26T00:00:00.000Z',
  });
  const available = [
    marked, legacy, duplicateParent, unavailable, parentLimited, notReply, foreign,
    acquiredParent, root, mention,
  ];
  const filters = [];
  const relay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send, filter) => {
      filters.push(filter);
      const matches = available
        .filter((event) => matchesFilter(event, filter))
        .sort((left, right) => right.created_at - left.created_at)
        .slice(0, filter.limit);
      for (const event of matches) send(['EVENT', subscriptionId, event]);
      send(['EOSE', subscriptionId]);
    });
  }, context.directory);
  const unavailablePort = await reserveClosedPort();
  const environment = createResearchEnvironment(context.memory);

  try {
    const starts = context.memory.collection([
      { subject: subject('account', author) },
      { subject: subject('account', author) },
    ], { operation: 'explicit-accounts' });
    const sessionBefore = environment.research.session.selection;
    const result = await environment.research.replyContexts(starts, {
      relays: [relay.url, `wss://127.0.0.1:${unavailablePort}/`],
      authoredLimit: 6,
      parentLimit: 2,
      timeoutMs: 2_000,
      observationLimit: 9,
      concurrency: 2,
    });

    assert.equal(result.contexts.length, 5);
    assert.equal(result.collection.type, 'result-collection');
    assert.ok(
      result.report.authoredNoteCount <= context.memory.describe().capacity,
      'reply resolution uses the bounded resident corpus',
    );
    assert.deepEqual(environment.research.session.selection, sessionBefore);
    assert.ok(result.contexts.every(({ reply }) => reply.record.event.pubkey === author));
    assert.ok(!result.contexts.some(({ reply }) => reply.subject.id === notReply.id));
    assert.equal(
      result.contexts.find(({ reply }) => reply.subject.id === marked.id).parent.subject.id,
      acquiredParent.id,
      'marked reply parent wins over root and mention',
    );
    const legacyContext = result.contexts.find(({ reply }) => reply.subject.id === legacy.id);
    assert.equal(legacyContext.parent.subject.id, storedParent.id);
    assert.equal(legacyContext.relationship.evidence.interpretation, 'best-effort-fallback');
    assert.equal(legacyContext.parent.status, 'resolved');
    assert.ok(legacyContext.parent.provenance.some(({ relay: source }) => (
      source === 'wss://stored.example/'
    )));
    assert.ok(result.contexts
      .filter(({ parent }) => parent.subject.id === acquiredParent.id)
      .every(({ parent }) => parent.provenance.some(({ relay: source }) => source === relay.url)));
    const missing = result.contexts.find(({ reply }) => reply.subject.id === unavailable.id);
    assert.equal(missing.parent.status, 'unresolved');
    assert.equal(missing.parent.unresolvedReason, 'unavailable');
    assert.equal(
      result.contexts.find(({ reply }) => reply.subject.id === parentLimited.id)
        .parent.unresolvedReason,
      'parent-limit',
    );
    const parentRequest = result.report.requests.find(({ purpose }) => purpose === 'reply-parents');
    assert.equal(parentRequest.filter.ids.length, 2);
    assert.equal(new Set(parentRequest.filter.ids).size, 2);
    assert.equal(
      parentRequest.filter.ids.filter((id) => id === acquiredParent.id).length,
      1,
      'duplicate references produce one parent target',
    );
    assert.ok(result.report.requests.every(({ relays }) => relays.some(
      ({ outcome }) => outcome === 'connection-failure',
    )));
    assert.ok(result.report.counts.acceptedObservations <= 9);
    assert.equal(result.report.options.authoredLimit, 6);
    assert.equal(result.report.options.parentLimit, 2);
    assert.equal(result.report.unresolvedParentCount, 2);
    assert.equal(result.report.boundedBy.parentLimit, true);
    assert.equal(result.contexts
      .filter(({ parent }) => parent.status === 'resolved')
      .map(({ reply, parent }) => [reply.record.event.content, parent.record.event.content])
      .length, 3, 'contexts are ordinary JavaScript data');

    const globallyBounded = await resolveReplyContexts(
      context.memory,
      [subject('account', author)],
      {
        relays: [relay.url],
        authoredLimit: 3,
        parentLimit: 2,
        timeoutMs: 2_000,
        observationLimit: 1,
      },
    );
    assert.equal(globallyBounded.report.counts.acceptedObservations, 1);
    assert.equal(globallyBounded.report.boundedBy.observationBudget, true);
    assert.equal(globallyBounded.report.requestCount, 1);

    const parentBounded = await resolveReplyContexts(
      context.memory,
      [subject('account', author)],
      {
        relays: [relay.url],
        authoredLimit: 5,
        parentLimit: 1,
        timeoutMs: 2_000,
        observationLimit: 6,
      },
    );
    assert.equal(parentBounded.report.requestedParentCount <= 1, true);

    const silentRelay = await startRelay(() => {}, context.directory);
    try {
      const timedOut = await resolveReplyContexts(
        context.memory,
        [subject('account', author)],
        {
          relays: [silentRelay.url],
          authoredLimit: 1,
          parentLimit: 1,
          timeoutMs: 30,
          observationLimit: 2,
        },
      );
      assert.equal(timedOut.report.boundedBy.timeout, true);
    } finally {
      await silentRelay.close();
    }
    assert.ok(filters.filter((filter) => filter.authors?.[0] === author)
      .every((filter) => filter.limit <= 6));
  } finally {
    await relay.close();
    environment.close();
    context.close();
  }
});

test('console expansion performs bounded targeted multi-hop acquisition', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createCorpusContext(8);
  const aliceKey = Uint8Array.from(Buffer.from('4'.repeat(64), 'hex'));
  const bobKey = Uint8Array.from(Buffer.from('5'.repeat(64), 'hex'));
  const bob = getPublicKey(bobKey);
  const secondHop = finalizeEvent({
    kind: 1, created_at: 100, tags: [], content: 'second hop',
  }, bobKey);
  const quoted = finalizeEvent({
    kind: 1, created_at: 110, tags: [['q', secondHop.id]], content: 'quoted evidence',
  }, bobKey);
  const seed = finalizeEvent({
    kind: 1, created_at: 120, tags: [['q', quoted.id]], content: 'seed',
  }, aliceKey);
  const inboundReply = finalizeEvent({
    kind: 1, created_at: 130, tags: [['e', seed.id, '', 'reply']], content: 'inbound',
  }, bobKey);
  const profile = finalizeEvent({
    kind: 0, created_at: 90, tags: [], content: '{"name":"bob"}',
  }, bobKey);
  const available = [quoted, secondHop, inboundReply, profile];
  const receivedFilters = [];
  context.memory.ingest(seed, {
    relay: 'wss://seed.example/', observedAt: '2026-07-25T12:00:00.000Z',
  });
  const relay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send, filter) => {
      receivedFilters.push(filter);
      for (const event of available.filter((candidate) => matchesFilter(candidate, filter))) {
        send(['EVENT', subscriptionId, event]);
      }
      send(['EOSE', subscriptionId]);
    });
  }, context.directory);
  const unavailablePort = await reserveClosedPort();
  const environment = createResearchEnvironment(context.memory);

  try {
    const sessionBefore = environment.research.session.selection.items.map(({ subject: item }) => item);
    const starting = context.memory.select({ ids: [seed.id] });
    const expanded = await environment.research.expand(starting, {
      relays: [relay.url, `wss://127.0.0.1:${unavailablePort}/`],
      relationshipTypes: ['quoted-event', 'reply-parent', 'author'],
      direction: 'both',
      depth: 2,
      limit: 20,
      timeoutMs: 2_000,
      observationLimit: 10,
      concurrency: 2,
    });

    const ids = new Set(expanded.items.map(({ subject: item }) => item.id));
    assert.ok(ids.has(quoted.id), 'missing quoted event was reached');
    assert.ok(ids.has(secondHop.id), 'second-hop quoted event was reached');
    assert.ok(ids.has(inboundReply.id), 'inbound reply was reached');
    assert.equal(context.memory.currentEvent(bob, 0).event.id, profile.id);
    assert.ok(expanded.items.some((item) => item.reasons.some((reason) => (
      reason.type === 'relationship' && reason.relationshipType === 'quoted-event'
    ))));
    assert.ok(expanded.items.some((item) => item.provenance.some(({ relay: source }) => (
      source === relay.url
    ))));
    assert.deepEqual(
      environment.research.session.selection.items.map(({ subject: item }) => item),
      sessionBefore,
      'explicit expansion does not mutate the session selection',
    );

    const report = expanded.context.expansion;
    assert.equal(report.options.observationLimit, 10);
    assert.ok(report.requestCount >= 3);
    assert.equal(report.filterCount, report.requestCount);
    assert.ok(report.counts.acceptedObservations <= 10);
    assert.ok(report.corpusBefore.eventCount < report.corpusAfter.eventCount);
    assert.equal(report.corpusAfter.capacity, 8);
    assert.ok(report.requests.some(({ relays }) => relays.some(({ outcome }) => (
      outcome === 'connection-failure'
    ))));
    assert.equal(report.boundedBy.depth, true);
    assert.ok(report.unresolvedBefore.events.includes(quoted.id));
    assert.ok(!report.unresolvedAfter.events.includes(quoted.id));
    assert.ok(receivedFilters.some((filter) => (
      filter['#e']
      && filter.kinds?.length === 1
      && filter.kinds[0] === 1
      && filter.limit > filter['#e'].length
    )), 'reply acquisition is restricted to bounded kind-1 notes');
    assert.ok(receivedFilters.some((filter) => (
      filter.authors
      && filter.kinds?.length === 1
      && filter.kinds[0] === 0
      && filter.limit === filter.authors.length
    )), 'profile acquisition requests one current candidate per account');

    const retained = environment.research.retain(expanded, 'expanded evidence');
    const saved = context.memory.getSet(retained.id);
    assert.ok(saved.members.some((item) => item.id === secondHop.id));
    assert.equal(context.memory.getEvent(profile.id).event.pubkey, bob);
  } finally {
    await relay.close();
    environment.close();
    context.close();
  }
});

test('exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createCorpusContext(20);
  const seedKey = Uint8Array.from(Buffer.from('6'.repeat(64), 'hex'));
  const replyKey = Uint8Array.from(Buffer.from('7'.repeat(64), 'hex'));
  const seed = finalizeEvent({
    kind: 1, created_at: 200, tags: [], content: 'conversation seed',
  }, seedKey);
  const replies = Array.from({ length: 12 }, (_, index) => finalizeEvent({
    kind: 1,
    created_at: 201 + index,
    tags: [['e', seed.id, '', 'reply']],
    content: `reply ${index}`,
  }, replyKey));
  context.memory.ingest(seed, {
    relay: 'wss://seed.example/', observedAt: '2026-07-25T12:00:00.000Z',
  });
  const receivedFilters = [];
  const relay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send, filter) => {
      receivedFilters.push(filter);
      for (const event of replies.filter((candidate) => matchesFilter(candidate, filter))) {
        send(['EVENT', subscriptionId, event]);
      }
      send(['EOSE', subscriptionId]);
    });
  }, context.directory);

  try {
    const broad = await expandResearch(
      context.memory,
      context.memory.select({ ids: [seed.id] }),
      {
        relays: [relay.url],
        relationshipTypes: ['reply-parent'],
        direction: 'inbound',
        depth: 1,
        limit: 20,
        timeoutMs: 2_000,
        observationLimit: 12,
      },
    );
    assert.equal(
      broad.items.filter(({ role }) => role === 'discovery').length,
      12,
      'one seed can acquire more than ten replies',
    );
    assert.equal(broad.context.expansion.counts.acceptedObservations, 12);
    assert.equal(broad.context.expansion.boundedBy.observationBudget, true);
    assert.ok(receivedFilters.some((filter) => (
      filter['#e']?.length === 1 && filter.kinds?.[0] === 1 && filter.limit === 12
    )));
    const limited = createInMemoryResearchMemory({ capacity: 20 });
    limited.ingest(seed, {
      relay: 'wss://seed.example/', observedAt: '2026-07-25T12:00:00.000Z',
    });
    const bounded = await expandResearch(
      limited,
      limited.select({ ids: [seed.id] }),
      {
        relays: [relay.url],
        relationshipTypes: ['reply-parent'],
        direction: 'inbound',
        depth: 1,
        limit: 20,
        timeoutMs: 2_000,
        observationLimit: 3,
      },
    );
    assert.equal(bounded.context.expansion.counts.acceptedObservations, 3);
    assert.equal(bounded.context.expansion.boundedBy.observationBudget, true);
    limited.close();

    const tiny = createInMemoryResearchMemory({ capacity: 3 });
    tiny.ingest(seed, {
      relay: 'wss://seed.example/', observedAt: '2026-07-25T12:00:00.000Z',
    });
    const tinyStart = tiny.select({ ids: [seed.id] });
    const pressured = await expandResearch(tiny, tinyStart, {
      relays: [relay.url],
      relationshipTypes: ['reply-parent'],
      direction: 'inbound',
      depth: 1,
      limit: 20,
      timeoutMs: 2_000,
      observationLimit: 4,
    });
    assert.equal(tiny.describe().eventCount, 3);
    assert.ok(tiny.describe().evictions > 0);
    assert.equal(tiny.inspect(subject('event', seed.id)).resident, true);
    assert.equal(pressured.items[0].subject.id, seed.id);
    assert.ok(pressured.items.length > 1, 'the preserved seed remains traversable');
    assert.equal(tiny.describe().eventCount, 3, 'eviction bounds the sole resident corpus');
    tiny.close();
  } finally {
    await relay.close();
    context.close();
  }
});

function createContext() {
  const memory = createInMemoryResearchMemory({ capacity: 1000 });
  const directory = mkdtempSync(join(tmpdir(), 'nostr-research-acquisition-'));
  return {
    directory,
    memory,
    close() {
      this.memory?.close();
      rmSync(this.directory, { force: true, recursive: true });
    },
  };
}

function matchesFilter(event, filter) {
  if (filter.ids && !filter.ids.includes(event.id)) return false;
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter['#e'] && !event.tags.some((tag) => (
    tag[0] === 'e' && filter['#e'].includes(tag[1])
  ))) return false;
  return true;
}

function createCorpusContext(capacity) {
  const memory = createInMemoryResearchMemory({ capacity });
  const directory = mkdtempSync(join(tmpdir(), 'nostr-research-acquisition-'));
  return {
    directory,
    memory,
    close() {
      this.memory?.close();
      rmSync(this.directory, { force: true, recursive: true });
    },
  };
}

function accountCollection(memory, accounts) {
  return memory.collection(
    accounts.map((id) => ({ subject: subject('account', id) })),
    { operation: 'explicit-account-starts' },
  );
}

async function startRelay(
  configure,
  certificateDirectory,
  { handshakeDelayMs = 0, ignoreCloseHandshake = false } = {},
) {
  const keyPath = join(certificateDirectory, 'relay-key.pem');
  const certificatePath = join(certificateDirectory, 'relay-cert.pem');
  try {
    readFileSync(keyPath);
  } catch {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-subj', '/CN=localhost', '-keyout', keyPath, '-out', certificatePath,
    ], { stdio: 'ignore' });
  }
  const sockets = new Set();
  const server = createServer({
    key: readFileSync(keyPath),
    cert: readFileSync(certificatePath),
  });
  server.on('upgrade', (request, socket) => {
    const accept = createHash('sha1')
      .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    sockets.add(socket);
    const requestHandlers = [];
    const socketCloseHandlers = [];
    let pendingClientData = Buffer.alloc(0);
    configure({
      onRequest(handler) { requestHandlers.push(handler); },
      onSocketClose(handler) { socketCloseHandlers.push(handler); },
    });
    socket.on('data', (buffer) => {
      pendingClientData = Buffer.concat([pendingClientData, buffer]);
      const decoded = decodeClientFrames(pendingClientData);
      pendingClientData = pendingClientData.subarray(decoded.consumed);
      for (const frame of decoded.frames) {
        if (frame.opcode === 1 && Array.isArray(frame.message) && frame.message[0] === 'REQ') {
          for (const handler of requestHandlers) {
            handler(frame.message[1], (packet) => sendFrame(socket, packet), frame.message[2]);
          }
        } else if (frame.opcode === 8 && !ignoreCloseHandshake) {
          socket.write(Buffer.from([0x88, 0x00]));
          socket.end();
        }
      }
    });
    socket.on('close', () => {
      sockets.delete(socket);
      for (const handler of socketCloseHandlers) handler();
    });
    setTimeout(() => {
      if (socket.destroyed) return;
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n'
        + 'Upgrade: websocket\r\n'
        + 'Connection: Upgrade\r\n'
        + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
      );
    }, handshakeDelayMs);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `wss://127.0.0.1:${port}/`,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

function sendFrame(socket, value) {
  const payload = Buffer.from(JSON.stringify(value));
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function decodeClientFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset + 6 <= buffer.length) {
    const opcode = buffer[offset] & 0x0f;
    let length = buffer[offset + 1] & 0x7f;
    let header = 2;
    if (length === 126) {
      if (offset + 8 > buffer.length) break;
      length = buffer.readUInt16BE(offset + 2);
      header = 4;
    }
    const maskStart = offset + header;
    const payloadStart = maskStart + 4;
    if (payloadStart + length > buffer.length) break;
    const mask = buffer.subarray(maskStart, payloadStart);
    const payload = Buffer.from(buffer.subarray(payloadStart, payloadStart + length));
    for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    let message = null;
    if (opcode === 1) try { message = JSON.parse(payload.toString()); } catch {}
    frames.push({ opcode, message });
    offset = payloadStart + length;
  }
  return { frames, consumed: offset };
}

async function eventually(predicate) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('Expected observable socket closure.');
}

async function reserveClosedPort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function supportsLoopbackListener() {
  const server = createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    return true;
  } catch (error) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES') return false;
    throw error;
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
}
