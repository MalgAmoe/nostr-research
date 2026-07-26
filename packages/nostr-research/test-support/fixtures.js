import { readFileSync } from 'node:fs';

export function loadFixtureEvents() {
  const fixturePath = new URL('../fixtures/events.json', import.meta.url);
  return JSON.parse(readFileSync(fixturePath, 'utf8'));
}
