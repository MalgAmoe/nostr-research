# CLI guide

This is the practical entry point for operating Nostrarium's research engine.
The CLI is a persistent research process, not a one-shot command and not a
prompted shell.

## Start and stop

From the repository root:

```sh
npm run research-session -- --capacity 1000
```

The two independent evidence stores can be bounded at construction:

```sh
npm run research-session -- \
  --capacity 1000 \
  --archive-capacity 250
```

Each capacity must be an integer from 1 to 1,000. `--capacity` bounds the
renewable observation buffer, and `--archive-capacity` bounds deliberately
preserved evidence.

The process reads one JSON object per line from stdin and writes one JSON
response per line to stdout. Keep it running while researching: named results
and acquired evidence exist only inside that process.

Every command needs a unique `commandId`:

```jsonl
{"commandId":"status-1","command":"status"}
```

End the session explicitly:

```jsonl
{"commandId":"close-1","command":"close"}
```

Each complete command must occupy one line.

## The operating model

The session contains three different things:

- an observation buffer of recently acquired canonical events;
- an archive of evidence deliberately preserved before buffer turnover;
- named result handles, which are temporary working views.

A handle does not copy or preserve its source evidence. Everything disappears
when the process closes.

The ordinary loop is:

```text
acquire a bounded field
→ observe it
→ relate subjects when value analysis is needed
→ filter, scan, aggregate, or navigate
→ fetch or continue when more relay data is wanted
→ explicitly preserve evidence when it must survive buffer turnover
```

There is no implicit active result. Every consuming command names its `input`;
every reusable output gets a `resultId`.

The complete command envelope can contain:

- `commandId` — caller-owned response correlation;
- `ifRevision` — execute only against the session revision the caller observed;
- `command`;
- `input` or operation-specific named `inputs`;
- `parameters`;
- `resultId`;
- `replace` — explicitly permit replacement of an existing result handle.

Use `ifRevision` when concurrent or scripted callers must not silently apply a
mutation to newer session state.

## Discover commands without guessing

Start with the compact global schema:

```jsonl
{"commandId":"schema-1","command":"schema"}
```

Input-free external operations can be inspected before any result handle
exists:

```jsonl
{"commandId":"schema-acquire-1","command":"schema","parameters":{"operation":"acquire"}}
```

The focused result reports the operation contract, effective session defaults,
bounds, locality, mutation, result kind, and completeness semantics. The same
form supports `relay-info` and `relay-count`.

Request all global contracts only when needed:

```jsonl
{"commandId":"schema-full-1","command":"schema","parameters":{"detail":"full"}}
```

Once a result exists, inspect its structure and compatible operations:

```jsonl
{"commandId":"schema-notes-1","command":"schema","input":"notes"}
```

Before constructing a specific operation, ask for its contextual contract:

```jsonl
{"commandId":"schema-scan-1","command":"schema","input":"noteRows","parameters":{"operation":"scan"}}
```

This reports the handle kind, available and populated fields, compatible
operations, accepted parameter shape, bounds, and applicable defaults. It does
not choose a research direction.

## First live session

Send these commands one at a time and inspect each response before continuing.

Configure known working relay defaults:

```jsonl
{"commandId":"configure-1","command":"configure","parameters":{"relays":["wss://nos.lol","wss://relay.primal.net","wss://relay.snort.social"],"acquisition":{"timeoutMs":12000,"observationLimit":300,"distinctEventLimit":250,"concurrency":3},"presentation":{"previewLimit":5,"excerptLimit":240,"sizeLimit":20000}}}
```

Acquire a bounded recent field. Directly self-warned events are excluded by
default:

```jsonl
{"commandId":"acquire-1","command":"acquire","parameters":{"filter":{"kinds":[1],"limit":250}},"resultId":"field"}
```

Check relay outcomes and bounds. `ok: true` means the command executed; the
external result may still be partial:

```jsonl
{"commandId":"coverage-1","command":"show","input":"field","parameters":{"mode":"coverage"}}
```

Preview the field and convert its subjects into rows:

```jsonl
{"commandId":"preview-1","command":"show","input":"field","parameters":{"mode":"preview","previewLimit":5}}
{"commandId":"relate-1","command":"relate","input":"field","resultId":"noteRows"}
```

Ask for populated scan fields, then search selected fields:

```jsonl
{"commandId":"schema-scan-2","command":"schema","input":"noteRows","parameters":{"operation":"scan"}}
{"commandId":"scan-1","command":"scan","input":"noteRows","parameters":{"fields":["event.text","event.links","event.domains"],"terms":["privacy","cryptography"],"match":"any","matchMode":"word","caseSensitive":false,"limit":100},"resultId":"matches"}
{"commandId":"matches-preview-1","command":"show","input":"matches","parameters":{"mode":"preview","previewLimit":10}}
```

Group matches by author, sort them, and return to navigable identities:

