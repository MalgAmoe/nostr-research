# Reviewer role

You are the independent reviewer in a repository-backed workflow.

Review the selected task, its acceptance criteria, the worker's deliverables,
the relevant repository sources, and the validation output. Do not modify any
repository source, deliverables, task state, or workflow records. Do not repair
the work. When the selected task explicitly requires runtime verification and
provides a writable reviewer sandbox, you may create disposable databases only
in ignored `.data/` paths or the system temporary directory.

The first non-empty line of your response must be exactly one of:

- `PASS`
- `CHANGES_REQUIRED`
- `BLOCKED`

Use `PASS` only when all acceptance criteria are materially satisfied.

Treat the durable principles in `CONTEXT.md` as constraints on every task.
Historical completed tasks do not override current policy. Do not invent
stronger acceptance criteria than the selected task defines.

Audit test changes as carefully as production changes:

- Permanent tests are exceptional and must protect stable public behavior.
- Reject unnecessary tests, helper-level tests, and tests that freeze private
  implementation or third-party runtime mechanics.
- Reject tests of TCP, TLS, WebSocket-library behavior, process scheduling, or
  exact timing unless the selected task explicitly makes that mechanism a
  product responsibility.
- Reject production APIs, abstractions, dependencies, or low-level machinery
  introduced only to satisfy a test.
- Accept temporary validation or run artifacts for live-network,
  environment-specific, exploratory, and one-off evidence.
- Passing validation is not evidence that every test is worth keeping.

For `CHANGES_REQUIRED`, provide a finite numbered list of concrete findings.
Each finding must identify the affected deliverable or source evidence and
state what must change. Do not request optional polish or expand the task.

Use `BLOCKED` when completion requires a human decision or unavailable external
information. Also use it when the same substantive finding from the supplied
previous review remains after another worker attempt: stop for reassessment
instead of requesting a third mechanical implementation.


# Canonical project context

# Project context

## Purpose

Nostrarium is a project for research, navigation, and exploration of Nostr. It
is not being shaped as a conventional feed client. Its job is to help a person
acquire evidence, inspect it, navigate relationships, preserve useful collections,
and understand why a result is present.

The product foundation is a UI-independent library. The CLI, functional
verification, agents, and any future adapters are consumers of that library;
no presentation layer defines the domain boundary.

## Settled principles

- Memory is one process-local research environment shared by the library, CLI,
  functional verification, and future applications. It owns a renewable,
  capacity-bounded observation buffer, deliberately preserved evidence, and
  explicit research knowledge. These have different lifetimes and must not be
  conflated.
- A raw, valid Nostr event is immutable source evidence. Store evidence
  without silently rewriting its event content or identity.
- Indexes, relationship views, search terms, rankings, labels, and other
  interpretations are derived from evidence. They must be reproducible from
  their inputs and replaceable without treating them as the source record.
- Relay acquisition and querying local memory are distinct, composable
  operations. Acquisition may add observations and evidence; querying explains
  what the local research memory currently contains. A caller may compose
  either or both.
- Provenance is research output, not hidden transport bookkeeping. The system
  must make observable where evidence came from and the reason a result was
  included in a query, relationship traversal, or named notebook membership.
- Persistence and a database format are deliberately absent. Closing or
  resetting memory, or ending the process, loses all resident state.

## Shared terms

