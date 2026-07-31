import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ root: new URL('..', import.meta.url).pathname, server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  assert(address && typeof address === 'object');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'networkidle' });

  const queryPanel = page.getByRole('region', { name: 'Search relays' });
  await queryPanel.waitFor();
  assert.equal(await page.locator('.sidebar > .query-panel').count(), 1);
  assert.equal(await page.locator('.field-content > .query-panel').count(), 0);
  assert.equal(await page.locator('.query-backdrop').count(), 0);
  await queryPanel.getByPlaceholder('Filter your relay list').fill('primal');
  await queryPanel.getByText('Primal', { exact: true }).waitFor();
  await queryPanel.getByText('nos.lol', { exact: true }).waitFor(); // selected sources never become hidden
  await queryPanel.getByPlaceholder('Filter your relay list').fill('');
  await queryPanel.getByPlaceholder('relay-side full-text search (NIP-50)').fill('nostr clients');
  await queryPanel.getByLabel('Limit per relay').selectOption('100');
  await queryPanel.getByText(/matching “nostr clients”/).waitFor();
  await queryPanel.getByRole('checkbox', { name: /Primal/ }).check();
  assert.equal(await queryPanel.getByRole('button', { name: 'Choose one relay' }).isDisabled(), true);
  await queryPanel.getByRole('checkbox', { name: /Primal/ }).uncheck();
  await queryPanel.getByRole('code').filter({ hasText: 'wss://nos.lol' }).waitFor();
  await queryPanel.getByPlaceholder('wss://relay.example').fill('http://not-a-relay.example');
  await queryPanel.getByRole('button', { name: 'Add', exact: true }).click();
  await queryPanel.getByText('Relay URL must use wss://.').waitFor();
  await queryPanel.getByRole('button', { name: 'Close relay search' }).click();

  await page.getByRole('heading', { name: 'No live field' }).waitFor();
  assert.equal(await page.locator('.note-card').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Map', exact: true }).count(), 0);
  assert.equal(await page.locator('img[src^="/media/"]').count(), 0);
  await page.getByRole('button', { name: /Search live relays/ }).first().click();
  await queryPanel.waitFor();
  assert.equal(await page.locator('.sidebar > .query-panel').count(), 1);
  assert.equal(await page.getByRole('button', { name: /SOURCE.*SEARCH/ }).count(), 1);
  assert.deepEqual(errors, []);
  console.log('atlas browser smoke passed: sidebar relay search, live-only start, no bundled content or media');
} finally {
  await browser?.close();
  await server.close();
}
