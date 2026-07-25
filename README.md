# Nostr Research

This repository is rebuilding Nostr research and navigation around a
UI-independent library. The first Solid application was removed after it
served its purpose as an interaction experiment.

```text
packages/nostr-research/    UI-independent research library and CLI
workflow/                   Persistent rebuild workflow
docs/                       Project decisions and supporting material
```

The retained lessons from the removed experiment are recorded in
[`docs/solid-experiment-lessons.md`](docs/solid-experiment-lessons.md). Its
implementation remains available through Git history, but it is not a target
architecture for the next application.

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
