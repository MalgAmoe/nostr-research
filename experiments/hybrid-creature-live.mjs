import { createNavigatorController } from '@nostrarium/controller';
import { createNodeJsonlTransport } from '@nostrarium/controller/node';
import { createAirlockComposer } from '@nostrarium/airlock-composer';
import { createPinballComposer } from '@nostrarium/pinball-composer';
import { createDarkroomComposer } from '@nostrarium/darkroom-composer';

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
  const airlock = createAirlockComposer({ controller });
  const pinball = createPinballComposer({ controller });
  const darkroom = createDarkroomComposer({ controller });

  // Airlock boards and protects the shared field.
  airlock.addQuestion('What dominates this field?');
  airlock.addQuestion('What survives when dominant traffic is contrasted with ordinary notes?');
  airlock.stageRoute({
    id: 'board',
    label: 'Acquire one shared universe',
    steps: [{
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
      resultId: 'hybrid-home',
    }],
  });
  const boarded = await airlock.executeNext('board');
  airlock.adopt(boarded, 'primary', 'shared hybrid Home');
  const weather = await airlock.observeWeather();

  // Pinball receives the same handle and reacts to its kind distribution.
  pinball.setTable(boarded, 'same protected field');
  const gravityQuestion = pinball.addCuriosity('Which kind creates the strongest gravity?');
  await pinball.fire({
    command: 'relate',
    input: 'hybrid-home',
    resultId: 'hybrid-rows',
  }, { curiosityId: gravityQuestion.id });
  await pinball.fire({
    command: 'aggregate',
    input: 'hybrid-rows',
    parameters: {
      by: [{ field: 'event.kind', name: 'kind' }],
      aggregations: [{ name: 'eventCount', operation: 'count' }],
    },
    resultId: 'hybrid-kinds',
  }, { curiosityId: gravityQuestion.id });
  await pinball.fire({
    command: 'sort',
    input: 'hybrid-kinds',
    parameters: {
      by: [{ field: 'eventCount', direction: 'descending' }],
    },
    resultId: 'hybrid-gravity',
  }, { curiosityId: gravityQuestion.id });
  const gravity = await controller.execute({
    command: 'show',
    input: 'hybrid-gravity',
    parameters: { mode: 'preview', previewLimit: 8 },
  });
  const gravityRows = (gravity.response.result?.preview ?? [])
    .map(({ values }) => values)
    .filter(Boolean);
  const dominantKind = gravityRows[0]?.kind;

  // Darkroom holds Pinball's row-space still and contrasts gravity with kind 1.
  darkroom.setGround({
    id: 'hybrid-rows',
    kind: 'relation',
    count: boarded.receipt.handle.count,
  }, 'Pinball row-space held still');
  const contrastQuestion = darkroom.addQuestion(
    `How does dominant kind ${dominantKind} differ in presence from kind 1?`,
  );
  const developed = await darkroom.develop({
    label: `kind ${dominantKind} / kind 1`,
    questionId: contrastQuestion.id,
    a: {
      command: 'filter',
      input: 'hybrid-rows',
      parameters: {
        where: { field: 'event.kind', equals: dominantKind },
        limit: 500,
      },
      resultId: 'hybrid-dominant',
    },
    b: {
      command: 'filter',
      input: 'hybrid-rows',
      parameters: {
        where: { field: 'event.kind', equals: 1 },
        limit: 500,
      },
      resultId: 'hybrid-kind-one',
    },
  });

  // Airlock keeps both exposures as references; Home remains unchanged.
  airlock.adopt(
    developed.outcomes.a,
    'reference',
    'dominant exposure from Darkroom',
  );
  airlock.adopt(
    developed.outcomes.b,
    'reference',
    'kind-1 exposure from Darkroom',
  );

  const [dominantPreview, notePreview] = await Promise.all([
    controller.execute({
      command: 'show',
      input: 'hybrid-dominant',
      parameters: { mode: 'preview', previewLimit: 3 },
    }),
    controller.execute({
      command: 'show',
      input: 'hybrid-kind-one',
      parameters: { mode: 'preview', previewLimit: 3 },
    }),
  ]);

  process.stdout.write(`${JSON.stringify({
    weather: weather.sensors.weather.language,
    gravity: gravityRows,
    pinball: {
      table: pinball.sensors().table,
      ball: pinball.sensors().momentum.ball,
      collisions: pinball.sensors().momentum.collisions.length,
    },
    darkroom: developed.negative,
    airlockAfterCombination: airlock.sensors().home,
    dominantPreview: excerpts(dominantPreview.response),
    kindOnePreview: excerpts(notePreview.response),
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
