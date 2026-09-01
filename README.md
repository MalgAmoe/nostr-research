# Nostrarium

Nostrarium develops agent-operated research and navigation through the Nostr
field. Its foundation is a composable, UI-independent research engine and a
small neutral controller. The current product direction is a local desktop
application in which an embedded agent operates that foundation while a human
directs the voyage, inspects evidence, and owns the conclusions.

```text
packages/nostr-research/    UI-independent research library and JSONL session
packages/nostrarium-controller/  Neutral controller with Node and browser transports
apps/nostrarium-desktop/    Local agent-operated desktop application
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
documents the neutral caller-side session controller and its Node JSONL and
browser Worker transports.

The [desktop application reference](./apps/nostrarium-desktop/README.md)
documents the embedded agent, application storage, research tools, and
headless voyage mode. Users do not install or run Pi separately.

Research evidence and session state remain deliberately process-local. Closing
or resetting the session loses resident evidence, archived evidence, and
handles. The desktop application separately persists its own
settings and agent-authored command recipes in a local SQLite store; it does
not persist the research engine's memory.
