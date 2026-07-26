# Composable session milestone field trial

Date: 2026-07-27

## Method

This trial drove the real `nostr-research-session --capacity 120` executable
through its stdin/stdout JSONL boundary. The worker sandbox refused both
external WebSocket connections and a loopback listener (`listen EPERM`), so a
temporary Node loader substituted a bounded, in-process fixture relay for the
`ws` transport. That relay emitted the repository's two canonical signed
kind-1 fixture events followed by NIP-01 `EOSE`. The executable, JSON parsing,
declarative interpreter, acquisition validation and filter matching, memory,
response envelopes, and process lifecycle were otherwise the production
paths. The adapter and loader were removed after the run.

No dynamically authored JavaScript performed a research operation. A Python
driver only wrote the JSON lines, read one response line per command, and
copied the returned retained-set UUID into later declarative commands.

The complete bounded run issued 30 commands, received 30 response lines, and
exited 0. The only stderr was Node's warning about the temporary experimental
loader.

## Bounded JSONL transcript

The acquisition crossed the executable boundary and returned two accepted
observations and two distinct canonical events:

```text
> {"commandId":"acquire-noisy","command":"acquire","parameters":{"relays":["wss://bounded-fixture.invalid/"],"filter":{"kinds":[1],"limit":30},"timeoutMs":2000,"observationLimit":30,"distinctEventLimit":30,"concurrency":1},"resultId":"noisy"}
< {"ok":true,"commandId":"acquire-noisy","sessionRevision":1,"result":{"handle":{"id":"noisy","kind":"events","count":2,"revision":1,"scope":"acquisition"},"external":{"status":"complete","completeness":{"boundsReached":[],"observed":2,"duplicateObservations":0,"distinctEvents":2,"relays":{"attempted":1,"complete":1,"incomplete":0,"outcomes":[{"outcome":"eose","count":1}]}}}},"warnings":[]}
```

I narrowed the acquisition, derived authors and referenced accounts through
two inspectable moves, and combined them:

```text
> {"commandId":"notes","command":"select","input":"noisy","parameters":{"scope":"acquisition","kinds":[1]},"resultId":"notes"}
< {"ok":true,"commandId":"notes","sessionRevision":2,"result":{"handle":{"id":"notes","kind":"events","count":2,"revision":2,"scope":"acquisition"}},"warnings":[]}
> {"commandId":"authors","command":"template","input":"notes","parameters":{"name":"accounts-from-notes","limit":10},"resultId":"authors"}
< {"ok":true,"commandId":"authors","sessionRevision":3,"result":{"handle":{"id":"authors","kind":"accounts","count":1,"revision":3},"expansion":{"operation":"move","parameters":{"to":"authors","limit":10}}},"warnings":[]}
> {"commandId":"mentioned","command":"move","input":"notes","parameters":{"to":"referencedAccounts","limit":10},"resultId":"mentioned"}
< {"ok":true,"commandId":"mentioned","sessionRevision":4,"result":{"handle":{"id":"mentioned","kind":"accounts","count":1,"revision":4}},"warnings":[]}
> {"commandId":"candidate-group","command":"union","input":"authors","parameters":{"with":"mentioned","limit":10},"resultId":"candidate-group"}
< {"ok":true,"commandId":"candidate-group","sessionRevision":5,"result":{"handle":{"id":"candidate-group","kind":"accounts","count":2,"revision":5}},"warnings":[]}
```

`show-group` returned both exact public keys. `explain-author` showed that the
chosen author was supported by two `event-author` transitions and two relay
observations; the mention-only account was therefore a useful noisy
counterexample, not silently discarded evidence.

I changed from the two-account candidate group to its author, then pursued the
author into two resident notes and conversation context:

```text
> {"commandId":"chosen-account","command":"difference","input":"candidate-group","parameters":{"with":"mentioned","limit":10},"resultId":"chosen-account"}
< {"ok":true,"commandId":"chosen-account","sessionRevision":6,"result":{"handle":{"id":"chosen-account","kind":"accounts","count":1,"revision":6}},"warnings":[]}
> {"commandId":"authored","command":"template","input":"chosen-account","parameters":{"name":"authored-notes","source":"local","eventLimit":20},"resultId":"authored"}
< {"ok":true,"commandId":"authored","sessionRevision":7,"result":{"handle":{"id":"authored","kind":"subjects","count":2,"revision":7},"completeness":{"status":"complete","scope":"resident-corpus","exhaustive":true,"inputs":[{"status":"resolved","resultCount":2}]},"expansion":{"operation":"continue","parameters":{"relationship":"authored-notes","source":"local","eventLimit":20}}},"warnings":[]}
> {"commandId":"context","command":"template","input":"authored","parameters":{"name":"conversation-context","source":"local","eventLimit":20},"resultId":"context"}
< {"ok":true,"commandId":"context","sessionRevision":8,"result":{"handle":{"id":"context","kind":"subjects","count":2,"revision":8},"expansion":{"operation":"continue","parameters":{"relationship":"conversation","source":"local","eventLimit":20}}},"warnings":[]}
```

`explain-authored-note` and `explain-context-note` both confirmed membership
for the second fixture event. Its unresolved zero-ID parent remained explicit;
the result did not claim exhaustive external conversation coverage.