| Term | Meaning |
| --- | --- |
| **event** | A raw, valid Nostr event: immutable source evidence. |
| **address** | A canonical NIP-01 coordinate for current replaceable or addressable event state; it is a stable subject distinct from every immutable historical event ID. |
| **observation** | A record that evidence was encountered through a particular acquisition context, such as a relay and its outcome. |
| **memory** | The process-local owner of the observation buffer, evidence archive, research notebook, and their derived indexes. |
| **observation buffer** | The renewable, capacity-bounded store of canonical events recently acquired from relays, their observations, and temporary indexes. Buffer evidence may be evicted. |
| **evidence archive** | Deliberately preserved evidence copied from the observation buffer at an explicit preservation level. Archive evidence is not silently evicted to make room for relay acquisition. |
| **research notebook** | Explicit process-local research knowledge: subject judgments, labels, notes, named membership and selected derived observations with reasons and source references. It is interpretation, not Nostr source evidence. |
| **session** | The persistent declarative, in-process owner of named result handles and a revision over one process-local memory. |
| **research configuration** | The explicit effective settings for one memory and session: immutable engine constraints, construction-time capacities, mutable defaults for future commands, and per-command overrides. |
| **result handle** | A session-owned name for an engine view. Handles are replaceable navigation state and do not silently preserve canonical evidence. |
| **subject collection** | A bounded set of stable Nostr subjects with membership reasons and provenance. |
| **research relation** | A bounded composable view of stable subjects, derived values, reasons, and provenance. Source-backed fields resolve from the archive or buffer; a relation must not accidentally become an undocumented evidence archive. |
| **field lineage** | Lightweight relation metadata recording which earlier field produced a renamed or grouped value and, when known, whether that value is a stable account or event identifier. It assists navigation without interpreting the value itself. |
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **acquisition coverage** | Information returned by one bounded relay attempt: exact filter and budgets, contacted relays and outcomes, and observations. It does not claim exhaustive indexing or create a global history record. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **provenance** | Observable source and acquisition history for evidence, including the context needed to assess it. |
| **derived relationship** | A reproducible interpretation connecting evidence (for example reply, mention, tag, author, or citation); it is not raw evidence and can be replaced. |
| **navigator** | The human or agent operating a vessel and making every research decision. |
| **vessel** | A coherent, named research posture adopted by a navigator over the existing engine and session. It shapes attention and movement without owning facts or conclusions. |

## Vessels

A vessel is a coherent, named way of moving through the Nostr field on top of
the research engine. It is operated by a navigator—a human or an agent—who
makes every research decision.

A vessel is not an engine feature, a UI, an autonomous actor, or a subset of
the operation vocabulary. It is a complete research posture expressed through
caller-side conventions over the existing session: configuration defaults,
habitual operations, observation modes, judgment practices, and a collection
goal. Most vessels may use most of the engine.

A vessel couples four dimensions:

1. **Movement** — how the navigator acquires and traverses the field: breadth
   versus depth, acquisition habits, preferred navigation primitives, and the
   routes made attractive at each point.
2. **Senses** — which observations, projections, and presentation modes
   habitually frame the evidence encountered by the navigator.
3. **Judgment** — the practices and tempo through which the navigator forms
   notebook knowledge. Judgment always belongs to the navigator; the vessel
   shapes what is seen, in what order, and with what framing.
4. **Collection** — the shape and intent of the knowledge the navigator is
   trying to accumulate toward an eventual exportable artifact.

These dimensions form a loop with the navigator at its center: senses inform
judgment, judgment steers movement, and movement determines what the senses
encounter next. A distinct vessel deliberately changes at least one dimension
while keeping the whole loop coherent. Two vessels use the same engine,
operations, and session protocol, but should lead the same navigator through
measurably different journeys over the same field.

Ownership remains explicit:

```text
engine     owns what is true
vessel     owns what is attended to
navigator  owns what is concluded
```

Vessels live entirely on the caller side. The engine, session, schema, and
operation vocabulary do not know they exist. A vessel may arrange and
foreground factual engine results, but it never computes domain facts, ranks
by its own authority, or acts on the navigator's behalf. Any remembering or
preservation remains an explicit engine operation directed by the navigator;
the vessel owns no hidden research memory.

A vessel is disposable and implies a way of visualizing evidence even before
that presentation exists. Its exact lifetime, interaction model, degree of
factual observation assistance, and concrete presentation are deliberately
open. They will be discovered by building and using vessels, then promoting
only repeated findings into the durable model.

## Testing policy

- Permanent unit tests are reserved for difficult, stable protocol rules,
  cryptographic behavior, and precise algorithms worth freezing.
- Functional tests exercise public library or CLI boundaries with the real process-local corpus.
- There is no automatic requirement to add a test for every feature or bug.
- Tests must not import private helpers or freeze internal architecture.
- Task validation and fresh-agent exploratory scenarios may be temporary run
  artifacts rather than permanent tests.
- When network behavior is under review, live relay checks are task validation,
  not an always-on brittle test suite.

## Deliberately open decisions

These principles settle the direction, not a final public API, ranking method,
or user interface. Product and design work
must still decide, through evidence and experimentation where appropriate:

- the reliability, cancellation, retry, and partial-result contract for
  multi-relay acquisition;
- event-validation and trust boundaries, including signatures and external
  identity claims;
- provenance detail and notebook-membership semantics;
- relay metadata, planning, configuration, moderation, and persistence policy;
- which current protocol interpretations are normative and which analysis or
  account-search heuristics are optional or excluded;
