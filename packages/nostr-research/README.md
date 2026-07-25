# Nostr Research memory

`@nostr-research/memory` is a small UI-independent library for a local, SQLite-backed
record of valid Nostr evidence and where it was encountered. It intentionally
contains no UI, ranking, recommendations, or trust scoring. Its bounded
acquisition operation is deliberately separate from local querying.

SQLite is the package's current concrete implementation and its one real
storage path. The tables and indexes are internal implementation details, not
a promised public data model or backend abstraction. Experimental databases
may be discarded and regenerated while the research model is still evolving.

## Library

```js
import { acquireRelayEvents, openResearchMemory } from '@nostr-research/memory';

const memory = openResearchMemory('./research.sqlite');
try {
  memory.ingest(event, {
    relay: 'wss://relay.example',
    observedAt: '2026-07-25T12:00:00.000Z',
  });

  console.log(memory.getEvent(event.id));
  // { event: <the unchanged Nostr event>, observations: [...] }
  console.log(memory.summary());
  // { events: 1, observations: 1 }
} finally {
  memory.close();
}
```

`ingest` accepts only canonical Nostr events: required event fields and tag
structure must be valid, the event ID must match the canonical serialisation,
and the Schnorr signature must verify. An event ID is stored once; every ingest
adds an independent observation.

`loadFixtureEvents()` returns a fresh copy of the committed, inspectable fixture
corpus in `fixtures/events.json`. `memory.importFixtures(observation)` imports
that corpus through the same validation and ingestion boundary.

### Live relay acquisition

`acquireRelayEvents(memory, options)` contacts only the explicit `wss://`
relay URLs in `options.relays`. It accepts one NIP-01 filter object and returns
a structured result; it never supplies a default relay. The conservative
defaults are a 10,000 ms operation timeout, 100 accepted event observations,
and four concurrent relays. Callers can override these with `timeoutMs`,
`eventLimit`, and `concurrency`, and can cancel in flight with an
`AbortSignal`:

```js
const controller = new AbortController();
const result = await acquireRelayEvents(memory, {
  relays: ['wss://relay.example/'],
  filter: { kinds: [1], limit: 20 },
  timeoutMs: 5_000,
  eventLimit: 20,
  signal: controller.signal,
});
```

`completionReason` is `completed` when every selected relay reaches a terminal
outcome, or `limit`, `timeout`, or `cancelled` when that global stop condition
wins. Each relay separately reports `eose`, `closed`,
`connection-failure`, `limit`, `timeout`, or `cancelled`, with a diagnostic
where useful.

The returned counts have these stable meanings:

- `received`: subscription-matching `EVENT` messages received, valid or not;
- `invalid`: received events rejected by canonical event/signature validation;
- `observations`: valid events accepted before the global event limit, each of
  which creates one relay/timestamp observation;
- `newlyStored`: accepted observations whose canonical event was not already
  in memory;
- `duplicate`: accepted observations whose event was already in memory.

`acquiredEventIds` contains each event ID accepted by this operation once.
Thus `newlyStored + duplicate === observations`, while invalid events are
never persisted. The operation sends NIP-01 `CLOSE` and closes every socket it
owns when a relay completes or a global stop condition occurs.

The package uses Node's built-in `node:sqlite` support and requires Node 22.5
or newer. SQLite files are generated artifacts and are ignored by Git.

## Persistent JavaScript console

Start the research console from the repository root with an explicit database
and bounded workspace capacity:

```sh
npm run --silent research-console -- --db .data/research.sqlite --capacity 500
```

This is Node's JavaScript REPL, not a command language. It keeps variables,
the workspace, and a temporary session alive between expressions, and supports
top-level `await`. End it with `.exit` or Ctrl-D; the console cancels active
acquisition and closes workspace and SQLite resources. Invalid or missing
startup options fail with a non-zero exit.

