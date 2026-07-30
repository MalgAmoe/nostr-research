# Field board experiment

A disposable multi-frame position and comparison surface for one Ground and a
bounded set of branches.

```text
Ground
├── branch A
├── branch B
└── branch C
```

The board accepts ordinary named handles and successful `show` summary outcomes
that the caller already requested. It has no controller, executes no commands,
and imports no other experiment.

## Purpose

Evidence Desk proved useful around one current note/account frame. The field
board tests the different Breadth problem: can Ground, branch origin, bounds,
resolution, reasons, and neutral contrasts remain understandable together
without opening every handle or maintaining the structure in external notes?

It deliberately does not display notes or accounts.

## Use

```js
import {
  createFieldBoard,
  formatFieldBoard,
} from '@nostrarium/field-board';

const board = createFieldBoard({
  ground: {
    key: 'ground',
    label: 'Ground',
    reason: 'Bounded kind-1 relay field.',
    source: groundOutcome,
    observation: {
      command: groundSummaryCommand,
      outcome: groundSummaryOutcome,
    },
  },
  branches: [{
    key: 'media',
    label: 'Media-bearing',
    reason: 'Events returned by the caller-chosen media predicate.',
    source: mediaOutcome,
    observation: {
      command: mediaSummaryCommand,
      outcome: mediaSummaryOutcome,
    },
  }],
});

console.log(formatFieldBoard(board.snapshot()));
```

Every frame exposes:

- its ordinary handle unchanged;
- caller-defined label and reason;
- Ground or branch role;
- handle kind and observed count;
- summary result kind and count unit;
- bounded lineage facts;
- declared bounds and completeness;
- evidence-resolution counts.

The board retains insertion order. It does not rank branches. Mechanical
contrasts preserve paired counts, kind compatibility, and evidence-resolution
profile changes. Bound comparison distinguishes shared keys with different
values, facts declared only by the left frame, facts declared only by the right
frame, and frames with no comparable bound keys. Input, discovered, and output
cardinality remain frame facts rather than masquerading as bound differences. A
same-kind branch-to-Ground count ratio is shown when Ground count is non-zero,
with an explicit statement that membership overlap is not established.

## Explicit position changes

```js
const { added } = board.addBranch(nextObservedFrame);

board.select('media');
const handle = board.handle(); // ordinary handle for any other surface

const { displaced } = board.replaceBranch('media', replacementFrame);
```

Addition appends one already-observed branch and returns its ordinary handle
without changing focus. Selection changes only local focus. Replacement changes
only the chosen branch slot and returns the displaced ordinary handle. If the
replaced branch was focused, focus follows the replacement. These actions mutate
only local board position; none inspects or executes a handle.

## Boundaries

- One Ground is fixed for the lifetime of a board.
- Branches are one level deep and bounded to eight by default.
- Every frame requires an already-requested summary for the same handle.
- Handle count and observed summary count must agree.
- Caller reasons remain attributed as caller reasons.
- Pairwise contrast is factual and neutral; no branch is preferred.
- No subjects, profile claims, event text, notebook judgment, or relation rows
  are rendered.
- No controller or execution capability is accepted.
- Evidence Desk, relation tools, and raw commands receive only returned ordinary
  handles and are not dependencies.

See [TRIALS.md](./TRIALS.md) for live evaluation.
