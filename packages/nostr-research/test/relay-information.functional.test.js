import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
  executeResearchOperation,
  executeResearchPlan,
} from '@nostr-research/memory';

test('relay information stays attributed, bounded, and reusable through the public executor', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, accept: options.headers.Accept });
    const relay = new URL(url).hostname;
    if (relay === 'success.example') {
      return jsonResponse({
        name: 'Fixture',
        supported_nips: [11, 42, 11],
        limitation: { auth_required: true, max_message_length: 4096 },
        extension: 'x'.repeat(3000),
      });
    }
    if (relay === 'missing.example') return jsonResponse({ name: 'Sparse fixture' });
    if (relay === 'http.example') {
      return new Response('', {
        status: 503, headers: { 'content-type': 'application/nostr+json' },
      });
    }
    if (relay === 'invalid.example') {
      return new Response('{', {
        headers: { 'content-type': 'application/nostr+json' },
      });
    }
    if (relay === 'malformed.example') {
      return jsonResponse({ supported_nips: ['11'] });
    }
    return new Response('x'.repeat(65537), {
      headers: { 'content-type': 'application/nostr+json' },
    });
  };

  try {
    const memory = createInMemoryResearchMemory({ capacity: 2 });
    const relays = [
      'wss://success.example/path',
      'wss://missing.example/',
      'wss://http.example/',
      'wss://invalid.example/',
      'wss://malformed.example/',
      'wss://oversized.example/',
    ];
    const direct = await executeResearchOperation(memory, {
      operation: 'relay-info',
      parameters: { relays, timeoutMs: 1000, concurrency: 2 },
    });
    assert.equal(direct.type, 'relay-information-report');
    assert.deepEqual(direct.requested.relays, relays);
    assert.deepEqual(direct.outcomes.map(({ outcome }) => outcome), [
      'success', 'success', 'http-error', 'invalid-json',
      'malformed-known-fields', 'oversized-response',
    ]);
    assert.deepEqual(direct.outcomes[0].advertised.supportedNips, [11, 42]);
    assert.equal(direct.outcomes[0].advertised.advertisedAuthRequired, true);
    assert.equal(direct.outcomes[0].document.extension.length, 2000);
    assert.equal(direct.outcomes[1].advertised.advertisedAuthRequired, undefined);
    assert.equal(memory.describe().observationBuffer.eventCount, 0);
    assert.ok(calls.every(({ accept }) => accept === 'application/nostr+json'));
    assert.equal(calls[0].url, 'https://success.example/path');

    const plan = await executeResearchPlan(memory, [{
      id: 'advertisements',
      operation: 'relay-info',
      parameters: { relays: ['wss://missing.example/'], timeoutMs: 1000, concurrency: 1 },
    }]);
    assert.equal(plan.stages[0].result.type, 'relay-information-report');

    const session = createDeclarativeResearchSession(memory, {
      relays: ['wss://success.example/path', 'wss://http.example/'],
      acquisition: { timeoutMs: 1000, concurrency: 1 },
    });
    const inspected = await session.execute({
      commandId: 'relay-info',
      command: 'relay-info',
      parameters: { concurrency: 2 },
      resultId: 'relay-advertisements',
    });
    assert.equal(inspected.ok, true);
    assert.deepEqual(inspected.result.handle, {
      id: 'relay-advertisements',
      kind: 'relay-information',
      count: 2,
      revision: 1,
      scope: 'external-report',
    });
    assert.equal(inspected.sessionRevision, 1);
    const listed = await session.execute({
      commandId: 'list',
      command: 'list',
      parameters: {},
    });
    assert.deepEqual(listed.result.preview[0], {
      id: 'relay-advertisements',
      kind: 'relay-information',
      count: 2,
      revision: 1,
      scope: 'external-report',
    });

    for (const mode of ['summary', 'preview', 'coverage', 'details']) {
      const shown = await session.execute({
        commandId: `show-${mode}`,
        command: 'show',
        input: 'relay-advertisements',
        parameters: { mode, previewLimit: 2, excerptLimit: 80, sizeLimit: 12000 },
      });
      assert.equal(shown.ok, true, JSON.stringify(shown));
      assert.equal(shown.result.type, 'relay-information');
      assert.equal(shown.result.observation, mode);
      if (mode === 'summary') {
        assert.equal(shown.result.summary.resultKind, 'relay-information-report');
        assert.equal(shown.result.summary.countUnit, 'relays');
        assert.deepEqual(shown.result.summary.lineage, { operation: 'relay-info' });
        assert.equal(shown.result.summary.completeness.status, 'partial');
        assert.equal(shown.result.summary.completeness.successful, 1);
        assert.equal(shown.result.summary.completeness.unsuccessful, 1);
        assert.deepEqual(shown.result.preview ?? [], []);
        assert.equal(shown.result.summary.successfulDocuments, 1);
      }
    }
    const schema = await session.execute({
      commandId: 'schema',
      command: 'schema',
      input: 'relay-advertisements',
      parameters: {},
    });
    assert.equal(schema.ok, true);
    assert.equal(schema.result.structure.kind, 'relay-information');
    assert.deepEqual(schema.result.compatibleOperations, []);
    assert.deepEqual(schema.result.structure.observationModes, [
      'summary', 'preview', 'coverage', 'details',
    ]);

    const unsupportedShow = await session.execute({
      commandId: 'show-explain',
      command: 'show',
      input: 'relay-advertisements',
      parameters: { mode: 'explain' },
    });
    assert.equal(unsupportedShow.ok, false);
    assert.equal(unsupportedShow.error.code, 'INVALID_OPERATION');

    const explained = await session.execute({
      commandId: 'explain',
      command: 'explain',
      input: 'relay-advertisements',
      parameters: { subject: { type: 'account', id: '0'.repeat(64) } },
    });
    assert.equal(explained.ok, false);
    assert.equal(explained.error.code, 'INVALID_OPERATION');

    const released = await session.execute({
      commandId: 'release',
      command: 'release',
      input: 'relay-advertisements',
      parameters: {},
    });
    assert.equal(released.ok, true);
    assert.equal(released.result.released, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/nostr+json; charset=utf-8' },
  });
}
