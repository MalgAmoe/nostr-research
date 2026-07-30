import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import {
  createFieldBoard,
  formatFieldBoard,
} from '@nostrarium/field-board';

function signed(secretByte, createdAt, content) {
  return finalizeEvent({ kind: 1, created_at: createdAt, tags: [], content },
    Uint8Array.from({ length: 32 }, () => secretByte));
}

async function observedFrames() {
  const memory = createInMemoryResearchMemory({ capacity: 20 });
  const session = createDeclarativeResearchSession(memory);
  const events = [
    signed(11, 1, 'photo landscape'),
    signed(12, 2, 'video field'),
    signed(13, 3, 'music and design'),
    signed(14, 4, 'how does this work'),
    signed(15, 5, 'anyone have evidence'),
    signed(16, 6, 'ordinary note'),
  ];
  for (const event of events) {
    memory.ingest(event, {
      relay: 'wss://field-board.example/',
      observedAt: '2026-07-30T18:00:00.000Z',
    });
  }
  let sequence = 0;

  async function frame(key, label, reason, selected) {
    const sourceCommand = {
      commandId: `source-${++sequence}`,
      command: 'select',
      parameters: { scope: 'corpus', ids: selected.map(({ id }) => id), limit: 20 },
      resultId: key,
    };
    const source = await session.execute(sourceCommand);
    const summaryCommand = {
      commandId: `summary-${++sequence}`,
      command: 'show',
      input: key,
      parameters: { mode: 'summary', sizeLimit: 10_000 },
    };
    const outcome = await session.execute(summaryCommand);
    return {
      key,
      label,
      reason,
      source,
      observation: { command: summaryCommand, outcome },
    };
  }

  const ground = await frame('ground', 'Ground', 'Six bounded fixture notes.', events);
  const media = await frame(
    'media', 'Media-bearing', 'Caller-selected media-bearing examples.', events.slice(0, 2),
  );
  const creative = await frame(
    'creative', 'Creative terms', 'Caller-selected creative-term examples.', [events[2]],
  );
  const inquiry = await frame(
    'inquiry', 'Inquiry terms', 'Caller-selected inquiry-term examples.', events.slice(3, 5),
  );
  const replacement = await frame(
    'quiet', 'Quiet remainder', 'Caller-selected unbranched remainder.', [events[5]],
  );
  const authorCommand = {
    commandId: `authors-${++sequence}`,
    command: 'move',
    input: 'ground',
    parameters: { to: 'authors' },
    resultId: 'authors',
  };
  const authorSource = await session.execute(authorCommand);
  const authorSummaryCommand = {
    commandId: `authors-summary-${++sequence}`,
    command: 'show',
    input: 'authors',
    parameters: { mode: 'summary', sizeLimit: 10_000 },
  };
  const authorSummary = await session.execute(authorSummaryCommand);
  const authors = {
    key: 'authors',
    label: 'Author accounts',
    reason: 'Accounts moved from Ground notes.',
    source: authorSource,
    observation: { command: authorSummaryCommand, outcome: authorSummary },
  };
  return { ground, media, creative, inquiry, replacement, authors };
}

test('Ground and several real summary observations remain visible without subject rendering', async () => {
  const frames = await observedFrames();
  const board = createFieldBoard({
    ground: frames.ground,
    branches: [frames.media, frames.creative, frames.inquiry],
  });
  const snapshot = board.snapshot();

  assert.equal(snapshot.ground.handle.kind, 'events');
  assert.equal(snapshot.ground.handle.count, 6);
  assert.equal(snapshot.ground.resolution.buffer, 6);
  assert.equal(snapshot.branches.length, 3);
  assert.deepEqual(snapshot.branches.map(({ key }) => key), [
    'media', 'creative', 'inquiry',
  ]);
  assert.deepEqual(snapshot.branches.map(({ parent }) => parent), [
    'ground', 'ground', 'ground',
  ]);
  assert.deepEqual(snapshot.contrasts.againstGround.map(({ counts }) => counts), [
    { left: 6, right: 2 },
    { left: 6, right: 1 },
    { left: 6, right: 2 },
  ]);
  assert.equal(snapshot.contrasts.betweenBranches.length, 3);
  assert.equal('cards' in snapshot, false);
  assert.equal('items' in snapshot, false);

  const rendered = formatFieldBoard(snapshot);
  assert.match(rendered, /FIELD BOARD · 4 frames · focus ground/u);
  assert.match(rendered, /GROUND · Ground · FOCUSED/u);
  assert.match(rendered, /reason \(caller\): Six bounded fixture notes\./u);
  assert.match(rendered, /BRANCH · Media-bearing/u);
  assert.match(rendered, /resolution · buffer 2/u);
  assert.match(rendered, /same-kind count ratio 33\.3% · overlap not established/u);
  assert.match(
    rendered,
    /Media-bearing ↔ Creative terms · kind events · counts 2 \/ 1 · resolution profile same · bounds: shared values same/u,
  );
  assert.match(rendered, /exit handle: ground/u);
  assert.match(
    formatFieldBoard(snapshot, { contrastLimit: 0 }),
    /3 pairwise contrasts omitted/u,
  );
});

