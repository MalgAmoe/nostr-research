# Reviewer role

You are the independent reviewer in a repository-backed workflow.

Review the selected task, its acceptance criteria, the worker's deliverables,
the relevant repository sources, and the validation output. Do not modify any
files. Do not repair the work.

The first non-empty line of your response must be exactly one of:

- `PASS`
- `CHANGES_REQUIRED`
- `BLOCKED`

Use `PASS` only when all acceptance criteria are materially satisfied.

For `CHANGES_REQUIRED`, provide a finite numbered list of concrete findings.
Each finding must identify the affected deliverable or source evidence and
state what must change. Do not request optional polish.

Use `BLOCKED` only when completion requires a human decision or unavailable
external information.



# Canonical project context

# Project context

## Purpose

This project is a tool for research, navigation, and exploration of Nostr. It
is not being shaped as a conventional feed client. Its job is to help a person
acquire evidence, inspect it, navigate relationships, preserve useful sets,
and understand why a result is present.

The product foundation is a UI-independent library. A CLI, functional
verification, and future user interfaces are consumers of that library; a UI
does not define the domain boundary. The current Solid application is a
behavioral reference during this work. Its code and observed behavior may be
retained, recreated, or rejected deliberately; neither its Solid controllers,
browser persistence, nor its present module layout is an implicit target
architecture.

## Settled principles

- SQLite is the one real storage path for the library, CLI, functional
  verification, and future applications. Do not introduce an in-memory store
  as a production or functional-test substitute.
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
  included in a query, relationship traversal, or saved set.
- Experimental databases are disposable and regenerable. During this phase
  there is no compatibility or migration burden for database formats.

## Shared terms

| Term | Meaning |
| --- | --- |
| **event** | A raw, valid Nostr event: immutable source evidence. |
| **observation** | A record that evidence was encountered through a particular acquisition context, such as a relay and its outcome. |
| **memory** | The local SQLite-backed research record of evidence, observations, and replaceable derived material. |
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **research run** | One recorded execution of a research operation, with its inputs, outcomes, and time/context sufficient to interpret it. |
| **research set** | A deliberately saved, named or otherwise identifiable group of evidence for later inspection or expansion. |
| **provenance** | Observable source and acquisition history for evidence, including the context needed to assess it. |
| **derived relationship** | A reproducible interpretation connecting evidence (for example reply, mention, tag, author, or citation); it is not raw evidence and can be replaced. |

## Testing policy

- Permanent unit tests are reserved for difficult, stable protocol rules,
  cryptographic behavior, and precise algorithms worth freezing.
- Functional tests exercise public library or CLI boundaries with real SQLite.
- There is no automatic requirement to add a test for every feature or bug.
- Tests must not import private helpers or freeze internal architecture.
- Task validation and fresh-agent exploratory scenarios may be temporary run
  artifacts rather than permanent tests.
- When network behavior is under review, live relay checks are task validation,
  not an always-on brittle test suite.

## Deliberately open decisions

These principles settle the direction, not a final public API, permanent
database schema, ranking method, or user interface. Product and design work
must still decide, through evidence and experimentation where appropriate:

- the reliability, cancellation, retry, and partial-result contract for
  multi-relay acquisition;
- event-validation and trust boundaries, including signatures and external
  identity claims;
- the durable provenance detail and research-run/set semantics;
- relay metadata, planning, configuration, moderation, and persistence policy;
- which current protocol interpretations are normative and which analysis or
  account-search heuristics are optional or excluded;
- pagination, corpus, portability, telemetry, and relationship semantics; and
- which future UI workflows, if any, should consume the library.

The current application contains useful behavior in all of these areas, but it
does not settle them. In particular, its IndexedDB/localStorage persistence,
Solid state, hidden array metadata, relay cache policy, and editorial scoring
heuristics must not be copied into the library by default.


# Selected task

---
id: 003-separate-reference-application
status: in_progress
max_attempts: 4
validation: workflow/tasks/003-separate-reference-application.validate.sh
depends_on: 002-project-contract
protected_paths: CONTEXT.md workflow/artifacts workflow/run.py workflow/prompts
---

# Separate the reference application

## Objective

Give the repository a simple physical boundary between the existing Solid
application and the new UI-independent library without changing application
behavior.

## Required result

Create this minimal shape:

```text
apps/
  reference-client/
packages/
  nostr-research/
workflow/
docs/
```

Move the existing application source, server, HTML, Vite configuration,
key-generation script, package metadata, runtime `keys/` and `logs/` locations
as appropriate into `apps/reference-client/`. Generated output, installed
dependencies, secrets, keys, and usage logs must not be committed or copied as
source assets.

Create a minimal root npm workspace that can run the reference client commands.
Reserve `packages/nostr-research/` without inventing its implementation in this
task. A short README or placeholder package description may establish its
purpose.

## Constraints

- Preserve reference-client runtime behavior and its existing commands.
- Do not refactor product modules while moving them.
- Do not make the reference client consume the future library.
- Do not introduce shared configuration packages, build orchestration
  frameworks, monorepo managers, or compatibility wrappers.
