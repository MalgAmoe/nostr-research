# Nostr Research

This repository develops Nostr research and navigation as a composable,
UI-independent library.

```text
packages/nostr-research/    UI-independent research library and JSONL session
workflow/                   Worker/reviewer task generator
```

## Run a research session

The JSON Lines executable owns one persistent declarative research session:

```sh
npm run research-session -- --capacity 1000
```

It reads one JSON command per line and writes one correlated JSON response per
line. Named result handles make acquisition, local selection, continuation,
inspection, transformation, and explicit notebook knowledge composable without an
implicit current selection. Persistence and a database format are deliberately
absent: closing or resetting the session, or exiting the process, loses all
resident evidence, notebook entries, named membership, and handles. See the
package README for the command protocol and examples.

`status` reports the observation buffer, evidence archive, and research
notebook separately. `list` reports named working-view cardinalities, making
complete buffer turnover and accidental evidence duplication observable.

The final operation flow is explicit: acquire from relays, select from local
memory, navigate stable subject collections, cross into research relations for
value analysis, and preserve evidence or attributed notebook knowledge only
when requested. Schema discovery and bounded next-operation suggestions make
this flow usable sequentially without an implicit selection or executable
JavaScript.