The single prepared binding is `research`. Its common conveniences are
`summary()`, `load(query)`, `acquire(options)`, `events(query)`,
`accounts(query)`, `currentEvent(account, kind, options)`, `follows(account)`,
`use(result)`, `inspect(subject, options)`,
`traverse(...)`, `compare(left, right)`, and `retain(...)`. The public
`research.memory`, `research.workspace`, and current `research.session` remain
available for deeper operations. Returned collections and records are ordinary
JavaScript values: assign, filter, combine, and pass them into later calls.
Large collections are only abbreviated when the REPL displays them; assigned
values remain complete.

`load` replaces the in-memory corpus with a bounded slice already stored in
SQLite and makes it the session selection. It never contacts a relay.
`acquire` requires explicit relay URLs, filter, and caller-chosen budgets; it
stores accepted evidence durably and adds it to the bounded workspace. It
prints one start and one completion progress line without printing events.

For example:

```js
const corpus = research.load({ kinds: [1], order: 'newest', limit: 200 })
const notes = research.events({ text: ['nostr'], limit: 50 })
research.use(notes)
const connected = research.traverse({
  relationshipTypes: ['reply-parent', 'quoted-event'],
  direction: 'both', depth: 2, limit: 100
})
const comparison = research.compare(notes, connected)
const saved = research.retain('nostr conversation evidence')
research.memory.getSet(saved.id)
```

To acquire first, use
`await research.acquire({ relays: ['wss://relay.example/'], filter:
{ kinds: [1], limit: 20 }, timeoutMs: 5000, eventLimit: 20 })`, then search the
workspace. Piped JavaScript uses the same persistent process and can finish
with `.exit`.

### Composable research kernel

The public vocabulary is `resolve -> select/acquire -> traverse -> project ->
retain`.

`subject(type, id)` creates a stable `event`, `account`, `tag`, `set`, or `run`
reference. `memory.resolve(...)` resolves stored event/account prefixes,
set/run IDs, and accounts by exact stored `name`, `display_name`, or `nip05`.
`memory.select(query)` returns a reusable result collection whose subjects,
reasons, provenance, and canonical evidence can flow directly into the other
operations:

```js
let memory = openResearchMemory('./research.sqlite');
const account = memory.resolve('alice@example.org');
const authored = memory.select({
  authors: [account.id], kinds: [1], since: 1_700_000_000,
  order: 'newest', limit: 20,
});
const conversationEvidence = memory.traverse(authored, {
  relationshipTypes: ['reply-root', 'reply-parent', 'mentioned-account', 'topic'],
  direction: 'both', depth: 3, limit: 100,
});
console.log(memory.project(conversationEvidence, {
  mode: 'compact', excerptLimit: 120, previewLimit: 5,
}));
const saved = memory.retain(conversationEvidence, 'alice-conversations');
memory.close();

memory = openResearchMemory('./research.sqlite');
const continued = memory.traverse([{ type: 'set', id: saved.id }], {
  relationshipTypes: ['author', 'mentioned-account'],
  direction: 'outbound', depth: 1, limit: 100,
});
memory.close();
```

### Raw tags, relationships, and replaceable events

Canonical events and their tag arrays are immutable source evidence.
Relationships are replaceable interpretations derived from that evidence.
For example, a valid `p` tag on an ordinary note is exposed as
`mentioned-account`, while a `p` tag on a kind-3 contact list is exposed as
`follow`. A follow explanation contains the source kind-3 event ID, exact tag,
and tag index. It says only that this contact-list event named the account; it
does not assert trust, endorsement, reciprocity, identity, or present social
closeness.

`memory.currentEvent(account, kind, options)` selects one current event from
local evidence for kinds 0 and 3, kinds 10000-19999, and parameterized kinds
30000-39999. It uses the newest `created_at`, then the lexicographically lowest
event ID for equal timestamps. For parameterized kinds, pass `{ d: 'value' }`;
an omitted `d` selects the empty identifier. It returns the canonical event
and its observations, or `null` when the address is not stored. Historical
events remain available through `getEvent` and ordinary selection.

