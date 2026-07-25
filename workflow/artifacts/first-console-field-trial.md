# First persistent-console field trial

## Runtime and acquisition bounds

The trial ran on 2026-07-25 from the repository root with Node's persistent
JavaScript REPL:

```sh
npm run --silent research-console -- \
  --db .data/first-console-field-trial.sqlite --capacity 200
```

The disposable database is Git-ignored and is not a deliverable. In that one
process I submitted two explicit, finite live attempts. The Unix time bounds
were 2026-07-18 through 2026-07-25 (`since: 1784400000`,
`until: 1785010433`).

```js
const broadParams = {
  relays: ['wss://relay.damus.io/', 'wss://nos.lol/'],
  filter: {
    kinds: [1], '#t': ['nostr'],
    since: 1784400000, until: 1785010433, limit: 30
  },
  timeoutMs: 8000, inactivityTimeoutMs: 2500,
  eventLimit: 40, perRelayEventLimit: 20, concurrency: 2
}
const broad = await research.acquire(broadParams)

const fallbackParams = {
  relays: ['wss://relay.primal.net/', 'wss://relay.nostr.band/'],
  filter: {
    kinds: [1], '#t': ['nostr'],
    since: 1784400000, until: 1785010433, limit: 24
  },
  timeoutMs: 10000, inactivityTimeoutMs: 3000,
  eventLimit: 30, perRelayEventLimit: 15, concurrency: 2
}
const fallback = await research.acquire(fallbackParams)
```

All four relays were contacted and returned the structured outcome
`connection-failure`, diagnostic `WebSocket connection or protocol error.`,
with zero received events and observations. These failures are observed
behavior in this execution environment, not evidence that the relays were
generally unavailable. I made no further retries. The console preserved the
two bounded acquisition coverage records in SQLite.

Because the live environment yielded no events, the research interaction used
the existing ignored `.data/first-research.sqlite` corpus. That corpus contains
real evidence from a prior bounded acquisition on the same date: kind 1,
`#t=nostr`, relay filter limit 50, operation timeout 12,000 ms, global
observation limit 75, and concurrency 4, against `relay.damus.io`, `nos.lol`,
and `relay.primal.net`. `nos.lol` and `relay.primal.net` supplied 63 distinct
events/75 observations; Damus failed during that original attempt. A later
bounded acquisition already in the database added observations and metadata.
Reusing this durable corpus separates acquisition availability from evaluation
of the persistent-console interaction model.

## Commands in one adaptive process

The adaptive investigation started a new persistent console from the repository
root with the durable corpus and this exact command:

```sh
npm run --silent research-console -- \
  --db .data/first-research.sqlite --capacity 200
```

The following representative commands ran in order in the same console
process. Values such as `corpus`, `relayNotes`, `lead`, `detail`, `leadOnly`,
`connected`, and `authored` were reused rather than translated into separate
CLI invocations.

```js
const corpus = research.load({
  kinds: [1], since: 1784930400, until: 1785010433,
  order: 'newest', limit: 100
})
research.summary()

const tagged = research.events({
  kinds: [1], tags: { t: ['nostr'] }, order: 'newest', limit: 30
})
research.memory.project(tagged, {
  mode: 'compact', excerptLimit: 100, previewLimit: 8
})

const relayNotes = research.events({
  kinds: [1], tags: { t: ['nostr'] }, text: ['relay'],
  order: 'newest', limit: 10
})
const lead = relayNotes.items.find(item =>
  item.subject.id ===
  'ac62b451fc255e1bd5931894dce9e6016f80f0ee99a73dc3df0a567720855b0b'
)
const detail = research.inspect(lead.subject)

const leadOnly = research.events({ ids: [lead.subject.id], limit: 1 })
research.use(leadOnly)
const connected = research.traverse({
  relationshipTypes: ['author', 'mentioned-account'],
  direction: 'outbound', depth: 1, limit: 20
})
const authored = research.events({
  authors: [detail.evidence.event.pubkey],
  order: 'newest', limit: 20
})
const compared = research.compare(connected, authored)
const saved = research.retain(
  connected, 'console-field-trial-earthly-accounts'
)
```

