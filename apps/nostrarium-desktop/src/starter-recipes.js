export const STARTER_RECIPES = Object.freeze([
  Object.freeze({
    id: 'profile-descent',
    name: 'Profile descent',
    definition: Object.freeze({
      starterRecipe: { id: 'profile-descent', version: 2 },
      purpose: 'Move from event evidence to attributed account profile claims without treating the profile as verification.',
      parameters: ['$source', '$prefix'],
      steps: [
        {
          command: 'move', input: '$source',
          parameters: { to: 'authors', limit: 100 },
          resultId: '$prefix-authors',
        },
        {
          checkpoint: 'Preview the account subjects, decide whether profile acquisition is warranted, and scale the hydration budgets to the number of candidates. The following 200-event bounds are an upper-bound example, not a default for one account.',
        },
        {
          command: 'hydrate', input: '$prefix-authors',
          parameters: {
            kinds: [0], timeoutMs: 15000, observationLimit: 200,
            distinctEventLimit: 200, concurrency: 3,
          },
          resultId: '$prefix-profiles',
        },
        {
          checkpoint: 'If hydration returned no metadata events, its completeness report is sufficient; skip details unless evidence exists.',
        },
        {
          command: 'show', input: '$prefix-profiles',
          parameters: { mode: 'details', previewLimit: 10 },
        },
      ],
      limitations: [
        'Profile metadata is an attributed self-claim.',
        'Hydration is relay-bounded and may leave accounts unresolved.',
      ],
    }),
  }),
  Object.freeze({
    id: 'mention-frequency',
    name: 'Mention frequency',
    definition: Object.freeze({
      starterRecipe: { id: 'mention-frequency', version: 2 },
      purpose: 'Count raw p-tag mentions in an event field using the generic relation algebra.',
      parameters: ['$source', '$prefix'],
      steps: [
        { command: 'relate', input: '$source', resultId: '$prefix-rows' },
        {
          command: 'explode', input: '$prefix-rows',
          parameters: { field: 'event.tags', as: 'tag', limit: 1000 },
          resultId: '$prefix-tags',
        },
        {
          checkpoint: 'Inspect bounds before treating the exploded rows as representative.',
        },
        {
          command: 'filter', input: '$prefix-tags',
          parameters: { where: { field: 'tag.0', equals: 'p' }, limit: 1000 },
          resultId: '$prefix-p-tags',
        },
        {
          command: 'aggregate', input: '$prefix-p-tags',
          parameters: {
            by: [{ field: 'tag.1', name: 'account' }],
            aggregations: [{ name: 'mentionCount', operation: 'count' }],
            limit: 1000,
          },
          resultId: '$prefix-mentions',
        },
        {
          command: 'sort', input: '$prefix-mentions',
          parameters: { by: [{ field: 'mentionCount', direction: 'descending' }] },
          resultId: '$prefix-ranked',
        },
      ],
      limitations: [
        'This counts raw p tags; it does not infer endorsement, relevance, or human identity.',
        'Any earlier acquisition or explode bound remains part of the result.',
      ],
    }),
  }),
  Object.freeze({
    id: 'relay-confessional',
    name: 'Relay Confessional',
    definition: Object.freeze({
      starterRecipe: { id: 'relay-confessional', version: 1 },
      purpose: 'Compare how separate relays answer the same exact bounded Nostr filter.',
      parameters: ['$filter', '$relayA', '$relayB', '$prefix'],
      steps: [
        {
          command: 'acquire',
          parameters: {
            relays: ['$relayA'], filter: '$filter', timeoutMs: 15000,
            observationLimit: 300, distinctEventLimit: 200, concurrency: 1,
          },
          resultId: '$prefix-a',
        },
        {
          command: 'acquire',
          parameters: {
            relays: ['$relayB'], filter: '$filter', timeoutMs: 15000,
            observationLimit: 300, distinctEventLimit: 200, concurrency: 1,
          },
          resultId: '$prefix-b',
        },
        {
          command: 'intersection', input: '$prefix-a',
          parameters: { with: '$prefix-b', limit: 1000 },
          resultId: '$prefix-shared',
        },
        {
          command: 'difference', input: '$prefix-a',
          parameters: { with: '$prefix-b', limit: 1000 },
          resultId: '$prefix-only-a',
        },
        {
          command: 'difference', input: '$prefix-b',
          parameters: { with: '$prefix-a', limit: 1000 },
          resultId: '$prefix-only-b',
        },
      ],
      decisions: [
        'Use the identical normalized filter and explicit bounds for both acquisitions.',
        'Inspect coverage before interpreting an empty or asymmetric result.',
      ],
      limitations: [
        'The comparison describes two bounded attempts, not either relay’s complete corpus.',
        'Relay-exclusive in this sample does not mean globally exclusive.',
      ],
    }),
  }),
]);

export function seedStarterRecipes(store) {
  const seeded = [];
  const updated = [];
  for (const recipe of STARTER_RECIPES) {
    const existing = store.recipe(recipe.id);
    if (existing === null) {
      store.saveRecipe({ ...recipe, originVoyageId: null });
      seeded.push(recipe.id);
      continue;
    }
    if (!isManagedStarter(existing, recipe)) continue;
    const currentVersion = existing.definition.starterRecipe?.version ?? 0;
    if (currentVersion >= recipe.definition.starterRecipe.version) continue;
    store.saveRecipe({ ...recipe, originVoyageId: null });
    updated.push(recipe.id);
  }
  return { seeded, updated };
}

function isManagedStarter(existing, recipe) {
  if (existing.originVoyageId !== null) return false;
  const marker = existing.definition.starterRecipe;
  if (marker?.id === recipe.id) return true;
  return marker === undefined
    && existing.name === recipe.name
    && existing.definition.purpose === recipe.definition.purpose;
}