`memory.follows(account)` and the console convenience
`research.follows(account)` resolve the account, select only its current stored
kind-3 event, and return followed account subjects in a reusable result
collection. Public keys without authored or metadata events remain navigable
account subjects. The collection retains exact relationship reasons and the
contact-list observations; if no contact list is stored it is empty with an
explanatory context. This operation is local-only and never contacts relays.

### Bounded in-memory workspaces

`createResearchWorkspace(memory, { capacity })` attaches one disposable,
indexed working corpus to an open durable memory. It is the active environment
for repeated selection and relationship traversal when a caller does not want
to return to SQLite at each exploratory step:

```js
import {
  createResearchSession,
  createResearchWorkspace,
  openResearchMemory,
} from '@nostr-research/memory';

const memory = openResearchMemory('./research.sqlite');
const workspace = createResearchWorkspace(memory, { capacity: 500 });
workspace.load({
  authors: [account.id],
  kinds: [1],
  since: 1_700_000_000,
  order: 'newest',
  limit: 500,
});

const notes = workspace.select({ tags: { t: ['nostr'] }, text: ['relay'] });
const connected = workspace.traverse(notes, {
  relationshipTypes: ['reply-parent', 'quoted-event', 'mentioned-account'],
  direction: 'both',
  depth: 3,
  limit: 100,
});
const session = createResearchSession(workspace, connected);
const saved = session.checkpoint('bounded relay research');

workspace.close();
memory.close();
```

`load(query)` explicitly replaces the corpus with a stored event slice using
the same event-query constraints as `memory.select`. `add(value)` incrementally
hydrates stored event subjects, result collections, acquisition output, or
search output. Canonical event IDs are deduplicated; adding an existing ID
refreshes its stored observations without changing its FIFO position. When
capacity is exceeded, the earliest admitted event is evicted deterministically.
Eviction and `workspace.close()` discard only temporary indexes and records:
they never delete SQLite evidence.

`workspace.select` and `workspace.traverse` operate only on private in-memory
indexes for IDs, authors, kinds, tags, and inbound/outbound derived
relationships. Relationship targets may remain unresolved when their canonical
events are outside the loaded corpus. `inspect(subject)` returns loaded
canonical event evidence and relay provenance; `{ loadIfMissing: true }` is an
explicit request to hydrate a missing stored event. `describe()` reports
capacity, count, remaining capacity, eviction count, and index counts without
exposing the corpus or mutable maps.

Workspace collections use the same result vocabulary as durable memory, so
they can be projected, retained as research sets, or used to start a research
session. A workspace is the bounded evidence corpus and query/navigation
engine; a result collection is a reusable operation result; a session is
temporary interaction state over those operations; and SQLite research memory
remains the durable source of evidence, observations, sets, runs, and coverage.

`memory.asCollection(output)` adapts structured acquisition output, event or
account search output, and convenience-navigation output to this same
collection contract. It consumes public objects directly; callers never need
to parse rendered output.

Traversal is deterministic and breadth-first. It deduplicates subjects while
retaining distinct explaining edges, with explicit depth and distinct-result
bounds. `relatedEvent`, `relatedAccount`, and `expandSet` are conveniences over
this operation. Projection modes are `compact`, `full`, `ids`, and `ndjson`;
explicit `excerptLimit` and `previewLimit` bounds are terminal-independent.
Full projection preserves canonical evidence. Retention saves reasons and
provenance.

Every result item has a `role`. Traversal inputs are `seed` items; subjects
reached through relationships are `discovery` items. Selection and other
collections use `discovery` unless they become explicit seeds of a later
traversal. This distinction survives projection and lets callers compose
collections directly without inferring origins from rendered text.

Compact projection bounds excerpts and previews and emits one `subjects` map
for relationship endpoint summaries; each relationship carries stable
`sourceRef` and `targetRef` keys instead of repeating both summaries. Its size
grows with distinct subjects and edges rather than duplicating complete
endpoints for every edge. Full projection is intentionally more expensive: it
hydrates canonical evidence and complete explanations for the requested
collection. Neither mode changes stored evidence.

