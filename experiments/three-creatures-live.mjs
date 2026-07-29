import { createNavigatorController } from '@nostrarium/controller';
import { createNodeJsonlTransport } from '@nostrarium/controller/node';
import { createAirlockComposer } from '@nostrarium/airlock-composer';
import { createPinballComposer } from '@nostrarium/pinball-composer';
import { createDarkroomComposer } from '@nostrarium/darkroom-composer';

const RELAYS = [
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
];

const results = [];
results.push(await flyAirlock());
results.push(await flyPinball());
results.push(await flyDarkroom());
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);

async function flyAirlock() {
  return withController(async (controller) => {
    const airlock = createAirlockComposer({ controller });
    airlock.addQuestion('What kind of field did the relays hand me?');
    airlock.addQuestion('Which entrance feels alive rather than merely loud?');
    airlock.stageRoute({
      id: 'boarding',
      label: 'Board without deciding where this should lead',
      steps: [{
        command: 'acquire',
        parameters: acquisition({ limit: 220 }),
        resultId: 'airlock-field',
      }],
    });
    const acquired = await airlock.executeNext('boarding');
    airlock.adopt(acquired, 'primary', 'chosen safe field');
    const weather = await airlock.observeWeather();
    airlock.stageRoute({
      id: 'entrances',
      label: 'Open five deterministic entrances',
      steps: [{
        command: 'sample',
        input: 'airlock-field',
        parameters: { limit: 5, seed: 'airlock-entrances' },
        resultId: 'airlock-entrances',
      }],
    });
    const entrances = await airlock.executeNext('entrances');
    const preview = await controller.execute({
      command: 'show',
      input: 'airlock-entrances',
      parameters: { mode: 'preview', previewLimit: 5 },
    });
    return {
      creature: 'Airlock',
      character: 'deliberate routes around a protected Home',
      home: airlock.sensors().home,
      questions: airlock.sensors().questions.map(({ text }) => text),
      weather: weather.sensors.weather.language,
      entranceCount: entrances.receipt.handle?.count ?? null,
      excerpts: eventExcerpts(preview.response),
      commands: controller.transcript().retainedEntries,
    };
  });
}

async function flyPinball() {
  return withController(async (controller) => {
    const pinball = createPinballComposer({ controller });
    const acquire = await pinball.fire({
      command: 'acquire',
      parameters: acquisition({ limit: 280 }),
      resultId: 'pinball-field',
    });
    pinball.setTable(acquire, 'protected table');
    const curiosity = pinball.addCuriosity('What kind keeps knocking the ball around?');
    await pinball.fire({
      command: 'relate',
      input: 'pinball-field',
      resultId: 'pinball-rows',
    }, { curiosityId: curiosity.id });
    await pinball.fire({
      command: 'aggregate',
      input: 'pinball-rows',
      parameters: {
        by: [{ field: 'event.kind', name: 'kind' }],
        aggregations: [{ name: 'eventCount', operation: 'count' }],
      },
      resultId: 'pinball-kinds',
    }, { curiosityId: curiosity.id });
    const sorted = await pinball.fire({
      command: 'sort',
      input: 'pinball-kinds',
      parameters: {
        by: [{ field: 'eventCount', direction: 'descending' }],
      },
      resultId: 'pinball-kind-gravity',
    }, { curiosityId: curiosity.id });
    const preview = await controller.execute({
      command: 'show',
      input: 'pinball-kind-gravity',
      parameters: { mode: 'preview', previewLimit: 12 },
    });
    const familiarKinds = new Set([0, 1, 3, 4, 5, 6, 7]);
    const oddKind = relationValues(preview.response)
      .filter((values) => values && !familiarKinds.has(values.kind))
      .at(-1)?.kind;
    let oddLanding = null;
    if (Number.isSafeInteger(oddKind)) {
      const oddity = pinball.addCuriosity(`What is kind ${oddKind} doing here?`);
      await pinball.fire({
        command: 'filter',
        input: 'pinball-rows',
        parameters: {
          where: { field: 'event.kind', equals: oddKind },
          limit: 100,
        },
        resultId: 'pinball-odd-kind',
      }, { curiosityId: oddity.id });
      oddLanding = await controller.execute({
        command: 'show',
        input: 'pinball-odd-kind',
        parameters: { mode: 'preview', previewLimit: 4 },
      });
    }
    return {
      creature: 'Pinball',
      character: 'one collision at a time; successful handles move the ball',
      table: pinball.sensors().table,
      ball: pinball.sensors().momentum.ball,
      curiosity: pinball.sensors().curiosities[0],
      collisions: pinball.sensors().momentum.collisions.map(
        ({ command, landed }) => ({ command, landed }),
      ),
      kindGravity: relationValues(preview.response),
      oddKind,
      oddLanding: oddLanding ? relationValues(oddLanding.response) : [],
      finalCount: sorted.receipt.handle?.count ?? null,
      commands: controller.transcript().retainedEntries,
    };
  });
}

async function flyDarkroom() {
  return withController(async (controller) => {
    const acquired = await controller.execute({
      command: 'acquire',
      parameters: acquisition({ kinds: [1], limit: 260 }),
      resultId: 'darkroom-field',
    });
    const rows = await controller.execute({
      command: 'relate',
      input: 'darkroom-field',
      resultId: 'darkroom-ground',
    });
    const darkroom = createDarkroomComposer({ controller });
    darkroom.setGround(rows, 'same note field for both exposures');
    const question = darkroom.addQuestion(
      'What changes when this field is exposed through media rather than no media?',
    );
    const developed = await darkroom.develop({
      label: 'media / no-media',
      questionId: question.id,
      a: {
        command: 'filter',
        input: 'darkroom-ground',
        parameters: {
          where: { field: 'event.hasMedia', equals: true },
          limit: 500,
        },
        resultId: 'darkroom-media',
      },
      b: {
        command: 'filter',
        input: 'darkroom-ground',
        parameters: {
          where: { field: 'event.hasMedia', equals: false },
          limit: 500,
        },
        resultId: 'darkroom-no-media',
      },
    });
    const [media, noMedia] = await Promise.all([
      controller.execute({
        command: 'show',
        input: 'darkroom-media',
        parameters: { mode: 'preview', previewLimit: 3 },
      }),
      controller.execute({
        command: 'show',
        input: 'darkroom-no-media',
        parameters: { mode: 'preview', previewLimit: 3 },
      }),
    ]);
    return {
      creature: 'Darkroom',
      character: 'paired exposures; Ground does not move',
      ground: darkroom.sensors().ground,
      question: darkroom.sensors().questions[0].text,
      contrast: developed.negative.contrast,
      mediaExcerpts: eventExcerpts(media.response),
      noMediaExcerpts: eventExcerpts(noMedia.response),
      commands: controller.transcript().retainedEntries,
      acquired: acquired.receipt.handle?.count ?? null,
    };
  });
}

async function withController(fly) {
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
    return await fly(controller);
  } finally {
    await controller.close();
  }
}

function acquisition({ kinds, limit }) {
  return {
    relays: RELAYS,
    filter: {
      ...(kinds ? { kinds } : {}),
      limit,
    },
    timeoutMs: 12_000,
    observationLimit: 400,
    distinctEventLimit: limit,
    concurrency: 3,
  };
}

function eventExcerpts(response) {
  return (response.result?.preview ?? []).map((item) => (
    item.excerpt
    ?? item.contentExcerpt
    ?? item.values?.['event.text']
    ?? item.subject?.id
    ?? null
  )).filter(Boolean);
}

function relationValues(response) {
  return (response.result?.preview ?? []).map(({ values }) => values);
}
