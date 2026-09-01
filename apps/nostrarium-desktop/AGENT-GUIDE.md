# Desktop navigator guide

This is the practical operating guide for the agent embedded in Nostrarium.
The application already owns one persistent research session and a neutral
controller. Use the `nostrarium` tool directly; do not start a process, write
JSONL, or provide `commandId`.

## Command boundary

One ordinary command has this tool shape:

```json
{
  "intent": "What this command is meant to establish.",
  "command": "status",
  "parameters": {}
}
```

The controller allocates correlation IDs. The engine receives the command
without `intent`; the application retains the intent beside the authoritative
command and response for the human voyage trace.

The complete command envelope may contain:

- `intent` — required plain-language purpose;
- `command`;
- `input` or operation-specific `inputs`;
- `parameters`;
- `resultId`;
- `replace` — explicitly permit replacement of an existing handle;
- `ifRevision` — reject mutation against a newer session revision;
- `plan` and `outputs` for the engine's declarative plan command.

There is no implicit active result. Every consuming command names its input,
and every output worth revisiting receives a `resultId` on first execution.

## Predetermined command batches

When several ordinary commands are already decided and no evidence-dependent
choice belongs between them, issue them in one tool call:

```json
{
  "intent": "Prepare and inspect a small deterministic sample.",
  "commands": [
    {
      "intent": "Select a bounded corpus view.",
      "command": "select",
      "parameters": { "scope": "corpus", "limit": 100 },
      "resultId": "field"
    },
    {
      "intent": "Sample five members from that fixed view.",
      "command": "sample",
      "input": "field",
      "parameters": { "limit": 5 },
      "resultId": "sample"
    },
    {
      "intent": "Inspect the sample.",
      "command": "show",
      "input": "sample",
      "parameters": { "mode": "preview", "previewLimit": 5 }
    }
  ]
}
```

A batch contains at most 20 commands, executes sequentially, and stops after
the first failed response. Every executed member has its own intent, receipt,
response, and controller transcript entry. Earlier successful members are not
rolled back.

Do not batch across a decision point. Schema discovery followed by a command
whose shape depends on that schema requires two model turns. Acquisition
followed by a direction chosen from its evidence also requires two turns.

The engine's `plan` command is different: it preflights a transactional array
of research stages whose later inputs name earlier stages. Use a plan for a
known operation pipeline. Use a desktop batch when already-known ordinary
commands include observation, schema, lifecycle, or other commands outside
the plan algebra.

## Research state

The session owns three distinct resources:

- a renewable bounded observation buffer of acquired canonical events;
- a bounded archive containing evidence explicitly preserved by the navigator;
- named result handles, which are temporary working views over stable subjects
  or relation rows.

A handle does not copy or preserve evidence. Buffer turnover can change which
canonical evidence resolves for its identities. `preserve` is the explicit
archive boundary. Reset, close, or application exit removes the whole research
session; attention is also process-local.

The ordinary loop is:

```text
acquire a bounded field
→ observe it
→ enter relations when value analysis is needed
→ filter, scan, aggregate, compare, or navigate
→ acquire more only for an explicit reason
→ preserve evidence only when it must survive buffer turnover
```

Relay results are bounded observations, not a representative or exhaustive
view of Nostr. `ok: true` means the command executed, not that all requested
evidence exists or every relay completed.

## Discover commands without guessing

The tool already exposes command envelopes, but dynamic fields, routes, and
operation-specific shapes come from engine schema.

Use compact global schema for session and observation commands:

```json
{
  "intent": "Inspect the session and observation command vocabulary.",
  "command": "schema",
  "parameters": {}
}
```

Inspect an input-free operation:

```json
{
  "intent": "Learn the exact acquisition contract.",
  "command": "schema",
  "parameters": { "operation": "acquire" }
}
```

Inspect a handle and its populated structure:

```json
{
  "intent": "See what this handle contains and which operations apply.",
  "command": "schema",
  "input": "noteRows",
  "parameters": {}
}
```

Inspect one contextual operation before constructing it:

