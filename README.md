# Nostr Research

This repository develops Nostr research and navigation as a composable,
UI-independent library.

```text
packages/nostr-research/    UI-independent research library and JS console
workflow/                   Persistent rebuild workflow
docs/                       Project decisions and supporting material
```

## Run the research console

The persistent JavaScript console exposes the library directly, so research
operations remain composable without building a second command vocabulary:

```sh
npm run research-console -- --db .data/research.sqlite
```

The console keeps one SQLite-backed research memory open and makes acquisition,
search, expansion, inspection, filtering, and checkpoints available as
JavaScript operations. See the package README for the console bindings and
examples.