- pagination, corpus, portability, telemetry, and relationship semantics; and
- which future adapters, if any, should consume the library.

## Process-local boundaries

Memory is the process-local owner of three distinct kinds of state:

- the observation buffer owns canonical relay events, observations, and
  temporary indexes, and may evict them according to its explicit capacity;
- the evidence archive owns only material deliberately preserved as a
  reference, bounded excerpt, or complete canonical event;
- the research notebook owns explicit interpretation and navigation knowledge,
  including judgments, labels, notes, memberships, reasons, and source
  references.

Resolution reports whether evidence came from the archive, the buffer, or is
currently unresolved. Ordinary acquisition never silently grows the archive
or notebook. Buffer eviction never silently deletes archived evidence or
notebook knowledge. Archive and notebook limits fail explicitly rather than
silently discarding research state.

A session is the persistent declarative research session: it owns named result
handles and a revision over one process-local memory. Commands name their
inputs and outputs explicitly; there is no active or current selection. A
result collection is the shared operation result passed between the library
and session layers. Handles remain views and do not silently copy complete
events. All state disappears on reset, close, or process exit; sessions are
not serialized.

Research configuration has explicit precedence and ownership. Engine
constraints describe immutable supported ranges. Memory, archive, and notebook
capacities are chosen when memory is constructed because changing them can
evict or reject state. Session configuration supplies mutable defaults for
future acquisition and presentation. Explicit command parameters override
those defaults for one operation. Generic session configuration never resizes
memory or silently changes existing evidence.

The coherent product path is memory, subject collections and research
relations, normalized operations, the declarative session, and its JSONL
adapter. Operation names and result kinds have one
authoritative definition shared by validation, execution, session handles,
schema output, and presentation. `show`, `inspect`, and `explain` remain one
deep bounded-observation module over those real result shapes; presentation
does not define alternate domain results or compatibility shapes.

Named plans and individual session commands share the same operation
representation. A command may name one `input` or a map of named `inputs`;
multi-input analysis is therefore available during an iterative session and
does not require a static plan or executable JavaScript. Relay-backed `fetch`
consumes relation fields, so acquisition can be directed by the current
analysis rather than hidden inside task-specific workflows. Pure `extract`
crosses relation values into stable subjects; protocol continuation starts
only from an explicit subject collection.

Relation transformations retain field lineage when fields are renamed or used
as grouping keys. This allows a later `extract` operation to recover a known
account/event transition without inferring meaning from the new field name.
Lineage is metadata, not evidence or a general type system. Technical
presentation facts such as per-row truncation remain separate from ordinary
analysis values.

Local selection asks what the current resident memory contains and has no network
side effects. Relay acquisition is separately invoked by a caller, may add
evidence and observations, returns the same reusable result vocabulary, and
returns bounded acquisition coverage directly to the caller. Coverage says
that a precise relay/filter/budget attempt occurred. It is not registered as
global history and never says that the relay or time window was exhaustively
indexed.

The public research core is runtime-neutral and uses Web Platform primitives,
including the runtime's standard `WebSocket`, `TextEncoder`, Web Crypto,
timers, and abort signals. Acquisition has one implementation across direct,
plan, session, hydration, continuation, and relation-backed fetch execution;
runtime capabilities are not command parameters or serialized research state.
The JSONL executable remains a Node adapter that owns streams, process
arguments, signals, and CLI diagnostics.

NIP-11 and NIP-65 material describes advertised relay capability or an
account's advertised read/write relay choices. These claims remain attributed
evidence. Per-relay acquisition outcomes are observed behavior, and the
library does not silently turn either advertised claims or observations into a
relay quality, trust, or fallback score.

NIP-11 inspection is one explicit input-free external operation over selected
relay URLs. It uses the runtime's standard fetch, returns one bounded attributed
retrieval outcome per relay, and may be held only as an ephemeral factual
session view. It does not mutate the observation buffer, archive, or notebook;
it is not acquisition coverage, and ordinary acquisition never performs a
hidden relay-information request. Advertised authentication requirements
remain claims and do not establish an acquisition refusal.

NIP-45 count is a separate explicit input-free external operation for one
exact normalized filter over selected relay URLs. Its bounded report preserves
one exact or approximate response, protocol evidence, refusal, diagnostic, or
failure outcome per relay. Counts are never summed across overlapping relay
corpora, counting does not mutate research memory, and it performs neither
hidden acquisition nor hidden NIP-11 inspection.

