import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';

const CONSOLE = new URL('../bin/nostr-research-console.js', import.meta.url);
const KEYS = ['8', '9'].map(
  (value) => Uint8Array.from(Buffer.from(value.repeat(64), 'hex')),
);

test('one console process preserves JavaScript state and composes a bounded research loop', () => {
  const eventIds = [];
  const events = [];
  let unwantedAuthor;
  try {
    for (let index = 0; index < 30; index += 1) {
      const event = finalizeEvent({
        kind: 1,
        created_at: 1_700_000_000 + index,
        tags: index === 0 ? [] : [['e', eventIds[index - 1], '', 'reply']],
        content: `console evidence ${index}`,
      }, KEYS[index % KEYS.length]);
      if (index === 0) unwantedAuthor = event.pubkey;
      eventIds.push(event.id);
      events.push(event);
    }
    const metadata = finalizeEvent({
      kind: 0,
      created_at: 1_700_000_100,
      tags: [],
      content: JSON.stringify({ name: 'unwanted profile' }),
    }, KEYS[0]);
    events.push(metadata);

    const source = [
      `const fixtures = ${JSON.stringify(events)}`,
      "for (const event of fixtures) research.memory.ingest(event, { relay: 'wss://console-fixture.example/', observedAt: '2026-07-25T00:00:00.000Z' })",
      "const loaded = research.events({ order: 'oldest', limit: 30 })",
      "await Promise.resolve('AWAIT_OK')",
      "const found = research.events({ text: ['console evidence'], limit: 30 })",
      "const manual = research.collection(found.items.slice(0, 8), { operation: 'manual-selection', label: 'field trial' })",
      "let fabricatedRejected = false; try { research.collection([{ ...manual.items[0], record: "
        + "{ ...manual.items[0].record, event: { ...manual.items[0].record.event, content: 'invented' } } }]) "
        + "} catch (error) { fabricatedRejected = /exactly match/.test(error.message) }",
      "let fabricatedProvenanceRejected = false; try { research.collection([{ ...manual.items[0], record: "
        + "{ ...manual.items[0].record, observations: [{ ...manual.items[0].record.observations[0], "
        + "relay: 'wss://fabricated.example/' }] } }]) "
        + "} catch (error) { fabricatedProvenanceRejected = /exactly match/.test(error.message) }",
      "const account = research.accounts({ text: ['unwanted profile'] }).items[0]",
      "let fabricatedProfileRejected = false; try { research.collection([{ ...account, record: "
        + "{ ...account.record, profile: { ...account.record.profile, name: 'fabricated profile' } } }]) "
        + "} catch (error) { fabricatedProfileRejected = /exactly match/.test(error.message) }",
      "let invalidRejected = 0; for (const operation of [() => research.exclude(manual, true), "
        + "() => research.distinctBy(manual, null), () => research.limitPer(manual, item => item, -1), "
        + "() => research.traverse(manual), () => research.follows()]) "
        + "{ try { operation() } catch (error) { invalidRejected += 1 } }",
      'const beforeQueries = JSON.stringify(research.activeSelection)',
      'const limited = research.limitPer(manual, item => item.record.event.pubkey, 3)',
      `const unwanted = '${unwantedAuthor}'`,
      'const excluded = research.exclude(limited, item => item.record.event.pubkey === unwanted)',
      'const distinct = research.distinctBy(excluded, item => item.subject.id)',
      `const inspected = research.inspect({ type: 'event', id: '${eventIds[0]}' })`,
      `const walked = research.traverse(distinct, `
        + "{ relationshipTypes: ['reply-parent'], direction: 'outbound', depth: 1, limit: 10 })",
      'const discoveries = research.discoveries(walked)',
      'const queriesUnchanged = beforeQueries === JSON.stringify(research.activeSelection)',
      'research.activate(distinct)',
      'const beforeTraversal = JSON.stringify(research.activeSelection)',
      "const walkedActive = research.traverse(research.activeSelection, "
        + "{ relationshipTypes: ['reply-parent'], direction: 'outbound', depth: 1, limit: 10 })",
      'const traversalUnchanged = beforeTraversal === JSON.stringify(research.activeSelection)',
      'research.activate(research.discoveries(walkedActive))',
      "const saved = research.retain(discoveries, 'console retained')",
      "const checkpoint = research.checkpoint('active checkpoint')",
      'const retained = research.memory.getSet(saved.id)',
      'const compact = research.show(walked)',
      'const detailed = research.show(walked, { includeEvidence: true })',
      'found',
      "console.log('SCENARIO:' + JSON.stringify({ processLocalCount: loaded.items.length, inspected: inspected.subject.id, "
        + 'manual: manual.items.length, limited: limited.items.length, excluded: excluded.items.length, '
        + 'distinct: distinct.items.length, walked: walked.items.length, discoveries: discoveries.items.length, '
        + 'queriesUnchanged, traversalUnchanged, '
        + 'selectedDiscoveries: research.activeSelection.items.length, saved: saved.memberCount, '
        + 'checkpoint: checkpoint.memberCount, compactReasons: compact.preview[0].reasons === undefined, '
        + 'detailedReasons: detailed.preview[0].evidence.reasons.length, '
        + 'fabricatedRejected, fabricatedProvenanceRejected, fabricatedProfileRejected, invalidRejected, '
        + 'reason: retained.members[0].reasons[0].type, '
        + 'provenance: retained.members[0].reasons[0].provenance.length }))',
      '.exit',
      '',
    ].join('\n');
    const result = spawnSync(process.execPath, [CONSOLE.pathname, '--capacity', '50'], {
      input: source,
      encoding: 'utf8',
      timeout: 10_000,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /type: 'result-collection'/);
    assert.match(result.stdout, /count: 30/);
    assert.match(result.stdout, /omitted: 25/);
    assert.match(result.stdout, /AWAIT_OK/);
    assert.doesNotMatch(result.stdout, /console evidence 0/);
    const marker = result.stdout.match(/SCENARIO:(\{.*\})/);
    assert.ok(marker, result.stdout);
    assert.deepEqual(JSON.parse(marker[1]), {
      processLocalCount: 30,
      inspected: eventIds[0],
      manual: 8,
      limited: 6,
      excluded: 3,
      distinct: 3,
      walked: 6,
      discoveries: 3,
      queriesUnchanged: true,
      traversalUnchanged: true,
      selectedDiscoveries: 3,
      saved: 3,
      checkpoint: 3,
      compactReasons: true,
      detailedReasons: 1,
      fabricatedRejected: true,
      fabricatedProvenanceRejected: true,
      fabricatedProfileRejected: true,
      invalidRejected: 5,
      reason: 'relationship',
      provenance: 1,
    });

    const fresh = spawnSync(process.execPath, [CONSOLE.pathname, '--capacity', '50'], {
      input: "console.log('FRESH:' + JSON.stringify(research.summary().corpus))\n.exit\n",
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.equal(fresh.status, 0, fresh.stderr);
    assert.match(fresh.stdout, /FRESH:\{"capacity":50,"eventCount":0,/);

  } finally {
    // The subprocess owns and closes its process-local corpus.
  }
});
