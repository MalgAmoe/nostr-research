import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { loadFixtureEvents } from '../test-support/fixtures.js';

test('factual schemas construct commands accepted through the public session seam', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  const session = createDeclarativeResearchSession(memory);
  const events = loadFixtureEvents().slice(0, 2);
  for (const event of events) {
    memory.ingest(event, {
      relay: 'wss://fixture.example/',
      observedAt: '2026-07-27T10:00:00.000Z',
    });
  }

  const global = await session.execute({
    commandId: 'global-schema', command: 'schema',
  });
  const contracts = global.result.research.parameterContracts;
  assert.deepEqual(contracts.filter.limit, {
    type: 'integer', minimum: 1, maximum: 1000, default: 100,
  });
  assert.deepEqual(contracts.move.limit, contracts.filter.limit);
  assert.equal('resultShape' in contracts.scan, false);
  assert.equal(
    global.result.research.operationFacts.scan.resultShape,
    'one relation row per matching field and term',
  );
  assert.equal('limit' in contracts.compare, false);
  assert.equal(contracts.project.limit.default, 100);
  assert.ok(contracts.aggregate.aggregations.item.operation.includes('sum'));
  assert.ok(
    contracts.derive.fields.item.expression.variants[2].operation.includes('coalesce'),
  );
  assert.deepEqual(contracts.fetch.bindings.keys, ['ids', 'authors', '#e', '#p', '#t']);
  assert.equal(contracts.continue.depth.default, 3);
  assert.equal(contracts.remember.reason.startsWith('required'), true);
  assert.equal(global.result.session.commands.plan.required.command, '"plan"');
  assert.equal('research' in global.result.session, false);
  assert.equal(
    global.result.session.commands.observation.inspect.parameters.subject,
    'event, account, or tag subject',
  );

  const selected = await session.execute({
    commandId: 'select', command: 'select',
    parameters: { scope: 'corpus', limit: contracts.select.limit.default },
    resultId: 'events',
  });
  assert.equal(selected.ok, true);
  const related = await session.execute({
    commandId: 'relate', command: 'relate', input: 'events', resultId: 'rows',
  });
  assert.equal(related.ok, true);

  const scanSchema = await session.execute({
    commandId: 'scan-schema', command: 'schema', input: 'rows',
    parameters: { operation: 'scan' },
  });
  assert.equal(scanSchema.result.operation.resultShape,
    global.result.research.operationFacts.scan.resultShape);
  const scanField = scanSchema.result.operation.populatedFields
    .find(({ types }) => types.includes('string'))?.name;
  assert.ok(scanField);
  const scanned = await session.execute({
    commandId: 'scan', command: 'scan', input: 'rows',
    parameters: {
      fields: [scanField],
      terms: ['a'],
      match: contracts.scan.match.default,
      matchMode: contracts.scan.matchMode.default,
      caseSensitive: contracts.scan.caseSensitive.default,
      limit: 10,
    },
    resultId: 'matches',
  });
  assert.equal(scanned.ok, true);

  const projected = await session.execute({
    commandId: 'project', command: 'project', input: 'rows',
    parameters: {
      fields: [{ field: 'event.kind', name: 'kind' }],
      limit: contracts.project.limit.default,
    },
    resultId: 'projected',
  });
  assert.equal(projected.ok, true);
  const aggregated = await session.execute({
    commandId: 'aggregate', command: 'aggregate', input: 'projected',
    parameters: {
      by: [],
      aggregations: [{ name: 'count', operation: 'count' }],
      limit: contracts.aggregate.limit.default,
    },
    resultId: 'counted',
  });
  assert.equal(aggregated.ok, true);

  const invalidCompare = await session.execute({
    commandId: 'invalid-compare', command: 'compare', input: 'events',
    parameters: { with: 'events', limit: 1 }, resultId: 'invalid',
  });
  assert.equal(invalidCompare.ok, false);
  assert.equal(invalidCompare.error.code, 'INVALID_OPERATION');

  const tag = await session.execute({
    commandId: 'inspect-tag', command: 'inspect',
    parameters: { subject: { type: 'tag', id: 'nostr' } },
  });
  assert.equal(tag.ok, true);
});
