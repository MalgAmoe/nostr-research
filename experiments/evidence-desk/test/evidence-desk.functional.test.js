import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { createNavigatorController } from '@nostrarium/controller';
import {
  arrangeActions,
  arrangeEvidence,
  compareEvidenceFrames,
  composeAction,
  composeCardFocus,
  formatEvidence,
} from '@nostrarium/evidence-desk';

function signed(secretByte, event) {
  return finalizeEvent(event, Uint8Array.from({ length: 32 }, () => secretByte));
}

class MixedRelayWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = MixedRelayWebSocket.CONNECTING;
    this.listeners = new Map();
    queueMicrotask(() => {
      if (url.includes('failing')) {
        this.readyState = MixedRelayWebSocket.CLOSED;
        this.emit('close', { code: 1006 });
      } else {
        this.readyState = MixedRelayWebSocket.OPEN;
        this.emit('open', {});
      }
    });
  }

  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }

  send(serialized) {
    const packet = JSON.parse(serialized);
    if (packet[0] === 'REQ') {
      queueMicrotask(() => this.emit('message', {
        data: JSON.stringify(['EOSE', packet[1]]),
      }));
    }
  }

  close() {
    this.readyState = MixedRelayWebSocket.CLOSED;
  }

  emit(name, event) {
    for (const listener of this.listeners.get(name) ?? []) listener(event);
  }
}

async function fixtureDesk() {
  const aliceProfile = signed(11, {
    kind: 0, created_at: 1, tags: [],
    content: JSON.stringify({
      name: 'alice', display_name: 'Alice Example', nip05: 'alice@example.test',
      about: 'Protocol builder and researcher.',
    }),
  });
  const bobProfile = signed(12, {
    kind: 0, created_at: 1, tags: [],
    content: JSON.stringify({ name: 'bob', about: 'Independent reviewer.' }),
  });
  const root = signed(11, {
    kind: 1, created_at: 2, tags: [['t', 'cryptography']],
    content: 'A bounded technical note about signatures.',
  });
  const second = signed(11, {
    kind: 1, created_at: 3, tags: [],
    content: 'A second implementation note.',
  });
  const reply = signed(12, {
    kind: 1, created_at: 4,
    tags: [['e', root.id, '', 'root'], ['e', root.id, '', 'reply']],
    content: 'A contextual review reply.',
  });
  const memory = createInMemoryResearchMemory({ capacity: 20 });
  for (const event of [aliceProfile, bobProfile, root, second, reply]) {
    memory.ingest(event, { relay: 'wss://fixture.invalid/' });
  }
  const session = createDeclarativeResearchSession(memory);
  let requests = 0;
  const controller = createNavigatorController({
    request: async (command) => {
      requests += 1;
      return session.execute(command);
    },
    transcript: { maxEntries: 100, maxBytes: 1_000_000 },
  });
  return { controller, root, requests: () => requests };
}

test('real note observations become evidence cards without another command', async () => {
  const { controller, root, requests } = await fixtureDesk();
  await controller.execute({
    command: 'select', parameters: { scope: 'corpus', kinds: [1] }, resultId: 'notes',
  });
  const showCommand = {
    command: 'show', input: 'notes',
    parameters: { mode: 'preview', previewLimit: 10, excerptLimit: 300 },
  };
  const showOutcome = await controller.execute(showCommand);
  const beforeArrange = requests();
  const desk = arrangeEvidence({ command: showCommand, outcome: showOutcome });

  assert.equal(requests(), beforeArrange);
  assert.equal(desk.source.handle, 'notes');
  assert.equal(desk.source.observation, 'preview');
  assert.equal(desk.frame.total, 3);
  assert.equal(desk.frame.visible, 3);
  assert.equal(desk.cards.every(({ object }) => object === 'note'), true);
  const rootCard = desk.cards.find(({ id }) => id === root.id);
  assert.equal(rootCard.text, 'A bounded technical note about signatures.');
  assert.equal(rootCard.author.claims.name, 'alice');
  assert.equal(rootCard.evidence.resolutionSource, 'buffer');
  assert.deepEqual(rootCard.evidence.relays, ['wss://fixture.invalid/']);
  assert.equal(rootCard.inclusion.reasons, 1);
  const rendered = formatEvidence(desk);
  assert.match(rendered, /3\/3 notes visible · preview/u);
  assert.match(rendered, /note · Alice Example/u);
  assert.match(rendered, /text: A bounded technical note about signatures\./u);
  assert.match(rendered, /evidence · buffer · 1 relay · 1 reason/u);
  assert.match(rendered, /source handle: notes/u);

  const focus = composeCardFocus(desk, rootCard.cardId, { resultId: 'focused-note' });
  assert.deepEqual(focus.commands, [{
    command: 'pick', input: 'notes',
    parameters: { positions: [rootCard.position] }, resultId: 'focused-note',
  }]);
  assert.equal(requests(), beforeArrange);
  const focused = await controller.execute(focus.commands[0]);
  assert.equal(focused.receipt.handle.count, 1);
  const focusedShowCommand = {
    command: 'show', input: 'focused-note', parameters: { mode: 'preview', previewLimit: 1 },
  };
  const focusedShow = await controller.execute(focusedShowCommand);
  const focusedDesk = arrangeEvidence({ command: focusedShowCommand, outcome: focusedShow });
  assert.equal(focusedDesk.cards[0].id, root.id);
  assert.deepEqual(
    controller.transcript().entries.map(({ command }) => command.command),
    ['select', 'show', 'pick', 'show'],
  );
  await controller.close();
});

