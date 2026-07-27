import { validateEvent, verifyEvent } from 'nostr-tools';

const EVENT_ID = /^[a-f0-9]{64}$/;
const SIGNATURE = /^[a-f0-9]{128}$/;
const SUBJECT_TYPES = new Set(['event', 'account', 'tag']);

export class ResearchMemoryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ResearchMemoryError';
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
  return { type, id };
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
