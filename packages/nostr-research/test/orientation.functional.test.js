import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import { createInMemoryResearchMemory } from '@nostr-research/memory';

const CONSOLE = new URL('../bin/nostr-research-console.js', import.meta.url);
const KEYS = ['a', 'b'].map((value) => Uint8Array.from(Buffer.from(value.repeat(64), 'hex')));

test('public console inspection and facets orient a bounded process-local investigation', () => {
  let memory = createInMemoryResearchMemory({ capacity: 1000 });
  const events = [
    finalizeEvent({
      kind: 1, created_at: 100, tags: [['t', 'research']],
      content: `${'very long source evidence '.repeat(1000)} https://example.org/a.png`,
    }, KEYS[0]),
    finalizeEvent({
      kind: 1, created_at: 101, tags: [['t', 'research']],
      content: `${'another very long note '.repeat(1000)} https://video.example/b.mp4`,
    }, KEYS[0]),
    finalizeEvent({
      kind: 1, created_at: 102, tags: [['p', 'f'.repeat(64)]],
      content: `${'independent long note '.repeat(1000)} https://example.net/page`,
    }, KEYS[1]),
  ];
  try {
    for (const event of events) {
      memory.ingest(event, {
        relay: 'wss://one.example/', observedAt: '2026-07-25T10:00:00.000Z',
      });
    }
    const repeated = memory.ingest(events[0], {
      relay: 'wss://two.example/', observedAt: '2026-07-25T10:01:00.000Z',
    });
    const coverage = memory.recordAcquisitionCoverage({
      requested: { relays: ['wss://one.example/', 'wss://two.example/'], filter: { kinds: [1], limit: 3 } },
      budget: { timeoutMs: 2000, eventLimit: 3, concurrency: 2 },
      startedAt: '2026-07-25T10:00:00.000Z',
      finishedAt: '2026-07-25T10:00:02.000Z',
      completionReason: 'limit',
      relays: [
        {
          relay: 'wss://one.example/', contacted: true, outcome: 'limit',
          received: 4, invalid: 1, duplicate: 0, newlyStored: 3, observations: 3,
          diagnostic: null,
        },
        {
          relay: 'wss://two.example/', contacted: true, outcome: 'limit',
          received: 1, invalid: 0, duplicate: 1, newlyStored: 0, observations: 1,
          diagnostic: null,
        },
      ],
      acquiredObservations: [{ eventId: events[0].id, observations: [repeated.observation] }],
    });
    const run = memory.recordRun({
      operation: 'event-query', inputs: { kinds: [1] },
      startedAt: '2026-07-25T10:02:00.000Z', finishedAt: '2026-07-25T10:02:01.000Z',
      status: 'completed', diagnostics: [],
      results: events.map((event) => ({
        type: 'event', id: event.id, reasons: [{ type: 'kind', value: 1 }], provenance: [],
      })),
    });
    const set = memory.retain(memory.select({ kinds: [1] }), 'orientation seed');
    memory.close();
    memory = null;

    const source = [
      `const fixtureEvents = ${JSON.stringify(events)}`,
      "for (const event of fixtureEvents) research.memory.ingest(event, { relay: 'wss://one.example/', observedAt: '2026-07-25T10:00:00.000Z' })",
      "const repeated = research.memory.ingest(fixtureEvents[0], { relay: 'wss://two.example/', observedAt: '2026-07-25T10:01:00.000Z' })",
      `const coverageInput = ${JSON.stringify({
        requested: { relays: ['wss://one.example/', 'wss://two.example/'], filter: { kinds: [1], limit: 3 } },
        budget: { timeoutMs: 2000, eventLimit: 3, concurrency: 2 },
        startedAt: '2026-07-25T10:00:00.000Z',
        finishedAt: '2026-07-25T10:00:02.000Z',
        completionReason: 'limit',
        relays: [
          { relay: 'wss://one.example/', contacted: true, outcome: 'limit', received: 4, invalid: 1, duplicate: 0, newlyStored: 3, observations: 3, diagnostic: null },
          { relay: 'wss://two.example/', contacted: true, outcome: 'limit', received: 1, invalid: 0, duplicate: 1, newlyStored: 0, observations: 1, diagnostic: null },
        ],
      }) .replace(/}$/, `,"acquiredObservations":[{"eventId":"${events[0].id}","observations":[]}]}`)}`,
      'coverageInput.acquiredObservations[0].observations = [repeated.observation]',
      'const coverageRecord = research.memory.recordAcquisitionCoverage(coverageInput)',
      `const runRecord = research.memory.recordRun({ operation: 'event-query', inputs: { kinds: [1] }, startedAt: '2026-07-25T10:02:00.000Z', finishedAt: '2026-07-25T10:02:01.000Z', status: 'completed', diagnostics: [], results: fixtureEvents.map(event => ({ type: 'event', id: event.id, reasons: [{ type: 'kind', value: 1 }], provenance: [] })) })`,
      "const setRecord = research.memory.retain(research.memory.select({ kinds: [1] }), 'orientation seed')",
      'const all = research.load({ kinds: [1], order: "oldest", limit: 10 })',
      'const facets = research.facets(all, { limit: 10 })',
      'const chosenAuthor = facets.authors.values[0].id',
      'const positive = research.collection(all.items.filter(item => item.record.event.pubkey === chosenAuthor), { operation: "author-facet" })',
      'const balanced = research.limitPer(positive, item => item.record.event.pubkey, 1)',
      'const negative = research.exclude(all, item => item.record.event.pubkey === chosenAuthor)',
      'const coverage = research.memory.getAcquisitionCoverage(coverageRecord.id)',
      'const acquisition = { requested: coverage.requested, budget: coverage.budget, startedAt: coverage.startedAt, finishedAt: coverage.finishedAt, completionReason: coverage.completionReason, relays: coverage.relays, acquiredObservations: coverage.observedEvents.map(item => ({ eventId: item.eventId, observations: [] })), counts: { observations: coverage.observedEvents.length, invalid: 1, duplicate: 1, newlyStored: 3, received: 5 }, coverage }',
      'const set = research.memory.getSet(setRecord.id)',
      'const run = research.memory.getRun(runRecord.id)',
      'const values = [acquisition, coverage, all, all.items[0], all.items[0].record, all.items[0].subject, { type: "account", id: all.items[0].record.event.pubkey }, set, run, research.memory.describe(), research.session.describe()]',
      'const shown = values.map(value => research.show(value, { previewLimit: 2, excerptLimit: 80, includeEvidence: true, sizeLimit: 4000 }))',
      'const expansionRequests = Array.from({ length: 40 }, (_, index) => ({ filter: { ids: [`raw-filter-${index}`], limit: 100 }, completionReason: "completed", counts: { observations: 3 }, relays: [{ relay: "wss://success.example/", outcome: "eose", diagnostic: null, received: 3 }, ...(index < 6 ? [{ relay: `wss://failed-${index}-${"relay-name-".repeat(12)}.example/`, outcome: "connection-failure", diagnostic: `failure ${index}: ${"connection refused with detailed transport context ".repeat(5)}` }] : [])] }))',
      'const expanded = research.collection(all.items, { operation: "traverse", relationships: [], expansion: { options: { depth: 3, limit: 50, eventLimit: 100, timeoutMs: 2500 }, startingSubjects: all.items.slice(0, 2).map(item => item.subject), corpusBefore: { eventCount: 3, capacity: 10 }, corpusAfter: { eventCount: 9, capacity: 10 }, requestCount: 40, filterCount: 40, counts: { observations: 120, newlyStored: 6, duplicate: 113, invalid: 1 }, requests: expansionRequests, unresolvedBefore: { events: ["a", "b"], accounts: ["c"] }, unresolvedAfter: { events: [], accounts: ["c"] }, boundedBy: { depth: true, traversalLimit: false, eventBudget: true, timeout: false, cancellation: false }, completionReason: "event-budget" } })',
      'const originalExpansion = JSON.stringify(expanded.context.expansion)',
      'const shownExpansion = research.show(expanded, { previewLimit: 2, sizeLimit: 1000 })',
      'const expansionUnchanged = JSON.stringify(expanded.context.expansion) === originalExpansion',
      'research.use(research.collection([...balanced.items, ...negative.items], { operation: "positive-negative-direction" }))',
      "const retained = research.retain('oriented result')",
      "console.log('ORIENTATION:' + JSON.stringify({ types: shown.map(item => item.type), sizes: shown.map(item => Buffer.byteLength(JSON.stringify(item))), facetEvents: facets.count, authorCount: facets.authors.values[0].count, relayOneCount: facets.observedRelays.values.find(item => item.id === 'wss://one.example/').count, relayTwoCount: facets.observedRelays.values.find(item => item.id === 'wss://two.example/').count, selectedAuthor: chosenAuthor, positive: positive.items.length, negative: negative.items.length, savedId: retained.id, savedCount: retained.memberCount, canonicalLength: research.memory.getEvent(all.items[0].subject.id).event.content.length, shownLength: shown[4].evidence.event.content.length, acquisitionCounts: shown[0].context.counts, uncertainty: shown[1].context.uncertainty, shownExpansion, expansionSize: Buffer.byteLength(JSON.stringify(shownExpansion)), expansionUnchanged, originalRequestCount: expanded.context.expansion.requests.length }))",
      '.exit',
      '',
    ].join('\n');
    const result = spawnSync(process.execPath, [CONSOLE.pathname, '--capacity', '10'], {
      input: source, encoding: 'utf8', timeout: 10_000,
    });
    assert.equal(result.status, 0, result.stderr);
    const marker = result.stdout.match(/ORIENTATION:(\{.*\})/);
    assert.ok(marker, result.stdout);
    const outcome = JSON.parse(marker[1]);
    assert.deepEqual(outcome.types, [
      'acquisition', 'acquisition-coverage', 'result-collection', 'event', 'event', 'event',
      'account', 'set', 'run', 'corpus-summary', 'session-description',
    ]);
    assert.ok(outcome.sizes.every((size) => size <= 4000));
    assert.equal(outcome.facetEvents, 3);
    assert.equal(outcome.authorCount, 2);
    assert.equal(outcome.relayOneCount, 3);
    assert.equal(outcome.relayTwoCount, 1);
    assert.equal(outcome.positive, 2);
    assert.equal(outcome.negative, 1);
    assert.equal(outcome.savedCount, 2);
    assert.ok(outcome.canonicalLength > 20_000);
    assert.ok(outcome.shownLength <= 80);
    assert.equal(outcome.acquisitionCounts.distinctEvents, 1);
    assert.match(outcome.uncertainty, /not implied/);
    assert.ok(outcome.expansionSize <= 1000);
    assert.deepEqual(outcome.shownExpansion.context.expansion, {
      subjects: { starting: 2, resulting: 3 },
      requests: 40,
      filters: 40,
      counts: { observations: 120, newlyStored: 6, duplicate: 113, invalid: 1 },
      corpus: {
        before: { events: 3, capacity: 10 },
        after: { events: 9, capacity: 10 },
      },
      unresolved: {
        before: { events: 2, accounts: 1 },
        after: { events: 0, accounts: 1 },
      },
      completionReason: 'event-budget',
      bounds: {
        depth: { limit: 3, reached: true },
        traversal: { limit: 50, reached: false },
        events: { limit: 100, reached: true },
        timeoutMs: { limit: 2500, reached: false },
        cancellation: { reached: false },
      },
      failures: outcome.shownExpansion.context.expansion.failures,
    });
    assert.ok(outcome.shownExpansion.context.expansion.failures.items.length >= 1);
    assert.ok(outcome.shownExpansion.context.expansion.failures.omitted >= 1);
    assert.match(outcome.shownExpansion.context.expansion.failures.items[0].relay, /failed-0/);
    assert.match(outcome.shownExpansion.context.expansion.failures.items[0].diagnostic, /failure 0/);
    assert.equal(JSON.stringify(outcome.shownExpansion).includes('raw-filter-'), false);
    assert.equal(JSON.stringify(outcome.shownExpansion).includes('success.example'), false);
    assert.equal(outcome.expansionUnchanged, true);
    assert.equal(outcome.originalRequestCount, 40);

  } finally {
    memory?.close();
  }
});
