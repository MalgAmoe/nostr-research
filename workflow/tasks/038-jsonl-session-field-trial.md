---
id: 038-jsonl-session-field-trial
status: ready
max_attempts: 8
validation: workflow/tasks/038-jsonl-session-field-trial.validate.sh
depends_on: 037-bounded-session-observation
protected_paths: workflow/run.py workflow/prompts workflow/artifacts/declarative-operations-field-trials.md workflow/artifacts/declarative-research-plan-field-trial.md
reviewer_sandbox: workspace-write
---

# Add the JSONL adapter and prove it through live research

## Objective

Expose the persistent declarative session as a protocol-clean JSON Lines
process and use it for open-ended live Nostr research without dynamically
authoring JavaScript.

The reusable architecture is the command/response protocol. JSONL is the first
adapter only.

## Executable adapter

Add a package executable such as:

```text
nostr-research-session --capacity 500
```

It must:

- read UTF-8 input one line at a time;
- parse one JSON command per non-empty line;
- dispatch commands sequentially to one persistent declarative session;
- write exactly one single-line JSON response per command to stdout;
- keep stdout free of prompts, progress prose, stack traces, and logs;
- turn malformed JSON into an `INVALID_COMMAND` response when correlation is
  unavailable;
- keep optional human diagnostics on stderr only;
- cancel owned external operations and close memory on EOF, signal, or process
  termination.

Do not duplicate command or research semantics in the adapter.

## Process-boundary functional scenario

Spawn the real executable and verify through JSONL that:

- memory and handles persist across commands;
- response envelopes remain valid one-line JSON;
- command IDs are echoed;
- revisions change only on mutations;
- unknown handles and revision conflicts are stable errors;
- bounded show/inspect/explain output works;
- release and reset semantics are correct;
- EOF closes cleanly.

Keep this as one functional process workflow, not a test per command.

## Live no-JavaScript trials

Use the executable itself—not a JavaScript wrapper—to perform at least three
different live investigations:

1. one directed topical/account investigation;
2. one orientation-first investigation where a later command is chosen after
   inspecting bounded evidence;
3. one investigation which encounters missing, empty, partial, or relay-error
   evidence and changes direction.

All research operations must be JSON commands sent to the process. Shell
transport may feed JSONL, but no dynamically authored JavaScript, callbacks,
manual reductions, or library imports may perform research work.

Record the exact JSONL command/response transcript or a bounded faithful
transcript with hashes/paths to any oversized raw capture in:

`workflow/artifacts/declarative-session-field-trials.md`

Record:

- whether any dynamic JavaScript was still needed;
- usability for an agent compared with the JavaScript REPL;
- output sizes and omitted/truncated values;
- useful and useless warnings;
- revision behavior;
- external completeness behavior;
- missing neutral operations, if any;
- presentation or protocol friction;
- what should be removed or simplified.

## Cleanup and documentation

Make only corrections directly evidenced by the process trial. Remove
redundant session/protocol surface rather than retaining speculative options.
Document the executable, protocol envelope, commands, and bounded output.

Do not remove the JavaScript REPL in this task. The trial decides whether it
can later be deprecated or removed.

## Boundaries

- No browser adapter, Worker adapter, server, UI, Rust, persistence, DSL,
  plugin system, concurrency scheduler, or automatic classification.
- Do not add algebra operations merely to make a trial look successful.
- Do not implement multi-client concurrency beyond optional `ifRevision`.
- The live transcript is validation evidence, not a permanent network test.

## Acceptance criteria

- The real executable is a persistent protocol-clean JSONL process.
- It uses the same interpreter and operation semantics as in-process callers.
- The process functional scenario passes.
- Three live investigations are recorded and use no dynamic JavaScript for
  research.
- Responses remain bounded, correlated, revisioned, and machine-readable.
- Partial and empty outcomes remain successful, structurally explicit
  research results where appropriate.
- The artifact gives an evidence-based verdict on replacing the JavaScript
  REPL's practical role.
- Functional tests and syntax checks pass.
