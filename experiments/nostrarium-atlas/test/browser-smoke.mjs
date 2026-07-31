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

  const queryPanel = page.getByRole('region', { name: 'Acquire Ground' });
  await queryPanel.waitFor();
  assert.equal(await page.locator('.acquisition-overlay > .query-panel').count(), 1);
  assert.equal(await page.locator('.sidebar > .query-panel').count(), 0);
  await queryPanel.getByPlaceholder('Filter your relay list').fill('primal');
  await queryPanel.getByText('Primal', { exact: true }).waitFor();
  await queryPanel.getByText('nos.lol', { exact: true }).waitFor(); // selected targets stay visible
  await queryPanel.getByPlaceholder('Filter your relay list').fill('');
  await queryPanel.getByPlaceholder('relay-side full-text search (NIP-50)').fill('nostr clients');
  await queryPanel.getByLabel('NIP-01 filter limit').selectOption('100');
  await queryPanel.getByText(/matching “nostr clients”/).waitFor();
  await queryPanel.getByRole('checkbox', { name: /Primal/ }).check();
  assert.equal(await queryPanel.getByRole('button', { name: 'Acquire and establish Ground' }).isDisabled(), true);
  await queryPanel.getByRole('checkbox', { name: /Primal/ }).uncheck();
  await queryPanel.getByRole('code').filter({ hasText: 'wss://nos.lol' }).waitFor();
  await queryPanel.getByPlaceholder('wss://relay.example').fill('http://not-a-relay.example');
  await queryPanel.getByRole('button', { name: 'Add', exact: true }).click();
  await queryPanel.getByText('Relay URL must use wss://.').waitFor();
  await queryPanel.getByRole('button', { name: 'Close acquisition draft' }).click();

  await page.getByRole('heading', { name: 'No live place' }).waitFor();
  await page.getByText('No Ground yet').waitFor();
  assert.equal(await page.locator('.note-card').count(), 0);
  assert.equal(await page.locator('.place-list article').count(), 0);
  assert.equal(await page.locator('img[src^="/media/"]').count(), 0);
  await page.getByRole('button', { name: /Open acquisition draft/ }).first().click();
  await queryPanel.waitFor();
  assert.equal(await page.locator('.acquisition-overlay > .query-panel').count(), 1);
  assert.equal(await page.getByRole('button', { name: /SOURCE.*DRAFT/ }).count(), 1);

  await page.setViewportSize({ width: 640, height: 800 });
  await queryPanel.getByRole('button', { name: 'Close acquisition draft' }).click();
  await page.getByRole('button', { name: 'Context', exact: true }).click();
  assert.equal(await page.locator('.sidebar').isVisible(), true);
  assert.equal(await page.getByText('PLACES', { exact: true }).isVisible(), true);
  assert.equal(await page.getByText('LENSES', { exact: true }).isVisible(), true);
  assert.equal(await page.locator('.field-content').isVisible(), false);
  await page.getByRole('button', { name: 'Field', exact: true }).click();
  assert.equal(await page.locator('.field-content').isVisible(), true);
  await page.getByRole('button', { name: 'Inspector', exact: true }).click();
  assert.equal(await page.locator('.inspector').isVisible(), true);
  assert.equal(await page.getByText('No subject selected').isVisible(), true);
  assert.deepEqual(errors, []);
  console.log('atlas browser smoke passed: explicit draft overlay, desktop workspace, and narrow Context/Field/Inspector modes');
} finally {
  await browser?.close();
  await server.close();
}
