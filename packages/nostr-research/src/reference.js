import { nip19 } from 'nostr-tools';
import { ResearchMemoryError, subject } from './protocol.js';

export const NOSTR_REFERENCE_MAX_LENGTH = 5000;

export class InvalidNostrReferenceError extends ResearchMemoryError {
  constructor(message = 'Nostr reference is malformed or unsupported.') {
    super(message);
    this.name = 'InvalidNostrReferenceError';
  }
}

function decodedSubject(type, id) {
  try {
    return subject(type, id);
  } catch (error) {
    if (error instanceof ResearchMemoryError) {
      throw new InvalidNostrReferenceError();
    }
    throw error;
  }
}

/** Decode a bounded public NIP-19 reference, optionally wrapped in NIP-21. */
export function decodeNostrReference(reference) {
  if (typeof reference !== 'string' || reference.length === 0) {
    throw new InvalidNostrReferenceError('Nostr reference must be a non-empty string.');
  }
  if (reference.length > NOSTR_REFERENCE_MAX_LENGTH) {
    throw new InvalidNostrReferenceError(
      `Nostr reference exceeds the ${NOSTR_REFERENCE_MAX_LENGTH}-character NIP-19 bound.`,
    );
  }
  const form = reference.startsWith('nostr:') ? 'nip21' : 'nip19';
  const encoded = form === 'nip21' ? reference.slice(6) : reference;
  if (encoded.length === 0 || encoded !== encoded.trim()) throw new InvalidNostrReferenceError();
  let decoded;
  try {
    decoded = nip19.decode(encoded);
  } catch {
    throw new InvalidNostrReferenceError();
  }
  if (decoded.type === 'nsec') {
    throw new InvalidNostrReferenceError('Private nsec references are not accepted.');
  }
  const result = { reference, form, entity: decoded.type };
  if (decoded.type === 'npub') {
    return { ...result, subject: decodedSubject('account', decoded.data) };
  }
  if (decoded.type === 'note') {
    return { ...result, subject: decodedSubject('event', decoded.data) };
  }
  if (decoded.type === 'nprofile') {
    return {
      ...result, subject: decodedSubject('account', decoded.data.pubkey),
      ...(decoded.data.relays?.length ? { relayHints: [...decoded.data.relays] } : {}),
    };
  }
  if (decoded.type === 'nevent') {
    return {
      ...result, subject: decodedSubject('event', decoded.data.id),
      ...(decoded.data.author !== undefined ? { authorHint: decoded.data.author } : {}),
      ...(decoded.data.kind !== undefined ? { kindHint: decoded.data.kind } : {}),
      ...(decoded.data.relays?.length ? { relayHints: [...decoded.data.relays] } : {}),
    };
  }
  if (decoded.type === 'naddr') {
    return {
      ...result,
      subject: decodedSubject(
        'address', `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier}`,
      ),
      authorHint: decoded.data.pubkey,
      kindHint: decoded.data.kind,
      ...(decoded.data.relays?.length ? { relayHints: [...decoded.data.relays] } : {}),
    };
  }
  throw new InvalidNostrReferenceError(`Unsupported NIP-19 entity: ${decoded.type}.`);
}
