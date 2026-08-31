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
or run the Pi coding agent separately. The existing research engine and
controller remain unchanged and independently browser-compatible.

The architecture decision, security boundary, authentication approach, risks,
and task sequence are recorded in
[`DESKTOP-AGENT-FEASIBILITY.md`](./docs/reference/DESKTOP-AGENT-FEASIBILITY.md).

## Immediate milestone

Prove one complete local agent voyage in three bounded tasks:

1. **Desktop and runtime tracer (implemented)** — create a secure local Electron shell and
   connect a sandboxed renderer to one in-process research session and neutral
   controller.
2. **Embedded agent and tool bridge (implemented and controlled-test verified)** — embed Pi agent-core with sequential
   execution and one transparent Nostrarium command tool; verify it with a
   controlled model and safe structured evidence output.
3. **Credentials and live voyage (implementation ready; live verification next)** — use encrypted
   provider credentials and one real subscription login, then run a visible
   human-directed voyage over real relays in development. Packaging follows
   only after that loop is proven useful.

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
- Research persistence, export, skills, vessel techniques, and dynamic visual
  composition remain later questions informed by real agent-operated voyages.
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
reads, higher capacity, persistence, Rust, and other protocol candidates remain
parked under the triggers documented in the protocol capability map.

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