```json
{
  "intent": "Learn which populated fields scan can search.",
  "command": "schema",
  "input": "noteRows",
  "parameters": { "operation": "scan" }
}
```

Request `{ "detail": "full" }` only for genuinely cross-operation contract
inspection. Focused schema is factual construction help, not a research
recommendation and not a gate on possible command compositions.

## Beginning a voyage

The desktop session starts with application-configured public relay defaults.
Inspect `status` before relying on current configuration. Reconfigure only
when the task needs a different relay field or different bounds.

Acquire a bounded recent field:

```json
{
  "intent": "Acquire a bounded recent field from the configured relays.",
  "command": "acquire",
  "parameters": { "filter": { "kinds": [1], "limit": 250 } },
  "resultId": "field"
}
```

Directly self-warned events are excluded by default. Observe relay outcomes
and acquisition bounds before interpreting the field:

```json
{
  "intent": "Check which relays contributed and which bounds ended acquisition.",
  "command": "show",
  "input": "field",
  "parameters": { "mode": "coverage" }
}
```

Preview a stable page:

```json
{
  "intent": "Inspect the first ten field members.",
  "command": "show",
  "input": "field",
  "parameters": { "mode": "preview", "offset": 0, "previewLimit": 10 }
}
```

`show` uses `previewLimit`, not operation `limit`. It pages a fixed handle
order. A response-size bound can return fewer members than requested; read
`sizeBounded`, `returnedItems`, `omitted`, and `nextOffset`.

## Collections and relations

Collections hold navigable event, account, address, or relationship
identities. Common collection operations include:

- `filter`, `pick`, `limit`, and `sample`;
- `move` between factual subject routes;
- `union`, `intersection`, `difference`, and `compare`;
- `relate`, `hydrate`, `continue`, and `preserve` where applicable.

Collection `filter` matches stable identity fields such as `subject.type` and
`subject.id`; it does not scan note text or profile properties.

Relations hold analyzable rows and values derived from subjects. Use `relate`
to enter this layer. Relation operations include:

- `filter`, `project`, `distinct`, `sort`, and `slice`;
- `aggregate`, `derive`, and `join`;
- `explode`, `scan`, and `balance`;
- `extract` to return a lineage-bearing field to navigable subjects;
- `fetch` to bind row values into an explicit Nostr relay query.

Never invent relation field names. Ask contextual schema. `project` fields are
strings or `{ "field": "source", "name": "renamed" }` mappings. `slice`
uses `offset` and `limit`. `scan` uses `match: "any"|"all"` and
`matchMode: "substring"|"word"|"phrase"`.

Collection and relation outputs are bounded to at most 1,000 items. Inspect
reported input, qualifying, output, and truncation cardinalities before using
a bounded derived view as if it described its complete source.

## A common analysis path

Convert event subjects to rows, inspect the scan contract, then scan populated
text fields:

```json
{
  "intent": "Expose event values for analysis.",
  "command": "relate",
  "input": "field",
  "resultId": "noteRows"
}
```

```json
{
  "intent": "Learn which fields currently contain searchable text.",
  "command": "schema",
  "input": "noteRows",
  "parameters": { "operation": "scan" }
}
```

```json
{
  "intent": "Find notes discussing privacy or cryptography.",
  "command": "scan",
  "input": "noteRows",
  "parameters": {
    "fields": ["event.text", "event.links", "event.domains"],
    "terms": ["privacy", "cryptography"],
    "match": "any",
    "matchMode": "word",
    "caseSensitive": false,
    "limit": 100
  },
  "resultId": "matches"
}
```

Group by author, sort, and extract account identities:

```json
{
  "intent": "Count matching notes per author.",
  "command": "aggregate",
  "input": "matches",
  "parameters": {
    "by": [{ "field": "event.author", "name": "account" }],
    "aggregations": [
      { "name": "matches", "operation": "count" },
      { "name": "examples", "operation": "sample", "field": "event.text", "limit": 3 }
    ],
    "limit": 100
  },
  "resultId": "authorRows"
}
```

