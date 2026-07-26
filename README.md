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
npm run research-console -- --capacity 1000
```

The console keeps one bounded, process-local research corpus in memory and
makes acquisition, search, expansion, inspection, filtering, and retention
available as JavaScript operations. Results do not implicitly replace the
active selection: `research.activate(result)` is the sole activation operation,
while `retain(result, name)` and `checkpoint(name)` separately retain an
explicit result or the active selection. Persistence and a database format are
deliberately absent: closing or resetting the corpus, or exiting the process,
loses all resident evidence and retained selections. Acquisition attempt
coverage is returned to its caller and is not stored as global history.
See the package README for the console bindings and examples.
