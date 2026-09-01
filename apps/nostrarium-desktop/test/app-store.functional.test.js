import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { DesktopAppStore } from '../src/app-store.js';
import { seedStarterRecipes, STARTER_RECIPES } from '../src/starter-recipes.js';

test('desktop settings and JSON recipes survive application-store restarts', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'nostrarium-app-store-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'nostrarium.sqlite3');
  let clock = 100;
  const first = new DesktopAppStore({ file, now: () => clock++ });

  assert.equal(first.schemaVersion(), 1);
  assert.equal(first.setting('relayDefaults'), null);
  assert.deepEqual(first.setSetting('relayDefaults', ['wss://nos.lol']), {
    key: 'relayDefaults', value: ['wss://nos.lol'], updatedAt: 100,
  });
  const created = first.saveRecipe({
    id: 'profiles-from-events',
    name: 'Profiles from events',
    definition: {
      parameters: ['input', 'prefix'],
      steps: [
        {
          command: 'move', input: '${input}',
          parameters: { to: 'authors', limit: 100 }, resultId: '${prefix}-authors',
        },
      ],
    },
    originVoyageId: 'nostrarium-voyage-1',
  });
  assert.equal(created.revision, 1);
  assert.equal(created.createdAt, 101);
  assert.equal(created.updatedAt, 101);
  first.close();

  const second = new DesktopAppStore({ file, now: () => clock++ });
  assert.deepEqual(second.setting('relayDefaults')?.value, ['wss://nos.lol']);
  assert.equal(second.recipes().length, 1);
  assert.equal('definition' in second.recipes()[0], false);
  assert.equal(second.recipe('profiles-from-events')?.definition.steps[0].command, 'move');

  const revised = second.saveRecipe({
    id: 'profiles-from-events',
    name: 'Profiles from event authors',
    definition: { parameters: ['input'], steps: [{ command: 'move' }, { pause: true }] },
  });
  assert.equal(revised.revision, 2);
  assert.equal(revised.createdAt, 101);
  assert.equal(revised.updatedAt, 102);
  assert.equal(revised.originVoyageId, null);
  second.close();

  const third = new DesktopAppStore({ file });
  assert.equal(third.recipe('profiles-from-events')?.revision, 2);
  assert.deepEqual(third.deleteSetting('relayDefaults'), {
    key: 'relayDefaults', deleted: true,
  });
  assert.deepEqual(third.deleteRecipe('profiles-from-events'), {
    id: 'profiles-from-events', deleted: true,
  });
  assert.equal(third.recipe('profiles-from-events'), null);
  third.close();
});

test('the application store accepts bounded JSON but rejects ambiguous or unsafe records', () => {
  const store = new DesktopAppStore({ file: ':memory:' });

  assert.throws(() => store.setSetting('bad key', true), /unsupported characters/u);
  assert.throws(() => store.setSetting('huge', 'x'.repeat(70_000)), /exceeds 64000 bytes/u);
  assert.throws(() => store.saveRecipe({
    id: 'invalid', name: 'Invalid', definition: [],
  }), /definition must be an object/u);
  assert.throws(() => store.saveRecipe({
    id: 'invalid', name: 'Invalid', definition: { value: 1n },
  }), /JSON-serializable/u);
  assert.throws(() => store.setSetting('invalid-number', { value: Number.NaN }), /finite numbers/u);
  assert.throws(() => store.setSetting('invalid-object', { value: new Date() }), /JSON objects/u);
  assert.throws(() => store.setSetting('invalid-member', { value: undefined }), /JSON-serializable/u);

  store.close();
  store.close();
  assert.throws(() => store.settings(), /store is closed/u);
});

test('starter recipes seed once without overwriting navigator revisions', () => {
  const store = new DesktopAppStore({ file: ':memory:', now: () => 10 });
  try {
    assert.deepEqual(seedStarterRecipes(store), {
      seeded: STARTER_RECIPES.map(({ id }) => id),
      updated: [],
    });
    assert.equal(store.recipes().length, STARTER_RECIPES.length);
    store.saveRecipe({
      id: 'profile-descent', name: 'My revised descent',
      definition: { steps: [{ checkpoint: 'Navigator-owned revision.' }] },
      originVoyageId: 'user-voyage',
    });
    assert.deepEqual(seedStarterRecipes(store), { seeded: [], updated: [] });
    assert.equal(store.recipe('profile-descent').name, 'My revised descent');
    assert.equal(store.recipe('profile-descent').revision, 2);
  } finally {
    store.close();
  }
});

test('starter recipe upgrades replace only older application-owned seeds', () => {
  const store = new DesktopAppStore({ file: ':memory:', now: () => 20 });
  try {
    const current = STARTER_RECIPES.find(({ id }) => id === 'mention-frequency');
    const legacy = structuredClone(current);
    delete legacy.definition.starterRecipe;
    legacy.definition.steps.at(-1).parameters = {
      by: [{ field: 'mentionCount', direction: 'desc' }], limit: 1000,
    };
    store.saveRecipe({ ...legacy, originVoyageId: null });

    assert.deepEqual(seedStarterRecipes(store), {
      seeded: ['profile-descent', 'relay-confessional'],
      updated: ['mention-frequency'],
    });
    assert.deepEqual(
      store.recipe('mention-frequency').definition.steps.at(-1).parameters,
      { by: [{ field: 'mentionCount', direction: 'descending' }] },
    );
    assert.equal(store.recipe('mention-frequency').revision, 2);
  } finally {
    store.close();
  }
});