test('paged card positions focus the exact stable collection member', async () => {
  const { controller } = await fixtureDesk();
  await controller.execute({
    command: 'select', parameters: { scope: 'corpus', kinds: [1] }, resultId: 'notes',
  });
  const pageCommand = {
    command: 'show', input: 'notes',
    parameters: { mode: 'preview', offset: 1, previewLimit: 1 },
  };
  const pageOutcome = await controller.execute(pageCommand);
  const page = arrangeEvidence({ command: pageCommand, outcome: pageOutcome });
  assert.equal(page.cards.length, 1);
  assert.equal(page.cards[0].position, 2);
  assert.equal(page.frame.omittedBefore, 1);
  assert.equal(page.frame.omittedAfter, 1);

  const focus = composeCardFocus(page, page.cards[0].cardId, { resultId: 'page-focus' });
  assert.deepEqual(focus.commands[0].parameters, { positions: [2] });
  await controller.execute(focus.commands[0]);
  const shownCommand = {
    command: 'show', input: 'page-focus', parameters: { mode: 'preview', previewLimit: 1 },
  };
  const shown = await controller.execute(shownCommand);
  const focused = arrangeEvidence({ command: shownCommand, outcome: shown });
  assert.equal(focused.cards[0].id, page.cards[0].id);
  await controller.close();
});

