import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';

const SECRET = Uint8Array.from(Buffer.from('9'.repeat(64), 'hex'));

function signed(kind, createdAt, tags, content) {
  return finalizeEvent({ kind, created_at: createdAt, tags, content }, SECRET);
}

test('relations normalize bounded attachment evidence and generically explode objects', async () => {
  const sharedUrl = 'https://media.example/item.jpg';
  const declared = signed(1, 1, [
    ['imeta', `url ${sharedUrl}`, 'm image/jpeg', 'dim 1200x800', 'alt Sunset',
      'x first-hash', 'fallback https://fallback.example/item.jpg'],
    ['imeta', `url ${sharedUrl}`, 'm video/mp4', 'm malformed', 'x second-hash'],
    ['imeta', 'm image/png'],
    ['imeta', 'url https://files.example/manual', 'm application/pdf'],
  ], `duplicate ${sharedUrl} inferred https://soundcloud.com/research/episode`);
  const file = signed(1063, 2, [
    ['url', 'https://files.example/audio.bin'],
    ['m', 'audio/ogg'],
    ['duration', '12.5'],
  ], '');
  const pictureWithoutUrl = signed(20, 3, [['imeta', 'm image/png']], 'caption only');
  const pictureWithContentUrl = signed(
    20,
    4,
    [],
    'caption https://pictures.example/research.jpg',
  );
  const voice = signed(1222, 5, [], 'https://voice.example/message.opus');
  const podcast = signed(54, 6, [
    ['audio', 'https://podcast.example/episode', 'audio/mpeg'],
  ], '');
  const videoWithAudioTrack = signed(34235, 7, [
    ['imeta', 'url https://video.example/main.mp4', 'm video/mp4'],
    ['imeta', 'url https://video.example/track.mp3', 'm audio/mpeg'],
  ], '');
  const bounded = signed(
    1,
    8,
    [],
    Array.from({ length: 22 }, (_, index) => `https://cdn.example/${index}.jpg`).join(' '),
  );
  const events = [
    declared, file, pictureWithoutUrl, pictureWithContentUrl, voice, podcast,
    videoWithAudioTrack, bounded,
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
      parameters: {
        previewLimit: events.length, includeEvidence: true, sizeLimit: 50000,
      },
    });
    const byId = new Map(shown.result.preview.map(({ values }) => [
      values['subject.id'], values,
    ]));
    const declaredFacts = byId.get(declared.id);
    assert.equal(declaredFacts['event.attachmentCount'], 3);
    assert.equal(declaredFacts['event.hasMedia'], true);
    assert.deepEqual(declaredFacts['event.mediaFamilies'], [
      'image', 'video', 'unknown', 'file', 'audio',
    ]);
    const merged = declaredFacts['event.attachments'][0];
    assert.deepEqual(merged, {
      url: sharedUrl,
      families: ['image', 'video', 'unknown'],
      mimeTypes: ['image/jpeg', 'video/mp4', 'malformed'],
      classification: 'conflicting',
      sources: ['imeta', 'url-extension'],
      width: 1200,
      height: 800,
      durationSeconds: null,
      alt: 'Sunset',
      hashes: ['first-hash', 'second-hash'],
      fallbackUrls: ['https://fallback.example/item.jpg'],
    });
    assert.equal(
      declaredFacts['event.attachments'][1].classification,
      'declared',
    );
    assert.deepEqual(
      declaredFacts['event.attachments'][2].sources,
      ['known-host'],
    );
    assert.equal(declaredFacts['event.attachments'][2].classification, 'inferred');

    assert.deepEqual(byId.get(file.id)['event.mediaSources'], ['file-metadata']);
    assert.equal(byId.get(file.id)['event.attachments'][0].durationSeconds, 12.5);
    assert.deepEqual(byId.get(voice.id)['event.mediaSources'], [
      'voice-kind', 'url-extension',
    ]);
    assert.deepEqual(byId.get(podcast.id)['event.mediaSources'], ['podcast-audio-tag']);
    const videoAttachments = byId.get(videoWithAudioTrack.id)['event.attachments'];
    assert.deepEqual(videoAttachments[0].families, ['video']);
    assert.equal(videoAttachments[0].classification, 'declared');
    assert.deepEqual(videoAttachments[1].families, ['audio']);
    assert.equal(videoAttachments[1].classification, 'declared');
    assert.equal(byId.get(pictureWithoutUrl.id)['event.format'], 'picture-first');
    assert.equal(byId.get(pictureWithoutUrl.id)['event.attachmentCount'], 0);
    assert.equal(byId.get(pictureWithoutUrl.id)['event.hasMedia'], false);
    assert.deepEqual(byId.get(pictureWithContentUrl.id)['event.attachments'][0], {
      url: 'https://pictures.example/research.jpg',
      families: ['image'],
      mimeTypes: [],
      classification: 'declared',
      sources: ['picture-kind', 'url-extension'],
      width: null,
      height: null,
      durationSeconds: null,
      alt: null,
      hashes: [],
      fallbackUrls: [],
    });
    assert.equal(byId.get(bounded.id)['event.attachmentCount'], 22);
    assert.equal(byId.get(bounded.id)['event.attachmentsOmitted'], 2);

    await session.execute({
      commandId: 'explode-attachments', command: 'explode', input: 'facts',
      parameters: { field: 'event.attachments', as: 'attachment', limit: 100 },
      resultId: 'exploded',
    });
    await session.execute({
      commandId: 'filter-bounded', command: 'filter', input: 'exploded',
      parameters: { where: { field: 'subject.id', equals: bounded.id } },
      resultId: 'bounded-attachments',
    });
    const boundedAttachments = await session.execute({
      commandId: 'show-bounded', command: 'show', input: 'bounded-attachments',
      parameters: { offset: 19, previewLimit: 1 },
    });
    assert.equal(boundedAttachments.result.count, 20);
    assert.equal(
      boundedAttachments.result.preview[0].values['attachment.url'],
      'https://cdn.example/19.jpg',
    );
    await session.execute({
      commandId: 'filter-attachment', command: 'filter', input: 'exploded',
      parameters: { where: { field: 'attachment.classification', equals: 'conflicting' } },
      resultId: 'conflicts',
    });
    const conflict = await session.execute({
      commandId: 'show-conflict', command: 'show', input: 'conflicts',
      parameters: { previewLimit: 1 },
    });
    assert.equal(conflict.result.preview[0].values['subject.id'], declared.id);
    assert.equal(conflict.result.preview[0].values['attachment.url'], sharedUrl);
    assert.deepEqual(conflict.result.preview[0].values['attachment.families'], [
      'image', 'video', 'unknown',
    ]);
    assert.equal(conflict.result.preview[0].provenanceCount > 0, true);

    await session.execute({
      commandId: 'generic-object-array', command: 'derive', input: 'facts',
      parameters: {
        fields: [{
          name: 'objects',
          expression: { constant: [{ label: 'one', nested: { hidden: true } }] },
        }],
      },
      resultId: 'object-arrays',
    });
    await session.execute({
      commandId: 'generic-explode', command: 'explode', input: 'object-arrays',
      parameters: { field: 'objects', as: 'item', limit: 1 },
      resultId: 'generic-exploded',
    });
    const generic = await session.execute({
      commandId: 'show-generic', command: 'show', input: 'generic-exploded',
      parameters: { previewLimit: 1 },
    });
    assert.equal(generic.result.preview[0].values['item.label'], 'one');
    assert.deepEqual(generic.result.preview[0].values['item.nested'], { hidden: true });
    assert.equal('item.nested.hidden' in generic.result.preview[0].values, false);

    const schema = await session.execute({
      commandId: 'schema', command: 'schema', input: 'facts',
      parameters: { operation: 'project' },
    });
    for (const field of [
      'event.mediaFamilies', 'event.mediaSources', 'event.attachmentCount',
      'event.attachments', 'event.attachmentsOmitted', 'event.hasMedia',
    ]) {
      assert.equal(schema.result.operation.availableFields.includes(field), true);
    }

    memory.ingest(signed(1, 8, [], 'turnover'), {
      relay: 'wss://evidence.example',
      observedAt: '2026-07-28T12:01:00.000Z',
    });
    const unresolved = await session.execute({
      commandId: 'show-unresolved', command: 'show', input: 'facts',
      parameters: { previewLimit: 1, includeEvidence: true },
    });
    assert.equal(unresolved.result.preview[0].values['subject.id'], declared.id);
    for (const field of [
      'event.mediaFamilies', 'event.mediaSources', 'event.attachmentCount',
      'event.attachments', 'event.attachmentsOmitted', 'event.hasMedia',
    ]) {
      assert.equal(unresolved.result.preview[0].values[field], null);
    }
  } finally {
    await session.close();
  }
});
