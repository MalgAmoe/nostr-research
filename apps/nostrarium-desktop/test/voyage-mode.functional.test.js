import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseVoyageArguments,
  selectVoyageModel,
} from '../src/voyage-mode.js';

test('voyage mode defaults to the signed-in Sol model', () => {
  const options = parseVoyageArguments(['--prompt', 'Explore a random field.']);
  assert.equal(options.provider, 'openai-codex');
  assert.equal(options.model, 'gpt-5.6-sol');

  assert.deepEqual(selectVoyageModel([{
    id: 'openai-codex',
    auth: { type: 'oauth' },
    models: [{ id: 'gpt-5.6-sol' }, { id: 'gpt-5.6-terra' }],
  }], options.provider, options.model), {
    providerId: 'openai-codex',
    modelId: 'gpt-5.6-sol',
  });
});

test('voyage mode never silently falls back from Sol', () => {
  assert.throws(() => selectVoyageModel([{
    id: 'openai-codex',
    auth: { type: 'oauth' },
    models: [{ id: 'gpt-5.6-terra' }],
  }], 'openai-codex', 'gpt-5.6-sol'), /No fallback model was selected/);
});

test('voyage mode requires an existing desktop login', () => {
  assert.throws(() => selectVoyageModel([{
    id: 'openai-codex',
    auth: null,
    models: [{ id: 'gpt-5.6-sol' }],
  }], 'openai-codex', 'gpt-5.6-sol'), /not signed in/);
});

test('voyage mode accepts either a prompt or a readiness check', () => {
  assert.equal(parseVoyageArguments(['--check']).check, true);
  assert.throws(() => parseVoyageArguments([]), /requires --prompt/);
  assert.throws(() => parseVoyageArguments([
    '--prompt', 'one', '--prompt-file', 'two.txt',
  ]), /either --prompt or --prompt-file/);
  assert.equal(parseVoyageArguments([
    '--check', '--context-token-limit', '8000',
  ]).contextTokenLimit, 8_000);
  assert.throws(() => parseVoyageArguments([
    '--check', '--context-token-limit', '999',
  ]), /at least 1000/);
});
