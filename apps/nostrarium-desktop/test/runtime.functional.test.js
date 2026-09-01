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
  const sessionIds = [];
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    emit: (event) => events.push(event),
  });

  faux.setResponses([
    (_context, options) => {
      sessionIds.push(options?.sessionId);
      return fauxAssistantMessage(fauxToolCall('nostrarium_handles', {
        intent: 'Establish whether the research session is ready.',
        action: 'status',
      }), { stopReason: 'toolUse' });
    },
    (_context, options) => {
      sessionIds.push(options?.sessionId);
      return fauxAssistantMessage('The session is open and empty.');
    },
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Check the research session.');

  const toolEnd = events.find((event) => event.type === 'tool-end');
  assert.equal(toolEnd?.isError, false);
  assert.equal(
    toolEnd?.result?.details?.intent,
    'Establish whether the research session is ready.',
  );
  assert.equal(toolEnd?.result?.details?.command?.command, 'status');
  assert.equal('intent' in toolEnd?.result?.details?.command, false);
  assert.equal(toolEnd?.result?.details?.response?.ok, true);
  assert.equal(toolEnd?.result?.details?.receipt?.ok, true);
  assert.deepEqual(toolEnd?.result?.details?.response?.result?.configuration?.relays, [
    'wss://nos.lol/',
    'wss://relay.primal.net/',
    'wss://relay.snort.social/',
  ]);
  assert.equal(sessionIds.length, 2);
  assert.equal(sessionIds[0], sessionIds[1]);
  assert.match(sessionIds[0], /^nostrarium-/);
  assert.ok(events.some((event) => event.type === 'message-delta'));
  assert.ok(events.some((event) => (
    event.type === 'message'
      && event.message.role === 'assistant'
      && event.message.text === 'The session is open and empty.'
  )));
  assert.equal(runtime.state().research.transcript.retainedEntries, 1);
  const record = runtime.commandRecord(toolEnd.result.details.receipt.commandId);
  assert.equal(record.available, true);
  assert.equal(record.entry.command.command, 'status');
  assert.deepEqual(record.entry.response.result.configuration.relays, [
    'wss://nos.lol/',
    'wss://relay.primal.net/',
    'wss://relay.snort.social/',
  ]);

  await runtime.close();
});

test('ordinary voyages retain complete model-visible tool history without count-based compaction', async () => {
  const faux = fauxProvider();
  let finalContext;
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
  });
  const responses = [];
  for (let index = 0; index < 8; index += 1) {
    responses.push(() => fauxAssistantMessage(fauxToolCall('nostrarium', {
      intent: `Inspect the public contract, pass ${index + 1}.`,
      command: 'schema',
      parameters: {},
    }), { stopReason: 'toolUse' }));
  }
  responses.push((context) => {
    finalContext = { messages: structuredClone(context.messages) };
    return fauxAssistantMessage('The controlled sequence is complete.');
  });
  faux.setResponses(responses);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Run the controlled schema sequence.');

  const toolResults = finalContext.messages.filter(({ role }) => role === 'toolResult');
  assert.equal(toolResults.length, 8);
  assert.equal(toolResults.every(({ content }) => (
    !content[0].text.includes('nostrarium-voyage-checkpoint')
  )), true);
  assert.equal(finalContext.messages.some(({ content }) => (
    Array.isArray(content)
      && content.some((part) => part.type === 'text'
        && part.text.includes('<nostrarium_voyage_context>'))
  )), false);
  assert.equal(runtime.state().research.transcript.retainedEntries, 8);

  await runtime.close();
});

