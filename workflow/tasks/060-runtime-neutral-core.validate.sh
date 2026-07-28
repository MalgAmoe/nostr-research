#!/bin/sh
set -eu

npm run check
npm test

node --input-type=module -e "
  globalThis.Buffer = undefined;
  const library = await import('./packages/nostr-research/src/index.js');
  const memory = library.createInMemoryResearchMemory({ capacity: 3 });
  const session = library.createDeclarativeResearchSession(memory);
  const response = await session.execute({
    commandId: 'status',
    command: 'status',
    parameters: {},
  });
  if (!response.ok) throw new Error('Runtime-neutral public core smoke test failed.');
  await session.close();
"

if rg -n "from ['\"](node:|ws['\"])" \
  packages/nostr-research/src \
  -g '*.js' \
  -g '!jsonl-session.js'
then
  echo "Runtime-neutral core still imports a Node-only module." >&2
  exit 1
fi

if rg -n '"ws"\s*:' packages/nostr-research/package.json
then
  echo "The package still declares the Node-only ws dependency." >&2
  exit 1
fi