Acquisition exposes separate operation-wide bounds for accepted valid relay
observations and distinct canonical event IDs. Duplicate observations consume
the observation budget but not the distinct-event budget. Reports keep
received packets, accepted observations, duplicate observations, newly stored
corpus events, and distinct events acquired separate, and identify which bound
stopped an operation.

Relay acquisition reports connection-level `NOTICE` and `AUTH` packets
separately from subscription-scoped packets. Per-relay diagnostics are bounded
and retain omission counts. Outcomes distinguish failure before opening,
opened-peer closure, explicit `CLOSED` refusal, EOSE completion, and
operation-wide bounds. Standardized refusal prefixes and NIP-67 `finish` or
`more` hints retain bounded raw evidence, but neither EOSE nor a hint claims
global exhaustiveness. An observed authentication challenge is neutral
transport evidence; only an `auth-required:` refusal establishes that request
outcome, and acquisition never signs or answers a challenge.

Per-relay acquisition coverage also retains the observed attempt lifecycle:
whether a worker started the attempt, whether the WebSocket opened, whether
the Nostr subscription request was sent, packets received, observations
accepted, and the final outcome. An unstarted relay, a pre-open stop, and an
opened subscription with zero packets remain distinguishable. Zero packets
does not imply that a relay was slow, silent, or late.

Canonical validation alone does not establish that relay evidence belongs to
the requested slice. Acquisition matches each canonical event against the
exact normalized NIP-01 filter before ingestion or budget accounting and
reports canonical non-matches separately. Nested relay requests inside one
continuation are deliberately absent: one acquisition command performs one
explicit bounded relay attempt. Multi-step research composes those attempts
sequentially and keeps each outcome visible.

Relay acquisition excludes directly self-warned content by default after
canonical validation and exact filter matching but before budgets and
ingestion. A direct `content-warning` tag or a self-label in the
`content-warning` namespace triggers the exclusion; its report retains only a
count. Callers may explicitly disable the setting. Kind-1985 labels and
kind-1984 reports remain attributed third-party evidence and never become
hidden acquisition policy. Direct `memory.ingest()` remains policy-free.

Notebook queries and named memberships can be converted to ordinary subject
collections for later operations. They restore stable subjects and recorded
reasons without relay access or reconstruction of evicted canonical evidence.
Notebook judgments, labels, and notes can outlive eviction of the evidence they
reference, but disappear with `reset()`, `close()`, or process exit. Their
meaning remains provisional and attributed to the caller that recorded them.

Session status reports observation-buffer, archive, and notebook counts
separately, while handle listing reports working-view cardinality. After
buffer turnover, notebook collections remain composable, archived canonical
evidence still resolves, and excerpt-only or unpreserved references are
honestly unresolved. Releasing archive evidence changes resolution but not
notebook history; releasing handles changes neither; reset clears every owner
and handle.

The final public flow is sustained through one declarative session and its
JSONL executable: acquire explicitly, select locally, navigate subject
collections, cross into relations for value analysis, preserve only deliberate
evidence or attributed notebook knowledge, and inspect every bound and
omission. Contextual schema visibility and named inputs expose generic
operations for ordinary sequential research without executable JavaScript.
Profile claims, protocol metadata,
mechanical matches, and graph proximity remain evidence for researcher
judgment rather than implicit credibility or trust scores.

Protocol relationship derivation is kind-aware and remains a replaceable view
over canonical evidence. Kind-1 and kind-1111 thread edges alone form
conversations; repost, reaction, and deletion targets retain distinct
relationship types. Unknown event and account tags remain mechanical
references rather than inheriting NIP-10 meaning. The relationship vocabulary
and the groups used by collection movement and continuation have one owner, so
navigation cannot drift from ingestion semantics.


# Selected task

---
id: 077-deterministic-views-and-isolated-boundaries
status: in_progress
max_attempts: 4
validation: workflow/tasks/077-deterministic-views-and-isolated-boundaries.validate.sh
depends_on: 076-truthful-contracts-and-evidence-state
---

# Make derived views deterministic and isolate permanent external boundaries

## Context

Derived ordering currently uses `localeCompare`, and case-insensitive scanning
uses locale-sensitive lowercasing while reusing normalized-string offsets
against the original text. Results can therefore vary by host locale or ICU
version, and Unicode case expansion can produce incorrect match and excerpt
offsets.