`memory.thread(eventId, { depth, limit })` composes shared traversals and
separates the start, known ancestors, direct replies, deeper descendants,
participating accounts, and ambiguous references. Its collection remains
projectable and retainable.

### Local selection and relay acquisition

`memory.searchEvents(query)` searches accumulated SQLite evidence and never
contacts relays. It accepts `ids`, `authors`, `kinds`, inclusive `since` and
`until` Unix timestamps, `tags`, `text`, `limit`, and `order` (`newest` or
`oldest`). ID and author values may be full values or unambiguous lowercase
hex prefixes of at least four characters.

Different constraint fields combine with AND. Multiple IDs, authors, kinds, or
values for one tag combine with OR. Every text term combines with AND and is
matched case-insensitively against note content. Different tag names combine
with AND. Tag names may include the conventional leading `#`; equivalent keys
such as `t` and `#t` are merged, so all their values retain the same OR
semantics. Results always have an explicit limit (default 50, maximum 1000)
and sort by `created_at`, then event ID. Each result contains the canonical
event, all observations, and one explicit match reason for every applied
constraint. Malformed and ambiguous constraints throw `ResearchMemoryError`;
a well-formed constraint matching nothing returns an empty result.

```js
const result = memory.searchEvents({
  authors: ['84bf7562262b'],
  kinds: [1],
  tags: { '#t': ['nostr'] },
  text: ['fixture'],
  since: 1_700_000_000,
  limit: 20,
  order: 'newest',
});
```

`memory.select` applies these local constraints but returns the shared
collection contract. Relay acquisition is deliberately separate:
`acquireRelayEvents` accepts a NIP-01 filter and has network side effects.
Local `text` and `order` are not relay filter fields. Acquisition feedback
preserves exact relays and filter (including supplied time bounds), per-relay
outcomes, completion reason, counts, recorded run ID when requested, and
bounded acquired identifiers.

`resolveAccount(publicKeyOrPrefix)` returns the current stored kind-0 metadata
event, parsed profile, and its observations. Current-event selection follows
replaceable-event ordering: greatest `created_at`, then lowest event ID.
`searchAccounts({ publicKeys, text, limit })` searches only current metadata;
public-key prefixes may match multiple accounts, while all text terms must
match at least one of `name`, `display_name`, or `nip05`. Absence and ambiguous
prefixes are explicit errors for single-account resolution.

`relatedEvent(idOrPrefix)` and `relatedAccount(keyOrPrefix)` expose
evidence-backed outbound and inbound relationships. Relationships include
their direction, type, source event ID, source event and provenance, resolution
state, and protocol evidence. NIP-10 markers and NIP-22 root/parent tags are
reported as known interpretations; NIP-22 comment tags are interpreted only
on kind-1111 events. Deprecated unmarked NIP-10 positional interpretation and
uppercase event tags outside kind 1111 are labeled `best-effort-fallback`.
References to events not in memory remain in the result with `resolved:
false`. Fallback interpretations remain ambiguous in traversal and thread
output and are never silently promoted to known replies. Account resolution
reflects public keys evidenced as stored authors or
account references independently of whether kind-0 profile metadata is
available.

### Temporary research sessions and coverage

`createResearchSession(memory, initial)` creates an in-process coordinator that
can begin empty or from a result collection, research run, or research set.
Its current `selection`, optional `focus`, provisional `exclusions`, named
branches, history, and `currentAction` are temporary. Meaningful methods are
`replace`, `setFocus`, `include`, `exclude`, `select`, `traverse`, `branch`,
`returnToBranch`, `back`, and `checkpoint`. `describe()` exposes the complete
public state needed by a UI, CLI, or agent without recording incidental UI
behavior.

```js
const session = createResearchSession(memory, memory.select({ kinds: [1] }));
session.setFocus(session.selection.items[0].subject);
session.branch('starting notes');
session.traverse({
  relationshipTypes: ['reply-parent', 'author'],
  direction: 'both',
  depth: 2,
  limit: 100,
});
const checkpoint = session.checkpoint('conversation evidence');
```