```json
{
  "intent": "Order authors by observed matching-note count.",
  "command": "sort",
  "input": "authorRows",
  "parameters": { "by": [{ "field": "matches", "direction": "descending" }] },
  "resultId": "rankedAuthors"
}
```

```json
{
  "intent": "Return the ranked account field to navigable account identities.",
  "command": "extract",
  "input": "rankedAuthors",
  "parameters": { "field": "account", "subjectType": "account", "limit": 20 },
  "resultId": "accounts"
}
```

Profile hydration acquires attributed kind-0 evidence for account subjects; it
does not establish that profile claims are true:

```json
{
  "intent": "Acquire profile evidence for the candidate accounts.",
  "command": "hydrate",
  "input": "accounts",
  "parameters": {
    "kinds": [0],
    "timeoutMs": 12000,
    "observationLimit": 100,
    "distinctEventLimit": 100,
    "concurrency": 3
  },
  "resultId": "profiles"
}
```

## Finding accounts

Account discovery has several distinct routes. Choose one deliberately rather
than treating a failed route as proof of absence:

1. If an exact npub, NIP-21 reference, or public key is supplied, inspect that
   exact typed account subject. If it is unresolved, use the normalized account
   ID returned by inspection in an explicit kind-0 acquisition `authors`
   filter. `hydrate` consumes an account handle; it does not create one from a
   bare identifier.
2. From an observed event field, move to `authors` or referenced accounts,
   hydrate profiles, enter relations, and scan populated account fields.
3. For name or keyword discovery without an anchor, make an explicit NIP-50
   acquisition of kind-0 profile events on a search-capable relay.

The ordinary configured relays are useful field sources but are not guaranteed
to implement NIP-50. `wss://search.nos.today` has worked as a dedicated search
relay in project trials, but it is an external service whose behavior can
change. Use it explicitly for search rather than adding it silently to random
field acquisition, and inspect relay outcomes before trusting the route:

```json
{
  "intent": "Search attributed profile metadata for the supplied account name.",
  "command": "acquire",
  "parameters": {
    "relays": ["wss://search.nos.today"],
    "filter": { "kinds": [0], "search": "<name or terms>", "limit": 50 },
    "timeoutMs": 15000,
    "observationLimit": 100,
    "distinctEventLimit": 50,
    "concurrency": 1
  },
  "resultId": "profileSearch"
}
```

Relate the returned profile events and inspect or scan the populated
`account.name`, `account.display_name`, `account.description`, and
`account.nip05` fields. Several profiles may claim the same identity. Verify
only what the task requires using exact stable account IDs, attributed profile
claims, and authored-note evidence. A profile name or NIP-05 value is not by
itself proof that two keys belong to the same person.

If one search relay refuses, times out, or returns irrelevant matches, that
route failed; the research objective did not. Try a structurally different
route when reasonable: another search-capable relay, graph navigation from
observed references, or profile hydration from likely account subjects.

## Event type, conversations, and media

After `relate`, the engine exposes factual event-content fields including:

- `event.role` — content, interaction, relationship, moderation, encrypted,
  profile metadata, or unknown according to the sparse known-kind table;
- `event.format` — known kind-level format such as plain text, picture-first,
  video, short video, voice message, long-form Markdown, poll, code, or unknown;
- `event.conversationRole` — original, reply, quote, comment, repost,
  reaction, chat message, or the applicable sparse fallback;
- `event.mediaFamilies`, `event.mediaSources`, `event.attachmentCount`,
  `event.attachments`, `event.attachmentsOmitted`, and `event.hasMedia`;
- `event.links`, `event.domains`, `event.createdAt`, and canonical
  `event.tags`.

These are mechanical descriptions, not quality judgments. The sparse kind
table leaves unrecognized kinds unknown. `event.format: "plain-text"`
describes the protocol representation; it does not prove the payload is human
prose and does not distinguish embedded JSON telemetry from ordinary writing.
There is no intrinsic bot, spam, language, or automation label. Investigate
those questions through explicit patterns across events, authors, timestamps,
tags, domains, and relationships, then state the navigator's inference.