test('account collections and metadata events are both presented as accounts without conflation', async () => {
  const { controller, requests } = await fixtureDesk();
  await controller.execute({
    command: 'select', parameters: { scope: 'corpus', kinds: [1] }, resultId: 'notes',
  });
  await controller.execute({
    command: 'move', input: 'notes', parameters: { to: 'authors' }, resultId: 'authors',
  });
  const accountsCommand = {
    command: 'show', input: 'authors', parameters: { mode: 'preview', previewLimit: 10 },
  };
  const accountsOutcome = await controller.execute(accountsCommand);
  const accounts = arrangeEvidence({ command: accountsCommand, outcome: accountsOutcome });
  assert.equal(accounts.cards.length, 2);
  assert.equal(accounts.cards.every(({ object }) => object === 'account'), true);
  assert.equal(accounts.cards.every(({ sourceSubject }) => sourceSubject.type === 'account'), true);
  assert.equal(accounts.cards.find(({ claims }) => claims.name === 'alice').claims.displayName,
    'Alice Example');
  assert.match(formatEvidence(accounts), /account · Alice Example/u);
  assert.match(formatEvidence(accounts), /nip05 claim: alice@example\.test/u);

  await controller.execute({
    command: 'continue', input: 'authors',
    parameters: { relationship: 'authored-notes', source: 'local', eventLimit: 10 },
    resultId: 'authored',
  });
  const authoredCommand = {
    command: 'show', input: 'authored', parameters: { mode: 'preview', previewLimit: 10 },
  };
  const authoredOutcome = await controller.execute(authoredCommand);
  const authored = arrangeEvidence({ command: authoredCommand, outcome: authoredOutcome });
  assert.equal(authored.context.origin.relationship, 'authored-notes');
  assert.equal(authored.context.origin.source, 'local');
  assert.equal(authored.context.origin.completeness.attemptStatus, 'complete');
  assert.match(
    formatEvidence(authored),
    /origin · continuation · authored-notes · local · complete · resident-corpus · exhaustive true/u,
  );
  const authoredSummaryCommand = {
    command: 'show', input: 'authored', parameters: { mode: 'summary' },
  };
  const authoredSummaryOutcome = await controller.execute(authoredSummaryCommand);
  const authoredSummary = arrangeEvidence({
    command: authoredSummaryCommand, outcome: authoredSummaryOutcome,
  });
  const authoredSummaryText = formatEvidence(authoredSummary);
  assert.doesNotMatch(authoredSummaryText, /undefined/u);
  assert.match(authoredSummaryText, /bounds · 3 output · limit 10 · truncated false/u);
  assert.match(
    authoredSummaryText,
    /completeness · complete · resident-corpus · exhaustive true · 0 omitted/u,
  );

  await controller.execute({
    command: 'select', parameters: { scope: 'corpus', kinds: [0] }, resultId: 'profiles',
  });
  const profilesCommand = {
    command: 'show', input: 'profiles', parameters: { mode: 'preview', previewLimit: 10 },
  };
  const profilesOutcome = await controller.execute(profilesCommand);
  const beforeArrange = requests();
  const profiles = arrangeEvidence({ command: profilesCommand, outcome: profilesOutcome });
  assert.equal(requests(), beforeArrange);
  assert.equal(profiles.cards.length, 2);
  assert.equal(profiles.cards.every(({ object }) => object === 'account'), true);
  assert.equal(profiles.cards.every(({ sourceSubject }) => sourceSubject.type === 'event'), true);
  assert.equal(profiles.cards.every(({ evidence }) => evidence.metadataEventId), true);

  const alice = profiles.cards.find(({ claims }) => claims.name === 'alice');
  const focus = composeCardFocus(profiles, alice.cardId, {
    intermediateResultId: 'alice-profile-event', resultId: 'alice-account',
  });
  assert.deepEqual(focus.commands, [
    {
      command: 'pick', input: 'profiles', parameters: { positions: [alice.position] },
      resultId: 'alice-profile-event',
    },
    {
      command: 'move', input: 'alice-profile-event', parameters: { to: 'authors' },
      resultId: 'alice-account',
    },
  ]);
  assert.equal(requests(), beforeArrange);
  for (const command of focus.commands) await controller.execute(command);
  const aliceShowCommand = {
    command: 'show', input: 'alice-account', parameters: { mode: 'preview', previewLimit: 1 },
  };
  const aliceShow = await controller.execute(aliceShowCommand);
  const aliceDesk = arrangeEvidence({ command: aliceShowCommand, outcome: aliceShow });
  assert.equal(aliceDesk.cards.length, 1);
  assert.equal(aliceDesk.cards[0].object, 'account');
  assert.equal(aliceDesk.cards[0].id, alice.id);
  await controller.close();
});

test('summary, details, explain, and coverage retain mode-specific evidence panels', async () => {
  const { controller } = await fixtureDesk();
  await controller.execute({
    command: 'select', parameters: { scope: 'corpus', kinds: [1] }, resultId: 'notes',
  });
  await controller.execute({
    command: 'preserve', input: 'notes',
    parameters: { level: 'canonical', reason: { type: 'mode-trial' } },
    resultId: 'preserved',
  });
  await controller.execute({
    command: 'remember', input: 'preserved',
    parameters: {
      note: 'Mode-specific desk trial.', reason: 'Explicit functional trial.',
      attribution: 'evidence-desk-test',
    },
    resultId: 'remembered',
  });

  const desks = {};
  for (const mode of ['summary', 'details', 'explain', 'coverage']) {
    const command = {
      command: 'show', input: 'remembered',
      parameters: { mode, previewLimit: 2, excerptLimit: 400, sizeLimit: 30_000 },
    };
    const outcome = await controller.execute(command);
    desks[mode] = arrangeEvidence({ command, outcome });
  }

  assert.equal(desks.summary.cards.length, 0);
  assert.equal(desks.summary.summary.countUnit, 'subjects');
  assert.equal(desks.summary.summary.evidenceResolution.archive, 3);
  assert.match(formatEvidence(desks.summary), /3 subjects · summary/u);
  assert.doesNotMatch(formatEvidence(desks.summary), /paging omissions/u);

  assert.equal(desks.details.cards.length, 2);
  assert.equal(desks.details.cards.every(({ object }) => object === 'note'), true);
  assert.equal(desks.details.cards[0].detail.resolutionSource, 'archive');
  assert.equal(desks.details.cards[0].detail.notebookEntry.attribution,
    'evidence-desk-test');
  assert.match(formatEvidence(desks.details), /notebook · evidence-desk-test/u);
  assert.match(formatEvidence(desks.details), /detail provenance · 1 observations · 1 relays/u);
  assert.match(formatEvidence(desks.details), /freshness · 1 observations/u);

  assert.equal(desks.explain.cards.length, 0);
  assert.equal(desks.explain.explanations.length, 2);
  assert.equal(desks.explain.frame.unsupportedPreviewItems, 0);
  assert.match(formatEvidence(desks.explain), /explanations visible · explain/u);
  assert.match(formatEvidence(desks.explain), /reason:/u);

  assert.equal(desks.coverage.cards.length, 0);
  assert.equal(desks.coverage.coverage.evidenceResolution.archive, 3);
  assert.equal(desks.coverage.coverage.partial, false);
  assert.match(formatEvidence(desks.coverage), /3 subjects · coverage/u);
  assert.match(formatEvidence(desks.coverage), /resolution: 0 buffer · 3 archive/u);
  await controller.close();
});