The permanent suite also contains continuation scenarios that can reach real
DNS through `fixture.invalid`, while the public browser Worker adapter has no
direct functional boundary scenario. Several fake WebSocket fixtures duplicate
mechanics, but consolidation is useful only where it makes the tests smaller
and clearer.

## Goal

Make identical inputs produce identical derived views across supported
runtimes, keep scan evidence aligned to original text, and remove accidental
environment dependence from permanent tests.

## Work

1. Replace host-locale-dependent ordering used by collection and relation
   operations with one deterministic code-point comparison rule.
2. Apply the same deterministic rule anywhere it affects public sort order,
   min/max selection, set/move ordering, or other derived results.
3. Make case-insensitive scan matching independent of host locale.
4. Preserve match `start`, `end`, and excerpt positions against the original
   string even when Unicode case folding changes normalized code-unit length.
   Do not merely substitute `toLowerCase()` and retain invalid offsets.
5. Preserve existing substring/word, any/all, field, term, case-sensitive, and
   result-limit semantics.
6. Correct existing assertions if they pin locale-dependent behavior. Do not
   delete coverage silently.
7. Remove real DNS/network dependence from permanent continuation and
   relationship functional tests. Use deterministic in-process WebSocket
   fixtures at the public boundary.
8. Add one functional scenario for the exported browser Worker adapter covering
   initialization, one valid command/response exchange, malformed-message
   rejection, and close/lifecycle behavior. Reuse the real session engine.
9. Consolidate fake relay/WebSocket support only where multiple tests share the
   same mechanics and the result is less code. Do not create a transport test
   framework.
10. Update durable documentation only if deterministic ordering or scan-offset
    semantics are currently described differently.

## Acceptance criteria

- Collection and relation results have the same ordering independent of host
  locale and ICU collation.
- Case-insensitive scan produces the same matches across supported runtimes.
- Unicode case-expansion examples report offsets and excerpts against the
  original input correctly.
- Case-sensitive and ordinary ASCII scan behavior remains unchanged.
- Permanent tests do not depend on DNS resolution or public relay timing.
- The browser Worker public adapter has one concise boundary scenario and still
  uses the same interpreter/session implementation.
- Test support is simpler or unchanged in size; no general mocking framework is
  introduced.

## Non-goals

- Linguistic or locale-aware collation.
- Natural-language stemming, tokenization, fuzzy search, or semantic search.
- A general Unicode search library or dependency.
- Live-relay tests in the permanent suite.
- Exhaustive Worker protocol tests, browser UI tests, or private message-helper
  unit tests.
- API versioning or compatibility shims for locale-dependent ordering.

## Verification

- Permanent tests expected: yes, one focused deterministic scan/order boundary,
  extensions of existing continuation fixtures, and one browser Worker public
  boundary scenario.
- Stable public behavior protected: deterministic ordering, original-text scan
  offsets, isolated continuation outcomes, and Worker message lifecycle.
- Temporary task validation or field evidence: run the functional suite under
  at least two available locale settings if the environment supports them; the
  same seeded outputs must result.
- Explicitly excluded test levels or mechanisms: private comparator/scanner
  tests, live DNS or relays, exhaustive Unicode conformance, Playwright UI
  testing, and a standalone fake-server framework.


# Previous independent review

CHANGES_REQUIRED

1. `packages/nostr-research/src/deterministic-text.js:13` builds offset-aware folded text by lowercasing each Unicode code point separately, but terms are folded as whole strings. Context-sensitive casing therefore breaks valid matches: `"ΟΣ"` folds to `"ος"` as a term but `foldCaseWithOffsets("ΟΣ").text` becomes `"οσ"`. Update the mapper so its searchable text exactly matches whole-string folding while retaining correct original UTF-16 boundaries.

2. Extend the focused public scan scenario in `packages/nostr-research/test/reference-resolved-views.functional.test.js:22` with a context-sensitive casing example such as Greek final sigma. The current `İ` case covers length expansion but does not detect the inconsistent folding above.

# Worker report

Implemented both review findings.

Deliverables:
- Fixed offset-aware case folding to use exact whole-string lowercase output while retaining original UTF-16 boundary mapping.
- Extended the public functional scan scenario with Greek final-sigma matching (`ΟΣ` → `ος`) and verified original offsets `7..9`.

Validation:
- Focused functional test: passed.
- Static checks: passed.
- Full task validation: 43/43 tests passed.
- `git diff --check`: passed.

Permanent tests expanded:
- Public relation scan scenario now protects both Unicode length expansion (`İ`) and context-sensitive casing (`ΟΣ`). Temporary validation would not adequately prevent regression in stable scan matching and original-text offset semantics.

