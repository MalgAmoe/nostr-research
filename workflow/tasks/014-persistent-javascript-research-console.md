---
id: 014-persistent-javascript-research-console
status: done
max_attempts: 5
validation: workflow/tasks/014-persistent-javascript-research-console.validate.sh
depends_on: 013-in-memory-research-workspace
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add a persistent JavaScript research console

## Objective

Create the smallest persistent application an agent can actually operate: a
Node JavaScript REPL backed by the library, an in-memory workspace, and SQLite
persistence.

JavaScript is the interaction language. Do not invent a command grammar,
network API, or graphical interface.

## Console lifecycle

Add a package executable and root launcher that can:

- open a caller-supplied SQLite database;
- create a bounded in-memory research workspace;
- start Node's interactive REPL with top-level `await`;
- keep JavaScript variables and the workspace alive between commands;
- close relay resources, workspace resources, and memory cleanly on exit; and
- return useful non-zero failures for invalid startup arguments.

The executable must work both interactively through a PTY and non-interactively
when JavaScript is piped into standard input for functional verification.

## Prepared environment

Expose one compact `research` object as the primary entry point. It should make
the common research loop natural:

- inspect workspace and durable-memory summaries;
- load a bounded stored corpus;
- acquire explicit bounded relay data into memory and the workspace;
- search events and accounts;
- reuse or replace the current session selection;
- inspect, traverse, compare, and retain results; and
- access the underlying public `memory`, `workspace`, and `session` when deeper
  library operations are needed.

Do not wrap every library method. Prefer a few meaningful conveniences and
direct access to the established public objects.

Useful results must remain ordinary JavaScript values that can be assigned,
filtered, combined, and passed into later operations.

## Output

Interactive inspection must be bounded and readable:

- large collections print their identity, count, context, and a small preview;
- complete values remain programmatically available;
- progress from long acquisition is visible without flooding output; and
- errors preserve useful operation context.

Use standard Node inspection facilities or a small cohesive formatter. Do not
create parallel rendered data models.

## Boundaries

- No browser or desktop UI.
- No screenshots or visual evaluation.
- No HTTP server, daemon, socket protocol, or remote code execution.
- No custom language or parser.
- No automatic public relays, background acquisition, crawling, ranking, or
  hidden research policy.
- Do not make incidental REPL variables durable.

## Documentation

Document startup, shutdown, prepared bindings, top-level `await`, assignment and
reuse of results, loading versus acquisition, and one short multi-step example.

## Verification

Use a public process-boundary functional scenario that starts one console
process, sends multiple JavaScript expressions, and proves:

- a variable created by one expression is usable by a later expression;
- a stored corpus loads into the workspace;
- search, traversal or inspection, session selection, and retention compose;
- output remains bounded for a large result; and
- exiting closes the database so it can immediately be reopened.

Do not test private formatter helpers or Node REPL internals.

## Acceptance criteria

- The console is a persistent JavaScript environment, not repeated CLI calls.
- Top-level `await` and persistent variables work.
- The `research` object drives the real library and in-memory workspace.
- Ordinary results are composable JavaScript values.
- Interactive rendering cannot accidentally dump an entire realistic corpus.
- Clean exit leaves durable evidence usable.
- Existing CLI and library entry points continue to work.
