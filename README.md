# Nostr Research

This repository develops Nostr research and navigation as a composable,
UI-independent library.

```text
packages/nostr-research/    UI-independent research library and JS console
workflow/                   Persistent rebuild workflow
docs/                       Project decisions and supporting material
```

## Run the research console

The JavaScript console exposes the library directly, so research
operations remain composable without building a second command vocabulary:

```sh
npm run research-console -- --capacity 10000
```

The console keeps one bounded, process-local research corpus in memory and
makes acquisition, search, expansion, inspection, filtering, and checkpoints
available as JavaScript operations. Persistence and a database format are
deliberately absent: closing or resetting the corpus, or exiting the process,
loses all resident evidence, retained groups, runs, and acquisition coverage.
See the package README for the console bindings and examples.
