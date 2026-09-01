import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acquireRelayEvents,
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
  executeResearchPlan,
  hydrateAccounts,
} from '@nostr-research/memory';
import { loadFixtureEvents } from '../test-support/fixtures.js';

test('factual schemas construct commands accepted through the public session seam', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  const session = createDeclarativeResearchSession(memory, {
    relays: ['wss://fixture.example'],
    acquisition: { timeoutMs: 1234, concurrency: 2 },
  });
  const events = loadFixtureEvents().slice(0, 2);
  for (const event of events) {
    memory.ingest(event, {
      relay: 'wss://fixture.example/',
      observedAt: '2026-07-27T10:00:00.000Z',
    });
  }

  const global = await session.execute({
    commandId: 'global-schema', command: 'schema', parameters: { detail: 'full' },
  });
  const contracts = global.result.research.parameterContracts;
  assert.equal(global.result.constraints.memory.observationsPerEvent.maximum, 100);
  assert.equal(contracts.acquire.timeoutMs.maximum, 60000);
  assert.equal(contracts.acquire.concurrency.maximum, 10);
  assert.equal(contracts.hydrate.timeoutMs.maximum, 60000);
  assert.equal(contracts.fetch.concurrency.maximum, 10);
  assert.equal(contracts.continue.timeoutMs.maximum, 60000);
  assert.equal(contracts.continue.concurrency.maximum, 10);
  assert.equal(global.result.constraints.plan.stages.maximum, 100);
  assert.equal(global.result.research.plan.stageCount.maximum, 100);
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
  for (const removed of ['remember', 'forget', 'notebook', 'remember-membership']) {
    assert.equal(removed in contracts, false);
  }
  assert.equal(global.result.session.commands.plan.required.command, '"plan"');
  assert.match(global.result.session.commands.plan.failureSemantics, /cannot be undone/);
  assert.equal('research' in global.result.session, false);

  for (const parameters of [{ timeoutMs: 60001 }, { concurrency: 11 }]) {
    await assert.rejects(
      acquireRelayEvents(memory, {
        relays: ['wss://fixture.invalid/'], filter: {}, ...parameters,
      }),
      /must be an integer from/,
    );
    await assert.rejects(
      hydrateAccounts(memory, memory.collection([{
        subject: { type: 'account', id: events[0].pubkey },
      }], {}, 'accounts'), {
        relays: ['wss://fixture.invalid/'], ...parameters,
      }),
      /must be an integer from/,
    );
  }
  await assert.rejects(
    executeResearchPlan(memory, Array.from({ length: 101 }, (_, index) => ({
      id: `stage-${index}`,
      operation: 'select',
      parameters: { scope: 'corpus' },
    }))),
    /at most 100 stages/,
  );
  assert.equal(
    global.result.session.commands.observation.inspect.parameters.subject,
    'subject object or bare/NIP-21 nostr: npub, nprofile, note, nevent, or naddr reference; encoded author, kind, and relay hints are unverified and never followed automatically',
  );
  const summary = await session.execute({
    commandId: 'summary-schema', command: 'schema',
  });
  assert.equal(summary.result.detail, 'summary');
  assert.equal('parameterContracts' in summary.result.research, false);
  assert.match(summary.result.research.contractAccess, /detail "full"/);

  for (const operation of ['acquire', 'relay-info', 'relay-count']) {
    const focused = await session.execute({
      commandId: `schema-${operation}`,
      command: 'schema',
      parameters: { operation },
    });
    assert.equal(focused.ok, true);
    assert.equal(focused.result.type, 'input-free-operation-schema');
    assert.equal(focused.result.operation.name, operation);
    assert.equal(focused.result.operation.input, 'forbidden');
    assert.equal(focused.result.operation.locality, 'external');
    assert.equal(focused.result.operation.effectiveDefaults.relays[0],
      'wss://fixture.example/');
    assert.equal(focused.result.operation.effectiveDefaults.timeoutMs, 1234);
    assert.equal(focused.result.operation.effectiveDefaults.concurrency, 2);
    assert.ok(focused.result.operation.parameters);
    assert.ok(focused.result.operation.resultFacts);
  }

  const inputRequiredSchema = await session.execute({
    commandId: 'schema-scan-without-input',
    command: 'schema',
    parameters: { operation: 'scan' },
  });
  assert.equal(inputRequiredSchema.ok, false);
  assert.equal(inputRequiredSchema.error.code, 'INVALID_OPERATION');
  assert.equal(inputRequiredSchema.error.details.inputRequired, true);

  const selected = await session.execute({
    commandId: 'select', command: 'select',
    parameters: { scope: 'corpus', limit: contracts.select.limit.default },
    resultId: 'events',
  });
  assert.equal(selected.ok, true);

  const bounded = await session.execute({
    commandId: 'bounded-limit', command: 'limit', input: 'events',
    parameters: { limit: 1 }, resultId: 'bounded',
  });
  assert.deepEqual(bounded.result.bounds, {
    inputCount: 2, outputCount: 1, omittedCount: 1, truncated: true,
  });

  const collectionFilterSchema = await session.execute({
    commandId: 'collection-filter-schema', command: 'schema', input: 'events',
    parameters: { operation: 'filter' },
  });
  assert.deepEqual(
    collectionFilterSchema.result.operation.parameters.where,
    contracts.filter.where.variants.collection,
  );
  assert.equal('variants' in collectionFilterSchema.result.operation.parameters.where, false);

  const removedNotebookCommand = await session.execute({
    commandId: 'removed-notebook-command', command: 'notebook', parameters: {},
  });
  assert.equal(removedNotebookCommand.ok, false);
  assert.equal(removedNotebookCommand.error.code, 'INVALID_COMMAND');
  assert.throws(
    () => createInMemoryResearchMemory({ notebookCapacity: 10 }),
    /Unknown in-memory research memory option field: notebookCapacity/u,
  );

  const related = await session.execute({
    commandId: 'relate', command: 'relate', input: 'events', resultId: 'rows',
  });
  assert.equal(related.ok, true);
  const relationFilterSchema = await session.execute({
    commandId: 'relation-filter-schema', command: 'schema', input: 'rows',
    parameters: { operation: 'filter' },
  });
  assert.deepEqual(
    relationFilterSchema.result.operation.parameters.where,
    contracts.filter.where.variants.relation,
  );
  const renamed = await session.execute({
    commandId: 'renamed-author', command: 'project', input: 'rows',
    parameters: { fields: [{ field: 'event.author', name: 'candidate' }] },
    resultId: 'renamed-author',
  });
  assert.equal(renamed.ok, true);
  const contradictory = await session.execute({
    commandId: 'contradictory-extract', command: 'extract', input: 'renamed-author',
    parameters: { field: 'candidate', subjectType: 'event' },
  });
  assert.equal(contradictory.ok, false);
  assert.equal(contradictory.error.code, 'TYPE_MISMATCH');
  const generic = await session.execute({
    commandId: 'generic-id', command: 'derive', input: 'rows',
    parameters: {
      fields: [{ name: 'generic', expression: { constant: events[0].id } }],
    },
    resultId: 'generic-id',
  });
  assert.equal(generic.ok, true);
  const genericExtract = await session.execute({
    commandId: 'generic-extract', command: 'extract', input: 'generic-id',
    parameters: { field: 'generic', subjectType: 'event' },
  });
  assert.equal(genericExtract.ok, true);

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

  const authorCounts = await session.execute({
    commandId: 'author-counts', command: 'aggregate', input: 'rows',
    parameters: {
      by: [{ field: 'event.author', name: 'author' }],
      aggregations: [{ name: 'count', operation: 'count' }],
    },
    resultId: 'author-counts',
  });
  assert.equal(authorCounts.ok, true);
  const authorSchema = await session.execute({
    commandId: 'author-schema', command: 'schema', input: 'author-counts',
  });
  assert.equal(
    authorSchema.result.observations.show.parameters.offset,
    'non-negative integer',
  );
  assert.equal('explain' in authorSchema.result.observations, false);
  assert.match(authorSchema.result.handleSemantics.membership, /positions remain fixed/u);
  assert.deepEqual(
    authorSchema.result.structure.fields.find(({ name }) => name === 'author').lineage,
    ['event.author'],
  );
  const extractSchema = await session.execute({
    commandId: 'author-extract-schema', command: 'schema', input: 'author-counts',
    parameters: { operation: 'extract' },
  });
  assert.deepEqual(extractSchema.result.operation.recognizedTransitions, [{
    field: 'author', subjectType: 'account', lineage: ['event.author'],
  }]);
  assert.deepEqual(extractSchema.result.operation.parameters.subjectType, {
    type: 'string',
    values: ['account', 'event', 'address'],
    required: true,
  });
  const authors = await session.execute({
    commandId: 'authors', command: 'extract', input: 'author-counts',
    parameters: { field: 'author', subjectType: 'account' },
    resultId: 'authors',
  });
  assert.equal(authors.ok, true);
  const authorsSchema = await session.execute({
    commandId: 'authors-schema', command: 'schema', input: 'authors',
  });
  assert.equal(
    authorsSchema.result.observations.explain.parameters.subject.startsWith('subject object'),
    true,
  );

  const derivedAuthors = await session.execute({
    commandId: 'derived-authors', command: 'derive', input: 'author-counts',
    parameters: {
      fields: [
        { name: 'authorAlias', expression: { field: 'author' } },
        { name: 'authorConstant', expression: { constant: events[0].pubkey } },
        {
          name: 'authorComputed',
          expression: {
            operation: 'coalesce',
            args: [{ field: 'author' }, { constant: events[0].pubkey }],
          },
        },
      ],
    },
    resultId: 'derived-authors',
  });
  assert.equal(derivedAuthors.ok, true);
  const nullDivision = await session.execute({
    commandId: 'null-division', command: 'derive', input: 'author-counts',
    parameters: {
      fields: [{
        name: 'ratio',
        expression: {
          operation: 'divide',
          args: [
            { constant: 12 },
            { constant: 0 },
            { constant: 3 },
          ],
        },
      }],
    },
    resultId: 'null-division',
  });
  assert.equal(nullDivision.ok, true);
  const shownNullDivision = await session.execute({
    commandId: 'show-null-division', command: 'show', input: 'null-division',
    parameters: { mode: 'preview', previewLimit: 10 },
  });
  assert.equal(shownNullDivision.result.preview[0].values.ratio, null);
  const derivedAuthorStructure = await session.execute({
    commandId: 'derived-author-schema', command: 'schema', input: 'derived-authors',
  });
  const derivedFields = derivedAuthorStructure.result.structure.fields;
  const derivedAuthorSchema = await session.execute({
    commandId: 'derived-author-extract-schema', command: 'schema', input: 'derived-authors',
    parameters: { operation: 'extract' },
  });
  const authorAlias = derivedFields.find(({ name }) => name === 'authorAlias');
  assert.deepEqual(authorAlias.lineage, ['event.author', 'author']);
  assert.equal(authorAlias.subjectType, 'account');
  for (const fieldName of ['authorConstant', 'authorComputed']) {
    const fieldDefinition = derivedFields.find(({ name }) => name === fieldName);
    assert.equal('lineage' in fieldDefinition, false);
    assert.equal('subjectType' in fieldDefinition, false);
  }
  const derivedTransitions = derivedAuthorSchema.result.operation.recognizedTransitions;
  assert.deepEqual(
    derivedTransitions.find(({ field }) => field === 'authorAlias'),
    {
      field: 'authorAlias',
      subjectType: 'account',
      lineage: ['event.author', 'author'],
    },
  );
  assert.equal(
    derivedTransitions.some(({ field }) => ['authorConstant', 'authorComputed'].includes(field)),
    false,
  );
  const aliasedAuthors = await session.execute({
    commandId: 'aliased-authors', command: 'extract', input: 'derived-authors',
    parameters: { field: 'authorAlias', subjectType: 'account' },
    resultId: 'aliased-authors',
  });
  assert.equal(aliasedAuthors.ok, true);
  assert.equal(aliasedAuthors.result.handle.count, authors.result.handle.count);

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
