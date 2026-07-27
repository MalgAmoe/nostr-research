# Research memory turnover field trial

## Verdict

PASS for deterministic system capability, with the live-network judgment
limited by the worker sandbox.

The real JSONL executable maintained coherent research state after all four
original observation-buffer events were evicted. Notebook queries and named
membership remained usable, canonical archive evidence resolved, excerpt-only
and unpreserved event references were reported unresolved, and a later `fetch`
bound its `authors` filter from a notebook-derived relation without JavaScript
or manual identifier copying. Releasing the archived profile made its existing
handle unresolved without deleting the three notebook judgments or the named
membership. Reset reduced buffer, archive, notebook, and handle counts to zero.

This verdict establishes lifecycle and composition behavior. It does not
establish relay completeness, researcher-quality classifications, or public
relay reliability.

## Method and evidence sources

Run date: 2026-07-27, Europe/Paris.

The deterministic phase ran:

```sh
node packages/nostr-research/bin/nostr-research-session.js --capacity 4
```

The executable was unmodified. A temporary Node loader substituted only its
`ws` transport dependency with an in-process deterministic relay because this
worker sandbox rejects socket listening and outbound network access. The relay
returned nine valid signed events from four deterministic keys: one profile,
three candidate notes, four turnover events, and one later note. The normal
acquisition code still performed NIP-01 filter matching, canonical validation,
ingestion, budget accounting, observation recording, and eviction. The
temporary loader and driver were removed after the run; they are not product
or permanent test code.

The complete correlated JSONL response record was inspected from
`/tmp/nostr-turnover-trial.json`. That file is temporary task validation, not a
durable product format. Counts and selected serialized response sizes below
come from that record.

## Commands and iterative investigation

The following commands were sent as individual JSON lines. Parameters omitted
here were the repeated deterministic relay URL, `timeoutMs: 1000`,
`observationLimit: 4`, `distinctEventLimit: 4`, and `concurrency: 1`.

1. Acquire and orient:
   - `acquire` as `orientation`, filter
     `{kinds:[0,1],until:150,limit:4}`.
   - `select` notes from `orientation` as `candidates`, limit 3.
   - `pick` positions 1, 2, and 3 as `positive`, `negative`, and `uncertain`.
2. Record explicit research knowledge:
   - three `remember` commands recorded `interested`, `uninterested`, and
     `uncertain` judgments, attributed to `field-trial researcher`;
   - `remember-membership` recorded all three candidates under
     `turnover candidates` with reason
     `field-trial-candidate-selection`.
3. Preserve deliberate evidence:
   - select the profile from `orientation` as `profile`;
   - `preserve` the profile at `canonical` level;
   - `preserve` the interested candidate at `canonical` level so its author
     can support later acquisition;
   - `preserve` the uncertain candidate at `excerpt` level with a 48-character
     bound.
4. Observe ownership before turnover:
   - `status` as `before-turnover`.
5. Replace the complete buffer:
   - `acquire` as `turnover-evidence`, filter
     `{kinds:[2],since:200,until:203,limit:4}`.
6. Continue from prior knowledge:
   - query `notebook` for `interested` as `remembered-positive`;
   - `show candidate-membership` and `show remembered-positive` with bounded
     evidence;
   - `relate remembered-positive` as `positive-rows`;
   - `fetch positive-rows` as `directed-evidence`, filter
     `{kinds:[1],since:250,limit:4}`, with
     `bindings:{authors:"event.author"}`.
7. Release evidence independently:
   - `release-archive profile`;
   - `show profile`;
   - inspect `membership` named `turnover candidates`;
   - run `status` and `list`.
8. End the process-local lifecycle:
   - `reset`;
   - `status`;
   - `close`.

No command embedded executable JavaScript. The later `fetch` command named
`positive-rows`; it did not contain a public key or event ID.

## Observations and completeness

Before turnover, `status` reported:

| Owner | Count/capacity | Other visible size evidence |
| --- | --- | --- |
| Observation buffer | 4 events / 4 | pressure 1.0, 0 evictions, 3 authors, 2 kinds |
| Evidence archive | 3 entries / 4 | 2 canonical, 1 excerpt, 0 reference |
| Research notebook | 3 entries, 1 membership / 1000 | knowledge was explicitly attributed |
| Named views | 7 handles | status response was about 536 serialized bytes |

