# Project next steps

Status: current direction after the first vessel, playful-voyage, and three
Evidence Desk voyage rounds through 2026-07-30.

## Current position

Nostrarium has a usable, runtime-neutral research foundation:

```text
canonical Nostr evidence
→ bounded process-local memory
→ stable subject collections
→ composable research relations
→ one normalized executor
→ persistent declarative session
→ JSONL and browser Worker adapters
→ neutral controller
→ contextual arrangement and command composition
```

The engine supports sustained sequential research without arbitrary
JavaScript. It exposes bounds, relay participation, partiality, provenance,
content and media facts, relationship evidence, archive state, notebook state,
and handle lifecycle.

The controller removes process and correlation friction without selecting
research actions. Composers and systems above it are disposable
interpretations rather than a canonical next layer.

No current voyage has identified a missing generic engine primitive that
justifies another engine milestone. One narrow contextual-schema completeness
problem found by the Breadth voyage has been corrected: full and focused
`remember` contracts now enumerate accepted notebook `kind` values from the
same contract fact used by validation. This was a factual correction, not a new
engine capability.

The first systems hypothesis was:

```text
Field → Navigate → Analyze → Collect
```

Only a deliberately small Field interpretation was implemented. Its first real
research task immediately crossed the proposed boundaries: finding
cryptographers required field acquisition, relation views, scanning,
aggregation, account movement, hydration, and authored-evidence inspection.
That was a useful result, not an architectural violation.

The stable commitment is that independently disposable systems may interpret
the same controller, handles, schemas, and evidence differently. Operations do
not belong exclusively to Field, Navigate, Analyze, or Collect.

## Product conclusion

The current vessel synthesis is in [`VESSELS.md`](./VESSELS.md).

The important distinction is:

- a **vessel posture** coherently arranges movement, senses, judgment
  conditions, and collection;
- a **research instrument** exposes recurrence, rarity, locality, time,
  conversation, or another mechanical property;
- a **voyage brief** gives one session its bounds and intent.

Not every instrument is a vessel. Not every successful voyage needs a
permanent name.

Depth, Breadth, Skeptic, and Archivist remain strong provisional postures.
Correspondent is inconclusive. Keyhole revealed useful locality but imposed
artificial blindness. Recurrence, rarity, temporal difference, and
conversation traversal are useful instruments that may serve many vessels.

The rule-driven Drift was captured by a distributed recurrence. The looser
playful voyage succeeded: random entrances, navigator curiosity, explicit
evidence-bearing doors, a small invalidation check, and another random airlock
led from a zucchini joke to an ActivityPub-bridged gardening and solarpunk
neighborhood.

## Current interaction finding

Three sustained voyages establish Evidence Desk as a **single-frame
note/account decision surface**. It naturally houses Depth and Skeptic work
around one current subject or evidence frame. It also serves each individual
Breadth stop, but does not keep this larger field visible together:

```text
Ground
├── branch A
├── branch B
└── branch C
```

That boundary should not be repaired by expanding the desk indiscriminately.
An independent Field Board experiment has tested the complementary multi-frame
shape. Reconstruction of the three-branch Breadth field, a stranger mixed-kind
structural field, and a prospective evolving field passed: Ground, branch
reasons, stage-aware bound contrasts, resolution profiles, lineage, neutral
count contrasts, local addition/replacement, focus, and exit handles remained
visible without subject previews or external structure notes.

Field Board imports no experiment and executes nothing. It accepts ordinary
handles plus already-requested summaries, then returns unchanged handles to any
single-frame surface, relation tool, or raw command path. Membership overlap
remains explicitly unavailable unless separately observed. This is evidence for
a narrow complementary surface, not a reason to combine the experiments or
promote a general cockpit.

Three subsequent real-relay composition voyages completed 57 controller
commands while moving between Field Board, Evidence Desk, relation tools,
Schema Composer, and raw known commands. The repeated useful interchange was a
named ordinary handle, its already-requested summary, and a caller-defined
reason entering the board; every surface returned an unchanged ordinary handle.
This supports experimental composition above the controller without making the
experiments depend on one another.

Repeated voyage evidence also distinguishes the desk's parts:

- note/account cards and the separate summary, preview, details, explain, and
  coverage senses are strongly supported;
- relation exit and subject-handle return are strongly supported;
- unresolved-account hydration is the clearest candidate for a situational
  control;
- complete action enumeration is truthful but has not earned permanence.

No immediate Evidence Desk feature work is required.

## Immediate work

Use the repository as an experimental workbench:

1. start human-facing experiments from notes and accounts rather than engine
   handles or command construction;
2. keep evidence visualizers separate from controls that create actions;
3. let explicit human actions compile down through the neutral controller to
   ordinary visible engine commands;
4. expose lower-level handles, schema, provenance, and commands when they help
   investigation without making them the primary interface;
5. freely revise, fork, combine, or delete experiments that do not help.

Two browser UI experiments tested a generic workbench and a note-first field
deck. Both proved that the same controller and browser Worker can support a
fully local browser client, but neither was usable enough to retain. They were
removed. Their useful result is the boundary above: notes and accounts are the
navigator's primary objects; visualizers explain the current evidence; action
controls deliberately move or reshape it; the complete engine remains
available underneath.

The goal is not to find the perfect layer above the controller. It is to make
different good-faith interpretations cheap to build and safe to fail.

