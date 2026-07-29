import { createNavigatorController } from '@nostrarium/controller';
import { createNodeJsonlTransport } from '@nostrarium/controller/node';
import {
  createComparison,
  createNavigator,
  createQuestions,
  createReservoirs,
} from '@nostrarium/spacecraft-organs';

const transport = createNodeJsonlTransport({
  workingDirectory: process.cwd(),
  capacity: 1_000,
  archiveCapacity: 200,
  notebookCapacity: 200,
  responseTimeoutMs: 35_000,
});
const controller = createNavigatorController({
  request: transport.request,
  closeTransport: transport.close,
  transcript: { maxEntries: 100, maxBytes: 1_000_000 },
});

try {
  const navigator = createNavigator({ controller });
  const questions = createQuestions();
  const reservoirs = createReservoirs();
  const comparison = createComparison();

  reservoirs.create('gravity');
  reservoirs.create('anomaly');
  const fieldQuestion = questions.open('What machinery dominates this field?');
  const exitQuestion = questions.open('Does a rare kind escape that machinery?');

  const acquired = await controller.execute({
    command: 'acquire',
    parameters: {
      relays: [
        'wss://nos.lol',
        'wss://relay.primal.net',
        'wss://relay.snort.social',
      ],
      filter: { limit: 300 },
      timeoutMs: 12_000,
      observationLimit: 450,
      distinctEventLimit: 300,
      concurrency: 3,
    },
    resultId: 'organ-home',
  });
  navigator.attach(acquired, 'home', 'random shared field');
  navigator.attach(acquired, 'current', 'board');

  await navigator.execute({
    command: 'relate',
    input: 'organ-home',
    resultId: 'organ-rows',
  }, { result: 'current', reason: 'resolve event rows' });
  await navigator.execute({
    command: 'aggregate',
    input: 'organ-rows',
    parameters: {
      by: [{ field: 'event.kind', name: 'kind' }],
      aggregations: [{ name: 'eventCount', operation: 'count' }],
    },
    resultId: 'organ-kinds',
  }, { result: 'current', reason: 'kind distribution' });
  const sorted = await navigator.execute({
    command: 'sort',
    input: 'organ-kinds',
    parameters: {
      by: [{ field: 'eventCount', direction: 'descending' }],
    },
    resultId: 'organ-gravity-map',
  }, { result: 'current', reason: 'rank kind gravity' });
  questions.attach(fieldQuestion.id, sorted, 'mechanical kind distribution');

  const gravityPreview = await controller.execute({
    command: 'show',
    input: 'organ-gravity-map',
    parameters: { mode: 'preview', previewLimit: 15 },
  });
  const kinds = (gravityPreview.response.result?.preview ?? [])
    .map(({ values }) => values)
    .filter(Boolean);
  const dominantKind = kinds[0]?.kind;
  const familiar = new Set([0, 1, 3, 4, 5, 6, 7]);
  const rareKind = kinds
    .filter(({ kind }) => !familiar.has(kind) && kind !== dominantKind)
    .at(-1)?.kind;

  navigator.returnTo('organ-rows', 'branch from shared row-space');
  const dominant = await navigator.execute({
    command: 'filter',
    input: 'organ-rows',
    parameters: {
      where: { field: 'event.kind', equals: dominantKind },
      limit: 500,
    },
    resultId: 'organ-dominant',
  }, { result: 'alternative', reason: `dominant kind ${dominantKind}` });
  reservoirs.pull(
    'gravity',
    dominant,
    `dominant kind ${dominantKind}`,
    'working',
  );
  comparison.attach('A', dominant, 'dominant field');
  questions.attach(fieldQuestion.id, dominant, 'dominant specimen');

  const rare = await navigator.execute({
    command: 'filter',
    input: 'organ-rows',
    parameters: {
      where: { field: 'event.kind', equals: rareKind },
      limit: 500,
    },
    resultId: 'organ-rare',
  }, { result: 'current', reason: `inspect rare kind ${rareKind}` });
  reservoirs.pull('anomaly', rare, `rare kind ${rareKind}`, 'working');
  comparison.attach('B', rare, 'rare field');
  questions.attach(exitQuestion.id, rare, 'rare specimen');

  const [dominantPreview, rarePreview] = await Promise.all([
    controller.execute({
      command: 'show',
      input: 'organ-dominant',
      parameters: { mode: 'preview', previewLimit: 3 },
    }),
    controller.execute({
      command: 'show',
      input: 'organ-rare',
      parameters: { mode: 'preview', previewLimit: 3 },
    }),
  ]);

  process.stdout.write(`${JSON.stringify({
    kinds,
    navigation: navigator.state(),
    questions: questions.state(),
    reservoirs: reservoirs.state(),
    comparison: comparison.state(),
    dominantPreview: excerpts(dominantPreview.response),
    rarePreview: excerpts(rarePreview.response),
    commandCount: controller.transcript().retainedEntries,
  }, null, 2)}\n`);
} finally {
  await controller.close();
}

function excerpts(response) {
  return (response.result?.preview ?? []).map((item) => (
    item.values?.['event.text']
    ?? item.excerpt
    ?? item.subject?.id
    ?? null
  )).filter(Boolean);
}