Positive and negative judgment then became ordinary set inputs:

```text
> {"commandId":"positive","command":"annotate","input":"chosen-account","parameters":{"judgment":"interested","strength":0.8,"reason":"Two authored notes and a visible conversation edge"}}
< {"ok":true,"commandId":"positive","sessionRevision":9,"result":{"type":"annotation-change","judgment":"interested","strength":0.8,"changed":1},"warnings":[]}
> {"commandId":"negative","command":"annotate","input":"mentioned","parameters":{"judgment":"uninterested","reason":"Mention-only account is a preserved counterexample for this inquiry"}}
< {"ok":true,"commandId":"negative","sessionRevision":10,"result":{"type":"annotation-change","judgment":"uninterested","changed":1},"warnings":[]}
> {"commandId":"working","command":"difference","input":"positives","parameters":{"with":"negatives","limit":20},"resultId":"working"}
< {"ok":true,"commandId":"working","sessionRevision":13,"result":{"handle":{"id":"working","kind":"accounts","count":1,"revision":13}},"warnings":[]}
```

Both annotation queries remained present as one-subject handles. No score,
training, inferred label, or automatic classification appeared.

Finally, I retained the working result, renamed it, explicitly replaced its
membership with the negative example, released its handle, and changed
direction by bulk-releasing all intermediate handles:

```text
> {"commandId":"release-saved-handle","command":"release","input":"saved-handle","parameters":{}}
< {"ok":true,"commandId":"release-saved-handle","sessionRevision":17,"result":{"type":"released-result-handle","id":"saved-handle"},"warnings":[]}
> {"commandId":"inspect-retained-after-release","command":"set","parameters":{"id":"999fe5ac-0697-4dbe-a674-635de854f206"}}
< {"ok":true,"commandId":"inspect-retained-after-release","sessionRevision":17,"result":{"type":"retained-selection","id":"999fe5ac-0697-4dbe-a674-635de854f206","name":"reviewed examples","memberCount":1},"warnings":[]}
> {"commandId":"release-direction","command":"release-all","parameters":{}}
< {"ok":true,"commandId":"release-direction","sessionRevision":18,"result":{"type":"released-result-handles","count":11},"warnings":[]}
> {"commandId":"sets-survive-release-all","command":"sets","parameters":{}}
< {"ok":true,"commandId":"sets-survive-release-all","sessionRevision":18,"result":{"type":"retained-selection-list","count":1,"sets":[{"id":"999fe5ac-0697-4dbe-a674-635de854f206","name":"reviewed examples","memberCount":1}]},"warnings":[]}
> {"commandId":"delete-retained","command":"delete-set","parameters":{"id":"999fe5ac-0697-4dbe-a674-635de854f206"}}
< {"ok":true,"commandId":"delete-retained","sessionRevision":19,"result":{"id":"999fe5ac-0697-4dbe-a674-635de854f206","deleted":true},"warnings":[]}
> {"commandId":"final-sets","command":"sets","parameters":{}}
< {"ok":true,"commandId":"final-sets","sessionRevision":19,"result":{"type":"retained-selection-list","count":0,"sets":[],"omitted":0},"warnings":[]}
```

This demonstrates the lifecycle distinction across the actual JSONL process:
release discarded handles, while only `delete-set` deleted retained evidence.

## Discovery, friction, and ownership

The initial `schema` command disclosed annotation fields and meanings,
retained-set commands, literal `account.name` and `account.display_name`
fields, and normalized template expansions without source inspection.

Exact friction:

- The sandbox could not perform external or loopback WebSocket I/O. The
  temporary fixture relay made the JSONL and acquisition paths repeatable, but
  this remains bounded fixture evidence, not a claim about a public relay.
- `show` on the `authored` continuation handle returned `INTERNAL_ERROR`.
  `explain` on the same handle worked and allowed the trial to continue. A
  neutral presentation of heterogeneous `subjects` continuation handles
  belongs in the library/session and should return either a bounded view or a
  clear type error, never an internal error.
- Selecting why two accounts form a coherent working group, which account to
  pursue, and whether an example is positive or negative remains human
  judgment. The library should preserve these provisional decisions and
  caller reasons, not automate them.
- A retained-set UUID must be copied from `sets` into later lifecycle
  commands. This is explicit and unambiguous, though less terse than hidden
  “current set” state.
- Templates helped only because every response exposed the ordinary normalized
  `move` or `continue` operation. Additional domain-named templates would risk
  hiding rather than expanding capability.

## Verdict

The declarative JSONL session now provides the practical exploratory
capability formerly supplied by arbitrary JavaScript: bounded acquisition,
iterative handles, explainable navigation, provisional positive and negative
judgment, set composition, retention, and an unambiguous release/delete
lifecycle. The trial made a genuine research choice and changed direction; it
did not merely prove that commands parse.

The JavaScript research REPL can be deprecated as a product research surface.
It may remain temporarily as a developer diagnostic while the separate
Node-dependency milestone is open. The `show` failure is a presentation defect
in an otherwise expressible declarative path, not a reason to preserve
dynamically authored JavaScript as a research operation.
