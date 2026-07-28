import assert from 'node:assert/strict';
import test from 'node:test';
import { nip19 } from 'nostr-tools';
import {
  InvalidNostrReferenceError,
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
  decodeNostrReference,
  subject,
} from '@nostr-research/memory';

const author = '11'.repeat(32);
const eventId = '22'.repeat(32);

test('public references normalize to stable subjects while hints stay attributed metadata', async () => {
  const npub = nip19.npubEncode(author);
  const nprofile = nip19.nprofileEncode({ pubkey: author, relays: ['wss://hint.example'] });
  const note = nip19.noteEncode(eventId);
  const nevent = nip19.neventEncode({
    id: eventId, author, kind: 1, relays: ['wss://event-hint.example'],
  });
  const naddr = nip19.naddrEncode({
    identifier: 'research:topic', pubkey: author, kind: 30023,
    relays: ['wss://address-hint.example'],
  });

  assert.deepEqual(decodeNostrReference(npub).subject, subject('account', author));
  assert.deepEqual(decodeNostrReference(nprofile).subject, subject('account', author));
  assert.deepEqual(decodeNostrReference(note).subject, subject('event', eventId));
  assert.deepEqual(decodeNostrReference(`nostr:${nevent}`).subject, subject('event', eventId));
  assert.deepEqual(
    decodeNostrReference(naddr).subject,
    subject('address', `30023:${author}:research:topic`),
  );
  assert.deepEqual(decodeNostrReference(nevent), {
    reference: nevent,
    form: 'nip19',
    entity: 'nevent',
    subject: subject('event', eventId),
    authorHint: author,
    kindHint: 1,
    relayHints: ['wss://event-hint.example'],
  });

  const memory = createInMemoryResearchMemory({ capacity: 2 });
  const session = createDeclarativeResearchSession(memory, {
    relays: ['wss://configured.example'],
  });
  try {
    assert.deepEqual(memory.lookup(note).items[0].subject, subject('event', eventId));
    const inspected = await session.execute({
      commandId: 'inspect-reference', command: 'inspect', parameters: { subject: nevent },
    });
    assert.equal(inspected.ok, true);
    assert.deepEqual(inspected.result.decodedReference.relayHints,
      ['wss://event-hint.example']);
    const status = await session.execute({
      commandId: 'status', command: 'status', parameters: {},
    });
    assert.deepEqual(status.result.configuration.relays,
      ['wss://configured.example/']);
    assert.equal(memory.describe().observationBuffer.eventCount, 0);
  } finally {
    await session.close();
  }

  const privateReference = nip19.nsecEncode(Uint8Array.from(Buffer.from('33'.repeat(32), 'hex')));
  const nonCanonicalAddress = nip19.naddrEncode({
    identifier: '', pubkey: author, kind: 1,
  });
  for (const invalid of [
    privateReference,
    nonCanonicalAddress,
    nip19.nrelayEncode?.('wss://relay.example') ?? 'nrelay1qq',
    'not-a-reference',
    `note1${'q'.repeat(5000)}`,
  ]) {
    assert.throws(
      () => decodeNostrReference(invalid),
      (error) => error instanceof InvalidNostrReferenceError
        && error.message.length < 160,
    );
  }
});