test('real acquisition coverage retains root relay, count, bound, and uncertainty facts', async () => {
  const originalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = MixedRelayWebSocket;
  try {
    const { controller } = await fixtureDesk();
    await controller.execute({
      command: 'acquire',
      parameters: {
        relays: ['wss://working.invalid', 'wss://failing.invalid'],
        filter: { kinds: [1], limit: 5 },
        timeoutMs: 100,
        observationLimit: 10,
        distinctEventLimit: 5,
        concurrency: 2,
      },
      resultId: 'attempt',
    });
    const command = {
      command: 'show', input: 'attempt',
      parameters: { mode: 'coverage', previewLimit: 10, sizeLimit: 30_000 },
    };
    const outcome = await controller.execute(command);
    assert.equal(outcome.response.result.type, 'acquisition-coverage');
    assert.equal('coverage' in outcome.response.result, false);

    const desk = arrangeEvidence({ command, outcome });
    assert.equal(desk.coverage.kind, 'acquisition');
    assert.deepEqual([...desk.coverage.requested.relays].sort(),
      ['wss://failing.invalid/', 'wss://working.invalid/']);
    assert.equal(desk.coverage.budget.distinctEventLimit, 5);
    assert.equal(desk.coverage.counts.acceptedObservations, 0);
    assert.equal(desk.coverage.relays.length, 2);
    assert.deepEqual(
      desk.coverage.relays.map(({ outcome: relayOutcome }) => relayOutcome).sort(),
      ['connection-failure', 'eose'],
    );
    assert.equal(desk.coverage.exhaustive, false);
    assert.match(desk.coverage.uncertainty, /not implied/u);

    const rendered = formatEvidence(desk);
    assert.match(rendered, /0 events · acquisition coverage/u);
    assert.match(rendered, /requested · 2 relays · filter/u);
    assert.match(rendered, /distinctEventLimit 5/u);
    assert.match(rendered, /acceptedObservations 0/u);
    assert.match(rendered, /relay · wss:\/\/working\.invalid\/ · eose/u);
    assert.match(rendered, /relay · wss:\/\/failing\.invalid\/ · connection-failure/u);
    assert.match(rendered, /attempt · completed · exhaustive false/u);
    assert.match(rendered, /uncertainty:/u);

    const summaryCommand = {
      command: 'show', input: 'attempt', parameters: { mode: 'summary' },
    };
    const summaryOutcome = await controller.execute(summaryCommand);
    const summary = arrangeEvidence({ command: summaryCommand, outcome: summaryOutcome });
    const summaryText = formatEvidence(summary);
    assert.match(
      summaryText,
      /bounds · timeoutMs 100 · observationLimit 10 · distinctEventLimit 5 · concurrency 2/u,
    );
    assert.doesNotMatch(summaryText, /^origin$/mu);
    await controller.close();
  } finally {
    globalThis.WebSocket = originalWebSocket;
  }
});

