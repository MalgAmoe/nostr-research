# Voyage system experiment guidelines

Status: provisional guidance for a new disposable composition experiment.

## Question

Can one caller-side system support the actual Nostr research loop—
orientation, attention, inspection, explicit action, reconsideration, and
collection—without collapsing the complete engine into a universal control
surface?

This experiment synthesizes evidence from earlier experiments. It does not have
to preserve their APIs, names, state models, or implementations.

## Foundation

The stable boundary remains:

```text
research engine
→ declarative session
→ neutral controller
→ ordinary handles, outcomes, receipts, schema, and visible commands
```

The new system may accept and use a controller. Every executed command must be
an ordinary visible command explicitly chosen by the navigator. The system must
not acquire, observe, inspect, refresh, route, or continue automatically.

Existing experiments are evidence and possible sources of small fitting
projections. They are not required dependencies. Reuse code only when it fits
the new system without importing a competing idea of focus, position,
lifecycle, or control.

## Navigation loop

```text
see the current situation
→ choose what deserves attention
→ choose how to examine it
→ choose an explicit action
→ receive a named result
→ decide where that result belongs
```

Execution and placement are separate decisions:

```text
execute
→ named reusable result waiting outside the voyage
→ place, inspect temporarily, attach, preserve, or discard
```

No successful result enters Ground, a branch, a question, or collection
silently. Successful operations that return only unnamed mutation metadata do
not create a pending voyage result.

## One coherent state

### Field

- One Ground.
- A bounded, revisable set of branches.
- One current focus shared by the whole system.
- Caller-written reasons for Ground, branches, and replacements.
- No automatic branch admission or branch ranking.

### Questions

- Several loose navigator-written questions may coexist.
- Questions are prompts for attention, not tasks.
- No status workflow, priority, scoring, or requirement to resolve them.
- A question may refer to ordinary handles or exact subjects with a
  navigator-written reason.
- Questions never synthesize an answer.

### Lens

Exactly one primary lens is open at a time. Closing it returns to the unchanged
shared focus.

Initial lens families:

- **evidence** — note/account preview, details, explanation, provenance, and
  profile evidence;
- **relation** — rows, fields, lineage, groups, counts, and structural facts;

Comparison remains an ordinary explicit engine operation. Its named summary
handle may be observed through the available relation senses; a dedicated
comparison lens is justified only if repeated voyages need a distinct decision
surface.

A lens consumes outcomes already requested by an explicit navigator action. It
does not issue follow-up commands.

### Action gate

- Holds an ordinary command draft visible to the navigator.
- May use focused schema facts to help construct an unfamiliar draft.
- Executes only on an explicit navigator call.
- Preserves the unchanged command, receipt, warnings, and any named reusable
  result.
- Leaves a named reusable result pending until the navigator explicitly places
  or discards it.
- Familiar operations remain expressible directly without schema ceremony.

### System conditions

Keep a small factual strip rather than another cockpit:

- latest receipt;
- warnings and partiality;
- external-attempt status when declared;
- session revision when declared by a receipt;
- handle, buffer, archive, and notebook pressure when already observed.

Unavailable facts remain unavailable. The strip issues no synchronization or
status command by itself.

### Collection

Notebook and archive remain engine-owned, explicit lifecycle operations.
Collection controls may appear situationally when the navigator chooses to
retain something. The experiment owns no hidden cargo store that pretends to
be preservation.

### Escape

The complete controller command surface remains reachable. Bypassing the
arrangement is valid evidence about the experiment.

## Lessons to preserve

- Field Board demonstrated that Ground, branches, focus, reasons, bounds, and
  resolution can remain legible together.
- Evidence Desk demonstrated useful single-frame note/account inspection.
- Relation work repeatedly mattered in serious voyages and requires different
  senses from note/account evidence.
- Schema Composer is useful for unfamiliar nested construction, not routine
  movement.
- Darkroom and comparison experiments showed value only when a pair is
  deliberately chosen.
- Flight Console showed the value of receipts and conditions, but a general
  sensor dashboard was too broad.
- Overlap experiments showed that useful overlap exists and maximal nesting
  duplicates position, questions, and handles.
- Vessels showed that attention changes journeys; the system must not conclude
  on behalf of the navigator.

## First vertical slice

Build the smallest executable system that proves the state transitions:

1. establish Ground from an ordinary handle, with an already-requested summary
   only when the navigator needed that observation;
2. add, replace, and focus bounded branches;
3. add and remove several loose questions;
4. attach an ordinary handle or exact subject reference to a question;
5. open and close one already-observed evidence or relation lens;
6. stage and explicitly execute an ordinary command through the controller;
7. retain the resulting handle as pending;
8. explicitly place the pending result as Ground/branch/focus, or discard it;
9. expose a compact snapshot containing position, questions, active lens,
   pending result, and system conditions;
10. preserve a direct raw-controller escape.

Do not build a browser UI in this slice. A JavaScript interface and bounded
text formatter are sufficient for live trials.

## Trial sequence

After the vertical slice works, run:

1. a random field that moves from several weak signals into one deep
   note/account investigation;
2. a relation-heavy voyage over tags, domains, mentions, recurrence, or
   grouping;
3. a collection voyage that compares evidence and explicitly invokes notebook
   or archive operations.

For every voyage record:

- changes to questions;
- focus and lens transitions;
- pending-result placement or discard decisions;
- every raw bypass and why it was preferable;
- useless continuously visible facts;
- missing facts or lenses;
- competing notions of position;
- whether the arrangement changed a research decision.

## Success signals

- The navigator can recover field position, current focus, live questions, and
  pending results without external structure notes.
- Questions materially affect at least one movement, inspection, comparison,
  or judgment test.
- Evidence and relation moments use distinct, understandable lenses.
- Commands remain ordinary, visible, and explicitly chosen.
- Execution never implies placement.
- Raw bypass remains easy but is not consistently preferable.
- One shared focus survives every transition.
- The system helps several different voyage rhythms without prescribing one.

## Discard signals

- It is merely several earlier experiments printed together.
- Multiple components independently own current position or focus.
- Questions become decorative text or task management.
- The system needs hidden observation, routing, recommendations, or automatic
  result placement to feel coherent.
- Relation analysis remains easier only outside the system.
- The system must reproduce the full schema or command catalogue continuously.
- Navigators routinely bypass it because direct controller use is clearer.
- Making the first slice coherent requires a general plugin, panel, or vessel
  framework.

## Testing policy

Use a few public-boundary functional tests for stable behavioral claims:

- one shared focus;
- visible unchanged commands;
- no automatic result placement;
- explicit placement and discard;
- ordinary handles remain usable outside the system.

Do not freeze formatting details or internal organization. Sustained live
voyages are the primary evaluation.