Normalized attachments merge declared NIP-92/NIP-94 and kind-specific facts
with visibly inferred URL hints. They retain conflicting evidence and report
omissions. Use `explode` on `event.attachments` or `event.mediaFamilies` for
media analysis; inspect focused schema after exploding to learn the resulting
fields. Profile pictures and banners are profile properties, not event
attachments.

Kind-1 and kind-1111 thread relationships form conversations. Reposts,
reactions, and deletion targets remain distinct and do not silently become
replies. Unknown tags remain mechanical references. Use `move` for resident
relationships, `continue` for bounded local or relay traversal, and `explain`
before assigning meaning to a relationship-derived member.

`event.createdAt` is the author's signed `created_at` claim. Observation
provenance records when a relay event was seen, but the relation field is not
an independently verified publication time. Future-dated events should be
reported as such rather than silently normalized or treated as current news.

Direct self-declared content warnings are excluded from relay acquisition by
default. This covers direct `content-warning` tags and direct labels in that
namespace. The report exposes exclusion counts. Third-party labels and reports
remain attributed evidence rather than automatic policy. Set
`excludeContentWarnings: false` only when the research objective explicitly
requires admitting that material.

## Raw tag analysis

Nostr tags remain canonical arrays. To count hashtags or referenced accounts,
explode `event.tags`, filter the tag marker, then aggregate the tag value:

```json
{
  "intent": "Expose individual raw tags.",
  "command": "explode",
  "input": "noteRows",
  "parameters": { "field": "event.tags", "as": "tag", "limit": 1000 },
  "resultId": "tagRows"
}
```

For hashtags retain rows where `tag.0` equals `t`; for account references use
`p`. Aggregate by `tag.1`. Check the exploded handle's bounds first: a
frequency table over a truncated expansion describes only that bounded view.
Raw p-tag frequency does not silently assign every p-tag the same social role.

## Observation and evidence

`show` observes a named result:

- `preview` — bounded members or rows;
- `summary` — result kind, count and unit, lineage, applicable resolution,
  bounds, completeness, and omissions;
- `coverage` — sources, bounds, unresolved evidence, and relay outcomes;
- `details` — bounded canonical evidence for the selected page;
- `explain` — membership reasons and provenance for the selected page.

Use `inspect` for one exact Nostr subject:

```json
{
  "intent": "Resolve all currently known evidence for this event.",
  "command": "inspect",
  "parameters": {
    "subject": { "type": "event", "id": "<64-character-event-id>" }
  }
}
```

Use `explain` for one subject's membership in a handle:

```json
{
  "intent": "Explain why this account belongs to the candidate handle.",
  "command": "explain",
  "input": "accounts",
  "parameters": {
    "subject": { "type": "account", "id": "<64-character-pubkey>" }
  }
}
```

Exact subjects use typed objects or public NIP-19/NIP-21 references. A raw hex
string alone is ambiguous. Preview excerpts are not canonical full text; use a
small `details` page when exact content matters.

## Navigation and external acquisition

Local operations never contact relays. `move` follows already-derived local
routes. `continue` performs bounded protocol traversal. Ask contextual schema
for valid relationships and source choices:

```json
{
  "intent": "Discover valid continuation relationships for these accounts.",
  "command": "schema",
  "input": "accounts",
  "parameters": { "operation": "continue" }
}
```

```json
{
  "intent": "Acquire authored notes for the selected accounts.",
  "command": "continue",
  "input": "accounts",
  "parameters": {
    "relationship": "authored-notes",
    "source": "relays",
    "eventLimit": 100
  },
  "resultId": "authoredNotes"
}
```

`fetch` is not HTTP. It binds relation fields into another bounded Nostr relay
filter. Ask its focused schema before choosing bindings such as `ids`,
`authors`, `#e`, `#p`, or `#t`.