Branches and `back()` restore earlier result state without copying or changing
canonical evidence. Exclusions disappear with the session unless
`checkpoint(name, { includeExclusions: true })` deliberately preserves them as
retention context. Checkpoint creation uses the same atomic `retain` operation
as other durable sets. `view('subject-list', projectionOptions)` and
`view('account-list', projectionOptions)` are read-only projections; thread
remains the existing composed memory view.

Every relay acquisition now returns `collection`, which can be passed directly
to a session, traversal, projection, or retention. It also atomically records
`coverage` containing the exact requested filter and relays, explicit timeout,
event and concurrency budgets, whether each relay was actually contacted,
per-relay outcomes, completion reason, and observed event IDs/times.
`memory.acquisitionCoverage({ relays, filter })` checks an exact requested
slice, while `getAcquisitionCoverage` and `listAcquisitionCoverage` expose
durable records after reopening memory. All coverage responses state
`exhaustive: false`: an EOSE or completed bounded attempt is not a claim that a
relay or window was completely indexed.

Caller-controlled planning helpers are:

- `planAcquisitionSlices({ relays, filter, since, until, targetSeconds })` for
  deterministic inclusive, non-overlapping time slices;
- `fetchRelayInformation(relay, { timeoutMs, signal })` for optional bounded
  NIP-11 retrieval;
- `relayQueryLimit(filter, advertisedInformation)` to cap a filter at an
  advertised `limitation.max_limit`; and
- `parseNip65RelayList(event)` to derive attributed read/write relay choices
  from canonical stored kind-10002 evidence.

NIP-11 and NIP-65 values are advertised information, not verified behavior.
Acquisition outcomes are observed behavior. No default relays, retries,
fallbacks, crawling, or relay scores are inferred from either.

### Research runs and sets

`recordRun(record)` stores an immutable snapshot of a completed `acquisition`,
`event-query`, or `account-query`. A record contains normalized public
`inputs`, ISO `startedAt` and `finishedAt` times, a completion `status`,
structured `diagnostics`, and event/account `results`. Each result carries its
match `reasons` and acquisition `provenance`. The returned UUID is stable;
recording equivalent inputs again creates a different run. `getRun(id)`
returns the complete snapshot and never repeats the operation. `listRuns()`
returns bounded metadata and result/diagnostic counts without deserializing
the stored result and diagnostic arrays.

Saved research sets use stable UUIDs and user-facing names. The public
operations are:

- `createSet`, `listSets`, `getSet`, `renameSet`, and `deleteSet`;
- `addSetMember` and `removeSetMember`, where a member is an event, account,
  tag, set, or recorded-run subject;
- `createSetFromRun(name, runId)`;
- `expandSet(sourceId, name, { relationshipTypes, direction, limit })`;
- `combineSets(operation, leftId, rightId, name)` for `union`,
  `intersection`, and `difference`; and
- `explainSetMember(setId, member)`.

Full 64-character lowercase hexadecimal identifiers are accepted even when
their evidence is not present locally. Membership reasons are durable and may
include explicit selection, a source run with its original reasons and
provenance, relationship evidence and its source member, or the contributing
sets in a set operation. Expansion uses only the stored relationships exposed
by local navigation, requires selected relationship types, and has a bounded
limit (default 50, maximum 1000). Set combinations create a new set and never
mutate either input. None of these operations contacts a relay.

Every operation that creates a populated set—`retain`, `createSetFromRun`,
`expandSet`, and `combineSets`—prevalidates and deduplicates its members and
reasons, then writes the set, members, and reasons in one SQLite transaction.
Any validation or insertion failure leaves no new set or partial membership.
`retain` also accepts an optional `AbortSignal`; cancellation observed during
the bulk write rolls back that transaction.
These operations return a bounded acknowledgement with counts and at most ten
preview members; use `getSet(id)` when complete membership and reasons are
needed. `listSets()` likewise returns counts and at most five preview member
references instead of expanding complete membership. Interactive
`addSetMember` remains a separate single-member edit.

