# Authored-note expansion field trial

Run on 2026-07-26 using the real persistent JavaScript console and disposable
SQLite memory `.data/authored-note-live-trial.sqlite`. The seed was
reconstructed from the novelist account identified by the earlier bookstore
trial because the earlier retained set was in a different local database.

## Exact commands

The console was opened interactively so each top-level `await` completed before
the following expression:

```sh
npm run --silent research-console -- \
  --db .data/authored-note-live-trial.sqlite --capacity 200
```

```js
const novelistKey =
  '738f7873ac2c6cb7701e3150616afc824379b132b467ba5a8429d5964af1b136'
const novelist = research.collection([{
  subject: { type: 'account', id: novelistKey },
  reasons: [{ type: 'live-trial' }],
  provenance: []
}], { operation: 'explicit-novelist-selection' })
const sessionBefore = research.summary().session
const expanded = await research.expand(novelist, {
  relays: [
    'wss://nos.lol/',
    'wss://relay.damus.io/',
    'wss://relay.primal.net/'
  ],
  relationshipTypes: [
    'author',
    'reply-parent',
    'quoted-event',
    'mentioned-event',
    'mentioned-account'
  ],
  direction: 'both',
  authoredLimit: 6,
  depth: 2,
  limit: 40,
  timeoutMs: 12000,
  eventLimit: 30,
  concurrency: 3
})
research.show(expanded, { previewLimit: 10 })
expanded.context.expansion
const notes = research.events({
  authors: [novelistKey],
  kinds: [1],
  order: 'newest',
  limit: 6
})
research.show(notes, { previewLimit: 6 })
research.facets(notes)
({ sessionBefore, sessionAfter: research.summary().session })
const promising = notes.items.find(item =>
  item.subject.id ===
    '6538f8c0cd72213b25edec5fd86ed21b329efa9cff4704c81acf4f5d9bc88a4d'
)
research.inspect(promising.subject)
const connected = research.traverse(
  research.collection([promising], { operation: 'promising-note' }),
  {
    relationshipTypes: [
      'reply-parent',
      'quoted-event',
      'mentioned-event',
      'mentioned-account'
    ],
    direction: 'outbound',
    depth: 1,
    limit: 10
  }
)
research.show(connected, { previewLimit: 10 })
const worthwhile = research.collection(
  [
    novelist.items[0],
    notes.items.find(item => item.subject.id ===
      '642a09e0082f6518ec6df93a92b354277b5c6a8644af5a598c8f0a3f1d0d33b1'),
    notes.items.find(item => item.subject.id ===
      'e36b96e4ee6db12e6838fec8afd207cebe707a136c48eba9bdc942fb9ab20cb1'),
    promising
  ],
  { operation: 'live-authored-note-evidence' }
)
const retained = research.retain(worthwhile, 'authored-note-live-trial')
retained
research.memory.getSet(retained.id)
.exit
```

The retained set was then reopened in a fresh console process:

```sh
npm run --silent research-console -- \
  --db .data/authored-note-live-trial.sqlite --capacity 200
```

```js
const reopened = research.memory.getSet(
  '559941f3-336e-47af-a8d6-b60a18ebbd52'
)
research.show(reopened, { previewLimit: 10 })
reopened.members
.exit
```

## Operational counts and provenance

The authored request was exactly:

```js
{
  authors: [novelistKey],
  kinds: [1],
  limit: 6
}
```

Its report identified `purpose: 'authored-notes'`, the
`relay-recent-created-at-descending` ordering assumption, `authoredLimit: 6`,
the operation-wide `eventLimit: 30`, depth 2, traversal limit 40, timeout
12,000 ms, and concurrency 3. `relay.primal.net` supplied six valid notes and
the authored request stopped at its six-observation limit; the other two
in-flight relay requests were also closed at that bound. Thus the selected
account yielded exactly six notes and could not exceed its declared
per-account sample.

Expansion made six bounded acquisition requests in total: the authored-note
request, one unresolved-event request, two inbound relationship requests, and
two account-metadata requests needed to hydrate explicit protocol
relationships. Across all requests and relays the operation recorded:

- 28 received and accepted observations;
- 0 invalid observations;
- 16 duplicate observations;
- 12 newly stored events;
- 28 total observations, below the global bound of 30; and
- 12 distinct events in durable memory.

Provenance was preserved rather than collapsed. The six authored notes were
first observed on `wss://relay.primal.net/`. The promising reply was also
observed on `wss://nos.lol/` and `wss://relay.damus.io/` during relationship
hydration. All three relays reached EOSE on the applicable hydration requests
except one later kind-0 request: Damus returned HTTP 503 while `nos.lol`
supplied the requested metadata and Primal returned EOSE with no match. That
partial failure remained visible and did not discard successful evidence.

The session description before and after `research.expand` was identical.
Expansion returned an independent collection and did not replace the session
selection.

## Evidence-backed orientation

The six-note relay-recent sample showed actual conversational and everyday
activity rather than merely a profile:

- two newest notes discussed baking in extreme heat;
- one standalone note was a humorous observation about a large insect;
- one longer standalone note discussed scientific evidence;
- two notes participated in a conversation about a child experimenting with
  food and a grandfather.

Event
`6538f8c0cd72213b25edec5fd86ed21b329efa9cff4704c81acf4f5d9bc88a4d`
was the useful protocol lead. Its raw tags identify reply parent
`11d1db6bee6d4ad20d0281e47508580f43ed794fb57c626a04b88d8e55632485`,
conversation root
`62fd6083f2cfe282fc9781a8d8fe10b81d6c4838768d6c9ed691e48efd14aaf2`,
and the other participant account
`ba18b6545357cff8e531accfe1d609a41ef3023fba071db1cbf5a67448c19046`.
The bounded expansion acquired the reply parent and participant metadata, and
the subsequent local depth-1 traversal exposed those existing
`reply-parent`/`mentioned-account` relationships without networking.

Only the explicit starting novelist account was sampled. Accounts discovered
from the reply were metadata-hydrated where required by the requested
relationships, but no authored-note filter was issued for them.

The retained set deliberately kept the account and three representative
notes—the two newest standalone baking notes and the conversational lead—rather
than all hydrated evidence. Set
`559941f3-336e-47af-a8d6-b60a18ebbd52` reopened in the fresh console with
exactly those four members and their ordinary `author`, `kind`, and stored
observation provenance reasons.

## Finding and API friction

The sample was useful for continued research: it distinguished the creator's
current conversational and everyday note activity from the kind-0 profile and
provided a concrete reply edge for inspecting social context. The explicit
option, recent-ordering label, per-account request, global observation budget,
ordinary relationship reasons, and relay outcomes were all visible in one
expansion report.

The main friction remains the persistent REPL's piped-input behavior: commands
following top-level `await` may be evaluated before the promise settles.
Interactive entry worked reliably. No pagination, feed behavior, implicit
account crawling, or console redesign was introduced.
