import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';

const SECRET = Uint8Array.from(Buffer.from('8'.repeat(64), 'hex'));

function signed(kind, createdAt, tags, content) {
  return finalizeEvent({ kind, created_at: createdAt, tags, content }, SECRET);
}

test('relations expose lazy factual event content and conversation fields', async () => {
  const root = signed(1, 1, [], 'root');
  const reply = signed(1, 2, [['e', root.id, '', 'reply']], 'reply');
  const quote = signed(1, 3, [['q', root.id]], 'quote');
  const ambiguous = signed(1, 4, [
    ['e', root.id],
    ['e', quote.id],
  ], 'ambiguous legacy thread');
  const malformed = signed(1, 5, [['e', 'not-an-event-id']], 'malformed legacy thread');
  const repost = signed(6, 6, [['e', root.id]], JSON.stringify(root));
  const reaction = signed(7, 7, [['e', root.id]], '+');
  const comment = signed(1111, 8, [['E', root.id]], 'comment');
  const chat = signed(42, 9, [], 'chat');
  const unknown = signed(9999, 10, [], 'unregistered');
  const events = [
    root, reply, quote, ambiguous, malformed, repost, reaction, comment, chat, unknown,
  ];
  const memory = createInMemoryResearchMemory({ capacity: events.length });
  const session = createDeclarativeResearchSession(memory);

  try {
    for (const event of events) {
      memory.ingest(event, {
        relay: 'wss://evidence.example',
        observedAt: '2026-07-28T12:00:00.000Z',
      });
    }
    await session.execute({
      commandId: 'select', command: 'select',
      parameters: { scope: 'corpus', order: 'oldest', limit: events.length },
      resultId: 'events',
    });
    await session.execute({
      commandId: 'relate', command: 'relate', input: 'events', resultId: 'facts',
    });

    const shown = await session.execute({
      commandId: 'show', command: 'show', input: 'facts',
      parameters: { previewLimit: events.length },
    });
    const byId = new Map(shown.result.preview.map(({ values }) => [
      values['subject.id'], values,
    ]));
    assert.deepEqual(
      ['event.role', 'event.format', 'event.conversationRole'].map(
        (field) => byId.get(root.id)[field],
      ),
      ['content', 'plain-text', 'original'],
    );
    assert.equal(byId.get(reply.id)['event.conversationRole'], 'reply');
    assert.equal(byId.get(quote.id)['event.conversationRole'], 'quote');
    assert.equal(byId.get(ambiguous.id)['event.conversationRole'], 'unknown');
    assert.equal(byId.get(malformed.id)['event.conversationRole'], 'unknown');
    assert.deepEqual(
      [byId.get(repost.id)['event.role'], byId.get(repost.id)['event.format'],
        byId.get(repost.id)['event.conversationRole']],
      ['interaction', 'none', 'repost'],
    );
    assert.equal(byId.get(reaction.id)['event.conversationRole'], 'reaction');
    assert.equal(byId.get(comment.id)['event.conversationRole'], 'comment');
    assert.equal(byId.get(chat.id)['event.conversationRole'], 'chat-message');
    assert.deepEqual(
      ['event.role', 'event.format', 'event.conversationRole'].map(
        (field) => byId.get(unknown.id)[field],
      ),
      ['unknown', 'unknown', 'unknown'],
    );

    const schema = await session.execute({
      commandId: 'schema', command: 'schema', input: 'facts',
      parameters: { operation: 'project' },
    });
    for (const field of ['event.role', 'event.format', 'event.conversationRole']) {
      assert.equal(schema.result.operation.availableFields.includes(field), true);
      assert.equal(
        schema.result.operation.populatedFields.some(({ name }) => name === field),
        true,
      );
    }

    memory.ingest(signed(1, 11, [], 'turnover'), {
      relay: 'wss://evidence.example',
      observedAt: '2026-07-28T12:01:00.000Z',
    });
    const afterTurnover = await session.execute({
      commandId: 'show-after-turnover', command: 'show', input: 'facts',
      parameters: { previewLimit: 1 },
    });
    assert.equal(afterTurnover.result.preview[0].values['subject.id'], root.id);
    assert.equal(afterTurnover.result.preview[0].values['event.role'], null);
    assert.equal(afterTurnover.result.preview[0].values['event.format'], null);
    assert.equal(afterTurnover.result.preview[0].values['event.conversationRole'], null);
  } finally {
    await session.close();
  }
});
