# Nostrarium desktop

The local agent-operated Nostrarium application. It embeds Pi's agent runtime,
the Nostrarium controller, and one in-process research session. Users do not
install or run Pi separately.

This first slice is deliberately narrow. It provides one encrypted OpenAI
Codex login, an informed research-tool adapter with a complete raw escape
hatch, a persistent in-process voyage, human intervention, and bounded
evidence presentation before wider interface work begins.

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

Common acquisition, observation, exact-subject inspection, membership
explanation, status, listing, and release operations have typed tools whose
stable vocabulary is available before the first command.

`nostrarium_action` handles collection and relation transformations. It obtains
the current focused contract internally, validates navigator-supplied values
with the factual schema composer, and executes exactly one ordinary
research command. The local contract lookup consumes no model turn, performs
no research movement, and remains recorded in the bounded controller
transcript. The result exposes the compiled command and validation basis.

`nostrarium_contract` exposes one compact focused contract when current
populated fields, routes, or nested choices genuinely affect construction. It
executes no research operation and makes no recommendation. Local
transformations return their existing cardinality and truncation facts in the
same result so the navigator can reject a biased bounded view immediately.

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

`nostrarium` remains the complete raw escape hatch for configuration, relay
information/counting, plans, notebook queries, diagnostics, and commands not
yet represented by the informed adapter. Visible schema inspection remains
available when the navigator is deciding among dynamic capabilities; it is no
longer required merely to construct ordinary syntax.

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
and `--model`. Voyage mode shares the desktop system prompt, informed tools,
controller, schema composer, context compaction, default relays, and encrypted
credential store. It does not provide a separate login flow or a second
implementation of agent behavior.

For deliberate compaction trials, `--context-token-limit` can lower the voyage
pressure threshold without changing the interactive desktop default. Values
below 1,000 are rejected.
