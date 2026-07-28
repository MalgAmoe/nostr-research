# CLI guide

This is the practical entry point for operating Nostr Research. The CLI is a
persistent research process, not a one-shot command and not a prompted shell.

## Start and stop

From the repository root:

```sh
npm run research-session -- --capacity 1000
```

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

The session contains four different things:

- an observation buffer of recently acquired canonical events;
- an archive of evidence deliberately preserved before buffer turnover;
- a notebook of explicit researcher judgments and memberships;
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
→ explicitly preserve evidence or remember a judgment
```

There is no implicit active result. Every consuming command names its `input`;
every reusable output gets a `resultId`.

## Discover commands without guessing

Start with the compact global schema:

```jsonl
{"commandId":"schema-1","command":"schema"}
```

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
- `continue`, `hydrate`, `preserve`, and notebook operations where applicable.

Relations contain rows and values derived from subjects. Use `relate` to enter
this layer. Relations support:

- `filter`, `project`, `distinct`, `sort`, `slice`;
- `aggregate`, `derive`, `join`;
- `explode`, `scan`, `balance`;
- `extract` to return a field to navigable subjects;
- `fetch` to bind row values into an explicit relay query.

Never guess a field name. Ask contextual `schema`.

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

## Keep evidence and decisions

```jsonl
{"commandId":"preserve-1","command":"preserve","input":"accounts","parameters":{"level":"reference","reason":{"type":"candidate-anchor"}}}
{"commandId":"remember-1","command":"remember","input":"accounts","parameters":{"judgment":"interested","strength":0.7,"reason":"Repeated relevant evidence in this session","attribution":"researcher","labels":["privacy"]}}
{"commandId":"membership-1","command":"remember-membership","input":"accounts","parameters":{"name":"privacy-candidates","reason":{"type":"field-trial"}}}
```

These actions are independent:

- `release` removes a working handle;
- `delete-membership` removes a membership;
- `release-archive` removes archived evidence;
- `forget` removes notebook judgments;
- `reset` clears the entire session.

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

For the in-process API, browser Worker adapter, exact contracts, and protocol
semantics, see the [package reference](./packages/nostr-research/README.md).
