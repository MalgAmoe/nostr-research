# Atlas navigation workspace — third-slice specification

Status: proposed product slice after completion of the Atlas action/resolver
migration.

## Why this slice

Atlas now has enough capability to perform a real voyage without leaving the
browser surface. A live post-migration voyage on 2026-08-01 successfully:

- acquired a 20-note Ground from a real relay;
- selected exact note evidence and moved locally to its author;
- hydrated and retained attributed profile claims;
- opened one local relationship branch and one relay-backed relationship
  branch;
- returned to Ground with selection and resolved names intact; and
- derived and displayed the bounded account-frequency facet.

The execution model held. The remaining friction is the arrangement of that
capability:

- the narrow context rail repeats two large actions for every facet account;
- Places and History consume space while communicating overlapping facts;
- the inspector presents exact evidence, five relationship families, complete
  drafts, raw disclosures, and subject actions in one long surface;
- prepared drafts remain visually dominant after the decision they supported;
- the field, rather than the current decision, receives too little horizontal
  room; and
- at narrow widths the contextual surfaces disappear instead of becoming
  deliberate, reachable modes.

This is not evidence for another engine operation or another state layer. It is
evidence for a clearer human arrangement over the now-unified Atlas action
boundary.

## Outcome

Make Atlas a denser navigational workspace in which a person can simultaneously
understand:

1. **where they are** — Ground and retained branches;
2. **what is in front of them** — readable notes or accounts; and
3. **what they can do with the current subject** — inspect, move locally, or
   prepare an explicit external action.

The workspace should resemble the useful character of the old explorer without
restoring its unreliable state flow. The existing Atlas store remains the only
UI/research-state owner, actions remain the only component-facing mutation
surface, and resolvers remain the only controller-command owners.

## Desktop arrangement

### 1. Navigation rail — orientation and lenses

The left rail should contain only two compact groups.

**Places**

- Ground first, followed by retained branches in stable order.
- Each row shows role, short label, count/counting unit, and the navigator
  reason when space permits.
- Activating or removing a branch remains an explicit local action.
- Back and Forward remain in the global header.
- Remove the separate History list from the persistent rail. It duplicates the
  same place names while back/forward already preserve traversal order. History
  may remain available through a small disclosure if later voyages prove it
  useful.

**Lenses**

- Account frequency remains a bounded local lens, not a popularity panel.
- Before derivation, show one compact `Derive account frequency` control.
- After derivation, each account row shows identity, attributed name/picture
  when already resolved, note count, and truncation/bound context.
- Clicking a row selects that account in the inspector.
- Do not repeat `Local notes` and `Research on relays` buttons in every row.
  Those actions belong to the selected-account decision surface.
- Keep commands, handles, lineage, and omissions behind one factual disclosure.

The rail scrolls independently from the field and inspector.

### 2. Field — the primary reading surface

The center remains the current immutable place.

- Keep Stream, Gallery, and Accounts as place projections.
- Make the entire note header/author identity an obvious selection target while
  retaining a distinct exact-note action where ambiguity would result.
- Continue to reuse explicitly observed account names and pictures without
  hiding public keys or their attribution.
- Keep prose, links, hashtags, Nostr references, and authorized media readable.
- Compress event ID, kind, relay count, and provenance into a quiet evidence
  footer; exact facts remain available in the inspector.
- Keep paging local to the current handle and visibly bounded.
- The field scrolls independently and should receive the majority of desktop
  width.

### 3. Inspector — one current decision

The right side should be organized by the decision around the selected subject,
not by every fact Atlas possesses.

**Subject header**

- Note: author, time, concise content, and exact event ID.
- Account: attributed profile presentation, public key, and resolution state.
- Unresolved and unrequested states remain visibly distinct.

**Evidence**

- Show a compact resolution/provenance/bounds summary by default.
- Canonical tags, complete returned content, supporting handles, commands, and
  responses remain in explicit disclosures.
- Do not repeat profile claims in both the header and a second full claim list
  unless the latter is opened for evidence inspection.

**Doors**

- Note relationships appear as compact rows: relationship name, known local
  outcome if any, `Open local`, and `Prepare relay`.
- Account actions appear as compact choices: `Resolve profile`, `Authored notes
  on relays`, and, when entered from the account-frequency lens, `Notes in this
  place` plus `Prepare independent account acquisition`.
- Local and relay-backed actions remain visually and semantically distinct.
- Atlas never recommends a door.

**Drafts**

- Show a full editable draft only after its corresponding prepare action.
- A draft is contextual to one selected door; other external drafts stay
  collapsed.
- After successful execution and branch installation, collapse the draft to a
  compact attempt result. The captured command, bounds, receipt, and response
  remain inspectable.
- Draft preparation and editing execute nothing.

The inspector scrolls independently from the field.

## Global header and status

The header should remain thin:

- brand;
- Back and Forward;
- current place role and label;
- local text filter; and
- one visible acquisition-draft control.

The bottom conditions bar remains a compact statement of current place,
external attempt state, warnings, and partiality. It should not become an
activity log or general dashboard.

## Narrow-window behavior

Do not squeeze three unusable columns or silently remove navigation.

- The field is the default primary surface.
- Context and Inspector become explicit full-height panels/drawers selected from
  persistent controls.
- Opening one does not reset place, projection, local filter, paging, selected
  subject, prepared draft, or media authorization.
- Back/Forward and the current-place label remain visible.
- Every capability available on desktop remains reachable; only its arrangement
  changes.

## Behavioral constraints

- No engine or controller changes.
- No new generic dispatcher, command language, state mirror, or experiment
  dependency.
- Components invoke only typed navigator actions.
- Resolvers alone construct and execute ordinary visible controller commands.
- The Atlas store remains the single owner of UI and research state.
- No automatic acquisition, hydration, continuation, retry, relay substitution,
  ranking, recommendation, or media loading.
- Ground and branch handles remain immutable and never silently replaced.
- Local selection remains distinct from movement.
- Bounds, omissions, unresolved evidence, warnings, and relay partiality remain
  available and accurately attributed.

## Acceptance voyage

Starting from a fresh browser session, a navigator can:

1. acquire Ground;
2. derive the account-frequency lens;
3. select an account from the lens without repeated row-level action clutter;
4. open only the profile draft, execute it, and see an attributed profile while
   remaining in Ground;
5. return to a note, see compact relationship doors, and open a local branch;
6. return to Ground with the same projection, filter, selection, facet, and
   profile presentation;
7. prepare and execute one relay-backed relationship branch;
8. navigate among all retained places from the compact rail; and
9. inspect exact commands, provenance, bounds, and responses only when desired.

The same voyage must remain possible at a narrow width by switching among the
Context, Field, and Inspector surfaces rather than losing either side surface.

## Explicit non-goals

- New facets or analysis operations.
- Notebook, archive, blocking, following, signing, messaging, or persistence.
- A generic engine console or schema composer in the main UI.
- Automatic identity verification or human/bot classification.
- A universal vessel interface.
- Visual polish unrelated to navigational density and comprehension.

## Implementation shape

Keep this to one product slice, with at most two internal passes:

1. rearrange the existing Place, Field, Lens, and Inspector components while
   preserving every action and state transition;
2. compact the repeated controls and implement the narrow-width surface
   switcher, followed by the acceptance voyage.

If implementation appears to require engine work or another shared state
abstraction, stop and re-evaluate the design rather than expanding scope.
