import { createNavigatorController } from '@nostrarium/controller';
import { createNodeJsonlTransport } from '@nostrarium/controller/node';
import {
  createCockAndBallsComposer,
} from '@nostrarium/cock-and-balls-composer';

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
  const body = createCockAndBallsComposer({ controller });
  body.nameBall('left', 'gravity');
  body.nameBall('right', 'anomaly');

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
    resultId: 'body-root',
  });
  body.setRoot(acquired, 'random field');
  await body.thrust({
    command: 'relate',
    input: 'body-root',
    resultId: 'body-rows',
  });
  await body.thrust({
    command: 'aggregate',
    input: 'body-rows',
    parameters: {
      by: [{ field: 'event.kind', name: 'kind' }],
      aggregations: [{ name: 'eventCount', operation: 'count' }],
    },
    resultId: 'body-kinds',
  });
  await body.thrust({
    command: 'sort',
    input: 'body-kinds',
    parameters: {
      by: [{ field: 'eventCount', direction: 'descending' }],
    },
    resultId: 'body-gravity-map',
  });
  const distribution = await controller.execute({
    command: 'show',
    input: 'body-gravity-map',
    parameters: { mode: 'preview', previewLimit: 15 },
  });
  const kinds = (distribution.response.result?.preview ?? [])
    .map(({ values }) => values)
    .filter(Boolean);
  const dominantKind = kinds[0]?.kind;
  const familiar = new Set([0, 1, 3, 4, 5, 6, 7]);
  const anomalousKind = kinds
    .filter(({ kind }) => !familiar.has(kind) && kind !== dominantKind)
    .at(-1)?.kind;

  // The row-space is the first landing after the root.
  body.retract(1);
  await body.thrust({
    command: 'filter',
    input: 'body-rows',
    parameters: {
      where: { field: 'event.kind', equals: dominantKind },
      limit: 500,
    },
    resultId: 'left-gravity',
  });
  body.pull('left', `dominant kind ${dominantKind}`);

  body.retract(1);
  await body.thrust({
    command: 'filter',
    input: 'body-rows',
    parameters: {
      where: { field: 'event.kind', equals: anomalousKind },
      limit: 500,
    },
    resultId: 'right-anomaly',
  });
  body.pull('right', `unfamiliar kind ${anomalousKind}`);

  const [left, right] = await Promise.all([
    controller.execute({
      command: 'show',
      input: 'left-gravity',
      parameters: { mode: 'preview', previewLimit: 3 },
    }),
    controller.execute({
      command: 'show',
      input: 'right-anomaly',
      parameters: { mode: 'preview', previewLimit: 3 },
    }),
  ]);

  process.stdout.write(`${JSON.stringify({
    distribution: kinds,
    anatomy: body.sensors(),
    leftPreview: excerpts(left.response),
    rightPreview: excerpts(right.response),
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
