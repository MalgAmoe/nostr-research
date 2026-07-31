# Nostrarium cockpit

Status: **disposable fixture-driven visual experiment**.

This experiment tests one interaction premise:

> A stable cockpit provides readable evidence and explicit controls while a
> universe viewport presents one bounded navigable field.

It combines findings rather than code from the voyage-system slice, Evidence
Desk, and Field Board:

- one Ground, bounded branches, one shared focus, and explicit pending placement;
- a readable single-focus post/account surface;
- factual conditions and uncertainty kept separate from visual atmosphere;
- one visible ordinary command draft at the action gate;
- a flat navigator sharing the same focus as the spatial viewport.

The current flight uses authored fixtures. It makes no relay connection and
executes no Nostrarium controller command. `EXECUTE RECORDED OUTCOME` advances
an explicitly labelled fixture state; it is not a simulated claim of live
acquisition. The visible drafts are ordinary command shapes intended for the
later controller-connected phase.

## Run

```sh
npm run dev --workspace @nostrarium/cockpit
npm test --workspace @nostrarium/cockpit
npm run test:browser --workspace @nostrarium/cockpit
npm run build --workspace @nostrarium/cockpit
```

## Interaction

- Select a signal in the universe or the flat `SIGNALS` navigator.
- Read its post, media, provenance facts, or recorded profile claims.
- Stage exactly one conversation or authored-notes command.
- Execute its recorded fixture outcome.
- Place the resulting ordinary handle as a branch or discard only the voyage
  reference.
- Travel among placed positions; focus remains singular.
- Preserve the focused signal explicitly in the fixture logbook state.

## Boundaries

- Spatial distance and brightness are presentation choices, not importance,
  quality, trust, or relay preference.
- Conversation lines represent declared fixture relationships. Ground bearings
  are decorative and deliberately faint.
- EOSE and zero/nonzero counts are conditions, not completeness claims.
- Profile names and descriptions remain claims.
- Hovering, looking, and traveling issue no hidden acquisition, schema,
  synchronization, retry, hydration, or preservation action.
- Canonical events are not copied into a second research store; this fixture
  contains authored display records only.
- Camera, panel, and viewport state are presentation-local.

## Deliberate omissions

No live controller adapter, relay networking, free flight, force layout, XR,
recommendation, trust score, automatic expansion, comparison cockpit, universal
component system, or shared experiment abstraction is included.

The next phase is justified only if real browser use shows the cockpit is
legible and the spatial viewport helps orientation. That phase should connect
one explicit `show`/selection path through the existing browser Worker and
neutral controller without changing either boundary.
