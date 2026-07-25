import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { connect } from '@tursodatabase/database';
import { runScenario } from './scenario.js';

const databasePath = resolve('native-spike.sqlite');
await rm(databasePath, { force: true });
await rm(`${databasePath}-wal`, { force: true });

const first = await runScenario(connect, databasePath, 'node-native');
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

console.log(JSON.stringify({ ...first, reopened: persisted }, null, 2));
