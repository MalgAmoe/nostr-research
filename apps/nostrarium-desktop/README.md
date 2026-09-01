# Nostrarium desktop

The local agent-operated Nostrarium application. It embeds Pi's agent runtime,
the Nostrarium controller, and one in-process research session. Users do not
install or run Pi separately.

This first slice is deliberately narrow. It provides one encrypted OpenAI
Codex login, the complete Nostrarium command interface, a persistent in-process
voyage, human intervention, and bounded evidence presentation before wider
interface work begins.

```sh
npm run dev --workspace @nostrarium/desktop
```

Sign in with an eligible ChatGPT account, choose a model, and ask the agent to
begin from a bounded random field. The app opens OAuth pages in the system
browser; credentials are encrypted in Electron's application-data directory
and never enter the renderer.

The renderer is sandboxed and receives no Node, credential, filesystem, shell,
or raw IPC access. The embedded agent receives only Nostrarium research
tools—no coding, shell, file, browser, or arbitrary-network tools.

## Agent context

The controller transcript remains the authoritative execution record. The
model receives bounded projections of command outcomes, while raw retained
records are loaded by the renderer only when a person expands them.

Ordinary voyages keep their complete model-visible conversation regardless of
command count. When estimated model context reaches a real pressure threshold,
older turns are replaced at the model boundary by a factual voyage checkpoint:
the research objectives, executed commands and receipts, produced handles,
navigator narration, and recently consulted focused contracts. Recent turns
remain complete. The checkpoint is orientation rather than evidence; exact
claims must still be reopened from named handles or controller records.

## Agent tools

`nostrarium` is the primary and complete research tool. It accepts every
ordinary session command: configuration, acquisition, observation,
transformation, traversal, plans, schema discovery, notebook operations, and
lifecycle. Commands execute against one persistent engine session, and their
full responses remain available in the controller record. Focused schema is
requested through the same tool when dynamic fields or parameter shapes need
to be discovered. It is construction help, not a gate on which research paths
the navigator may attempt.

`nostrarium_attention` is a bounded, process-local caller-side experiment for
temporary voyage orientation. It is a small key/value JSON workspace whose
organization belongs entirely to the navigator: the application does not name
Ground, focus, questions, candidates, or any other research concept. It executes
no research command, copies no evidence, records no conclusion by its own
authority, and is cleared by session reset. Temporary hypotheses stored there
do not become canonical evidence or notebook knowledge. The current workspace is included
in factual context checkpoints. It should be used selectively when temporary
working state must survive several steps, not as a mirror of every handle,
command, fact, or conclusion. Recurring structures may inform a later design;
none are part of the interface yet.

`nostrarium_recipes` exposes cross-run recipe memory through four operations:
list, get, save, and delete. Recipes are bounded JSON objects owned by the
navigator. Loading one gives the agent orientation; saving or loading executes
no controller or research command. Actual operations remain ordinary visible
`nostrarium` commands. Command-like recipe steps should preserve exact command
envelopes that previously succeeded, while parameters, decision points, and
limitations remain explicit and adaptable.

The adapter does not replace this command surface with task-specific tools.
Caller-side recipes or command composers may later produce visible ordinary
commands, but the navigator must always retain access to the complete
interface and may combine operations in ways those conveniences did not
anticipate.

## Application persistence

Electron's main process owns one local SQLite application store at
`nostrarium.sqlite3` inside the application-data directory. The sandboxed
renderer never opens the database or receives a persistence bridge. Typed
settings remain internal to the main process, while recipe definitions are
available to the agent through the separate memory tool and are never executed
by it.

The store seeds `relayDefaults`, and both the windowed runtime and headless
voyage mode use that application setting when constructing a new research
session. Schema migrations are explicit and records are size-bounded.

This is application memory, not engine persistence. Live handles, observation
buffer contents, archive evidence, notebook knowledge, temporary attention,
controller state, and in-flight voyages remain process-local. Provider
credentials remain separately encrypted through Electron `safeStorage` and
never enter SQLite.

## Headless voyage mode

The desktop app can run the same embedded agent and research runtime without
opening a window. It reads the existing encrypted desktop login and selects
`gpt-5.6-sol` by default; it never silently falls back to another model.

Check that the stored login and Sol model are available without making an
inference request:

```sh
npm run voyage --workspace @nostrarium/desktop -- --check
```

Run one voyage and retain its complete JSONL event trace:

```sh
npm run voyage --workspace @nostrarium/desktop -- \
  --prompt "Acquire a random bounded field and tell me what is worth investigating." \
  --output /tmp/nostrarium-voyage.jsonl
```

Use `--prompt-file` for longer prompts, or explicitly override `--provider`
and `--model`. Voyage mode shares the desktop system prompt, research tools,
controller, context compaction, default relays, and encrypted
credential store. It does not provide a separate login flow or a second
implementation of agent behavior.

For deliberate compaction trials, `--context-token-limit` can lower the voyage
pressure threshold without changing the interactive desktop default. Values
below 1,000 are rejected.
