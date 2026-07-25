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

## Run the interactive research playground

Start the local application from the repository root:

```sh
npm run playground
```

Open `http://127.0.0.1:4317`. The server owns SQLite and relay connections;
browser code only uses its local HTTP API. The default research database is
`.data/playground.sqlite` (ignored by Git). A different path can be opened or
created in the first panel, or supplied at startup with
`NOSTR_RESEARCH_DB=/path/to/research.sqlite npm run playground`. Set `PORT` or
`HOST` to change the local listener.

The workflow is intentionally small: open memory, acquire a bounded explicit
relay/filter slice, inspect and focus evidence, include or exclude subjects,
expand one named relationship, go back, and checkpoint the current selection.
Saved sets listed in the first panel can be opened as the starting point of a
new temporary session.

On a macOS host with Safari remote automation enabled, the actual-browser
verification can be rerun with:

```sh
npm run test:playground-browser-evidence
```

It drives the controlled vertical slice through the visible UI and writes
screenshots plus a machine-readable state trace to `workflow/artifacts/`.
