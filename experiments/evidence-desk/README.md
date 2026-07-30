# Evidence desk experiment

A disposable single-frame note/account decision surface over explicit
controller observations.

Three sustained voyages established that shape. The desk naturally supports
Depth and Skeptic work around one current subject or evidence frame. It remains
useful at individual Breadth stops, but does not keep Ground and several branch
frames visible together; that is a boundary rather than a card defect.

The desk keeps evidence visualization separate from controls:

```text
explicit show response ── arrangeEvidence() ── note/account cards
requested schemas      ── arrangeActions()  ── visible controls
navigator choice       ── composeAction()   ── ordinary command
selected card          ── composeCardFocus() ─ visible command sequence
```

It imports no other experiment and owns no controller capability.

## Evidence

```js
import {
  arrangeEvidence,
  compareEvidenceFrames,
  formatEvidence,
} from '@nostrarium/evidence-desk';

const command = {
  command: 'show',
  input: 'notes',
  parameters: { mode: 'preview', previewLimit: 10 },
};
const outcome = await controller.execute(command);
const desk = arrangeEvidence({ command, outcome });
console.log(formatEvidence(desk));
```

Kind-1 events become note cards. Account subjects become account cards. Kind-0
metadata events are displayed as account claims while retaining their immutable
metadata-event source identity. No metadata JSON is reparsed by the experiment.

Claims, evidence state, inclusion reasons, provenance, paging, acquisition
uncertainty, and transformation context remain distinct.

All explicit observation modes have separate arrangements:

- `preview`: note/account cards;
- `summary`: cardinality, bounds, event facts, and evidence resolution;
- `details`: cards plus notebook, provenance, freshness, corpus, and canonical
  evidence panels;
- `explain`: exact inclusion reasons and bounded provenance;
- `coverage`: source participation, resolution, partiality, and bounds. Acquisition
  coverage is read from its distinct root-level report shape rather than from a
  collection-style nested `coverage` object.

Modes are not coerced into a common card shape when their evidence differs.

## Comparing explicit observations

```js
const transition = compareEvidenceFrames(localAncestors, relayAncestors);
```

The comparison reports neutral set facts (`shared`, `onlyBefore`, `onlyAfter`)
and source-state changes such as `unresolved → buffer` or `buffer → archive`.
It does not claim that one frame caused another.

## Focusing a card

```js
const accountCard = desk.cards.find(({ object }) => object === 'account');
const focus = composeCardFocus(desk, accountCard.cardId, {
  resultId: 'focused-account',
  intermediateResultId: 'focused-profile-event',
});

for (const command of focus.commands) {
  // Display the command and execute only after navigator confirmation.
  await controller.execute(command);
}
```

A note or account already held as that subject requires one visible `pick`.
An account displayed from a kind-0 event requires visible `pick → move authors`
commands. The distinction is not hidden by the card presentation. `cardId` is
source-stable and remains unique when several immutable metadata events describe
the same primary account `id`.

## Actions

The caller explicitly requests a broad contextual schema and any focused
contracts it wants to expose:

```js
const broad = await controller.execute({
  command: 'schema', input: 'focused-account', parameters: {},
});
const continuation = await controller.execute({
  command: 'schema', input: 'focused-account',
  parameters: { operation: 'continue' },
});

const controls = arrangeActions({
  source: 'focused-account',
  schemaOutcomes: [broad, continuation],
});
```

Broad-schema operations remain visible with `contractLoaded: false`. Focused
contracts add factual parameters, requirements, and choices. Declared move
routes, continuation relationship/source pairs, and preservation levels expand
into visible command variants; none is selected automatically. Composition
checks mechanically declared required and “at least one” fields before returning
a command, while the engine remains the semantic validation authority.

This complete action enumeration is truthful but has not yet earned permanence.
In sustained voyages, a navigator with an intended movement usually entered the
ordinary command directly; unresolved-account hydration was the recurring case
where a situational control would have materially helped. The broad arranger is
retained as experimental evidence, not promoted as the desk's proven core.

```js
const authoredLocally = controls.groups
  .flatMap(({ actions }) => actions)
  .find(({ id }) => id === 'operate:continue')
  .variants
  .find(({ id }) => id === 'operate:continue:authored-notes:local');

const command = composeAction(authoredLocally, {
  parameters: { eventLimit: 25 },
  resultId: 'authored-notes',
});
```

The five `show` modes are a small desk-owned observation vocabulary rather than
facts attributed to contextual operation schemas. Every observation door is an
ordinary visible `show` command.

## Boundaries

- The desk presents one current evidence frame; it is not a branch map,
  comparison board, or pinned-Ground system.
- Initial reasons and cross-frame tensions remain navigator-owned rather than
  being inferred from cards.
- No controller or execute function is accepted.
- No observation, schema request, focus, preservation, or movement is issued.
- Full commands and multi-command focus sequences remain visible.
- Profile values are labelled as claims.
- Relay completeness, evidence resolution, and inclusion reasons are not
  converted into trust or quality judgments.
- Relation rows are deliberately unsupported by this note/account desk and are
  counted as such rather than coerced into cards.
- Observation items, relays, action choices, comparisons, and text rendering
  are bounded.
- Handles remain available in technical footers and commands, but are not the
  primary evidence heading.

See [TRIALS.md](./TRIALS.md) for the iteration record.
