# Second persistent-console field trial

Date: 2026-07-25. Disposable database:
`.data/second-field-trial.sqlite`.

## Public relay attempt

```js
await (async () => {
  const acquisition = await research.acquire({
    relays: ['wss://relay.damus.io', 'wss://nos.lol'],
    filter: { kinds: [1], '#t': ['nostr'], since: 1753430400, limit: 20 },
    timeoutMs: 6000, eventLimit: 20, concurrency: 2
  })
  const acquisitionView = research.show(acquisition, {
    previewLimit: 2, excerptLimit: 100
  })
  const initial = research.facets(acquisition.collection, { limit: 8 })
  console.log('TRIAL:' + JSON.stringify({ acquisitionView, initial }))
})()
```

Both requested public relays were contacted, but the sandbox returned
`connection-failure` with `WebSocket connection or protocol error` before any
EVENT. `show` preserved the exact filter, normalized URLs, operation budgets,
per-relay outcomes, zero observation/distinct-event counts, completion reason,
and uncertainty. This is evidence of bounded failed attempts, not evidence
that either relay lacked matches.

Live acquisition was unavailable, so the remaining interaction used five
signed canonical events inserted through `memory.ingest`: a long root note, a
reply mentioning its author, a current kind-3 contact list, and metadata for
two authors. Each carried an attributed local field-trial relay observation.

## Orientation and direction

These exact commands ran in one persistent console:

```js
const corpus = research.load({ order: 'oldest', limit: 100 })
const orientation = research.show(corpus, { previewLimit: 3, excerptLimit: 100 })
const corpusFacets = research.facets(corpus, { limit: 8 })
const authorDirection = research.limitPer(
  corpus, item => item.record.event.pubkey, 2
)
const withoutMetadata = research.exclude(
  authorDirection, item => item.record.event.kind === 0
)
const positiveNotes = research.collection(
  withoutMetadata.items.filter(item =>
    item.record.event.kind === 1 &&
    item.record.event.content.includes('fallback')
  ),
  { operation: 'ordinary-js-positive' }
)
const followed = research.follows(
  'b95c249d84f417e3e395a127425428b540671cc15881eb828c17b722a53fc599'
)
const mentions = research.traverse(positiveNotes, {
  relationshipTypes: ['mentioned-account'],
  direction: 'outbound', depth: 1, limit: 10
})
const conversation = research.memory.thread(
  'c11a3a5b74bb210756fc9ae210dcf8eed6df46f10f0c99b01a4cb65e0466b474',
  { depth: 3, limit: 20 }
)
const chosen = research.collection([
  ...positiveNotes.items,
  ...followed.items,
  ...research.discoveries(mentions).items,
  ...conversation.collection.items
], { operation: 'field-trial-chosen' })
const saved = research.retain(chosen, 'second console field trial')
```

`show` returned count five, three bounded previews, omitted count two,
selection context, and provenance totals. Facets showed author counts 3/2;
kind counts 2/2/1 for kinds 0/1/3; five events at the local relay; domains
`research.example` and `media.example`; two linked events and one image event.
These are corpus counts, not judgments.

`limitPer` reduced five events to four. The negative predicate removed metadata
and left three; the positive ordinary JavaScript predicate selected two notes.
The explicit follow pivot found author B, the mention pivot found author A,
and the conversation pivot returned the exact root and reply. Retention saved
four distinct subjects (two events and two accounts) with eight reasons.

## Reopen verification

In a fresh console process:

```js
const reopened = research.memory.getSet(
  'f87ae43a-934a-4c51-a15b-9a652431d954'
)
research.show(reopened, { previewLimit: 5 })
reopened.members.length
research.memory.getEvent(
  'c11a3a5b74bb210756fc9ae210dcf8eed6df46f10f0c99b01a4cb65e0466b474'
).event.content.length
```

The reopened set had four members and bounded inspection showed all four.
Direct canonical access returned the complete 3,671-character root, confirming
inspection did not rewrite evidence.

## Shape friction and next tasks

- Piped input needed one awaited async expression for acquisition; interactive
  use did not have this sequencing concern.
- Relay, domain, and media facet identities intentionally require ordinary
  JavaScript predicates because local selection has no such query fields.

No next implementation task is justified by this trial. Failed relay access is
an environment limitation, not evidence for retries, fallback scores, or
default relays.