`connected` contained three subjects, `authored` contained three locally
stored events, and their shared subject was the selected event. The durable set
is `47b4f418-0355-4ef0-9ed0-fe1ff3ed7a6f`. After exiting, I reopened that exact
database from the repository root with:

```sh
npm run --silent research-console -- \
  --db .data/first-research.sqlite --capacity 200
```

In that new console process the retained set was directly readable:

```js
const reopened = research.memory.getSet(
  '47b4f418-0355-4ef0-9ed0-fe1ff3ed7a6f'
)
reopened
```

It retained the event, author account, mentioned account, relationship reasons,
and source observation provenance.

## Findings: evidence and interpretation

Observed evidence:

- Event `ac62b451fc255e1bd5931894dce9e6016f80f0ee99a73dc3df0a567720855b0b`
  is a kind-1 note whose content begins “Earthly is becoming much more than a
  web map.” Its author is
  `3aa5817273c3b2f94f491840e0472f049d0f10009e23de63006166bca9b36ea3`.
  Stored observations include `nos.lol`, `relay.primal.net`, and
  `relay.damus.io`.
- The raw note has a `p` tag for account
  `6b3780ef2972e73d370b84a3e51e7aa9ae34bf412938dcfbd9c5f63b221416c8`
  with relay hint `wss://relay.damus.io/`, plus `t` tags `Blossom`,
  `blossom`, and `nostr`.
- Traversal explained the author through the NIP-01 `pubkey` field and the
  second account through that exact `p` tag. These are derived relationships
  with source-event evidence, not identity or trust claims.
- The selected author had three authored events in the bounded local
  workspace. The comparison shared only the selected lead event.

Interpretation:

- The Earthly note was useful for this interaction trial because it supplied
  substantive text and two explainable account pivots. This does not establish
  that the account or project is globally interesting, trusted, or important.
- The initial `#nostr` slice also contained terse coordinates, image links,
  generic greetings, and promotional material. In this sample, inspecting
  excerpts and refining by text was necessary before choosing a lead.

## Composition and friction

`load -> events -> project -> use -> traverse -> events -> compare -> retain`
composed naturally. Collections stayed as ordinary JavaScript values,
session-based traversal used the prior `use`, explicit-result retention did
not disturb the investigation, and the SQLite checkpoint survived process
reopening with reasons and provenance.

Concrete friction encountered:

- `research.inspect(event)` returns canonical event data at
  `detail.evidence.event`; I first tried `detail.event` and
  `detail.record.event`, causing ordinary REPL `TypeError`s. The object is
  inspectable, but the convenience shape is not demonstrated near the console
  example.
- Evaluating `research.use(leadOnly)` printed the complete one-item collection,
  including a long event. The bounded writer abbreviates collections only when
  they exceed five items, so a single long note can still flood navigation
  output. Assignment avoids this, but that is easy to miss.
- `research.retain(connected, ...)` intentionally retained the traversal seed
  as well as both discovered accounts. Getting only discoveries requires an
  explicit JavaScript filter; the traversal result accurately exposes roles,
  but the common continuation is slightly awkward.
- Node's experimental SQLite warning appears at every process start.

No code repair was made. The failed property accesses were discoverability
friction, not incorrect result handling, and the successful corrected sequence
did not justify changing a public shape. No permanent regression was added
because the existing public console scenario already covers persistent
variables, traversal, retention, bounded display, and reopening.

## Candidate next tasks

1. Add a short console documentation example showing the exact
   `research.inspect(...).evidence.event` and `.provenance` shape; both wrong
   guesses occurred during this trial.
2. Bound REPL display by canonical-event content size even for collections of
   five or fewer items; one selected long note flooded the console.
3. Document a small role-filtering idiom for turning traversal discoveries
   into a retained set without its seed; this trial needed that distinction.
4. Expose acquisition coverage inspection directly on the prepared `research`
   object if another trial confirms that assessing structured relay failures
   through `research.memory` is recurrent friction.
