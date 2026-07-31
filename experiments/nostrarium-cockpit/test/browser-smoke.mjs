import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({
  root: new URL('..', import.meta.url).pathname,
  server: { host: '127.0.0.1', port: 0 },
  logLevel: 'silent',
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  assert(address && typeof address === 'object');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'networkidle' });

  await expectText(page, 'FIXTURE FLIGHT · NO RELAY CONTACT');
  await expectText(page, 'Recorded bounded attempt · relay completeness is not implied.');
  assert.equal(await page.getByRole('button', { name: /GROUND · 9 SIGNALS/ }).getAttribute('aria-current'), 'location');

  await page.getByRole('button', { name: /STAGE CONVERSATION/ }).click();
  await expectText(page, '"command":"continue"');
  assert.equal(await page.getByRole('button', { name: /THREAD · 6 SIGNALS/ }).count(), 0);
  await page.getByRole('button', { name: 'EXECUTE RECORDED OUTCOME' }).click();
  await page.getByRole('button', { name: 'PLACE BRANCH' }).waitFor();
  assert.equal(await page.getByRole('button', { name: /THREAD · 6 SIGNALS/ }).count(), 0);
  await page.getByRole('button', { name: 'PLACE BRANCH' }).click();
  const thread = page.getByRole('button', { name: /THREAD · 6 SIGNALS/ });
  assert.equal(await thread.count(), 1);
  await thread.click();
  await expectText(page, 'Fixture relationship field · no live acquisition occurred.');

  await page.locator('.view-switch button').nth(1).click();
  assert.equal(await page.locator('.signal-list > button').count(), 6);
  await page.locator('.signal-list > button').nth(1).click();
  await expectText(page, 'The no-audience-required part is the best part.');
  await page.getByRole('button', { name: 'VIEW ACCOUNT' }).click();
  await expectText(page, 'Account claims');
  await expectText(page, 'Account ownership and trust are not inferred.');
  await page.getByRole('button', { name: /RETURN TO SIGNAL/ }).click();
  await page.getByRole('button', { name: 'PRESERVE' }).click();
  await expectText(page, 'IN LOGBOOK');

  await page.getByRole('button', { name: /STAGE AUTHOR FIELD/ }).click();
  await page.getByRole('button', { name: 'EXECUTE RECORDED OUTCOME' }).click();
  await page.getByRole('button', { name: 'PLACE BRANCH' }).click();
  assert.equal(await page.getByRole('button', { name: /AUTHOR · 5 SIGNALS/ }).count(), 1);
  assert.deepEqual(errors, []);
  console.log('cockpit browser smoke passed: focus, command gate, pending placement, travel, account, preservation');
} finally {
  await browser?.close();
  await server.close();
}

async function expectText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor();
}
