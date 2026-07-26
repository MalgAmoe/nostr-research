import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '../../../packages/nostr-research/src/index.js';

const memory = createInMemoryResearchMemory({ capacity: 30 });
const session = createDeclarativeResearchSession(memory);
const run = (command) => session.execute(command);

try {
  const acquired = await run({
    commandId: 'acquire',
    command: 'acquire',
    parameters: {
      relays: ['wss://nos.lol/', 'wss://relay.damus.io/'],
      filter: { kinds: [1], limit: 30 },
      timeoutMs: 12_000,
      observationLimit: 50,
      distinctEventLimit: 40,
      concurrency: 2,
    },
    resultId: 'buffer',
  });
  await run({
    commandId: 'working-buffer',
    command: 'select',
    input: 'buffer',
    parameters: { kinds: [1], limit: 30 },
    resultId: 'working-buffer',
  });
  const orientation = await run({
    commandId: 'orientation',
    command: 'show',
    input: 'working-buffer',
    parameters: { previewLimit: 5, excerptLimit: 100 },
  });
  if (!acquired.ok || !orientation.ok || orientation.result.count === 0) {
    console.log(JSON.stringify({ acquired, orientation }));
    process.exitCode = 2;
  } else {
    await run({
      commandId: 'authors',
      command: 'move',
      input: 'working-buffer',
      parameters: { to: 'authors', limit: 30 },
      resultId: 'authors',
    });
    const accounts = await run({
      commandId: 'account-view',
      command: 'show',
      input: 'authors',
      parameters: { previewLimit: 5, excerptLimit: 100 },
    });

    const tag = [
      ...orientation.result.orientation.facets.tags.tail,
      ...orientation.result.orientation.facets.tags.values,
    ].find(({ name }) => name === 't')?.value;
    const narrowed = tag
      ? await run({
        commandId: 'topic',
        command: 'filter',
        input: 'working-buffer',
        parameters: {
          where: { field: 'event.tag', name: 't', value: tag },
          limit: 30,
        },
        resultId: 'topic',
      })
      : null;
    const topic = narrowed?.ok
      ? await run({
        commandId: 'topic-view',
        command: 'show',
        input: 'topic',
        parameters: { previewLimit: 5, excerptLimit: 100 },
      })
      : null;
    const comparison = narrowed?.ok
      ? await run({
        commandId: 'compare',
        command: 'compare',
        input: 'working-buffer',
        parameters: { with: 'topic', limit: 30 },
        resultId: 'comparison',
      })
      : null;
    const comparisonView = comparison?.ok
      ? await run({
        commandId: 'comparison-view',
        command: 'show',
        input: 'comparison',
        parameters: { previewLimit: 3, excerptLimit: 100 },
      })
      : null;

    const acquisitionValue = memory.select({ kinds: [1], limit: 1000 });
    const threaded = acquisitionValue.items.find(({ record }) => (
      record.event.tags.some((item) => item[0] === 'e' && item[1])
    )) ?? acquisitionValue.items[0];
    let conversation = null;
    let conversationContinuation = null;
    if (threaded) {
      await run({
        commandId: 'thread-seed',
        command: 'select',
        parameters: { scope: 'corpus', ids: [threaded.subject.id] },
        resultId: 'thread-seed',
      });
      conversationContinuation = await run({
        commandId: 'conversation',
        command: 'continue',
        input: 'thread-seed',
        parameters: {
          relationship: 'conversation',
          source: 'relays',
          relays: ['wss://nos.lol/', 'wss://relay.damus.io/'],
          depth: 2,
          eventLimit: 20,
          timeoutMs: 8_000,
          observationLimit: 20,
          distinctEventLimit: 20,
          concurrency: 2,
        },
        resultId: 'conversation',
      });
      if (conversationContinuation.ok) {
        conversation = await run({
          commandId: 'conversation-view',
          command: 'show',
          input: 'conversation',
          parameters: { previewLimit: 5, excerptLimit: 100 },
        });
      }
    }

    const status = await run({
      commandId: 'status',
      command: 'status',
      parameters: {},
    });
    console.log(JSON.stringify({
      acquisition: {
        ok: acquired.ok,
        handle: acquired.result.handle,
        external: acquired.result.external,
      },
      orientation: orientation.result.orientation,
      accountView: accounts.result.orientation,
      chosenTag: tag ?? null,
      topicView: topic?.result?.orientation ?? null,
      conversationContinuation,
      conversationView: conversation?.result?.orientation
        ?? conversationContinuation?.result?.preview?.orientation
        ?? null,
      comparisonView: comparisonView?.result ?? null,
      corpus: status.result.corpus,
    }));
  }
} finally {
  await session.close();
}