test('contextual actions come only from already-requested schemas and compose visible commands', async () => {
  const { controller, requests } = await fixtureDesk();
  await controller.execute({
    command: 'select', parameters: { scope: 'corpus', kinds: [1] }, resultId: 'notes',
  });
  const schemas = [];
  schemas.push(await controller.execute({ command: 'schema', input: 'notes', parameters: {} }));
  for (const operation of ['move', 'continue', 'remember', 'preserve']) {
    schemas.push(await controller.execute({
      command: 'schema', input: 'notes', parameters: { operation },
    }));
  }
  const beforeArrange = requests();
  const actions = arrangeActions({ source: 'notes', schemaOutcomes: schemas });
  assert.equal(requests(), beforeArrange);
  assert.equal(actions.observations.some(({ id }) => id === 'observe:preview'), true);
  assert.equal(actions.observations.some(({ id }) => id === 'observe:coverage'), true);
  assert.equal(actions.observations.every(
    ({ basis }) => basis === 'desk-observation-vocabulary'), true);
  const navigate = actions.groups.find(({ id }) => id === 'navigate');
  const move = navigate.actions.find(({ id }) => id === 'operate:move');
  assert.equal(move.contractLoaded, true);
  assert.equal(move.contract.choices.to.some(({ to }) => to === 'authors'), true);
  const authorsVariant = move.variants.find(({ id }) => id === 'operate:move:authors');
  assert.deepEqual(authorsVariant.command, {
    command: 'move', input: 'notes', parameters: { to: 'authors' },
  });
  const continuation = navigate.actions.find(({ id }) => id === 'operate:continue');
  assert.equal(continuation.variants.some(
    ({ id }) => id === 'operate:continue:replies:local'), true);
  const remember = actions.groups.find(({ id }) => id === 'judge')
    .actions.find(({ id }) => id === 'operate:remember');
  assert.deepEqual(remember.requirements, {
    required: ['reason', 'attribution'],
    atLeastOne: ['labels', 'note', 'judgment', 'summary'],
  });
  assert.throws(
    () => composeAction(remember, {
      parameters: { note: 'Visible but mechanically incomplete.' },
      resultId: 'remembered',
    }),
    /Missing required parameter: reason/u,
  );
  assert.deepEqual(composeAction(remember, {
    parameters: {
      note: 'Visible and complete.', reason: 'trial', attribution: 'test-navigator',
    },
    resultId: 'remembered',
  }), {
    command: 'remember', input: 'notes',
    parameters: {
      note: 'Visible and complete.', reason: 'trial', attribution: 'test-navigator',
    },
    resultId: 'remembered',
  });
  const preserve = actions.groups.find(({ id }) => id === 'preserve')
    .actions.find(({ id }) => id === 'operate:preserve');
  assert.deepEqual(preserve.contract.parameters.level.values,
    ['reference', 'excerpt', 'canonical']);
  assert.deepEqual(
    preserve.variants.find(({ id }) => id === 'operate:preserve:canonical').remainingRequired,
    ['reason'],
  );

  const preserveCanonical = preserve.variants.find(
    ({ id }) => id === 'operate:preserve:canonical',
  );
  assert.deepEqual(composeAction(preserveCanonical, {
    parameters: { reason: { type: 'research-source' } },
  }), {
    command: 'preserve', input: 'notes',
    parameters: { level: 'canonical', reason: { type: 'research-source' } },
  });

  const command = composeAction(authorsVariant, { resultId: 'visible-authors' });
  assert.deepEqual(command, {
    command: 'move', input: 'notes', parameters: { to: 'authors' },
    resultId: 'visible-authors',
  });
  assert.equal(requests(), beforeArrange);
  const moved = await controller.execute(command);
  assert.equal(moved.receipt.handle.kind, 'accounts');
  assert.deepEqual(
    controller.transcript().entries.map(({ command: sent }) => sent.command),
    ['select', 'schema', 'schema', 'schema', 'schema', 'schema', 'move'],
  );
  await controller.close();
});

