# Nostr Research

This repository separates the existing reference client from the future
UI-independent research library.

```text
apps/reference-client/      Existing Solid reference client
packages/nostr-research/    Reserved for the UI-independent library
workflow/                   Persistent rebuild workflow
docs/                       Project decisions and supporting material
```

## Run the reference client

Requires Node.js 20+.

```sh
npm install
npm run build
npm start
```

For development with hot reload, run `npm run dev` alongside `npm start`.
The reference client's detailed usage notes are in
[`apps/reference-client/README.md`](apps/reference-client/README.md).

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