## CLI

All commands operate on the same public library and require a database path:

From the repository root, `npm run --silent research -- ...` invokes the local
workspace binary directly. Keep `--silent` so npm's script banner does not
precede the machine-readable CLI output:

```sh
npm run --silent research -- --db .data/research.sqlite search --text nostr
```

```sh
nostr-research-memory --db ./research.sqlite init
nostr-research-memory --db ./research.sqlite import-fixture --relay wss://relay.example
nostr-research-memory --db ./research.sqlite acquire \
  --relay wss://relay.damus.io \
  --relay wss://nos.lol \
  --filter-json '{"kinds":[1],"limit":10}' \
  --timeout-ms 5000 --event-limit 10
nostr-research-memory --db ./research.sqlite summary
nostr-research-memory --db ./research.sqlite inspect 78c49d12afd45ddadb9b547051c344352060a9aa9a1665de8fd8695b4aa8d30c
nostr-research-memory --db ./research.sqlite search --kind 1 --tag t=nostr --text fixture --limit 20
nostr-research-memory --db ./research.sqlite accounts --text alice
nostr-research-memory --db ./research.sqlite account 84bf7562262b
nostr-research-memory --db ./research.sqlite related event 78c49d12afd4
nostr-research-memory --db ./research.sqlite related account 84bf7562262b
nostr-research-memory --db ./research.sqlite thread 78c49d12afd4 --depth 5 --limit 100
nostr-research-memory --db ./research.sqlite run search --kind 1 --text fixture
nostr-research-memory --db ./research.sqlite run list
nostr-research-memory --db ./research.sqlite set from-run findings <run-id>
nostr-research-memory --db ./research.sqlite set add <set-id> event <full-event-id>
nostr-research-memory --db ./research.sqlite set expand <set-id> replies \
  --relationship reply-parent --direction outbound --limit 50
nostr-research-memory --db ./research.sqlite set combine union <left-id> <right-id> combined
nostr-research-memory --db ./research.sqlite set explain <set-id> event <full-event-id>
nostr-research-memory --db ./research.sqlite reset
```

For an account-to-conversation investigation, resolve with `account
alice@example.org`, acquire bounded evidence using explicit relays and a filter
such as `{"authors":["<key>"],"kinds":[0,1],"since":1700000000,
"until":1700086400}`, select with `search --author <key> --kind 1`, then use
`thread <event-id>`. `run search` plus `set from-run` retains a selection;
`set expand` continues it after reopening the same SQLite database.

Run `nostr-research-memory --help` for commands and options. Successful
commands print JSON for scripting and inspection; invalid commands, missing
events, and invalid input exit non-zero with an `Error:` message.

`--output compact|full|ids|ndjson` is accepted before or after the command.
Search, acquisition, relationship, run-list, and set-list commands default to
`compact`; evidence inspection defaults to `full`. `compact` bounds event
content excerpts and avoids repeated evidence, `full` retains canonical events
and provenance, `ids` emits a JSON identifier array, and `ndjson` emits one
independently parseable compact record per line.

Node currently reports its built-in SQLite experimental warning on supported
versions. The CLI leaves that narrowly scoped runtime warning unchanged rather
than suppressing Node warnings globally; it is written to stderr and does not
affect machine-readable stdout.

For acquisition, use exactly one of `--filter-json` or `--filter-file`; the
latter names a file containing one JSON filter object. Repeated `--relay`
arguments are required. Output is the same structured result returned by the
library plus the database path. Add `--record` to `acquire` to preserve the
operation as a run. `run search` and `run accounts` execute and record local
queries; `run inspect` reopens one historical result.

The `set` command supports `create`, `list`, `inspect`, `rename`, `delete`,
`add`, `remove`, `from-run`, `expand`, `combine`, and `explain`. Names
containing spaces should be shell-quoted. `set add` accepts optional
`--reason-json`; expansion requires one or more repeatable `--relationship`
options.