The turnover acquisition accepted four distinct observations and reported
four added and four evicted events. Its before/after buffer counts were both
4, while eviction count changed from 0 to 4. It stopped at the explicit
observation bound, so its completeness was correctly `partial`; it did not
claim an exhaustive relay result. The response was about 949 bytes.

After turnover:

- the three-member notebook membership still showed three stable subjects;
- one source resolved from canonical archive evidence;
- the excerpt-only and unpreserved sources were honestly unresolved;
- the notebook query for the interested judgment returned one subject whose
  canonical event resolved from the archive;
- the membership `show` response was about 9.4 KB and the one-item notebook
  view about 5.5 KB with `includeEvidence:true`; both were bounded
  presentation responses, not hidden copies inside the handles; and
- the directed `fetch` bound one author from one relation row, acquired one
  later event, completed at EOSE, and evicted one turnover event. Its response
  was about 942 bytes.

After explicit profile release, `show profile` reported `resolved:false`.
Archive entries decreased from 3 to 2 (1 canonical and 1 excerpt); notebook
remained at 3 entries and 1 membership. The buffer remained bounded at 4
events, now with 5 cumulative evictions. Eleven named handles represented 20
total result rows/cardinality units (counts summed from `list`); the bounded
list response was about 981 bytes. These numbers expose the views as navigation
state rather than suggesting 20 additional canonical events.

After reset, buffer events, archive entries, notebook entries, notebook
memberships, and handles were all zero. Buffer evictions also reset to zero.

## Researcher judgments versus system capability

The positive, negative, and uncertain labels were scripted researcher
judgments chosen to exercise notebook semantics. The system did not infer
them, score them, or promote them into relay trust. The deterministic contents
made each choice inspectable, but this trial does not claim those labels are
generally correct.

System-generated facts were limited to canonical validation, exact filter
matching, observations and their relay attribution, buffer eviction,
resolution source, archive level, notebook attribution, handle cardinality,
and bounded acquisition coverage.

The archived excerpt remained useful as a bounded quotation but did not resolve
as canonical evidence after turnover. This is intentional and was reported as
unresolved rather than silently upgraded.

## Bounded live phase

A second unmodified executable used capacity 10 and attempted:

```json
{"commandId":"live-orient","command":"acquire","parameters":{"relays":["wss://relay.damus.io"],"filter":{"kinds":[1],"limit":3},"timeoutMs":2000,"observationLimit":3,"distinctEventLimit":3,"concurrency":1},"resultId":"live-orientation"}
```

The environment denied the connection. The response was successful as a
bounded operation but `partial`, with 0 observations, 0 distinct events,
`relay-errors` as the bound/reason, and one `connection-failure` outcome.
Status remained buffer 0/10, archive 0/10, notebook 0 entries/0 memberships,
and one empty handle. Therefore no honest judgment about current public-relay
content or research ergonomics can be made from this run. The useful ergonomic
finding is that failure coverage was concise and did not mutate evidence.

## Friction and implementation findings

- The sandbox prevents both local socket listening and outbound relay access,
  requiring a transport-only deterministic substitute for exact JSONL
  validation.
- The first complete run exposed that `show` did not recognize a real
  notebook-membership result even though later operations could consume it.
  This returned `INTERNAL_ERROR`; presentation dispatch was fixed and the
  existing public notebook-turnover functional scenario now protects it.
- `describe()` duplicated the buffer under top-level legacy corpus fields and
  `observationBuffer`. The duplicate shape was removed. `status` now presents
  buffer, archive, and notebook ownership separately, and acquisition
  summaries read the explicit buffer shape.
- A trial `list` limit of 50 exceeded the documented maximum of 20 and surfaced
  as a generic internal error rather than a semantic parameter error. Using
  the valid bound completed the trial. Error classification for presentation
  option bounds remains a genuine, non-blocking limitation outside this
  storage-lifecycle task.
- `includeEvidence:true` is intentionally verbose. The default compact view is
  preferable for orientation; detailed evidence is best requested only for a
  small candidate window.

## Final assessment

Research continuity survived complete observation-buffer turnover with
distinct, observable owners and lifecycles. Exact archive evidence, notebook
knowledge, and working handles did not collapse into one store. A named
notebook-derived relation directed a later bounded acquisition without copied
identifiers. Archive release changed resolution without rewriting notebook
history, and reset cleared the entire process-local environment.

The remaining uncertainties are public-relay ergonomics in a network-enabled
environment, the generic error classification for an over-limit presentation
option, and broader product choices already listed as open in `CONTEXT.md`.
