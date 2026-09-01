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
  let exposedTools;
  let initialSystemPrompt;
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    emit: (event) => events.push(event),
  });

  faux.setResponses([
    (context, options) => {
      sessionIds.push(options?.sessionId);
      exposedTools = context.tools.map(({ name }) => name);
      initialSystemPrompt = context.systemPrompt;
      return fauxAssistantMessage(fauxToolCall('nostrarium', {
        intent: 'Establish whether the research session is ready.',
        command: 'status', parameters: {},
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
  assert.deepEqual(exposedTools, ['nostrarium', 'nostrarium_attention', 'nostrarium_recipes']);
  assert.match(initialSystemPrompt, /<nostrarium_agent_guide>/u);
  assert.match(initialSystemPrompt, /# Desktop navigator guide/u);
  assert.match(initialSystemPrompt, /## Predetermined command batches/u);
  assert.match(initialSystemPrompt, /## Discover commands without guessing/u);
  assert.match(initialSystemPrompt, /`show` uses `previewLimit`, not operation `limit`/u);
  assert.match(initialSystemPrompt, /It pages a fixed handle\s+order/u);
  assert.doesNotMatch(initialSystemPrompt, /npm run research-session/u);
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

test('one tool call can execute a transparent sequence of predetermined ordinary commands', async () => {
  const faux = fauxProvider();
  const events = [];
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    emit: (event) => events.push(event),
  });
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall('nostrarium', {
      intent: 'Create and inspect a small deterministic field without another research decision.',
      commands: [
        {
          intent: 'Create a bounded corpus view.',
          command: 'select', parameters: { scope: 'corpus', limit: 10 }, resultId: 'batch-field',
        },
        {
          intent: 'Take one deterministic sample from that view.',
          command: 'sample', input: 'batch-field', parameters: { limit: 1 }, resultId: 'batch-sample',
        },
        {
          intent: 'Observe the sample summary.',
          command: 'show', input: 'batch-sample', parameters: { mode: 'summary' },
        },
      ],
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage('The predetermined sequence completed in one model round.'),
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Run the already-decided setup and observation sequence.');

  const toolEnd = events.find((event) => event.type === 'tool-end');
  assert.equal(toolEnd?.isError, false);
  assert.deepEqual(toolEnd.result.details.batch, {
    requested: 3,
    executed: 3,
    stoppedOnFailure: false,
  });
  assert.deepEqual(
    toolEnd.result.details.executions.map(({ command, response }) => ({
      command: command.command,
      ok: response.ok,
    })),
    [
      { command: 'select', ok: true },
      { command: 'sample', ok: true },
      { command: 'show', ok: true },
    ],
  );
  assert.equal(runtime.state().research.transcript.retainedEntries, 3);
  assert.match(toolEnd.result.content[0].text, /"executions"/u);

  await runtime.close();
});

test('a transparent command sequence stops after its first failed response', async () => {
  const faux = fauxProvider();
  const events = [];
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    emit: (event) => events.push(event),
  });
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall('nostrarium', {
      intent: 'Verify that dependent predetermined commands do not run after failure.',
      commands: [
        { intent: 'Check the current state.', command: 'status' },
        { intent: 'Deliberately exercise a semantic failure.', command: 'does-not-exist' },
        { intent: 'This dependent command must not execute.', command: 'list' },
      ],
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage('The sequence stopped at the failed command.'),
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Exercise batch failure behavior.');

  const toolEnd = events.find((event) => event.type === 'tool-end');
  assert.deepEqual(toolEnd.result.details.batch, {
    requested: 3,
    executed: 2,
    stoppedOnFailure: true,
  });
  assert.equal(toolEnd.result.details.executions[1].response.ok, false);
  assert.equal(runtime.state().research.transcript.retainedEntries, 2);

  await runtime.close();
});

test('large command batches keep model and UI projections bounded while controller records remain complete', async () => {
  const faux = fauxProvider();
  const events = [];
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    emit: (event) => events.push(event),
  });
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall('nostrarium', {
      intent: 'Exercise projection bounds without hiding authoritative command records.',
      commands: Array.from({ length: 8 }, (_, index) => ({
        intent: `Inspect the complete contract copy ${index + 1}.`,
        command: 'schema', parameters: { detail: 'full' },
      })),
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage('The bounded batch projection remains recoverable from the controller.'),
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Exercise a deliberately large predetermined batch.');

  const toolEnd = events.find((event) => event.type === 'tool-end');
  const executions = toolEnd.result.details.executions;
  assert.equal(executions.length, 8);
  assert.match(toolEnd.result.content[0].text, /combined model projection exceeded 40000/u);
  assert.ok(executions.some(({ responseOmitted }) => (
    responseOmitted?.reason === 'batch-ui-details-bound'
  )));
  assert.ok(JSON.stringify(toolEnd.result.details).length < 81_000);
  for (const execution of executions) {
    const record = runtime.commandRecord(execution.receipt.commandId);
    assert.equal(record.available, true);
    assert.equal(record.entry.response.ok, true);
    assert.equal(record.entry.response.result.detail, 'full');
  }
  assert.equal(runtime.state().research.transcript.retainedEntries, 8);

  await runtime.close();
});

test('desktop-configured relay defaults initialize the same complete research runtime', async () => {
  const faux = fauxProvider();
  const events = [];
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    defaultRelays: ['wss://relay.example.com'],
    emit: (event) => events.push(event),
  });
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall('nostrarium', {
      intent: 'Confirm application-owned relay defaults reached the engine.',
      command: 'status', parameters: {},
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage('The configured relay field is active.'),
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Check the configured relay field.');

  const toolEnd = events.find((event) => event.type === 'tool-end');
  assert.deepEqual(toolEnd.result.details.response.result.configuration.relays, [
    'wss://relay.example.com/',
  ]);
  await runtime.close();
});

test('recipe memory stores agent-authored JSON without executing or narrowing research commands', async () => {
  const faux = fauxProvider();
  const events = [];
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    emit: (event) => events.push(event),
  });
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall('nostrarium_recipes', {
      intent: 'Retain a sequence that already proved reusable.',
      action: 'save',
      id: 'profiles-from-events',
      name: 'Profiles from events',
      definition: {
        purpose: 'Move from event evidence to profile candidates.',
        parameters: ['source', 'prefix'],
        steps: [
          {
            command: 'move', input: '$source',
            parameters: { to: 'authors', limit: 100 },
            resultId: '$prefix-authors',
          },
          { checkpoint: 'Inspect the authors before deciding whether to hydrate.' },
        ],
      },
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage(fauxToolCall('nostrarium_recipes', {
      intent: 'Confirm the retained pattern remains explicit rather than executable.',
      action: 'get', id: 'profiles-from-events',
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage('The recipe is stored as orientation only.'),
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Retain the proven sequence without executing it.');

  const recipeEnds = events.filter(({ type }) => type === 'tool-end');
  assert.equal(recipeEnds.length, 2);
  assert.equal(recipeEnds.every(({ toolName }) => toolName === 'nostrarium_recipes'), true);
  assert.equal(recipeEnds[0].result.details.recipe.revision, 1);
  assert.equal(recipeEnds[1].result.details.recipe.definition.steps[0].command, 'move');
  assert.equal(runtime.state().research.transcript.retainedEntries, 0);
  assert.equal(runtime.state().recipes.count, 1);

  await runtime.resetSession();
  assert.equal(runtime.state().recipes.count, 1);
  assert.equal(runtime.state().research.transcript.retainedEntries, 0);
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

test('the complete command tool pages a stable handle directly', async () => {
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
    fauxAssistantMessage(fauxToolCall('nostrarium', {
      intent: 'Inspect the second page without creating another handle.',
      command: 'show',
      input: 'notes',
      parameters: { mode: 'preview', offset: 5, previewLimit: 20 },
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage('The stable page is empty.'),
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Page the existing handle directly.');

  const showEnd = events.find((event) => (
    event.type === 'tool-end'
      && event.toolName === 'nostrarium'
      && event.result?.details?.command?.command === 'show'
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

test('the complete command tool returns visible stage facts for declarative plans', async () => {
  const faux = fauxProvider();
  const events = [];
  const runtime = createDesktopRuntime({
    credentials: new InMemoryCredentialStore(),
    providers: [faux.provider],
    emit: (event) => events.push(event),
  });
  faux.setResponses([
    fauxAssistantMessage(fauxToolCall('nostrarium', {
      intent: 'Execute two freely composed operations as one visible plan.',
      command: 'plan',
      plan: [
        { id: 'selected', operation: 'select', parameters: { scope: 'corpus', limit: 10 } },
        { id: 'sampled', operation: 'sample', input: 'selected', parameters: { limit: 1 } },
      ],
      outputs: { selected: 'notes', sampled: 'sampled' },
    }), { stopReason: 'toolUse' }),
    fauxAssistantMessage('Both plan stages and their ordinary handles are visible.'),
  ]);

  await runtime.selectModel(faux.provider.id, faux.getModel().id);
  await runtime.prompt('Exercise the complete command route.');

  const planEnd = events.find((event) => event.type === 'tool-end');
  assert.equal(planEnd?.toolName, 'nostrarium');
  assert.equal(planEnd?.isError, false);
  assert.equal(planEnd.result.details.response.result.type, 'research-plan-report');
  assert.deepEqual(
    planEnd.result.details.response.result.stages.map(({ id, operation }) => ({ id, operation })),
    [{ id: 'selected', operation: 'select' }, { id: 'sampled', operation: 'sample' }],
  );
  assert.equal(planEnd.result.details.response.result.stages[0].handle.id, 'notes');
  assert.equal(planEnd.result.details.response.result.stages[1].handle.id, 'sampled');
  assert.match(planEnd.result.content[0].text, /"stages"/u);
  assert.equal(runtime.state().research.transcript.retainedEntries, 1);

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