test('the informed observation tool pages a stable handle without schema discovery', async () => {
  const faux = fauxProvider();
  const events = [];
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    emit: (event) => events.push(event),
  });
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall('nostrarium', {
      intent: 'Create an empty but stable event position.',
      command: 'select',
      parameters: { scope: 'corpus', limit: 10 },
      resultId: 'notes',
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage(fauxToolCall('nostrarium_show', {
      intent: 'Inspect the second page without creating another handle.',
      input: 'notes',
      mode: 'preview',
      offset: 5,
      previewLimit: 20,
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage('The stable page is empty.'),
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Page the existing handle directly.');

  const showEnd = events.find((event) => (
    event.type === 'tool-end' && event.toolName === 'nostrarium_show'
  ));
  assert.equal(showEnd?.isError, false);
  assert.deepEqual(showEnd.result.details.command, {
    command: 'show',
    input: 'notes',
    parameters: { mode: 'preview', offset: 5, previewLimit: 20 },
  });
  assert.equal(runtime.state().research.transcript.retainedEntries, 2);

  await runtime.close();
});

test('the schema-backed action tool retrieves its contract internally and executes one visible research command', async () => {
  const faux = fauxProvider();
  const events = [];
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    emit: (event) => events.push(event),
  });
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall('nostrarium', {
      intent: 'Create a bounded local event position.',
      command: 'select',
      parameters: { scope: 'corpus', limit: 10 },
      resultId: 'notes',
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage(fauxToolCall('nostrarium_action', {
      intent: 'Take one reproducible bounded sample from the position.',
      input: 'notes',
      operation: 'sample',
      parameters: { limit: 1 },
      resultId: 'sampled',
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage('The compiled sample is available.'),
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Exercise the schema-backed route.');

  const actionEnd = events.find((event) => (
    event.type === 'tool-end' && event.toolName === 'nostrarium_action'
  ));
  assert.equal(actionEnd?.isError, false);
  assert.deepEqual(actionEnd.result.details.command, {
    command: 'sample',
    input: 'notes',
    parameters: { limit: 1 },
    resultId: 'sampled',
  });
  assert.equal(
    actionEnd.result.details.composition.compiler,
    '@nostrarium/schema-composer',
  );
  assert.equal(actionEnd.result.details.composition.contract, 'notes:sample');
  assert.equal(actionEnd.result.details.composition.contractLookup.cached, false);
  assert.match(
    actionEnd.result.details.composition.contractLookup.commandId,
    /^navigator-/u,
  );
  assert.equal(runtime.state().research.transcript.retainedEntries, 3);
  const record = runtime.commandRecord(actionEnd.result.details.receipt.commandId);
  assert.equal(record.entry.command.command, 'sample');
  assert.equal(record.entry.command.input, 'notes');
  assert.equal(record.entry.command.resultId, 'sampled');

  await runtime.close();
});

test('the focused contract tool exposes compact dynamic controls without executing research movement', async () => {
  const faux = fauxProvider();
  const events = [];
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    emit: (event) => events.push(event),
  });
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall('nostrarium', {
      intent: 'Create a stable empty collection for contract inspection.',
      command: 'select', parameters: { scope: 'corpus', limit: 10 }, resultId: 'notes',
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage(fauxToolCall('nostrarium_contract', {
      intent: 'Learn the exact current sampling bounds before constructing it.',
      input: 'notes', operation: 'sample',
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage('The focused sample contract is available.'),
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Inspect one dynamic contract without moving through the field.');

  const contractEnd = events.find((event) => (
    event.type === 'tool-end' && event.toolName === 'nostrarium_contract'
  ));
  assert.equal(contractEnd?.isError, false);
  assert.equal(contractEnd.result.details.command.command, 'schema');
  assert.equal(contractEnd.result.details.contract.type, 'command-composition');
  assert.equal(contractEnd.result.details.contract.operation, 'sample');
  assert.match(contractEnd.result.content[0].text, /"command-composition"/u);
  assert.equal(runtime.state().research.transcript.retainedEntries, 2);

  await runtime.close();
});

test('temporary voyage attention stays outside research state and clears on reset', async () => {
  const faux = fauxProvider();
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
  });
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall('nostrarium', {
      intent: 'Create one ordinary handle that can anchor temporary working state.',
      command: 'select', parameters: { scope: 'corpus', limit: 10 }, resultId: 'seed-field',
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage(fauxToolCall('nostrarium_attention', {
      intent: 'Retain the initial research position in an organization chosen for this voyage.',
      action: 'put', key: 'starting-position',
      value: { handle: 'seed-field', reason: 'Initial local field for this voyage.' },
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage(fauxToolCall('nostrarium_attention', {
      intent: 'Keep the unresolved lines of inquiry visible.',
      action: 'put', key: 'working-lines',
      value: [{ question: 'Which identities deserve a closer look?', source: { handle: 'seed-field' } }],
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage(fauxToolCall('nostrarium_attention', {
      intent: 'Retain the current candidate without imposing a universal focus concept.',
      action: 'put', key: 'candidate-under-examination',
      value: {
        subject: { type: 'account', id: 'a'.repeat(64) },
        reason: 'Current subject under examination.',
      },
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage('The temporary voyage position is explicit.'),
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Establish a temporary attention state.');

  const beforeReset = runtime.state();
  assert.equal(beforeReset.research.transcript.retainedEntries, 1);
  assert.equal(beforeReset.attention.entries['starting-position'].handle, 'seed-field');
  assert.equal(beforeReset.attention.entries['working-lines'].length, 1);
  assert.equal(
    beforeReset.attention.entries['candidate-under-examination'].subject.id,
    'a'.repeat(64),
  );
  assert.equal(beforeReset.attention.entryCount, 3);
  assert.deepEqual(beforeReset.attention.keys, [
    'starting-position', 'working-lines', 'candidate-under-examination',
  ]);

  await runtime.resetSession();
  assert.deepEqual(runtime.state().attention, {
    entries: {},
    entryCount: 0,
    totalBytes: 0,
    keys: [],
    limits: { entries: 12, entryBytes: 4_000, totalBytes: 24_000 },
  });

  await runtime.close();
});

test('a failed internal contract lookup executes no requested research operation', async () => {
  const faux = fauxProvider();
  const events = [];
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    emit: (event) => events.push(event),
  });
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall('nostrarium_action', {
      intent: 'Attempt a handle operation without inspecting its contract.',
      input: 'missing',
      operation: 'scan',
      parameters: { fields: ['event.text'], terms: ['privacy'] },
      resultId: 'matches',
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage('The action was not executed because its input handle was absent.'),
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Try the unprepared action.');

  const actionEnd = events.find((event) => (
    event.type === 'tool-end' && event.toolName === 'nostrarium_action'
  ));
  assert.equal(actionEnd?.isError, true);
  assert.match(actionEnd.result.content[0].text, /Focused scan contract lookup failed: UNKNOWN_RESULT/u);
  assert.equal(runtime.state().research.transcript.retainedEntries, 1);

  await runtime.close();
});

test('the schema-backed action tool rejects values outside a loaded contract before execution', async () => {
  const faux = fauxProvider();
  const events = [];
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    emit: (event) => events.push(event),
  });
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall('nostrarium', {
      intent: 'Create the position to test.',
      command: 'select',
      parameters: { scope: 'corpus', limit: 10 },
      resultId: 'notes',
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage(fauxToolCall('nostrarium_action', {
      intent: 'Try an unadvertised sample option.',
      input: 'notes',
      operation: 'sample',
      parameters: { limit: 1, seed: 7 },
      resultId: 'sampled',
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage('The invalid command was rejected before execution.'),
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Verify contract enforcement.');

  const actionEnd = events.find((event) => (
    event.type === 'tool-end' && event.toolName === 'nostrarium_action'
  ));
  assert.equal(actionEnd?.isError, true);
  assert.match(actionEnd.result.content[0].text, /seed must be a non-empty string/u);
  assert.match(actionEnd.result.content[0].text, /Accepted parameters for sample/u);
  assert.equal(runtime.state().research.transcript.retainedEntries, 2);

  await runtime.close();
});

test('releasing a handle also releases its retained focused contracts', async () => {
  const faux = fauxProvider();
  const events = [];
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    emit: (event) => events.push(event),
  });
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall('nostrarium', {
      intent: 'Create a temporary position.',
      command: 'select',
      parameters: { scope: 'corpus', limit: 10 },
      resultId: 'temporary',
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage(fauxToolCall('nostrarium', {
      intent: 'Load a focused contract for the temporary position.',
      command: 'schema',
      input: 'temporary',
      parameters: { operation: 'sample' },
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage(fauxToolCall('nostrarium', {
      intent: 'Release the temporary position.',
      command: 'release',
      input: 'temporary',
      parameters: {},
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage(fauxToolCall('nostrarium_action', {
      intent: 'Verify that the released position has no retained contract.',
      input: 'temporary',
      operation: 'sample',
      parameters: { limit: 1 },
      resultId: 'sampled',
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage('The released contract cannot be reused.'),
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Exercise focused-contract lifecycle cleanup.');

  const actionEnd = events.find((event) => (
    event.type === 'tool-end' && event.toolName === 'nostrarium_action'
  ));
  assert.equal(actionEnd?.isError, true);
  assert.match(actionEnd.result.content[0].text, /Focused sample contract lookup failed: UNKNOWN_RESULT/u);
  assert.equal(runtime.state().research.transcript.retainedEntries, 4);

  await runtime.close();
});

test('real context pressure creates a factual voyage checkpoint and preserves recent complete turns', async () => {
  const faux = fauxProvider();
  let finalContext;
  const observedContexts = [];
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    contextTokenLimit: 1_000,
  });
  const requests = [{
    intent: 'Learn the exact acquisition contract before operating.',
    command: 'schema',
    parameters: { operation: 'acquire' },
  }];
  for (let index = 0; index < 10; index += 1) {
    requests.push({
      intent: `Check session orientation after step ${index + 1}.`,
      command: 'status',
      parameters: {},
    });
  }
  faux.setResponses([
    () => fauxAssistantMessage(fauxToolCall('nostrarium_attention', {
      intent: 'Keep the pressure-test question explicit across compaction.',
      action: 'put',
      key: 'pressure-test',
      value: { question: 'Does temporary attention survive a factual voyage checkpoint?' },
    }), { stopReason: 'toolUse' }),
    ...requests.map((request) => (context) => {
      observedContexts.push(structuredClone(context.messages));
      return fauxAssistantMessage(
        fauxToolCall('nostrarium', request),
        { stopReason: 'toolUse' },
      );
    }),
    (context) => {
      finalContext = { messages: structuredClone(context.messages) };
      observedContexts.push(structuredClone(context.messages));
      return fauxAssistantMessage('The pressure test is complete.');
    },
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Run a voyage long enough to require a checkpoint.');

  const checkpoint = finalContext.messages.find(({ role, content }) => (
    role === 'user'
      && Array.isArray(content)
      && content.some((part) => part.type === 'text'
        && part.text.includes('<nostrarium_voyage_context>'))
  ));
  assert.ok(checkpoint);
  const checkpointText = checkpoint.content[0].text;
  assert.ok(checkpointText.length <= 48_000);
  assert.match(checkpointText, /nostrarium-voyage-checkpoint/);
  assert.match(checkpointText, /Learn the exact acquisition contract/);
  assert.match(checkpointText, /Does temporary attention survive a factual voyage checkpoint/);
  assert.match(checkpointText, /relevantOperationContracts/);
  assert.match(checkpointText, /"name":"acquire"/);
  assert.ok(finalContext.messages.some(({ role }) => role === 'toolResult'));
  assert.ok(finalContext.messages.length < (requests.length * 2) + 2);
  const firstCheckpoint = observedContexts.findIndex(hasVoyageCheckpoint);
  assert.notEqual(firstCheckpoint, -1);
  assert.equal(observedContexts.slice(firstCheckpoint).every(hasVoyageCheckpoint), true);
  assert.equal(runtime.state().research.transcript.retainedEntries, requests.length);
  assert.equal(runtime.state().agent.checkpointActive, true);

  await runtime.close();
});

function hasVoyageCheckpoint(messages) {
  return messages.some(({ role, content }) => (
    role === 'user'
      && Array.isArray(content)
      && content.some((part) => part.type === 'text'
        && part.text.includes('<nostrarium_voyage_context>'))
  ));
}
