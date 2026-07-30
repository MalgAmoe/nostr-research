# Nostrarium

Nostrarium develops research and navigation through the Nostr field. Its
foundation is a composable, UI-independent research engine and a small neutral
controller. Above them, disposable experiments explore many ways of operating,
composing, and experiencing the same evidence.

```text
packages/nostr-research/    UI-independent research library and JSONL session
packages/nostrarium-controller/  Neutral caller-side controller and Node transport
experiments/schema-composer/  Schema-backed command and observation composer
experiments/flight-console/   Research sensors, movements, and engine escape
experiments/overlap-cockpits/ Bridge, Parallax, and Expedition experiments
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

Disposable interpretations live under [`experiments/`](./experiments/).
Stable engine and controller packages do not depend on them.

Persistence and a database format are deliberately absent. Closing or
resetting the session, or exiting the process, loses all resident evidence,
notebook entries, named memberships, and handles.

## Project documents

- [CONTEXT.md](./CONTEXT.md) contains durable principles and terminology.
- [VESSELS.md](./VESSELS.md) contains the current conclusions from vessel and
  playful-voyage experiments.
- [NEXT-STEPS.md](./NEXT-STEPS.md) contains the active direction and promotion
  rules for future work.
- [CONTROL-AND-DATA-MAP.md](./CONTROL-AND-DATA-MAP.md) maps the available
  controls and evidence surfaces.
- [NOSTR-PROTOCOL-CAPABILITY-MAP.md](./NOSTR-PROTOCOL-CAPABILITY-MAP.md) maps
  protocol coverage and possible future capabilities.
- [docs/voyages/](./docs/voyages/) contains completed trial journals and
  artifacts. They are evidence, not current guidance.
