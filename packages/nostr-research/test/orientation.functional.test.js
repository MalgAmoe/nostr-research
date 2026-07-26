import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import { createInMemoryResearchMemory } from '@nostr-research/memory';
import { createResearchEnvironment } from '../src/console.js';

const SECRET = Uint8Array.from(Buffer.from('a'.repeat(64), 'hex'));

test('presentation and facets orient surviving research values', () => {
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  const environment = createResearchEnvironment(memory);
  try {
    const events = [
      finalizeEvent({
        kind: 1, created_at: 10, tags: [['t', 'research']],
        content: `long evidence ${'detail '.repeat(100)}https://example.org/image.png`,
      }, SECRET),
      finalizeEvent({
        kind: 1, created_at: 11, tags: [['t', 'research']],
        content: 'second note https://example.net/page',
      }, SECRET),
    ];
    for (const event of events) {
      memory.ingest(event, {
        relay: 'wss://one.example/', observedAt: '2026-07-25T10:00:00.000Z',
      });
    }
    memory.ingest(events[0], {
      relay: 'wss://two.example/', observedAt: '2026-07-25T10:01:00.000Z',
    });

    const selected = environment.research.events({ kinds: [1], order: 'oldest' });
    const facets = environment.research.facets(selected);
    const retained = memory.retain(selected, 'orientation seed');

    assert.equal(facets.count, 2);
    assert.equal(facets.authors.values[0].count, 2);
    assert.equal(
      facets.observedRelays.values.find(({ id }) => id === 'wss://two.example/').count,
      1,
    );
    assert.equal(facets.presence.values.find(({ id }) => id === 'images').count, 1);

    const shownCollection = environment.research.show(selected, {
      previewLimit: 1, excerptLimit: 40, includeEvidence: true,
    });
    const shownSet = environment.research.show(memory.getSet(retained.id));
    const shownCorpus = environment.research.show(memory.describe());
    assert.equal(shownCollection.type, 'result-collection');
    assert.equal(shownCollection.count, 2);
    assert.ok(shownCollection.preview[0].evidence.event.content.length <= 40);
    assert.equal(shownSet.type, 'set');
    assert.equal(shownSet.count, 2);
    assert.equal(shownCorpus.type, 'corpus-summary');
  } finally {
    environment.close();
  }
});
