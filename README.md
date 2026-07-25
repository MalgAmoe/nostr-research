# Nostr Research

This repository develops Nostr research and navigation as a composable,
UI-independent library.

```text
packages/nostr-research/    UI-independent research library and CLI
workflow/                   Persistent rebuild workflow
docs/                       Project decisions and supporting material
```

## Run the research CLI

The root command uses the workspace-installed CLI binary without a registry
lookup:

```sh
npm run --silent research -- --db .data/research.sqlite init
npm run --silent research -- --db .data/research.sqlite search --text nostr
```

Use `--output compact|full|ids|ndjson` before or after the command to select a
machine-readable projection. `--silent` suppresses npm's script banner so
standard output contains only CLI data. Run
`npm run --silent research -- --help` for details.
