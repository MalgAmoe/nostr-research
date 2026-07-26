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

Verdict: the JSONL process can replace the JavaScript REPL's practical role for
agent-driven declarative research. Keep the REPL for now, as required. A later
deprecation decision should include a successful live relay trial in an
environment with DNS/network access; this field trial proved the protocol and
failure-direction workflow but could not compare rich positive evidence
navigation.
