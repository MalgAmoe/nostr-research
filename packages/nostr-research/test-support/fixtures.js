import { readFileSync } from 'node:fs';

export function loadFixtureEvents() {
  const fixturePath = new URL('../fixtures/events.json', import.meta.url);
  return JSON.parse(readFileSync(fixturePath, 'utf8'));
}

export class EmptyRelayWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = EmptyRelayWebSocket.CONNECTING;
    this.listeners = new Map();
    queueMicrotask(() => {
      if (url.includes('failing')) {
        this.readyState = EmptyRelayWebSocket.CLOSED;
        this.emit('close', { code: 1006 });
      } else {
        this.readyState = EmptyRelayWebSocket.OPEN;
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
    this.readyState = EmptyRelayWebSocket.CLOSED;
  }

  emit(name, event) {
    for (const listener of this.listeners.get(name) ?? []) listener(event);
  }
}