Unresolved uncertainties: none.

# Validation output

Exit code: 0


> nostrarium@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/protocol.js && node --check src/reference.js && node --check src/protocol-relationships.js && node --check src/event-content.js && node --check src/relay-url.js && node --check src/configuration.js && node --check src/contract-facts.js && node --check src/memory.js && node --check src/collection.js && node --check src/acquire.js && node --check src/relay-info.js && node --check src/relay-count.js && node --check src/operations.js && node --check src/relation.js && node --check src/pipeline-source.js && node --check src/plan.js && node --check src/interpreter.js && node --check src/continuation.js && node --check src/presentation.js && node --check src/jsonl-session.js && node --check src/browser-worker.js && node --check bin/nostr-research-session.js


> nostrarium@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

✔ synchronous relay request send failure is an attributed terminal peer outcome (2.261834ms)
✔ relation fetch binds deduplicated values into an ordinary acquisition (17.18825ms)
✔ acquisition rejects unusable public inputs before networking (0.383459ms)
✔ relay acquisition excludes direct self-warnings by default with a factual override (43.788875ms)
✔ public acquisition and session reports preserve bounded relay messages and honest outcomes (37.547583ms)
✔ relay lifecycle facts distinguish unstarted, pre-open, subscribed-zero, rejected, and contributed attempts (4.502208ms)
✔ address subjects navigate typed references to current local replaceable evidence (79.460667ms)
✔ ordinary acquisition accepts an explicit canonical #a filter (0.408416ms)
✔ browser Worker adapter owns one real session through message and close lifecycle (67.8525ms)
✔ direct, plan, and session execution share operation kinds and failure boundaries (30.070292ms)
✔ collections navigate identities while relations own value analysis (27.086292ms)
✔ collection accounting separates rejected identities from bounded omissions (13.392916ms)
✔ relation handles report operation-specific cardinality and proven truncation (298.656917ms)
✔ relay continuation does not claim a valid empty result when one relay fails (24.996792ms)
✔ named account and note handles continue with bounded relationship provenance (2374.707666ms)
✔ factual schemas construct commands accepted through the public session seam (58.582333ms)
✔ summary size bounds retain the public factual core and report presentation omissions (238.259834ms)
✔ declarative observation and lifecycle form one bounded public workflow (5.261625ms)
✔ relation summaries compact source selection details without losing their shape (6.06275ms)
✔ declarative named results compose compatible sets and expose their schema (15.031042ms)
✔ declarative notebook knowledge survives turnover and remains independent from evidence (42.767875ms)
✔ relations normalize bounded attachment evidence and generically explode objects (315.930875ms)
✔ relations expose lazy factual event content and conversation fields (99.503917ms)
✔ canonical archive aliases merge observations while buffer residency stays independent (58.860792ms)
✔ explicit archive preservation survives complete buffer turnover and releases atomically (39.0645ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (21.056416ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (40.186209ms)
✔ JSONL executable provides one persistent bounded process workflow (85.300541ms)
✔ process-local memory preserves canonical evidence and independent relay observations (33.826042ms)
✔ memory bounds retained event provenance and preserves visible omissions in collection views and canonical archives (369.432ms)
✔ canonical account preservation retains bounded provenance omissions (235.383625ms)
✔ protocol rejects a canonical-looking event carrying another event signature (1.10975ms)
✔ public references normalize to stable subjects while hints stay attributed metadata (5.201458ms)
✔ mixed event kinds derive truthful references without polluting conversations (67.508541ms)
✔ inline NIP-27 references navigate as typed, explainable evidence without becoming threads (12.887583ms)
✔ replaceable selection and follow interpretation remain stable in one process (34.564792ms)
✔ public local search composes constraints, explains matches, and preserves provenance (28.500375ms)
✔ relation ordering and case-folded scan offsets are deterministic public results (61.936083ms)
✔ relation handles resolve references across evidence lifetime and keep bounded views composable (40.561083ms)
✔ relay count remains attributed and never creates a global total (6.000875ms)
✔ relay count cancellation distinguishes started and unstarted attempts (0.165917ms)
✔ relay information stays attributed, bounded, and reusable through the public executor (7.487416ms)
✔ large notebook membership is atomic, bounded, process-local, and directly navigable (2252.274583ms)
ℹ tests 43
ℹ suites 0
ℹ pass 43
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2770.892042


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.