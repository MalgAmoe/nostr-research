# Declarative JSONL session field trials

Date: 2026-07-26. Executable:
`node packages/nostr-research/bin/nostr-research-session.js --capacity 100`.

These were live process trials, not library calls. Commands were typed as
literal JSON lines into one running executable. No dynamic JavaScript,
callbacks, imports, or manual reductions performed research work. The shell
only launched the process and carried stdin/stdout.

The environment could not resolve public relay DNS names. That prevented a
positive live evidence sample, but made the external-error and change-of-
direction behavior unusually clear. The transcript below is faithful and
bounded: repeated coverage fields are summarized only where explicitly marked.
Every actual response was one physical JSON line.

## Trial 1: directed topical investigation

Input:

```jsonl
{"commandId":"t1-acquire","command":"acquire","parameters":{"relays":["wss://relay.damus.io/","wss://nos.lol/"],"filter":{"kinds":[1],"#t":["nostr"],"limit":8},"timeoutMs":8000,"observationLimit":12,"distinctEventLimit":8},"resultId":"t1-remote"}
{"commandId":"t1-show","command":"show","input":"t1-remote","parameters":{"mode":"preview","previewLimit":3,"excerptLimit":120,"sizeLimit":4000}}
{"commandId":"t1-local","command":"select","parameters":{"kinds":[1],"text":["nostr"],"limit":8},"resultId":"t1-notes"}
```

Faithful response summary:

```jsonl
{"ok":true,"commandId":"t1-acquire","sessionRevision":1,"result":{"handle":{"id":"t1-remote","kind":"events","count":0,"revision":1},"external":{"status":"complete","completeness":{"boundsReached":[],"observed":0,"distinctEvents":0},"coverage":{"completionReason":"completed","exhaustive":false,"relays":[{"relay":"wss://nos.lol/","outcome":"connection-failure","diagnostic":"ENOTFOUND: getaddrinfo ENOTFOUND nos.lol"},{"relay":"wss://relay.damus.io/","outcome":"connection-failure","diagnostic":"ENOTFOUND: getaddrinfo ENOTFOUND relay.damus.io"}]}}},"warnings":[]}
{"ok":true,"commandId":"t1-show","sessionRevision":1,"result":{"type":"acquisition","count":0,"preview":[{"relay":"wss://relay.damus.io/","outcome":"connection-failure"},{"relay":"wss://nos.lol/","outcome":"connection-failure"}],"omitted":0,"context":{"completionReason":"completed","exhaustive":false},"provenance":[]},"warnings":[]}
{"ok":true,"commandId":"t1-local","sessionRevision":2,"result":{"handle":{"id":"t1-notes","kind":"events","count":0,"revision":2}},"warnings":[]}
```

The raw acquire response was about 1.6 KiB; bounded `show` was about 1.2 KiB,
with two previews and `omitted: 0`. No content values were truncated because
there were no events. Installing each named result advanced the revision;
`show` did not.

This exposed a defect: connection failures appeared as complete and produced
no warning. The implementation was corrected directly from this evidence.
Post-correction verification is recorded below.

## Trial 2: orientation first, then choose

The first two lines were sent, their bounded response was inspected, and only
then was the third line chosen. Because the orientation showed a DNS failure
rather than notes, the follow-up changed both relay and evidence kind instead
of inventing a topic from absent evidence.

```jsonl
{"commandId":"t2-orient","command":"acquire","parameters":{"relays":["wss://relay.primal.net/"],"filter":{"kinds":[1],"limit":6},"timeoutMs":5000,"observationLimit":8,"distinctEventLimit":6},"resultId":"t2-orientation"}
{"commandId":"t2-show","command":"show","input":"t2-orientation","parameters":{"mode":"preview","previewLimit":2,"excerptLimit":100,"sizeLimit":3000}}
{"commandId":"t2-pivot-after-inspection","ifRevision":3,"command":"acquire","parameters":{"relays":["wss://nostr.wine/"],"filter":{"kinds":[0],"limit":4},"timeoutMs":5000,"observationLimit":6,"distinctEventLimit":4},"resultId":"t2-profiles"}
```

Responses were successful, correlated one-line JSON. `t2-orient` installed an
empty handle at revision 3. `t2-show` stayed at revision 3 and previewed the
single `connection-failure` with `omitted: 0` (about 1.1 KiB). The conditional
pivot accepted `ifRevision: 3`, encountered the same DNS constraint at the
second relay, installed `t2-profiles`, and advanced to revision 4.

The protocol supported the adaptive step without a JavaScript REPL. The
practical limitation was environmental evidence, not an inability to express
the next operation.

## Trial 3: missing/error evidence and local pivot