- Update repository paths in documentation, ignores, and scripts only where the
  move makes that necessary.
- Existing uncommitted source content belongs to the project and must be moved
  intact.

## Acceptance criteria

- The root clearly separates applications from packages.
- The reference client installs through the root workspace and can be started
  from an obvious root command.
- Its existing tests and production build pass from the reorganized repository.
- Its server and key-generation scripts pass syntax checks.
- No existing product source module or permanent test is deleted.
- Git ignores generated databases, dependencies, builds, keys, and logs at
  their new locations.
- `packages/nostr-research/` contains no speculative architecture.
- The resulting organization is understandable without wrapper scripts.


# Worker report

Deliverables verified:
- Reference client relocated to apps/reference-client/.
- Root npm workspace and direct root commands configured.
- packages/nostr-research/ reserved with only a purpose README.
- Documentation and ignore rules updated for the new layout.
- All original client source and permanent tests confirmed byte-for-byte intact after relocation.

Validation performed:
- workflow/tasks/003-separate-reference-application.validate.sh passed.
- 44 client tests passed.
- Production build passed.
- Server and key-generation syntax checks passed.
- Root npm test command passed.
- Ignore coverage confirmed for dependencies, builds, keys, logs, and SQLite files.

Unresolved uncertainties:
- None.

# Validation output

Exit code: 0


> nostr-research-client@0.1.0 test
> node --test src/*.test.js

✔ name blocks use case-insensitive contains matching (0.651375ms)
✔ name block patterns are trimmed and normalized (0.111334ms)
✔ restored events survive a muted source only when another allowed source observed them (1.038875ms)
✔ restored provenance merges with newer in-memory provenance (0.174458ms)
✔ relay timeout remains distinguishable from a successful empty response (252.10275ms)
✔ event storage reports that IndexedDB is unavailable instead of silently succeeding (0.748375ms)
✔ deduplicates normalized note content while preserving provenance (0.619333ms)
✔ does not collapse short or protocol events (0.089083ms)
✔ extracts unique normalized domains (1.233041ms)
✔ extracts and classifies normalized event URLs once (0.511291ms)
✔ parses explicit kind constraints without turning an empty field into kind zero (0.215125ms)
✔ builds a bounded multi-entity graph and keeps in-corpus references (2.364083ms)
✔ neighborhood candidates include transparent direction-relative reasons (1.21975ms)
✔ classifies Nostr event lifecycles and addressable identities (1.047334ms)
✔ parses marked NIP-10 roots, parents, quotes, and relay hints (0.285375ms)
✔ parses NIP-22 root scope separately from direct parent (1.258625ms)
✔ marks older replaceable versions and authorized deletion requests (0.18025ms)
✔ pulse scopes map friendly choices to Nostr kinds (1.2805ms)
✔ large pulse targets are spread across contiguous relay-safe time slices (1.069ms)
✔ pulse analysis exposes relay coverage and directed signals (7.184709ms)
✔ topic signals favor independent participation over one prolific author (1.761375ms)
✔ account signals separate repetitive high-volume accounts (1.168875ms)
✔ normalizes one editable research draft into one immutable search request (2.34125ms)
✔ explains whether a draft can retrieve events from relays (1.851042ms)
✔ compiles a resolved request into a stable relay plan (0.211167ms)
✔ facet research follows the same draft, request, and plan stages as manual search (0.442458ms)
✔ presents and edits structured constraints through the composer interface (0.209541ms)
✔ applies structured constraints consistently to local archive results (0.647ms)
✔ reads NIP-65 read and write relay markers (0.748666ms)
✔ prioritizes explicit hints then purpose-specific advertised relays (0.085ms)
✔ respects an advertised relay maximum without inventing one (0.057209ms)
✔ round-trips public NIP-51 mute-list tags (0.907542ms)
✔ explains why an event is hidden (0.373208ms)
✔ research manifests are stable regardless of event order (1.0005ms)
✔ research facets can be selected and cleared through the session boundary (0.705333ms)
✔ successive searches use the latest term and reset corpus combination to replace (0.678208ms)
✔ an empty replacement search stays current instead of restoring the previous corpus (1.716917ms)
✔ plain account names search profile metadata through configured search relays (0.621708ms)
✔ keyword search discards relay results that do not contain every requested term (0.167042ms)
✔ searching wider from a facet replaces the old draft with an exact constraint (0.143583ms)
✔ an older failed search cannot restore over a newer successful search (3.13425ms)
✔ replace, union, and intersection preserve their distinct set semantics (0.534416ms)
✔ intersection pagination cannot introduce events outside the original base (0.077959ms)
✔ keeps corpus retrieval separate from presentation filters (0.351458ms)
ℹ tests 44
ℹ suites 0
ℹ pass 44
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 346.865166

> nostr-research-client@0.1.0 build
> vite build

vite v8.1.4 building client environment for production...
[2K
transforming...✓ 45 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.44 kB │ gzip:   0.28 kB
dist/assets/index-CsfDOEnO.css   39.26 kB │ gzip:   8.14 kB
dist/assets/index-DvKQN8zt.js   344.69 kB │ gzip: 104.70 kB

✓ built in 406ms


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.