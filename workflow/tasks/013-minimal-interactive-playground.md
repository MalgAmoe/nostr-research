---
id: 013-minimal-interactive-playground
status: ready
max_attempts: 5
validation: workflow/tasks/013-minimal-interactive-playground.validate.sh
depends_on: 012-research-sessions-and-coverage
protected_paths: docs/solid-experiment-lessons.md workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Build the first minimal interactive research playground

## Objective

Create a new local application over the library and session module. This is a
fresh vertical slice, not a restoration or redesign of the removed Solid
prototype.

The application should let a person conduct the observe, focus, expand, and
retain loop interactively while the library remains authoritative for
research behavior.

## Application shape

Create one small application under `apps/`. Choose the least complex
maintainable web stack already compatible with the repository. A lightweight
framework is acceptable, but do not introduce an application architecture
framework, global state library, or elaborate design system.

Provide one root command that starts the local application. Keep the runtime
local and document its address and data location.

The application may use a small local server to own SQLite and relay
connections. Browser code must not open or mutate SQLite directly.

## Required vertical slice

The application must support:

1. create or open a research database;
2. start a temporary research session;
3. configure explicit relays, time bounds, kinds, and event budget;
4. start one bounded acquisition and see per-relay progress/outcomes;
5. inspect the resulting selection as readable notes or accounts;
6. focus an event or account without losing the selection;
7. include or exclude subjects provisionally;
8. traverse one explicit relationship type and make the result the current
   selection or a branch;
9. go back to the prior meaningful state; and
10. checkpoint the current selection as a durable research set.

Opening a saved research set in a new session must also work.

## Interaction principles

- The current selection is always identifiable.
- The researcher can see whether data is local or newly acquired.
- Every expansion shows the relationship and direction used.
- Partial relay completion, limits, timeouts, and missing evidence are visible.
- Back restores research state, not merely browser history.
- Inspecting a subject never silently replaces typed acquisition parameters.
- Empty results remain meaningful and do not clear the previous state without
  an explicit action.
- Loading indicators appear only around the operation that is actually
  waiting.

## Presentation

Render:

- profile names and identifiers;
- note text with line breaks and links;
- images, video, and audio from explicit content/tag URLs;
- timestamps and event kinds;
- relay provenance summaries; and
- an expandable raw-event/tags/protocol-evidence view.

Use a simple research-tool visual language. Do not spend this milestone on
branding, animation, dashboards, graph canvases, or a complete settings area.
The layout must remain usable in a narrow window.

## Library ownership

The application is an Adapter over public library/session operations.

- Do not reimplement Nostr filter semantics, relationship interpretation,
  set persistence, coverage, or result transformations in UI state.
- Application state may own dialogs, active tab, scroll position, and draft
  form values.
- Research state belongs to the session module.

If a required interaction reveals a missing public operation, add the smallest
library change and verify it at the library seam.

## Scope boundaries

- No login, signing, publishing, private messages, notifications, or global
  feed.
- No automatic discovery score, recommendations, moderation engine, or relay
  ranking.
- No recreation of Relay Pulse, investigation steps, query compiler, or the
  old application layout.
- No permanent session compatibility promise.
- No end-to-end test for every button.

## Verification

Keep permanent tests small:

- server/library integration for one complete vertical slice;
- one browser-level smoke scenario covering acquisition with a controlled
  source or fixture, selection, focus, traversal, back, and checkpoint; and
- responsive/manual verification recorded by the reviewer.

The independent reviewer must start the application, use it through an actual
browser, and confirm that research actions use the public library/session
behavior.

## Acceptance criteria

- One documented command starts a working local application.
- A new user can complete the required vertical slice without editing files or
  invoking the CLI.
- Research state survives navigation within the session.
- A checkpoint is reopenable as a new session.
- No removed prototype code or architecture is restored.
- The application remains small enough to understand as one vertical slice.