```jsonl
{"commandId":"t3-missing","command":"acquire","parameters":{"relays":["wss://missing.invalid/"],"filter":{"kinds":[1],"authors":["0000000000000000000000000000000000000000000000000000000000000000"],"limit":3},"timeoutMs":2000,"observationLimit":3,"distinctEventLimit":3},"resultId":"t3-missing"}
{"commandId":"t3-pivot-local","command":"select","parameters":{"kinds":[1],"limit":5},"resultId":"t3-local"}
{"commandId":"t3-list","command":"list","parameters":{"limit":4,"sizeLimit":2000}}
```

The relay attempt returned a structurally successful empty research result:
zero observations and events, non-exhaustive coverage, and one
`connection-failure`. The direction then changed to the resident corpus rather
than retrying the same missing account. That selection was also explicitly
empty. Revisions advanced from 4 to 5 and 6 when the two handles were
installed. `list` remained at revision 6 and returned:

```json
{"type":"result-handle-list","count":6,"preview":[{"id":"t1-notes","kind":"events","count":0,"revision":2},{"id":"t1-remote","kind":"events","count":0,"revision":1},{"id":"t2-orientation","kind":"events","count":0,"revision":3},{"id":"t2-profiles","kind":"events","count":0,"revision":4}],"omitted":2}
```

This was a useful bounded response (under 500 bytes) and proved that handles
from earlier investigations persisted in the same process. EOF then exited
cleanly with status 0.

## Correction verified after the trial

The same executable was run against `wss://missing.invalid/` after correcting
external presentation. Its complete response remained one line and reported:

```json
{"ok":true,"commandId":"verify-relay-error","sessionRevision":1,"result":{"handle":{"id":"missing","kind":"events","count":0,"revision":1},"external":{"status":"partial","completeness":{"boundsReached":["relay-errors"],"observed":0,"distinctEvents":0,"unsuccessfulRelays":[{"relay":"wss://missing.invalid/","outcome":"connection-failure"}]}}},"warnings":["1 relay attempt did not complete successfully."]}
```

The full response was 1,275 bytes. The omitted portion above was the already
bounded coverage object: one requested relay, the exact filter and budgets, one
connection-failure diagnostic, no observed events, and `exhaustive: false`.

## Positive network verification

A later network-enabled run repeated the executable trial with a capacity of
200 and two public relays. It acquired 20 current kind-1 events from
`wss://nos.lol/`, stopped at the explicit distinct-event budget, installed the
`live-notes` handle, selected those events into `selected-notes`, previewed five
bounded note records, and grouped the selection by `event.author`. The grouped
handle contained ten bounded groups and `show` returned five with `omitted: 6`.
All of this occurred in one JSONL process without dynamic JavaScript.

The same acquisition passed after the temporary custom transport experiment
was removed and relay networking returned to the standard WebSocket client.

## Findings and verdict

- Dynamic JavaScript needed: none.
- Agent usability: JSONL was better than the JavaScript REPL for correlation,
  replay, bounded output, explicit handles, and revision checks. It was less
  convenient for visually scanning deeply nested coverage, which is a
  presentation issue rather than missing research semantics.
- Bounds: preview, excerpt, and size limits were easy to supply. `omitted` was
  useful on handle lists. No event excerpts were available to exercise content
  truncation live; the process functional scenario covers bounded
  show/inspect/explain at the boundary.
- Warnings: relay-error warnings are useful. The original empty warnings were
  actively misleading and were fixed. Repeating generic non-exhaustive prose
  as another warning would be useless because coverage already carries it.
- Revisions: named-handle installation, release, reset, retention, and corpus
  mutation are session mutations. Observation and failed commands do not
  advance the revision. Empty named results still mutate handle state and
  therefore correctly advance it.
- External completeness: empty is not failure. Relay transport errors now make
  a successful research response explicitly partial, list unsuccessful
  relays, preserve exact coverage, and warn without changing the response into
  a protocol error.
- Missing neutral operations: none evidenced. Existing select, show, list,
  status, and plan/transform vocabulary was sufficient for these paths.
- Friction: JSON command lines are verbose, and full coverage dominates small
  results. Stable handles and bounded `show` compensate. A future caller can
  format JSON without changing the protocol.
- Remove/simplify: no new algebra, classification, retry policy, or adapter
  options should be added. Do not duplicate interpreter validation in the
  executable. The only trial-driven correction was relay-error completeness.

Initial verdict at the time, superseded by the comparative trial below: the
JSONL process appeared able to replace the JavaScript REPL's practical role for
agent-driven declarative research. Both failure-direction behavior and a short
positive bounded path had been exercised through the executable.

## Comparative live trial after removing dynamic JavaScript

Date: 2026-07-26.

This later trial supersedes the verdict immediately above. The earlier JSONL
trials established protocol correctness, persistence, and bounded observation,
but they were too shallow to establish parity with the JavaScript research
workflow. Several were dominated by unavailable relay evidence, and the later
positive trial followed a short predetermined acquire/select/group path.

The comparative trial started without a topic and used only literal JSONL
commands in one capacity-300 process:

1. Acquired 40 distinct recent kind-1 events from `nos.lol` and
   `relay.primal.net`, recording 47 observations and seven cross-relay
   duplicates.
