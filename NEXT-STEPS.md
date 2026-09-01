# Project next steps

Status: current direction after closing the standalone human-interface
experiment phase, 2026-08-31.

## Current position

Nostrarium has a stable, runtime-neutral research foundation:

```text
canonical Nostr evidence
→ bounded process-local memory
→ subject collections and research relations
→ one normalized executor
→ persistent declarative session
→ JSONL and browser Worker adapters
→ neutral controller
```

The completed experiments established that the engine is genuinely useful to
an LLM navigator, but a fixed human-operated research interface either hides
too much of the engine or makes its operation vocabulary the human's problem.
Atlas and the other disposable interfaces remain historical evidence rather
than the current product direction.

## Product direction

Nostrarium is now being tested as an agent-operated local research
application:

```text
human direction and judgment
→ embedded research agent
→ Nostrarium controller and engine
→ Nostr field
→ visible attributed evidence
→ human response
```

The first application lives at `apps/nostrarium-desktop/`. It embeds
Pi's lower-level AI and agent libraries inside Electron; users will not install
or run the Pi coding agent separately. It consumes the research engine and
controller through their existing public execution seam; both remain
independently browser-compatible.

The architecture decision, security boundary, authentication approach, risks,
and task sequence are recorded in
[`DESKTOP-AGENT-FEASIBILITY.md`](./docs/reference/DESKTOP-AGENT-FEASIBILITY.md).

## Immediate milestone

Prove one complete local agent voyage in three bounded tasks:

1. **Desktop and runtime tracer (implemented)** — create a secure local Electron shell and
   connect a sandboxed renderer to one in-process research session and neutral
   controller.
2. **Embedded agent and complete command bridge (implemented and live verified)** — embed Pi agent-core with sequential
   execution and expose the complete session command surface as the agent's
   primary interface. Focused schema, observation, transformations, traversal,
   plans, and lifecycle all cross the same visible boundary; caller-side
   conveniences must never reduce that power.
3. **Credentials and live voyage (implemented and repeatedly verified)** — encrypted
   provider credentials and a real subscription login now support visible
   human-directed voyages over public relays. The voyage ledger, bounded
   model/UI projections, lazy authoritative records, streaming narration, and
   pressure-triggered factual voyage checkpoints were added in response to
   those trials. Packaging follows only after the operating loop is stable.

Headless voyage mode uses the exact desktop runtime, encrypted login, system
prompt, tools, controller, and compaction without a renderer. Early trials
showed genuine construction friction, and a schema-backed specialized adapter
temporarily reduced it. A later identity-search regression exposed the larger
cost: presenting common operations as primary tools and the complete command
surface as an escape hatch narrowed the navigator's strategy. It abandoned a
failed NIP-50 route instead of composing a different acquisition and analysis
path. The adapter also projected only selected response fields, which hid plan
stage results from the model.

The specialized adapter has therefore been removed from the desktop runtime.
The agent again receives one complete `nostrarium` command tool plus the
separate optional attention workspace. Full engine responses are retained at
that boundary, including declarative plan stages. Focused schema remains
available through an ordinary command, and future recipes or composers may
produce transparent command drafts without becoming a smaller substitute for
the engine. The exact failed identity-search prompt now completes through a
multi-route live voyage and corroborates the discovered profile across relays.

The desktop application now also owns a deliberately separate SQLite store for
cross-run application memory. Its first migration contains typed settings and
versioned JSON recipe records; the configured relay defaults feed both the
windowed and headless runtime. A separate agent memory tool can list, load,
save, and delete those records; it has no execution authority. Engine memory,
attention, controller state, and credentials remain outside this database.

The first recipe trials established three useful constraints. A natural voyage
with construction failures correctly declined to save a recipe. A recipe later
reconstructed from prose preserved the right research posture but invented
stale command fields and obstructed reuse. After revision to exact ordinary
command templates, all five recipe operations succeeded on first use without
schema consultation, while the navigator still adapted selection and judged
evidence itself. Keep recipes as transparent JSON orientation for now: capture
proven command envelopes, expose decision points, and do not add automatic
execution or a fixed recipe language until repeated use requires it.

The next interface trial extracted one repeated idea from the closed experiment
phase: temporary voyage attention. The first implementation deliberately tried
a shaped caller-side state containing Ground, current focus, open questions,
and landmarks. It was included in context checkpoints but had no controller
access, copied no evidence, recorded no conclusions, and reset with the voyage.

Three live headless voyages established a narrow first result:

- branching exploration used Ground and two open questions, then genuinely
  returned to an earlier article-cluster path;
- identity descent used Ground and focus, including an explicit pivot from an
  abandoned automated feed to the operator identity named by its profile;
