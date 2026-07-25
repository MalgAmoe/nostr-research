import { connect } from './vendor/database-wasm.js';
import { runScenario } from './scenario.js';

const output = document.querySelector('#output');

try {
  const eventCount = Number(new URLSearchParams(location.search).get('events')) || 100;
  const databasePath = `nostr-turso-portability-${eventCount}.sqlite`;
  const first = await runScenario(
    connect,
    databasePath,
    'browser-wasm-opfs',
    {
      eventCount,
      onProgress: (stage) => { output.textContent = `Running: ${stage}…`; },
    },
  );
  const reopened = await connect(databasePath);
  const persisted = {
    eventCount: Number((await reopened.get('SELECT COUNT(*) AS count FROM events')).count),
    setMemberCount: Number((await reopened.get(
      `SELECT COUNT(*) AS count
       FROM research_set_members
       WHERE set_id = 'portable-set'`,
    )).count),
    integrityCheck: (await reopened.get('PRAGMA integrity_check')).integrity_check,
  };
  await reopened.close();
  const result = { ok: true, ...first, reopened: persisted };
  output.textContent = JSON.stringify(result, null, 2);
  document.documentElement.dataset.status = 'passed';
} catch (error) {
  output.textContent = JSON.stringify({
    ok: false,
    name: error?.name,
    message: error?.message,
    stack: error?.stack,
  }, null, 2);
  document.documentElement.dataset.status = 'failed';
}
