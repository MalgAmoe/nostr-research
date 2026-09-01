# Nostrarium desktop

The local agent-operated Nostrarium application. It embeds Pi's agent runtime,
the Nostrarium controller, and one in-process research session. Users do not
install or run Pi separately.

It provides encrypted OpenAI Codex login, the complete Nostrarium command
interface, a persistent in-process voyage, human intervention, and bounded
evidence presentation.

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
transformation, traversal, plans, schema discovery, and
lifecycle. Commands execute against one persistent engine session, and their
full responses remain available in the controller record. Focused schema is
requested through the same tool when dynamic fields or parameter shapes need
to be discovered. It is construction help, not a gate on which research paths
the navigator may attempt.

The complete [desktop navigator guide](./AGENT-GUIDE.md) is included in the
agent's initial operating instructions, so basic command discovery does not
consume the beginning of every voyage. It is adapted to the embedded tool,
controller-owned correlation, command batches, attention, recipes, and context
checkpoints; the separate repository CLI guide remains specific to JSONL
terminal operation.

The same `nostrarium` tool can execute up to 20 already-decided ordinary
commands as a transparent sequential batch. Every member keeps its own intent,
controller receipt, response, and transcript entry. A batch stops on the first
failed response and must not cross a point where evidence or human judgment
should determine the next command. Engine `plan` remains the transactional
representation for research stages; desktop batching only removes unnecessary
model turns between heterogeneous ordinary commands such as observation and
lifecycle steps. Combined model and renderer projections are bounded; opening
the raw batch disclosure loads each complete retained controller record lazily.

`nostrarium_attention` is a bounded, process-local workspace for temporary
voyage orientation. It is a small key/value JSON store whose
organization belongs entirely to the navigator: the application does not name
Ground, focus, questions, candidates, or any other research concept. It executes
no research command, copies no evidence, records no conclusion by its own
authority, and is cleared by session reset. Temporary hypotheses stored there
do not become canonical evidence. The current workspace is included
in factual context checkpoints. It should be used selectively when temporary
working state must survive several steps, not as a mirror of every handle,
command, fact, or conclusion.

`nostrarium_recipes` exposes cross-run recipe memory through four operations:
list, get, save, and delete. Recipes are bounded JSON objects owned by the
navigator. Loading one gives the agent orientation; saving or loading executes
no controller or research command. Actual operations remain ordinary visible
`nostrarium` commands. Command-like recipe steps should preserve exact command
envelopes that previously succeeded, while parameters, decision points, and
limitations remain explicit and adaptable.

The store seeds three versioned, replaceable orientations: profile descent,
raw p-tag mention frequency, and a two-relay comparison. They are examples of
proven command compositions, not privileged workflows. Application-owned seeds
may receive factual corrections on a later version; a navigator-edited recipe
is never overwritten.

The adapter does not replace this command surface with task-specific tools.
Recipes may guide visible ordinary commands, but the navigator always retains
access to the complete interface and may combine operations in ways those
recipes did not anticipate.

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
buffer contents, archive evidence, temporary attention,
controller state, and in-flight voyages remain process-local. Provider
credentials remain separately encrypted through Electron `safeStorage` and
never enter SQLite.

## Retained runtime seams

The main process and preload boundary intentionally retain two operations that
the current renderer does not display:

- `logout(providerId)` removes stored provider access and clears a selected
  model from that provider. It is the future account-management boundary.
- `steer(message)` injects a human message into an active agent turn. It is the
  future mid-voyage intervention boundary; the current renderer offers abort
  only.

They remain narrow runtime operations rather than speculative UI. When either
control is exposed, the renderer should call the existing preload method; it
must not add another authentication or agent-execution path.

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