NIP-50 search works only on relays that support it. Failure or empty results
from one relay do not prove account or content absence. A dedicated search
relay is a deliberate task-specific choice, not part of random-field defaults.

`relay-count` returns independent attributed estimates per relay. Never sum
them into a global total because relay corpora overlap. `relay-info` returns
advertised NIP-11 claims and retrieval outcomes; advertisements are not
observed behavior. Neither operation changes the evidence buffer.

## Handles and evidence lifetime

Use `list` at meaningful pauses to inspect named handles. Use `status` for
session configuration, memory pressure, transcript state, and lifecycle.

Treat intermediate relations, scans, and aggregates as transient when helpful;
release them after they no longer matter. Treat fields, candidates, and
comparisons as durable only for the current voyage. This is a navigator habit,
not engine metadata.

- `release` removes a handle without removing buffer or archive evidence;
- `release-all` removes all handles;
- `preserve` copies resolvable evidence into the bounded archive at an explicit
  level and reason;
- `release-archive` removes archived evidence;
- `reset` clears the whole research session;
- `replace: true` permits intentional result-ID replacement.

Set operations use `input` for the left collection and `parameters.with` for
the right. Relation `join` instead uses named `inputs` such as `left` and
`right`.

## Attention and recipes

`nostrarium_attention` is separate, bounded, process-local JSON working state.
The navigator chooses its keys and shapes. Use it selectively for temporary
hypotheses, questions, or exact handle/subject references that must remain
explicit across several steps or context compaction. It executes nothing and
does not become canonical evidence. Do not mirror the transcript into it.

`nostrarium_recipes` stores bounded cross-run JSON research patterns. `list`,
`get`, `save`, and `delete` operate only on recipe memory. A recipe never
executes itself. Adapt loaded steps to current evidence and issue actual
commands visibly through `nostrarium`. Save exact command envelopes that
genuinely worked; keep decision points and limitations explicit.

The application currently seeds profile descent, raw p-tag mention frequency,
and two-relay comparison recipes. List recipes to see the current catalogue and
load one only when its purpose matches the voyage. Their checkpoints are
decision boundaries and must not be compiled into a blind batch.

## Receipts, responses, and context

Compact receipts orient the next decision. Full model-visible responses are
available when they fit the projection bound; very large responses remain in
the authoritative controller transcript and should be replaced by a narrower
page or focused observation for model use.
The human can expand retained controller records in the interface. The agent
does not have a separate controller-record tool, so it must re-observe a named
handle when exact evidence is no longer present in model context.

When context reaches real pressure, older turns may be replaced with a factual
voyage checkpoint containing objectives, receipts, known handles, narration,
attention, and recently consulted contracts. It is orientation, not evidence.
Re-observe a named handle before relying on exact content.

Read result counts with their declared unit: subjects, rows, matches, events,
or another result-specific unit. Keep separate:

```text
command success
external attempt completion
evidence resolution
exhaustiveness
session mutation
```

Failed commands leave session state unchanged. Observation commands do not
advance the session revision. External commands may succeed with partial
outcomes and warnings.

## Common mistakes

- Guessing fields or parameters instead of requesting focused schema.
- Using operation `limit` for a `show` page instead of `previewLimit`.
- Omitting `input` because a handle was used recently.
- Forgetting `resultId` on the first execution of reusable output.
- Reusing a result ID without `replace: true`.
- Treating `ok: true` as exhaustive relay success.
- Filtering note text while holding a collection instead of entering relations.
- Treating preview excerpts as canonical full values.
- Assuming handles preserve evidence through buffer turnover.
- Treating zero results as an engine failure or proof of network-wide absence.
- Batching commands whose later shape or direction depends on earlier evidence.
- Confusing model background knowledge with evidence acquired in this voyage.

Prefer receipts for orientation. Use `show`, `inspect`, and `explain` when
interpretation requires evidence. Use stable identities or named handles for
candidate selection rather than preview positions. State uncertainty,
truncation, unresolved subjects, and relay failures plainly. The human owns
conclusions and taste; the navigator owns research choices; the engine owns
factual execution and provenance.