```jsonl
{"commandId":"authors-1","command":"aggregate","input":"matches","parameters":{"by":[{"field":"event.author","name":"account"}],"aggregations":[{"name":"matches","operation":"count"},{"name":"examples","operation":"sample","field":"event.text","limit":3}],"limit":100},"resultId":"authorRows"}
{"commandId":"authors-sort-1","command":"sort","input":"authorRows","parameters":{"by":[{"field":"matches","direction":"descending"}]},"resultId":"rankedAuthors"}
{"commandId":"authors-extract-1","command":"extract","input":"rankedAuthors","parameters":{"field":"account","subjectType":"account","limit":20},"resultId":"accounts"}
```

Hydrate the selected account profiles:

```jsonl
{"commandId":"hydrate-1","command":"hydrate","input":"accounts","parameters":{"kinds":[0],"timeoutMs":12000,"observationLimit":100,"distinctEventLimit":100,"concurrency":3},"resultId":"profiles"}
```

At any point:

```jsonl
{"commandId":"list-1","command":"list"}
{"commandId":"status-2","command":"status"}
```

## Collections and relations

Collections contain stable Nostr subjects: events, accounts, addresses, or
mixed subjects. Use them for identity and navigation:

- `filter`, `pick`, `limit`, `sample`;
- `move`;
- `union`, `intersection`, `difference`, `compare`;
- `continue`, `hydrate`, and `preserve` where applicable.

Set operations use `input` for the left collection and `parameters.with` for
the right collection. The general `inputs` envelope is reserved for operations
such as relation `join`, whose inputs have separately named roles.

Relations contain rows and values derived from subjects. Use `relate` to enter
this layer. Relations support:

- `filter`, `project`, `distinct`, `sort`, `slice`;
- `aggregate`, `derive`, `join`;
- `explode`, `scan`, `balance`;
- `extract` to return a field to navigable subjects;
- `fetch` to bind row values into an explicit relay query.

Never guess a field name. Ask contextual `schema`.

Collection and relation outputs are bounded to at most 1,000 items. That
ceiling currently keeps eager scans, cloning, expansions, and joins
predictable; inspect bounds rather than raising it without measuring the
resulting runtime and memory cost.

## Reusable compositions

These are recipes made from ordinary operations, not special research
commands. Change the input handles, fields, and thresholds to fit the current
question.

### Compare two acquisition snapshots

Keep two acquisition handles for the same filter, then compare their immutable
event identities. `compare` returns counts; `difference` returns the events
present in the newer handle but absent from the older one:

```jsonl
{"commandId":"compare-snapshots-1","command":"compare","input":"newSnapshot","parameters":{"with":"oldSnapshot"},"resultId":"snapshotComparison"}
{"commandId":"new-events-1","command":"difference","input":"newSnapshot","parameters":{"with":"oldSnapshot","limit":1000},"resultId":"newEvents"}
{"commandId":"new-events-summary-1","command":"show","input":"newEvents","parameters":{"mode":"summary"}}
```

This is a process-local event-identity delta. It does not snapshot changes in
relay provenance, address resolution, or earlier sessions.

### Count hashtags or mentioned accounts

Start from an event relation such as `noteRows`. Explode the canonical tag
arrays and inspect the resulting summary before continuing:

```jsonl
{"commandId":"tags-1","command":"explode","input":"noteRows","parameters":{"field":"event.tags","as":"tag","limit":1000},"resultId":"tagRows"}
{"commandId":"tags-summary-1","command":"show","input":"tagRows","parameters":{"mode":"summary"}}
```

If `summary.bounds.truncated` is true, the frequency result describes only
that bounded expansion. Narrow or window the source relation before treating
it as representative.

For hashtag frequency, retain `t` tags. For account-reference frequency,
replace `"t"` with `"p"`:

```jsonl
{"commandId":"hashtags-1","command":"filter","input":"tagRows","parameters":{"where":{"field":"tag.0","equals":"t"},"limit":1000},"resultId":"hashtagRows"}
{"commandId":"hashtag-counts-1","command":"aggregate","input":"hashtagRows","parameters":{"by":[{"field":"tag.1","name":"tag"}],"aggregations":[{"name":"mentions","operation":"count"}],"limit":1000},"resultId":"hashtagCounts"}
{"commandId":"hashtag-ranking-1","command":"sort","input":"hashtagCounts","parameters":{"by":[{"field":"mentions","direction":"descending"}]},"resultId":"rankedHashtags"}
{"commandId":"hashtag-preview-1","command":"show","input":"rankedHashtags","parameters":{"mode":"preview","previewLimit":10}}
```

This counts raw canonical tags. It does not silently reinterpret every `p` tag
as the same social role.

### Isolate notes from prolific authors

Aggregate event rows by author and retain authors meeting the chosen threshold:

```jsonl
{"commandId":"author-counts-1","command":"aggregate","input":"noteRows","parameters":{"by":[{"field":"event.author","name":"account"}],"aggregations":[{"name":"noteCount","operation":"count"}],"limit":1000},"resultId":"authorCounts"}
{"commandId":"prolific-authors-1","command":"filter","input":"authorCounts","parameters":{"where":{"field":"noteCount","gte":10},"limit":1000},"resultId":"prolificAuthors"}
```

