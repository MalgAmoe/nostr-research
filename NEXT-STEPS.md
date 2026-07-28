# Project next steps

Status: decision memo based on the repository state on 2026-07-28.

## Current position

The project has reached a real core rather than another prototype.

The useful product boundary is:

```text
canonical Nostr evidence
    ↓
process-local research memory
    ↓
stable subject collections
    ↓
composable research relations
    ↓
one normalized operation executor
    ↓
persistent declarative session
    ↓
JSONL adapter
```

This boundary has now survived several kinds of research:

- broad relay sampling;
- topic scanning and explicit exclusions;
- balancing across authors;
- profile hydration;
- relationship continuation;
- evidence inspection;
- provisional human or agent judgments;
- buffer turnover and deliberately preserved knowledge; and
- interactive composition without executable JavaScript.

The latest sustained trial did not expose a missing research operation. It
used acquisition, selection, union, relations, scan, relation filtering,
balance, extraction, hydration, continuation, bounded observation, and the
notebook as one sequential research process.

That matters. The project should no longer respond to every difficult research
session by expanding the algebra. Nostr is noisy, inconsistent, and full of
machine activity. Some difficulty belongs to the evidence and to researcher
judgment rather than to the library.

## Main decision

The first two milestones made the existing research model truthful before
exposing it through another runtime:

```text
correct protocol relationships
    ↓
complete navigable protocol identities
    ↓
make the established core runtime-neutral
    ↓
prove it through a minimal second consumer
```

The [protocol capability map](./NOSTR-PROTOCOL-CAPABILITY-MAP.md) found that
canonical acquisition is sound, but some event kinds passed through generic
tag interpretation that produced misleading relationships. Milestone 1
corrected that defect. Milestone 2 added stable address subjects and decoded
tagged, shareable, and inline protocol references without turning hints into
identity or hidden relay behavior.

These were corrections to the evidence-navigation boundary already used by
the library, not requests for a broader NIP framework or more task-specific
operations. The runtime-neutral core is now established; the next active
milestone is proving the same session boundary through a minimal second
consumer.

## Milestone 1: truthful protocol relationships

Status: completed on 2026-07-28.

### Goal

Relationship navigation should describe what an event kind actually means,
without losing generic visibility of its original tags.

### Work

1. Introduce a small kind-aware relationship interpretation boundary.
2. Keep NIP-10 thread, mention, and quote semantics scoped to kind `1`.
3. Complete the applicable root and parent semantics for NIP-22 kind `1111`
   comments.
4. Represent kinds `6` and `16` as reposts.
5. Represent kinds `7` and `17` as reactions.
6. Represent kind `5` targets as deletion requests rather than reply-like
   references.
7. Retain raw tags and generic inspection after typed relationships are
   derived.
8. Verify the existing conversation, continuation, and relationship views
   through public-boundary functional behavior and a temporary mixed-kind
   research trial.

### Success condition

An event cannot enter an ordinary reply or conversation graph merely because
a tag with another protocol meaning resembles a NIP-10 reference. Inspection
still exposes the canonical event and original tags.

Implemented result: relationship derivation now has one kind-aware owner.
Kind-1 notes and kind-1111 comments retain thread edges; reposts, reactions,
and deletion requests expose typed targets; unknown event/account tags remain
mechanical references. Existing collection movement and continuation consume
the same relationship groups.

### What this milestone must not do

- create a universal event-kind registry or plugin system;
- interpret every known NIP;
- rewrite canonical events;
- hide unknown tags; or
- introduce moderation or trust policy.

## Milestone 2: navigable protocol references

Status: completed on 2026-07-28.

### Goal

A protocol reference visible in evidence should have the correct stable
identity and be usable in a later explicit local or relay operation.

### Work

1. Add an addressable-event coordinate identity distinct from an immutable
   event ID.
2. Resolve address coordinates by kind, author, and `d` identifier while
   preserving access to resident historical versions as evidence.
3. Decode the research-relevant NIP-19 entities: `npub`, `note`, `nprofile`,
   `nevent`, and `naddr`.
