import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InMemoryCredentialStore,
  fauxAssistantMessage,
  fauxToolCall,
} from '@earendil-works/pi-ai';
import { fauxProvider } from '@earendil-works/pi-ai/providers/faux';
import { createDesktopRuntime } from '../src/runtime.js';

test('an embedded agent operates one persistent research session through the visible tool', async () => {
  const faux = fauxProvider();
  const events = [];
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    emit: (event) => events.push(event),
  });

  faux.setResponses([
    fauxAssistantMessage(
      fauxToolCall('nostrarium', { command: 'status', parameters: {} }),
      { stopReason: 'toolUse' },
    ),
    fauxAssistantMessage('The session is open and empty.'),
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Check the research session.');

  const toolEnd = events.find((event) => event.type === 'tool-end');
  assert.equal(toolEnd?.isError, false);
  assert.equal(toolEnd?.result?.details?.command?.command, 'status');
  assert.equal(toolEnd?.result?.details?.response?.ok, true);
  assert.equal(toolEnd?.result?.details?.receipt?.ok, true);
  assert.ok(events.some((event) => (
    event.type === 'message'
      && event.message.role === 'assistant'
      && event.message.text === 'The session is open and empty.'
  )));
  assert.equal(runtime.state().research.transcript.retainedEntries, 1);

  await runtime.close();
});
