import { validateEvent, verifyEvent } from 'nostr-tools';

const EVENT_ID = /^[a-f0-9]{64}$/;
const SIGNATURE = /^[a-f0-9]{128}$/;
const SUBJECT_TYPES = new Set(['event', 'account', 'address', 'tag']);

export class ResearchMemoryError extends Error {
  constructor(message, code = undefined) {
    super(message);
    this.name = 'ResearchMemoryError';
    if (code !== undefined) this.semanticCode = code;
  }
}

export class InvalidNostrEventError extends ResearchMemoryError {
  constructor(message = 'Event is not a valid canonical Nostr event.') {
    super(message);
    this.name = 'InvalidNostrEventError';
  }
}

/** Creates a minimal stable Nostr subject reference. */
export function subject(type, id) {
  if (!SUBJECT_TYPES.has(type)) {
    throw new ResearchMemoryError(`Unsupported subject type: ${type}.`);
  }
  if (typeof id !== 'string' || id.length === 0) {
    throw new ResearchMemoryError('Subject ID must be a non-empty string.');
  }
  if (['event', 'account'].includes(type) && !EVENT_ID.test(id)) {
    throw new ResearchMemoryError(
      `${type} subject ID must be a full 64-character lowercase hexadecimal value.`,
    );
  }
  if (type === 'address' && !parseAddress(id)) {
    throw new ResearchMemoryError(
      'address subject ID must be a canonical replaceable coordinate: '
      + '<kind>:<64-character-lowercase-hex-pubkey>:<d>.',
    );
  }
  return { type, id };
}

/** Parses one canonical NIP-01 replaceable/addressable event coordinate. */
export function parseAddress(value) {
  if (typeof value !== 'string') return null;
  const match = /^([0-9]+):([a-f0-9]{64}):(.*)$/su.exec(value);
  if (!match) return null;
  const kind = Number(match[1]);
  if (!Number.isSafeInteger(kind) || String(kind) !== match[1]) return null;
  const normal = kind === 0 || kind === 3 || (kind >= 10000 && kind < 20000);
  const addressable = kind >= 30000 && kind < 40000;
  if ((!normal && !addressable) || (normal && match[3] !== '')) return null;
  return { kind, pubkey: match[2], d: match[3] };
}

export function isCanonicalNostrEvent(event) {
  if (!event || typeof event !== 'object') return false;
  let candidate;
  try {
    candidate = structuredClone(event);
  } catch {
    return false;
  }
  if (!validateEvent(candidate)) return false;
  if (!EVENT_ID.test(candidate.id) || !SIGNATURE.test(candidate.sig)) return false;
  if (!Number.isSafeInteger(candidate.kind) || candidate.kind < 0) return false;
  if (!Number.isSafeInteger(candidate.created_at) || candidate.created_at < 0) return false;
  // nostr-tools memoizes verification. Verify the clone so validation never
  // annotates caller-owned evidence.
  return verifyEvent(candidate);
}