4. Parse NIP-21 `nostr:` URIs and NIP-27 inline references.
5. Support local address resolution and explicit relay acquisition through
   `#a`.
6. Preserve author and relay hints as attributed routing suggestions without
   silently changing the configured relay set.
7. Extend bounded inspection and contextual schema only as required to expose
   the new identity and available actions.

### Success condition

Event, account, and address references found in tags or content can become
stable subjects and participate in the same collection, relation, inspection,
and explicit acquisition model. Address coordinates never masquerade as event
IDs.

Implemented result: canonical replaceable coordinates are stable `address`
subjects with local current-event resolution. Valid `a` tags, NIP-22 address
roots and parents, public NIP-19/NIP-21 inputs, and bounded NIP-27 inline
references produce typed, explainable navigation. Author, kind, and relay
hints remain attributed metadata and never change identity, session relay
configuration, or acquisition behavior.

### What this milestone must not do

- automatically follow relay hints;
- add hidden acquisition;
- introduce a general URL or external-identity ontology;
- specialize the engine around long-form content; or
- add a second navigation API.

## Milestone 3: runtime-neutral core

Status: completed on 2026-07-28.

### Goal

The same memory, operations, session, schema, and presentation behavior should
run in Node and in a browser-compatible JavaScript environment. Node-specific
process behavior should remain an adapter concern.

### Work

1. Identify the smallest WebSocket construction boundary used by acquisition.
   Prefer a tiny injected constructor or factory over a transport framework.
2. Make acquisition use that boundary while retaining exactly the same relay
   accounting, cancellation, validation, budgets, and partial-result behavior.
3. Replace `Buffer.byteLength` in presentation with a runtime-neutral UTF-8
   byte measurement.
4. Keep JSONL stream parsing, signals, and command-line arguments in the Node
   adapter.
5. Decide whether package export paths are needed only after the dependency
   change is understood. Do not split the repository into several packages
   merely to create architectural appearance.
6. Run one temporary browser-like task validation that imports the public core,
   ingests real canonical events, executes a declarative research sequence, and
   observes bounded output. This is task validation, not a reason to add a new
   permanent browser test suite.

### Success condition

A browser-oriented consumer can import and operate the public research core
without a Node polyfill, while the existing JSONL process continues to work
unchanged from a caller's perspective.

### What this milestone must not do

- redesign acquisition;
- invent a generalized networking abstraction;
- introduce persistence;
- change operation names or result shapes;
- add a frontend;
- translate the engine to Rust;
- add TypeScript merely as part of the move; or
- create separate implementations for Node and the browser.

## Milestone 4: one non-Node interactive consumer

Only after the runtime-neutral milestone passes should the project create a
second consumer.

The purpose is not yet to design the final client. It is to prove that the
declarative session is a real application boundary rather than a CLI-specific
protocol.

A browser Worker is the most informative next consumer:

```text
browser interface or development harness
    ↓ structured command objects
Worker
    ↓
the same declarative session
    ↓
the same executor and memory
```

The Worker message protocol can use the same command and response objects as
JSONL without treating JSON Lines itself as the architecture. There should be
no second command language, alternate result model, or browser-only research
logic.

The first consumer can remain deliberately plain. It needs to demonstrate:

- start and close a session;
- configure relays and bounds;
- acquire evidence;
- submit arbitrary valid operations;
- list handles;
- show bounded previews and summaries;
- inspect and explain subjects; and
- see memory pressure, completeness, warnings, and errors.

It should not yet attempt to solve visual research navigation, recommendation,
feed design, moderation, or saved workspaces. Those decisions need observation
of actual human use against the same engine.

## Milestone 5: relay behavior visibility

### Goal

Make relay capability, limitations, completion, and refusal visible without
turning relay metadata into an automatic score or routing policy.

### Task 1: relay message and outcome visibility

1. Capture bounded `NOTICE` messages and standardized `CLOSED` reason
   prefixes on the existing acquisition path.
2. Parse NIP-67 EOSE `finish` and `more` hints without treating either as
   proof that a relay corpus is globally exhaustive.
