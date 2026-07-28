import events from '../../packages/nostr-research/fixtures/events.json';

// Blob Workers have an opaque origin, so Chromium does not expose
// crypto.randomUUID even though a normally served Worker does.
if (typeof globalThis.crypto.randomUUID !== 'function') {
  let sequence = 0;
  globalThis.crypto.randomUUID = () => `00000000-0000-4000-8000-${String(
    sequence += 1,
  ).padStart(12, '0')}`;
}

class FixtureWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  #listeners = new Map();

  constructor(url) {
    this.url = url;
    this.readyState = FixtureWebSocket.CONNECTING;
    queueMicrotask(() => {
      this.readyState = FixtureWebSocket.OPEN;
      this.#emit('open', {});
    });
  }

  addEventListener(type, listener) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type).add(listener);
  }

  send(serialized) {
    const packet = JSON.parse(serialized);
    if (packet[0] !== 'REQ') return;
    const subscriptionId = packet[1];
    for (const event of events) {
      queueMicrotask(() => this.#emit('message', {
        data: JSON.stringify(['EVENT', subscriptionId, event]),
      }));
    }
    queueMicrotask(() => this.#emit('message', {
      data: JSON.stringify(['EOSE', subscriptionId]),
    }));
  }

  close() {
    if (this.readyState >= FixtureWebSocket.CLOSING) return;
    this.readyState = FixtureWebSocket.CLOSING;
    queueMicrotask(() => {
      this.readyState = FixtureWebSocket.CLOSED;
      this.#emit('close', { code: 1000 });
    });
  }

  #emit(type, event) {
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }
}

globalThis.WebSocket = FixtureWebSocket;
