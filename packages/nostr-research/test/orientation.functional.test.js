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
    const annotatedSubject = selected.items[0].subject;
    const annotation = environment.research.annotate(annotatedSubject, {
      labels: ['keep', 'privacy'],
      note: 'Useful evidence',
    });

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
    const shownFacets = environment.research.show(facets, { previewLimit: 1 });
    const shownSet = environment.research.show(memory.getSet(retained.id));
    const shownCorpus = environment.research.show(memory.describe());
    const comparison = environment.research.show(environment.research.compare(
      selected,
      memory.collection([selected.items[1]], { operation: 'comparison-seed' }),
    ), { previewLimit: 1 });
    const accounts = memory.transform(selected, {
      operation: 'move', to: 'authors', limit: 10,
    });
    const shownAccounts = environment.research.show(accounts, { previewLimit: 1 });
    const reasonOnlyConversation = memory.collection([{
      subject: selected.items[1].subject,
      reasons: [{
        type: 'relationship',
        relationshipType: 'reply-root',
        sourceEventId: selected.items[1].subject.id,
        targetId: selected.items[0].subject.id,
      }],
    }], { operation: 'continuation', relationship: 'conversation' });
    const shownConversation = environment.research.show(reasonOnlyConversation);
    const projected = environment.research.project(selected, { mode: 'ids' });
    const projectedWithAnnotation = environment.research.project(selected, { mode: 'compact' });
    assert.equal(shownCollection.type, 'result-collection');
    assert.equal(shownCollection.count, 2);
    assert.equal(shownCollection.orientation.population.subjects, 2);
    assert.equal(shownCollection.orientation.sampling.method, 'collection order (oldest)');
    assert.equal(shownCollection.orientation.truncation.omittedSubjects, 1);
    assert.equal(shownCollection.orientation.freshness.observationCount, 3);
    assert.equal(shownCollection.orientation.corpus.retainedMemberships, 2);
    assert.equal(shownCollection.orientation.facets.linkedSourceDomains.omitted, 1);
    assert.equal(
      shownCollection.orientation.facets.linkedSourceDomains.tail[0].domain,
      'example.org',
    );
    assert.ok(shownCollection.preview[0].evidence.event.content.length <= 40);
    assert.equal(shownFacets.type, 'facets');
    assert.equal(shownFacets.authors.values.length, 1);
    assert.equal(shownFacets.tags.values.length, 1);
    assert.equal(shownFacets.tags.omitted, 0);
    assert.equal(shownFacets.presence.values.length, 1);
    assert.equal(shownFacets.presence.omitted, 2);
    assert.equal(shownSet.type, 'set');
    assert.equal(shownSet.count, 2);
    assert.equal(shownCorpus.type, 'corpus-summary');
    assert.equal(comparison.type, 'result-comparison');
    assert.deepEqual(comparison.population, {
      left: 2, right: 1, shared: 1, onlyLeft: 1, onlyRight: 0,
    });
    assert.equal(comparison.truncation.truncated, false);
    assert.equal(shownAccounts.orientation.population.residentEvidence, 0);
    assert.equal(shownAccounts.orientation.population.subjectsWithMembershipEvidence, 1);
    assert.ok(shownAccounts.orientation.membershipEvidence.reasonCount > 0);
    assert.ok(shownAccounts.orientation.membershipEvidence.provenanceCount > 0);
    assert.equal(shownAccounts.orientation.freshness.observationCount, 3);
    assert.equal(shownConversation.orientation.conversation.relationshipCount, 1);
    assert.deepEqual(
      shownConversation.orientation.conversation.types.values,
      [{ id: 'reply-root', count: 1 }],
    );
    assert.deepEqual(
      projected,
      selected.items.map(({ subject: item }) => ({ type: item.type, id: item.id })),
    );
    assert.deepEqual(annotation.labels, ['keep', 'privacy']);
    assert.deepEqual(
      environment.research.annotated({ labels: ['keep'] })
        .items.map(({ subject: item }) => item),
      [annotatedSubject],
    );
    assert.equal(
      projectedWithAnnotation.results.find(({ id }) => id === annotatedSubject.id)
        .annotation.note,
      'Useful evidence',
    );
    assert.equal(environment.research.removeAnnotation(annotatedSubject).removed, true);
    assert.equal(environment.research.annotated().items.length, 0);
  } finally {
    environment.close();
  }
});