3. Distinguish failure before a WebSocket opens, a peer closing before relay
   completion, an explicit subscription refusal, and ordinary operation
   bounds.
4. Keep three authentication facts distinct:
   - `authChallengeObserved` means that the relay sent a neutral NIP-42
     challenge;
   - `auth-required` is an observed request outcome only when the subscription
     is actually refused as requiring authentication; and
   - `advertisedAuthRequired` is an attributed NIP-11 claim, not an acquisition
     outcome.
5. Do not answer an authentication challenge, load a signer, or infer that a
   read request failed merely because a challenge was observed.
6. Carry every new fact through acquisition, normalized results, session
   handles, bounded `show coverage`/`show details`, and factual schema. A fact
   hidden in transport bookkeeping does not satisfy this milestone.

### Task 2: explicit NIP-11 relay inspection

1. Add one explicit external operation that requests NIP-11 documents and
   returns an attributed, bounded relay-information report.
2. Report the requested relay, retrieval time, HTTP outcome, document fields,
   supported NIPs, advertised limitations, and omissions.
3. Preserve retrieval failures, non-JSON responses, malformed fields, and
   absent optional fields without turning them into empty relay claims.
4. Make the ephemeral result nameable by a session and observable through
   bounded `show` modes and contextual schema.
5. Do not put relay advertisements in the research notebook or acquisition
   coverage, fetch them implicitly during acquisition, or make a relay into a
   stable Nostr subject merely to support `inspect`.

### Success condition

A caller can understand what a selected relay claims to support, what limits
it advertises, what happened during the actual request, and whether the relay
provided a completion hint. None of those facts silently changes relay choice.

Connection reuse, retry policy, NIP-50 search, NIP-65 routing, and responding
to authentication remain later candidates. In particular, an `AUTH` challenge
must not silently become key management or signing behavior as part of relay
diagnostics.

## Milestone 7: NIP-45 count before acquisition

### Goal

Let a researcher estimate the scale of one exact request at selected relays
before deciding whether and how to acquire events.

### Work

1. Add an explicit external count operation using NIP-45 rather than hiding a
   count request inside acquisition.
2. Normalize the request and response through the same public operation,
   session, schema, and bounded-presentation seams as the existing core.
3. Report each relay independently, including unsupported, rejected, timed
   out, malformed, exact, and approximate outcomes.
4. Preserve the relay's approximate metadata when supplied.
5. Treat every count as attributed planning evidence. Never sum or otherwise
   collapse overlapping relay counts into an unexplained global total.
6. Do not mutate the observation buffer, archive, or notebook.

### Success condition

A researcher can compare bounded per-relay estimates for one filter and decide
whether to narrow, partition, or acquire it without mistaking the estimates
for global Nostr truth.

## Milestone 6: sustained research before more engine design

After relay visibility and explicit count are available, return to sustained
research trials. The milestone numbers preserve the historical document names;
the deliberate execution order is M5, then M7, then M6.

The important trials are not isolated searches for a known answer. They should
exercise movement over time:

1. acquire a bounded window;
2. inspect its structure;
3. form provisional interests and exclusions;
4. preserve judgments or a small amount of evidence;
5. navigate to related subjects;
6. allow the observation buffer to turn over;
7. continue from notebook knowledge or archived evidence; and
8. verify that the researcher still understands what is resident, preserved,
   unresolved, partial, or omitted.

The vessel metaphor is useful here: the researcher cannot retain the whole
Nostr universe. The system should make movement, carrying selected knowledge,
and losing renewable evidence understandable. It should not silently automate
those decisions.

Record repeated friction, not one-off inconvenience. A library change should
normally require one of these signals:

- the same generic operation is repeatedly recreated outside the library;
- the existing operation cannot express a research step without arbitrary
  code;
- evidence, interpretation, and working views become confused;
- bounds or partiality cannot be understood;
- the same command has surprising behavior across direct, plan, and session
  execution; or
- a consumer must reproduce engine semantics.

The trials should also compare advertised relay capability with observed
behavior and deliberately exercise event, account, and address navigation.
Only repeated friction should promote another protocol feature into committed
work.

## Later protocol candidates

