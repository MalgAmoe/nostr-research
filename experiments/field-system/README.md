# Nostrarium Field system

`@nostrarium/field-system` is one disposable experimental system built over the
shared Nostrarium controller. It interprets one part of research as **contact
with a bounded field**:

- configure contact defaults;
- acquire a field;
- sample unranked entrances;
- compare two field handles;
- observe a field;
- hand a handle to another system.

It is not a permanent product hierarchy. Other systems may divide the same
infrastructure differently.

The first sustained research trial showed that this initial surface is too
narrow: a field-centered search naturally needed `relate`, `scan`,
`aggregate`, `move`, `hydrate`, and further observation. Those operations are
not reserved for other systems. The experiment is retained in this small form
so its next revision can respond to observed use rather than an invented
taxonomy.

Every action emits exactly one ordinary controller command. The action result
contains the visible command draft beside the unchanged controller response
and receipt. `observe` additionally arranges response-declared presentation
facts; `handoff` adds a small reference containing the ordinary handle and its
factual schema. Neither copies canonical evidence, executes a hidden plan, or
chooses a research direction.

```js
import { createNavigatorController } from '@nostrarium/controller';
import { createFieldSystem } from '@nostrarium/field-system';

const controller = createNavigatorController({
  request: (command) => session.execute(command),
  transcript: { maxEntries: 500, maxBytes: 2_000_000 },
});
const field = createFieldSystem({ controller });

await field.configure({
  relays: ['wss://nos.lol/', 'wss://relay.primal.net/'],
});

const acquired = await field.acquire({
  filter: { kinds: [1], limit: 200 },
  distinctEventLimit: 200,
  resultId: 'field',
});

const entrances = await field.sample({
  input: acquired.receipt.handle.id,
  limit: 5,
  seed: 'voyage-1',
  resultId: 'entrances',
});

const observation = await field.observe({
  input: entrances.receipt.handle.id,
  mode: 'preview',
  previewLimit: 5,
});

const handoff = await field.handoff(entrances.receipt.handle.id);
// Any other interpretation can accept this without copied event data.
```

`compare` accepts `intersection`, `difference`, or `compare`. A complete
three-way relay comparison remains an explicit sequence of separately visible
acquisitions and set operations; the Field system does not hide it behind one
procedure.