The first product-level interaction contract is recorded in
[`INTERACTION-SPEC.md`](./INTERACTION-SPEC.md). Its first Atlas vertical slice
is complete and voyage-tested: explicit acquisition establishes immutable
Ground, a bounded account-frequency facet overlaps local branching and relay-
draft preparation, selected notes and accounts retain local observations,
profile hydration enriches without moving, authored-note acquisition creates a
branch, and place state survives backtracking. The slice required no Atlas-
specific engine operation.

The second Atlas slice is also complete and voyage-tested. It makes that proven
navigation model useful for reading and traversing Nostr rather than widening
the generic control surface. It adds:

1. safe rich note rendering from already-exposed content and attachment facts;
2. explicit author, reply, ancestor, quote, mention, and reference doors whose
   local and relay-backed effects remain visibly distinct; and
3. attributed account names and pictures wherever profile evidence has been
   explicitly resolved, plus an explicit bounded way to resolve authors for a
   current place without hidden hydration.

The slice remains entirely caller-side: it reuses ordinary controller commands,
retains exact evidence and bounds, and creates no engine milestone, automatic
background request, recommendation, or canonical identity claim.

A subsequent architectural tracer now gives initial acquisition, navigation,
view state, media authorization, and local subject observation one explicit
path from typed navigator action through a narrow resolver to a single Atlas
store commit. It adds no user-facing capability and is not a third feature
slice. Unmigrated action families remain explicit in the older path; they should
move only in coherent families after the tracer is proven by continued use.
No third Atlas feature slice is agreed yet.

## Promotion rule

After several voyages, compare them before writing code.

Promote an arrangement into caller-side controls or templates only when:

- it recurs across different fields and questions;
- it is mechanical rather than interpretive;
- it removes measurable construction or observation friction;
- every compiled command remains visible;
- the navigator still chooses direction and conclusion.

Do not build a vessel registry, autonomous workflow, hidden ranking system, or
visual interface merely to formalize the metaphor.

Engine work resumes only for:

- a verified correctness problem;
- a protocol capability repeatedly blocking real voyages; or
- a generic operation repeatedly and awkwardly reconstructed outside the
  library.

## Parked capabilities and triggers

- **Multi-filter `REQ`**: reconsider when repeated acquisitions need the same
  combined request and round trips become material.
- **NIP-50 remote search**: reconsider only if directed anchoring becomes more
  important than random-field navigation and a reliable search relay joins
  the test set.
- **NIP-42 authentication**: reconsider only when a relay needed for research
  requires authenticated reads.
- **Retry or relay-routing policy**: reconsider when explicit diagnostics and
  sequential navigator choices prove insufficient.
- **Capacity above 1,000 events**: measure selection, relation resolution,
  inspection, cloning, and browser memory first.
- **Persistence or cross-session voyages**: reconsider only when process-local
  loss blocks real use.
- **Rust or another lower-level implementation**: reconsider only when
  measured constraints justify it.

## Deliberately declined

Typed NIP-51 list navigation is not a product direction. Published account
lists import incumbent, overlapping topology and can pull research toward the
network's loudest center. Raw list events remain inspectable evidence.

Also avoid hidden next-operation recommendations, background acquisition,
trust or popularity scores, speculative task-specific operations, automatic
field admission, and persistence merely because conventional applications
have it.

## Documentation map

- [`README.md`](./README.md): project entry point.
- [`CLI.md`](./CLI.md): practical operating guide.
- [`CONTEXT.md`](./CONTEXT.md): durable principles and terminology.
- [`VESSELS.md`](./VESSELS.md): current vessel conclusions.
- [`CONTROL-AND-DATA-MAP.md`](./CONTROL-AND-DATA-MAP.md): engine controls and
  evidence surfaces.
- [`INTERACTION-SPEC.md`](./INTERACTION-SPEC.md): product-level navigator
  places, facets, projections, doors, and first browser vertical slice.
- [`NOSTR-PROTOCOL-CAPABILITY-MAP.md`](./NOSTR-PROTOCOL-CAPABILITY-MAP.md):
  protocol coverage and possible future capabilities.
- [`docs/voyages/`](./docs/voyages/): historical voyage journals and artifacts.
- [`packages/nostr-research/README.md`](./packages/nostr-research/README.md):
  library and protocol reference.
- [`packages/nostrarium-controller/README.md`](./packages/nostrarium-controller/README.md):
  controller, transport, arrangement, and composer reference.
- [`experiments/schema-composer/README.md`](./experiments/schema-composer/README.md):
  one schema-backed composer, explicitly outside the neutral controller.
- [`experiments/evidence-desk/README.md`](./experiments/evidence-desk/README.md):
  the voyage-tested single-frame note/account decision surface.
- [`experiments/field-board/README.md`](./experiments/field-board/README.md):
  the pure multi-frame Ground and branch position experiment.
- [`experiments/flight-console/README.md`](./experiments/flight-console/README.md):
  research sensors, explicit movements, and full-engine escape.
- [`experiments/overlap-cockpits/README.md`](./experiments/overlap-cockpits/README.md):
  the surviving Bridge, Parallax, and Expedition arrangements.
- [`workflow/WORKFLOW.md`](./workflow/WORKFLOW.md): worker/reviewer task runner.

Completed workflow tasks and run records remain under `workflow/` as historical
execution evidence, not current product documentation.
