# Nostrarium

Nostrarium develops research and navigation through the Nostr field. Its
foundation is a composable, UI-independent research engine; caller-side
vessels will progressively give that engine coherent ways of being operated.

```text
packages/nostr-research/    UI-independent research library and JSONL session
packages/nostrarium-controller/  Neutral caller-side controller and Node transport
workflow/                   Worker/reviewer task generator
```

## Run a research session

The JSON Lines executable owns one persistent declarative research session:

```sh
npm run research-session -- --capacity 1000
```

It reads one JSON command per line and writes one correlated JSON response per
line. Start with the [CLI guide](./CLI.md). It explains the process model,
schema discovery, a complete first research session, collections versus
relations, navigation, observation, and common mistakes.

The [package reference](./packages/nostr-research/README.md) documents the
in-process JavaScript API, browser Worker adapter, exact engine behavior, and
protocol semantics. [CONTEXT.md](./CONTEXT.md) contains durable product and
engineering decisions.

The [controller reference](./packages/nostrarium-controller/README.md)
documents the neutral caller-side session controller and its Node JSONL
transport.

Persistence and a database format are deliberately absent. Closing or
resetting the session, or exiting the process, loses all resident evidence,
notebook entries, named memberships, and handles.