- a linear relation-heavy investigation ignored attention completely and
  remained coherent.

The tool caused no construction failures and the agent kept conclusions in its
narration rather than attention. Those voyages established that explicit,
bounded temporary working state can help; they did not establish Ground, focus,
questions, landmarks, or attachments as universal concepts. The shaped state
has therefore been replaced, before promotion, by a bounded key/value JSON
workspace. The navigator chooses its keys and value shapes, and can view, get,
put, remove, or clear them. The next trials should observe whether different
models and research situations independently invent recurring organizations.
Only repeated useful patterns should become candidates for stronger data
structures. The process-local research notebook was unused through this round.
Leave notebook and archive semantics unchanged while the agent-facing core is
still being discovered, then evaluate them explicitly before the later
project-pruning phase.

Three subsequent live voyages exercised the unstructured workspace rather than
the earlier vocabulary:

- a short three-direction random exploration ignored it; stable handles and
  narration were sufficient;
- a difficult candidate-elimination search also ignored it and stopped honestly
  with one plausible result;
- an explicitly multi-line investigation invented one `branchboard` object
  containing four named branches and exact anchors, then returned to the most
  promising line.

The third use is suggestive but not yet a reusable structure. The navigator
wrote the branchboard once and never revised or reread it; its `unstarted`
statuses were stale by the end even though the anchors remained useful in model
context. This round therefore supports keeping a small generic workspace while
rejecting any fixed attention schema. Further evidence should come from natural
long voyages and real context compaction, not prompts designed merely to force
workspace use.

A deliberate live compaction voyage then lowered only the headless pressure
threshold and crossed a real model-context checkpoint. The navigator invented
one `voyage_state` object, revised it after completing the first branch, reread
the live entry before later replacements, and completed a 33-command voyage
with exact anchors and bounds intact. The final workspace occupied 1,963 bytes;
the controller transcript remained authoritative and untruncated. This verifies
the generic workspace’s distinctive role across compaction while still proving
nothing about a universal internal shape. The headless voyage mode now exposes
an explicit context-pressure override for repeating this diagnostic without
changing the interactive desktop default.

The first UI contains only provider/model setup, conversation, chronological
tool activity, one bounded evidence area, intervention/abort, and session
reset. It is a tracer for the product loop, not a new general workbench.

## Constraints

- The embedded agent receives Nostrarium research tools only. It has no shell,
  filesystem, coding, arbitrary HTTP, or browser-automation authority.
- The renderer has no Node access, provider credentials, or raw IPC surface.
- Nostr events are untrusted evidence and are never treated as instructions or
  executable UI content.
- The desktop app consumes the existing public engine and controller; it does
  not create a second research executor.
- Research-evidence persistence, export, skills, vessel techniques, and dynamic
  visual composition remain later questions informed by real agent-operated
  voyages. The desktop SQLite store persists only explicit application data.
- Do not revive or combine old experiments merely to reuse their code. Extract
  a result only when the new application encounters the same need.

## Promotion rule

After several embedded-agent voyages, promote only repeated findings:

- repeated generic mechanics may become engine or controller tools;
- repeated agent investigation techniques may become skills or prompt
  resources;
- repeated evidence needs may become trusted visual components;
- repeated recovery needs may justify persistence or export.

The human owns direction and conclusion. The agent owns the current research
movement. The engine owns evidence, provenance, bounds, and reproducible
operations.

## Parked capabilities

Protocol and performance work resumes only for a verified correctness problem
or repeated voyage blocker. NIP-50, multi-filter requests, authenticated relay
reads, higher capacity, engine-evidence persistence, Rust, and other protocol
candidates remain parked under the triggers documented in the protocol
capability map.

## Documentation map

- [`README.md`](./README.md): project entry point.
- [`CONTEXT.md`](./CONTEXT.md): durable engine principles and terminology.
- [`CLI.md`](./CLI.md): direct research-session operating guide.
- [`DESKTOP-AGENT-FEASIBILITY.md`](./docs/reference/DESKTOP-AGENT-FEASIBILITY.md): current
  application decision and first milestone.
- [`CONTROL-AND-DATA-MAP.md`](./docs/reference/CONTROL-AND-DATA-MAP.md): engine controls and
  evidence surfaces.
- [`NOSTR-PROTOCOL-CAPABILITY-MAP.md`](./docs/reference/NOSTR-PROTOCOL-CAPABILITY-MAP.md):
  protocol coverage and parked candidates.
- [`docs/voyages/`](./docs/voyages/): completed voyage evidence.
- [`experiments/`](./experiments/): closed disposable interface and composition
  experiments.