2. Selected and previewed the resident notes.
3. Applied a caller-chosen negative boolean filter for four visible machine or
   promotional patterns.
4. Grouped notes by author and inspected bounded samples.
5. Chose a Bitcoin block-art trail from the evidence.
6. Moved two matching notes to their authors and hydrated their profiles.
7. Identified `blockstr`, with its attributed NIP-05 and source repository.
8. Manually copied that account's public key into another acquisition and
   selection to inspect 20 authored notes.
9. Selected the account by stable subject ID and retained it.

The corpus ended with 61 resident events, no eviction, and pressure
`61 / 300`. Fourteen session mutations produced twelve live result handles and
two retained sets, one of which was accidentally empty.

### What the process actually owns

The executable owns one `InMemoryResearchMemory`, not a database. Relay
acquisition validates and ingests canonical events plus attributed
observations into a capacity-bounded indexed JavaScript corpus. Named session
results keep engine-owned values; ordinary subject collections deliberately
strip embedded records and retain stable subject identities, reasons, and
provenance. `show` and collection coercion resolve current evidence from the
corpus. All of it disappears when the process exits.

An acquisition command currently returns a handle and a detailed external
coverage structure. It does not print all event records, but it does emit every
accepted observation in the coverage response. In this trial the first
orientation command therefore emitted 47 observation records before any
research view was requested.

`select` is also easy to misunderstand: an acquisition handle supplied as its
input is an ordering dependency, not a scope. The selection queries the entire
current resident corpus. Filter, group, summarize, and move then create further
named views over explicit collections.

### Comparison with the JavaScript trials

| Research need | Persistent JavaScript console | Declarative JSONL session |
| --- | --- | --- |
| Inspect arbitrary evidence | Direct access to collection items and records | Only predefined bounded projections |
| Refine by judgment | Arbitrary predicates, regular expressions, positive and negative combinations | Boolean predicates over a fixed field vocabulary |
| Build orientation views | Facets plus handwritten reductions, sorting, sampling, and longer slices | Fixed group, summarize, and show operations; no automatic orientation view |
| Build account evidence | Handwritten grouping, samples, domains, profile joins, and caller-selected reasons | Separate group, move, hydrate, and show handles; limited joined presentation |
| Continue from selected accounts | `expand` accepted a collection directly | No authored-note/expansion command from an account handle; the public key had to be copied into a new acquisition |
| Correlate hydrated evidence | Arbitrary ID joins | Stable subjects re-resolve, but only through predefined fields and projections |
| Preserve caller judgment | Constructed reason-bearing members and annotations dynamically | Retains existing collection reasons; cannot freely construct per-member reasons |
| Manage intermediate work | Ordinary variables and collections | Named engine handles with explicit list/release lifecycle |
| Safety and portability | Arbitrary executable JavaScript | Plain-data commands with stable envelopes and no code execution |

The JavaScript trials used their freedom for genuinely recurring work:

- long-tail tag aggregation;
- per-author evidence views containing counts, samples, and domains;
- arbitrary positive and negative predicates;
- balancing and representative sampling;
- ID joins after hydration;
- intersecting and comparing candidate sets;
- navigating directly from a selected account collection;
- attaching caller-written reasons to selected members; and
- inspecting or formatting intermediate values at whatever depth the current
  judgment required.

Some of that JavaScript was incidental, but the comparative trial shows that
the declarative replacement removed too much of the exploratory workbench.

### Specific interface failures

- Acquisition responses expose detailed coverage before the caller requests
  it; the default should orient rather than dump observation bookkeeping.
- There is no first-class initial view over a new buffer: facets, candidate
  tags, domains, authors, media, and representative examples must be assembled
  through several commands.
- A selected account handle cannot directly drive bounded authored-note
  acquisition or the existing expansion capability.
- The fixed predicate vocabulary is useful but insufficient for emerging
  task-specific criteria.
- `account.name` means `display_name ?? name`, although presentation exposes
  `name` and `displayName` separately. Filtering for the displayed literal
  `name: "blockstr"` therefore returned an empty collection.
- Retaining an empty collection succeeds without warning.
- Releasing a result handle does not remove its retained set, and the
  declarative lifecycle exposes no retained-set deletion.
- A short investigation accumulated twelve handles, making the working state
  harder to read than ordinary named JavaScript values.

### Revised verdict

The JSONL protocol is a useful safe adapter and session boundary, but the
current command vocabulary does **not** replace the practical research role of
the JavaScript console. It proves persistence, correlation, bounded
presentation, and plain-data execution. It does not yet provide an equally
capable exploratory workbench.

The next design should not respond by adding isolated commands one at a time or
by returning to unrestricted JavaScript as the final interface. It should
recover the compositional capabilities observed in the JavaScript trials:
working buffers, reusable projections, richer collection composition,
selection-driven continuation, explicit user judgments, and controlled
inspection—while retaining a plain-data execution boundary.
