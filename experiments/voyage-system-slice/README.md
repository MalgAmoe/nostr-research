# Voyage system slice

Status: **provisional disposable experiment**.

This is the first executable vertical slice from
[`../VOYAGE-SYSTEM-GUIDELINES.md`](../VOYAGE-SYSTEM-GUIDELINES.md). Its
provisional name describes its scope rather than proposing a permanent system.

It tests whether one caller-side object can keep a coherent voyage state while
preserving the neutral boundary:

```text
research engine
→ declarative session
→ neutral controller
→ ordinary commands, outcomes, receipts, and handles
→ this disposable voyage state
```

The package has no runtime dependency on another experiment.

## Included state

`createVoyageSystemSlice({ controller })` owns exactly one local state:

- one Ground and bounded revisable branches;
- one shared focus used by field, lens, and pending placement;
- several loose questions with bounded handle or exact-subject references;
- at most one open evidence or relation lens;
- one visible staged ordinary command;
- at most one successful result waiting for placement;
- compact conditions projected only from outcomes supplied to the system.

It does not own engine handles, notebook entries, archives, relay state, or a
second copy of evidence.

## Boundary

The system may execute a command only through this explicit sequence:

```js
voyage.stage(navigatorWrittenCommand);
const executed = await voyage.executeStaged();
```

`stage()` preserves the draft without rewriting it. `executeStaged()` invokes
`controller.execute()` exactly once. A successful named reusable handle becomes
pending; it does not enter Ground, branches, questions, or focus. Successful
operations that return only unnamed mutation metadata complete without pending
placement.

Pending placement is a separate local call:

```js
voyage.placePending({
  destination: 'branch',
  key: 'candidate',
  label: 'Candidate notes',
  reason: 'Caller-written reason.',
});
```

Ground, branch, and branch-replacement placement may include an
already-requested matching summary, but do not require one. A frame without a
summary says only what its ordinary handle and caller reason establish. Focus
placement needs a caller-written reason. `discardPending(reason)` removes only
the voyage reference; it does not issue `release` or make the engine handle
unusable.

The unchanged controller is available as `voyage.raw`. Raw bypasses are
expected and should be recorded. `voyage.notice({ command, outcome })` may fold
a raw outcome into the conditions strip; it issues no command.

## Field and focus

All Ground and branch entries come from explicit pending-result placement.
`replace-branch` replaces one stable branch slot without changing focus:

```js
voyage.placePending({
  destination: 'replace-branch',
  key: 'domains',
  label: 'Concrete domain notes',
  reason: 'Caller-written replacement reason.',
});

voyage.focus('domains', callerReason);
voyage.focus(ordinaryHandle, callerReason);
```

A frame contains an ordinary handle and a caller-written reason. It may also
retain an already-requested successful `show ... mode: summary` observation for
that handle. Branch replacement does not silently change focus.

Changing focus while a lens is open is rejected. Closing the lens leaves focus
unchanged.

## Loose questions

```js
const { question } = voyage.addQuestion('What deserves a bounded check?');
voyage.attachQuestion(question.id, {
  handle,
  reason: 'Why this handle bears on the prompt.',
});
voyage.attachQuestion(question.id, {
  subject: { type: 'event', id, kind: 1 },
  reason: 'Why this exact subject bears on the prompt.',
});
voyage.detachQuestion(question.id, referenceId);
voyage.removeQuestion(question.id);
```

Questions have no status, priority, score, answer, or automatic movement.

## Already-observed lenses

```js
voyage.openLens({
  family: 'evidence',
  label: 'Chosen note',
  observations: { command: explicitShow, outcome: showOutcome },
});

voyage.openLens({
  family: 'relation',
  label: 'Structural rows',
  observations: [
    { command: explicitShow, outcome: rowsOutcome },
    { command: explicitSchema, outcome: schemaOutcome },
  ],
});
```

The simplified slice supports evidence observations from `show`, and relation
observations from `show` and `schema`. Every observation must match the shared
handle focus. Lenses project only supplied responses and never request
follow-ups.

Evidence projection retains bounded subject, claim, resolution, provenance,
and paging facts. Relation projection retains bounded rows, populated-field
facts, cardinality, lineage, counts, and reported omissions. Unsupported or
unavailable facts remain visible as absent or omitted rather than inferred.

## Conditions

The compact conditions strip may expose:

- latest supplied receipt and warnings;
- compact external-attempt facts already retained by that receipt;
- handle, buffer, archive, and notebook pressure after an explicitly supplied
  status outcome.

The system never calls `status`, `list`, `schema`, `show`, `synchronize`, or any
other observation command by itself.

## Formatting

`formatVoyageSystemSlice(snapshot, options)` produces bounded text for live
trials. Formatting is deliberately not a frozen public contract. The structured
snapshot is the factual public boundary.

## Deliberate omissions

This slice has no:

- browser UI;
- automatic acquisition, observation, hydration, continuation, retry, or
  synchronization;
- automatic result placement, branch ranking, or recommendation;
- broad operation catalogue or routing vocabulary;
- predefined movement pipeline;
- second Home/current/trail state;
- hidden cargo or preservation store;
- synthesized question answer;
- comparison lens yet;
- relation operation composer.

Notebook and archive remain explicit ordinary engine operations. Focused schema
composition may produce a command draft elsewhere; the gate accepts that draft
unchanged.

## Validation

```sh
npm test --workspace @nostrarium/voyage-system-slice
npm run check --workspace @nostrarium/voyage-system-slice
```

See [`TRIALS.md`](./TRIALS.md) for the first real-relay voyage and defects.