test('prospective branch addition preserves focus and enforces the board limit locally', async () => {
  const frames = await observedFrames();
  const board = createFieldBoard({ ground: frames.ground, branchLimit: 2 });

  const first = board.addBranch(frames.media);
  assert.equal(first.added.id, 'media');
  assert.equal(first.board.focus, 'ground');
  assert.deepEqual(first.board.branches.map(({ key }) => key), ['media']);

  board.select('media');
  const second = board.addBranch(frames.creative);
  assert.equal(second.board.focus, 'media');
  assert.deepEqual(second.board.branches.map(({ key }) => key), ['media', 'creative']);
  assert.equal(board.handle().id, 'media');
  assert.throws(() => board.addBranch(frames.inquiry), /2 branch limit/u);
  assert.equal(board.snapshot().branches.length, 2);
  assert.equal(typeof board.execute, 'undefined');
});

test('focus and branch replacement are explicit local changes that return ordinary handles', async () => {
  const frames = await observedFrames();
  const board = createFieldBoard({
    ground: frames.ground,
    branches: [frames.media, frames.creative, frames.inquiry],
    focus: 'creative',
  });

  assert.deepEqual(board.handle(), {
    id: 'creative', kind: 'events', count: 1, revision: 3, scope: 'corpus',
  });
  const selected = board.select('media');
  assert.equal(selected.focus, 'media');
  assert.equal(board.handle().id, 'media');

  board.select('inquiry');
  const replaced = board.replaceBranch('inquiry', frames.authors);
  assert.equal(replaced.displaced.id, 'inquiry');
  assert.equal(replaced.board.focus, 'authors');
  assert.deepEqual(replaced.board.branches.map(({ key }) => key), [
    'media', 'creative', 'authors',
  ]);
  assert.equal(board.handle().id, 'authors');
  assert.equal(board.handle().kind, 'accounts');
  assert.match(
    formatFieldBoard(replaced.board),
    /count ratio unavailable for different kinds/u,
  );
  assert.equal(typeof board.execute, 'undefined');
});

test('bound contrast separates shared differences from stage-specific facts', () => {
  const frame = (key, label, count, bounds) => ({
    key,
    label,
    reason: `${label} reason.`,
    source: { id: key, kind: 'events', count },
    observation: {
      command: { command: 'show', input: key, parameters: { mode: 'summary' } },
      outcome: {
        ok: true,
        result: {
          observation: 'summary',
          summary: {
            resultKind: 'fixture', count, countUnit: 'subjects', bounds,
            evidenceResolution: { buffer: count, archive: 0, unresolved: 0 },
          },
        },
      },
    },
  });
  const board = createFieldBoard({
    ground: frame('ground', 'Ground', 10, { timeoutMs: 100, concurrency: 2 }),
    branches: [
      frame('relay', 'Relay branch', 4, { timeoutMs: 200, concurrency: 2 }),
      frame('transform', 'Transform branch', 3, { omittedCount: 0, truncated: false }),
    ],
  }).snapshot();

  assert.deepEqual(board.contrasts.againstGround[0].boundComparison, {
    comparable: true,
    sharedKeys: ['timeoutMs', 'concurrency'],
    sharedDifferences: [{ key: 'timeoutMs', left: 100, right: 200 }],
    leftOnly: [],
    rightOnly: [],
  });
  assert.deepEqual(board.contrasts.againstGround[1].boundComparison, {
    comparable: false,
    sharedKeys: [],
    sharedDifferences: [],
    leftOnly: ['timeoutMs', 'concurrency'],
    rightOnly: ['omittedCount', 'truncated'],
  });
  const rendered = formatFieldBoard(board);
  assert.match(rendered, /shared values differ: timeoutMs/u);
  assert.match(
    rendered,
    /no comparable keys · Ground only: timeoutMs, concurrency · Transform branch only: omittedCount, truncated/u,
  );
});

test('frames reject mismatched summaries, duplicate positions, and excess branches', async () => {
  const frames = await observedFrames();
  assert.throws(() => createFieldBoard({
    ground: frames.ground,
    branches: [{
      ...frames.media,
      observation: frames.creative.observation,
    }],
  }), /already-requested summary for media/u);
  assert.throws(() => createFieldBoard({
    ground: frames.ground,
    branches: [frames.media, { ...frames.creative, key: 'media' }],
  }), /Duplicate board frame: media/u);
  assert.throws(() => createFieldBoard({
    ground: frames.ground,
    branches: [frames.media, frames.creative],
    branchLimit: 1,
  }), /at most 1 frames/u);
});