test('unresolved event references and relationship inclusion remain explicit', () => {
  const id = 'f'.repeat(64);
  const command = { command: 'show', input: 'ancestors', parameters: { mode: 'preview' } };
  const desk = arrangeEvidence({
    command,
    outcome: {
      ok: true,
      result: {
        type: 'result-collection', observation: 'preview', count: 1,
        preview: [{
          type: 'event', id, resolved: false,
          reasonSummary: {
            count: 2, relationshipCount: 1, relationshipTypes: ['reply-parent'],
          },
        }],
        offset: 0, limit: 1, nextOffset: 1, omittedBefore: 0, omittedAfter: 0,
      },
    },
  });
  assert.equal(desk.cards[0].object, 'event');
  assert.equal(desk.cards[0].evidence.resolved, false);
  const rendered = formatEvidence(desk);
  assert.match(rendered, /event · unresolved reference/u);
  assert.match(rendered, /evidence · resolved false/u);
  assert.match(rendered, /included via: reply-parent/u);

  const resolved = arrangeEvidence({
    command: { ...command, input: 'acquired-ancestors' },
    outcome: {
      ok: true,
      result: {
        type: 'result-collection', observation: 'preview', count: 1,
        preview: [{
          type: 'event', id, kind: 1, createdAt: 10, contentExcerpt: 'Resolved parent.',
          resolutionSource: 'buffer', author: { publicKey: 'a'.repeat(64) },
          reasonSummary: {
            count: 2, relationshipCount: 1, relationshipTypes: ['reply-parent'],
          },
        }],
        offset: 0, limit: 1, nextOffset: 1, omittedBefore: 0, omittedAfter: 0,
      },
    },
  });
  assert.deepEqual(compareEvidenceFrames(desk, resolved), {
    type: 'evidence-frame-comparison', version: 1,
    before: { handle: 'ancestors', observation: 'preview' },
    after: { handle: 'acquired-ancestors', observation: 'preview' },
    shared: 1, onlyBefore: [], onlyAfter: [],
    resolutionChanges: [{
      object: {
        cardId: `event:${id}`, object: 'note', id,
        sourceSubject: { type: 'event', id, kind: 1 },
      },
      before: 'unresolved', after: 'buffer',
    }],
  });
});

test('multiple metadata events for one account retain unique source-stable card ids', () => {
  const publicKey = 'a'.repeat(64);
  const preview = ['1', '2'].map((digit) => ({
    type: 'event', id: digit.repeat(64), kind: 0, createdAt: Number(digit),
    resolutionSource: 'buffer',
    author: { publicKey, name: 'same-account', metadataEventId: digit.repeat(64) },
    reasonSummary: { count: 1, relationshipCount: 0, relationshipTypes: [] },
  }));
  const command = { command: 'show', input: 'profiles', parameters: { mode: 'preview' } };
  const desk = arrangeEvidence({
    command,
    outcome: {
      ok: true,
      result: {
        type: 'result-collection', observation: 'preview', count: 2, preview,
        offset: 0, limit: 2, nextOffset: 2, omittedBefore: 0, omittedAfter: 0,
      },
    },
  });
  assert.deepEqual(desk.cards.map(({ id }) => id), [publicKey, publicKey]);
  assert.equal(new Set(desk.cards.map(({ cardId }) => cardId)).size, 2);
  const second = composeCardFocus(desk, desk.cards[1].cardId, {
    intermediateResultId: 'second-profile', resultId: 'same-account',
  });
  assert.deepEqual(second.commands[0].parameters, { positions: [2] });
});

test('unsupported previews and arrangement bounds remain visible', () => {
  const preview = Array.from({ length: 105 }, (_, index) => (
    index === 0
      ? { type: 'relation-row', index }
      : {
        type: 'account', id: `${index}`.padStart(64, '0'), resolved: false,
        reasonSummary: { count: 1, relationshipCount: 0, relationshipTypes: [] },
      }
  ));
  const command = { command: 'show', input: 'large', parameters: { mode: 'preview' } };
  const desk = arrangeEvidence({
    command,
    outcome: {
      response: {
        ok: true,
        result: {
          type: 'result-collection', observation: 'preview', count: 105, preview,
          offset: 0, limit: 105, nextOffset: 105, omittedBefore: 0, omittedAfter: 0,
          omitted: 0, sizeBounded: false,
        },
      },
    },
  });
  assert.equal(desk.cards.length, 99);
  assert.equal(desk.frame.unsupportedPreviewItems, 1);
  assert.equal(desk.frame.arrangementOmittedCards, 5);
  const rendered = formatEvidence(desk, { cardLimit: 3 });
  assert.match(rendered, /arranged cards not rendered: 96/u);
  assert.match(rendered, /arrangement omissions: 5 bounded · 1 unsupported/u);
});