The protocol audit identifies useful possibilities beyond the committed
milestones:

- NIP-50 relay search as an explicit remote operation distinct from local
  scanning;
- selected public NIP-51 lists for attributed discovery and moderation
  evidence;
- deletion, expiration, warning, label, report, and assertion status;
- NIP-05 and NIP-39 identity verification; and
- richer profile, long-form, media, and file projections.

These remain candidates, not a backlog to implement automatically. The full
rationale and guardrails live in
[NOSTR-PROTOCOL-CAPABILITY-MAP.md](./NOSTR-PROTOCOL-CAPABILITY-MAP.md).

## Things not worth doing next

### Do not add more operations speculatively

The current algebra is broad. Difficult research results are not proof that a
new operation is missing. Prefer a concrete repeated research obstruction.

### Do not split large modules because they are large

`memory.js`, `interpreter.js`, `relation.js`, and `presentation.js` are the
largest modules, but their responsibilities are currently recognizable:

- memory owns the three stores and indexes;
- the interpreter owns session protocol and handles;
- relations own value-oriented analysis;
- presentation owns bounded observation.

Splitting them without a new boundary would distribute one responsibility
across more files and make the project harder to follow. Extract code only
when the portability work or a repeated defect reveals a real independent
owner.

### Do not add persistence yet

Process-local loss is explicit and coherent. Persistence would force decisions
about serialization, migrations, identity, archive policy, user ownership, and
possibly synchronization. None is required to validate the research model.

### Do not introduce TypeScript as a cleanup project

The factual schema and runtime normalizers are the public contract. TypeScript
could later improve development ergonomics for multiple consumers, but a
conversion now would create broad churn without answering a current product
question.

### Do not encode quality, personhood, or credibility

Bots, projects, people, pseudonyms, organizations, and automated tools all use
the same protocol. The system should expose evidence that helps a researcher
judge them. It should not silently decide what counts as a real person, a good
account, or a trustworthy source.

### Do not build the final UI from assumptions

The old interface was useful for discovering product ideas but accumulated
workflow assumptions and state problems. A future interface should consume the
stable session and be informed by observed use. It must not define a separate
engine.

## Secondary issues to watch, not milestones

These deserve attention only when evidence makes them active:

- whether the hard observation-buffer maximum of 1,000 events is useful or
  merely an early safety value; current selection, inspection, relation
  resolution, and cloning costs assume this bound, so raising it requires
  measurement and review rather than a constant-only change;
- whether contextual schema remains usable from a non-CLI consumer;
- whether exact provenance remains understandable after many transformations;
- whether acquisition retry information is sufficient during unreliable relay
  sessions;
- whether relation resolution costs become noticeable near capacity;
- whether notebook entries need richer source references after long sessions;
- whether package naming still reflects a library that now does much more than
  memory; and
- whether NIP-65 evidence needs first-class inspection without turning an
  account's advertised relay choices into automatic routing or scoring.

None currently justifies changing the engine.

## Recommended order

```text
1. Correct kind-aware protocol relationships — completed
2. Complete addressable and inline-reference navigation — completed
3. Make the established core runtime-neutral — completed
4. Add a minimal browser/Worker consumer — completed
5. M5: expose relay capability and observed behavior
6. M7: add explicit per-relay NIP-45 count
7. M6: run sustained research with buffer turnover
8. Let repeated trial friction decide multi-filter REQ, NIP-51, authentication,
   retry policy, or unanticipated work
9. Design a human-facing interface after observing the second consumer
10. Add persistence or Rust only if real constraints demand them
```

## Final perspective

The important achievement is not the number of operations. It is that one
bounded, inspectable research environment now lets a caller acquire evidence,
look at it, make provisional decisions, navigate, and retain selected
knowledge without confusing source evidence with interpretation.

The truthfulness corrections are now complete: different event kinds do not
create false thread relationships, and protocol references retain stable
event, account, or address identities. Portability is now more valuable than
speculative additional power. A second consumer can then test whether the
boundary is genuinely general, and sustained research can decide which relay
or protocol capabilities are worth adding. Only after that should the project
decide what the human application ought to become.
