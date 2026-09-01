# Project context

## Purpose

Nostrarium is a project for research, navigation, and exploration of Nostr. It
is not being shaped as a conventional feed client. Its job is to help a human
and an embedded research agent acquire evidence, inspect it, navigate
relationships, preserve useful collections, and understand why a result is
present. The agent operates the research system; the human directs the voyage,
intervenes, inspects evidence, and owns the conclusions.

The product foundation is a UI-independent library. The CLI, functional
verification, agents, and any future adapters are consumers of that library;
no presentation layer defines the domain boundary.

The current product application is local rather than hosted. It embeds the agent
runtime, provider authentication, engine, and controller in one installed
desktop application while keeping the visible renderer isolated from Node and
credentials. This choice does not change the engine's runtime-neutral or
browser-compatible boundary.

## Settled principles

- Memory is one process-local research environment shared by the library, CLI,
  functional verification, and future applications. It owns a renewable,
  capacity-bounded observation buffer and deliberately preserved evidence.
  These have different lifetimes and must not be conflated.
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
  included in a query, relationship traversal, or named result.
- Research-engine persistence and a database format are deliberately absent.
  Closing or resetting memory, or ending the process, loses all resident
  research state. The desktop application may separately persist settings and
  recipes without persisting engine memory.
- Nostr content is untrusted evidence. An embedded agent receives only bounded
  Nostrarium research operations, never coding, shell, filesystem, arbitrary
  network, credential, or executable-UI authority.

## Shared terms

| Term | Meaning |
| --- | --- |
| **event** | A raw, valid Nostr event: immutable source evidence. |
| **address** | A canonical NIP-01 coordinate for current replaceable or addressable event state; it is a stable subject distinct from every immutable historical event ID. |
| **observation** | A record that evidence was encountered through a particular acquisition context, such as a relay and its outcome. |
| **memory** | The process-local owner of the observation buffer, evidence archive, and their derived indexes. |
| **observation buffer** | The renewable, capacity-bounded store of canonical events recently acquired from relays, their observations, and temporary indexes. Buffer evidence may be evicted. |
| **evidence archive** | Deliberately preserved evidence copied from the observation buffer at an explicit preservation level. Archive evidence is not silently evicted to make room for relay acquisition. |
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
| **navigator** | The human or embedded agent directing the next research operation. The human owns the objective and final conclusions; the agent owns the current movement through the field. |

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

## Process-local boundaries

Memory is the process-local owner of two distinct kinds of state:

- the observation buffer owns canonical relay events, observations, and
  temporary indexes, and may evict them according to its explicit capacity;
- the evidence archive owns only material deliberately preserved as a
  reference, bounded excerpt, or complete canonical event.

Resolution reports whether evidence came from the archive, the buffer, or is
currently unresolved. Ordinary acquisition never silently grows the archive.
Buffer eviction never silently deletes archived evidence. Archive limits fail
explicitly rather than silently discarding research state.

A session is the persistent declarative research session: it owns named result
handles and a revision over one process-local memory. Commands name their
inputs and outputs explicitly; there is no active or current selection. A
result collection is the shared operation result passed between the library
and session layers. Handles remain views and do not silently copy complete
events. All state disappears on reset, close, or process exit; sessions are
not serialized.

Research configuration has explicit precedence and ownership. Engine
constraints describe immutable supported ranges. Memory and archive capacities
are chosen when memory is constructed because changing them can
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
session view. It does not mutate the observation buffer or archive;
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

Session status reports observation-buffer and archive counts separately, while
handle listing reports working-view cardinality. After buffer turnover,
archived canonical evidence still resolves, while excerpt-only or unpreserved
references are honestly unresolved. Releasing archive evidence changes
resolution; releasing handles does not; reset clears every owner and handle.

The final public flow is sustained through one declarative session and its
JSONL executable: acquire explicitly, select locally, navigate subject
collections, cross into relations for value analysis, preserve only deliberate
evidence, and inspect every bound and
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