Join that bounded author relation back to the original event rows:

```jsonl
{"commandId":"prolific-notes-1","command":"join","inputs":{"left":"noteRows","right":"prolificAuthors"},"parameters":{"on":{"left":"event.author","right":"account"},"kind":"inner","select":[{"field":"noteCount","name":"author.noteCount"}],"limit":1000},"resultId":"prolificNotes"}
{"commandId":"prolific-summary-1","command":"show","input":"prolificNotes","parameters":{"mode":"summary"}}
```

The threshold is a caller-defined research choice, not a bot or quality
classification.

## Observe results

`show` observes a named result:

- `preview`: a bounded page of members or rows;
- `summary`: a compact factual core at `result.summary` with the result kind,
  count and explicit unit, operation lineage, and applicable evidence
  resolution, bounds, completeness, and omissions; handle-specific facts
  remain alongside that core;
- `coverage`: sources, bounds, omissions, unresolved evidence, relay outcomes;
- `details`: bounded canonical evidence for the selected page;
- `explain`: membership reasons and provenance for the selected page.

`inspect` instead resolves one exact Nostr subject:

```jsonl
{"commandId":"inspect-1","command":"inspect","parameters":{"subject":{"type":"event","id":"<64-character-event-id>"}}}
```

`explain` resolves one subject's membership within a named result:

```jsonl
{"commandId":"explain-1","command":"explain","input":"accounts","parameters":{"subject":{"type":"account","id":"<64-character-pubkey>"}}}
```

Use `offset` with `show` to inspect later windows without another handle.

## Navigate and acquire more

Local commands never contact relays. `continue` follows a protocol
relationship. Ask its contextual schema for valid relationships and sources:

```jsonl
{"commandId":"schema-continue-1","command":"schema","input":"accounts","parameters":{"operation":"continue"}}
{"commandId":"authored-1","command":"continue","input":"accounts","parameters":{"relationship":"authored-notes","source":"relays","eventLimit":100},"resultId":"authoredNotes"}
```

A zero-input result is `empty-valid-result` only when every requested relay
reached a conclusive terminal state for that attempt. If any requested relay
remains inconclusive, the result remains externally partial and the absence is
unverifiable.

`fetch` uses relation fields to build a bounded relay filter. Ask its
contextual schema before choosing `bindings`; valid binding keys include
`ids`, `authors`, `#e`, `#p`, and `#t`.

`relay-count` estimates a filter independently on each relay. Never sum the
counts as a global total:

```jsonl
{"commandId":"count-1","command":"relay-count","parameters":{"filter":{"kinds":[1]}},"resultId":"counts"}
```

`relay-info` retrieves each relay's advertised NIP-11 document:

```jsonl
{"commandId":"relay-info-1","command":"relay-info","resultId":"relayInfo"}
```

Neither operation changes the evidence buffer.

## Keep evidence

```jsonl
{"commandId":"preserve-1","command":"preserve","input":"accounts","parameters":{"level":"reference","reason":{"type":"candidate-anchor"}}}
```

Evidence and working-state actions are independent:

- `release` removes a working handle;
- `release-archive` removes archived evidence;
- `reset` clears the entire session.

The engine does not store navigator judgments. Temporary orientation belongs
to caller-side working state; reusable methods and durable application metadata
belong to the embedding application. Conclusions stay with the navigator or an
explicit exported artifact rather than becoming a parallel engine memory.

## Common mistakes

- Starting a new process for every command.
- Omitting `input` because a result was used most recently.
- Reusing a `resultId` without `"replace": true`.
- Treating `ok: true` as proof that every relay completed.
- Filtering event text while holding a collection; use `relate` first.
- Inventing fields or parameters instead of asking contextual `schema`.
- Assuming a handle preserves evidence through buffer turnover.
- Treating a zero-result research query as an engine error.

## Response semantics

```json
{"ok":true,"commandId":"acquire-1","sessionRevision":2,"result":{},"warnings":[]}
```

```json
{"ok":false,"commandId":"acquire-1","sessionRevision":2,"error":{"code":"INVALID_OPERATION","message":"...","details":{}}}
```

Failed commands leave session state unchanged. Observation commands do not
advance `sessionRevision`. External commands can succeed with a
machine-readable `partial` status; inspect coverage rather than treating
partiality as failure.

Item limits and the response-size limit are independent. A page can therefore
return fewer items than requested. Read `sizeBounded`, `requestedItems`,
`returnedItems`, `omitted`, and `nextOffset` before interpreting the page.
Preview rows may list large fields under `omittedValueFields`; request
`details` with a smaller page when canonical evidence is needed.

For the in-process API, browser Worker adapter, exact contracts, and protocol
semantics, see the [package reference](./packages/nostr-research/README.md).
