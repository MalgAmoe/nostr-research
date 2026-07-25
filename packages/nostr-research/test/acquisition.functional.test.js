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
  createResearchWorkspace,
  expandResearch,
  loadFixtureEvents,
  openResearchMemory,
  ResearchMemoryError,
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
      eventLimit: 5,
      concurrency: 2,
    });

    assert.equal(result.completionReason, 'completed');
    assert.deepEqual(result.relays.map((relay) => relay.outcome), ['eose', 'eose']);
    assert.deepEqual(result.counts, {
      received: 3, invalid: 1, duplicate: 1, newlyStored: 1, observations: 2,
    });
    assert.deepEqual(result.acquiredEventIds, [firstEvent.id]);
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
      eventLimit: 1,
    });
    assert.equal(limited.completionReason, 'limit');
    assert.equal(limited.counts.observations, 1);
    await eventually(() => limitSocketClosed);

    const controller = new AbortController();
    const cancellationRelay = await startRelay(() => {}, context.directory);
    const pending = acquireRelayEvents(context.memory, {
      relays: [cancellationRelay.url],
      filter: {},
      timeoutMs: 2_000,
      eventLimit: 2,
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
        eventLimit: 2,
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
      eventLimit: 2,
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
      eventLimit: 2,
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
  const context = createContext();
  const workspace = createResearchWorkspace(context.memory, { capacity: 2 });
  const environment = createResearchEnvironment(context.memory, workspace);
  const selection = workspace.collection([], { operation: 'empty-start' });
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
      environment.research.expand(selection, { ...valid, eventLimit: 0 }),
      /eventLimit must be a positive integer/,
    );
    await assert.rejects(
      environment.research.expand(selection, { ...valid, signal: {} }),
      {
        name: 'ResearchMemoryError',
        message: 'Expansion signal must be an AbortSignal.',
      },
    );
  } finally {
    environment.close();
    context.memory = null;
    context.close();
  }
});

test('console expansion performs bounded targeted multi-hop acquisition', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
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
  const workspace = createResearchWorkspace(context.memory, { capacity: 8 });
  workspace.load({ ids: [seed.id] });
  const environment = createResearchEnvironment(context.memory, workspace);
  let environmentClosed = false;

  try {
    const sessionBefore = environment.research.session.selection.items.map(({ subject: item }) => item);
    const starting = workspace.select({ ids: [seed.id] });
    const expanded = await environment.research.expand(starting, {
      relays: [relay.url, `wss://127.0.0.1:${unavailablePort}/`],
      relationshipTypes: ['quoted-event', 'reply-parent', 'author'],
      direction: 'both',
      depth: 2,
      limit: 20,
      timeoutMs: 2_000,
      eventLimit: 10,
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
    assert.equal(report.options.eventLimit, 10);
    assert.ok(report.requestCount >= 3);
    assert.equal(report.filterCount, report.requestCount);
    assert.ok(report.counts.observations <= 10);
    assert.ok(report.workspaceBefore.eventCount < report.workspaceAfter.eventCount);
    assert.equal(report.workspaceAfter.capacity, 8);
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
    environment.close();
    environmentClosed = true;
    context.memory = null;
    const reopened = openResearchMemory(context.databasePath);
    try {
      const saved = reopened.getSet(retained.id);
      assert.ok(saved.members.some((item) => item.id === secondHop.id));
      assert.equal(reopened.getEvent(profile.id).event.pubkey, bob);
    } finally {
      reopened.close();
    }
  } finally {
    await relay.close();
    if (!environmentClosed) environment.close();
    context.close();
  }
});

test('exported expansion uses the global budget for reply breadth and preserves tiny-workspace seeds', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
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
    const roomy = createResearchWorkspace(context.memory, { capacity: 20 });
    roomy.load({ ids: [seed.id] });
    const broad = await expandResearch(
      context.memory,
      roomy,
      roomy.select({ ids: [seed.id] }),
      {
        relays: [relay.url],
        relationshipTypes: ['reply-parent'],
        direction: 'inbound',
        depth: 1,
        limit: 20,
        timeoutMs: 2_000,
        eventLimit: 12,
      },
    );
    assert.equal(
      broad.items.filter(({ role }) => role === 'discovery').length,
      12,
      'one seed can acquire more than ten replies',
    );
    assert.equal(broad.context.expansion.counts.observations, 12);
    assert.equal(broad.context.expansion.boundedBy.eventBudget, true);
    assert.ok(receivedFilters.some((filter) => (
      filter['#e']?.length === 1 && filter.kinds?.[0] === 1 && filter.limit === 12
    )));
    roomy.close();

    const limited = createResearchWorkspace(context.memory, { capacity: 20 });
    limited.load({ ids: [seed.id] });
    const bounded = await expandResearch(
      context.memory,
      limited,
      limited.select({ ids: [seed.id] }),
      {
        relays: [relay.url],
        relationshipTypes: ['reply-parent'],
        direction: 'inbound',
        depth: 1,
        limit: 20,
        timeoutMs: 2_000,
        eventLimit: 3,
      },
    );
    assert.equal(bounded.context.expansion.counts.observations, 3);
    assert.equal(bounded.context.expansion.boundedBy.eventBudget, true);
    limited.close();

    const tiny = createResearchWorkspace(context.memory, { capacity: 3 });
    tiny.load({ ids: [seed.id] });
    const tinyStart = tiny.select({ ids: [seed.id] });
    const pressured = await expandResearch(context.memory, tiny, tinyStart, {
      relays: [relay.url],
      relationshipTypes: ['reply-parent'],
      direction: 'inbound',
      depth: 1,
      limit: 20,
      timeoutMs: 2_000,
      eventLimit: 4,
    });
    assert.equal(tiny.describe().eventCount, 3);
    assert.ok(tiny.describe().evictions > 0);
    assert.equal(tiny.inspect(subject('event', seed.id)).loaded, true);
    assert.equal(pressured.items[0].subject.id, seed.id);
    assert.ok(pressured.items.length > 1, 'the preserved seed remains traversable');
    assert.equal(context.memory.summary().events, 13, 'workspace eviction never removes SQLite evidence');
    tiny.close();
  } finally {
    await relay.close();
    context.close();
  }
});

function createContext() {
  const directory = mkdtempSync(join(tmpdir(), 'nostr-acquisition-'));
  const databasePath = join(directory, 'memory.sqlite');
  const memory = openResearchMemory(databasePath);
  return {
    directory,
    databasePath,
    memory,
    close() {
      this.memory?.close();
      rmSync(directory, { recursive: true, force: true });
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
    configure({
      onRequest(handler) { requestHandlers.push(handler); },
      onSocketClose(handler) { socketCloseHandlers.push(handler); },
    });
    socket.on('data', (buffer) => {
      for (const frame of decodeClientFrames(buffer)) {
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
  const messages = [];
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
    messages.push({ opcode, message });
    offset = payloadStart + length;
  }
  return messages;
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
