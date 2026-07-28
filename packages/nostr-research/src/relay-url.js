import { ResearchMemoryError } from './protocol.js';

export function normalizeRelayUrl(value, label = 'Relay URL') {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ResearchMemoryError(`Invalid ${label.toLowerCase()}: ${value}`);
  }
  if (url.protocol !== 'wss:' || url.username || url.password || url.hash) {
    throw new ResearchMemoryError(
      `${label} must use wss:// and must not contain credentials or a fragment: ${value}`,
    );
  }
  return url.href;
}
