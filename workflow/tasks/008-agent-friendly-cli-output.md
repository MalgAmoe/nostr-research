---
id: 008-agent-friendly-cli-output
status: in_progress
max_attempts: 5
validation: workflow/tasks/008-agent-friendly-cli-output.validate.sh
depends_on: 007-saved-research
protected_paths: apps/reference-client CONTEXT.md workflow/artifacts workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make CLI output compact and composable

## Objective

Make the existing research CLI practical for interactive human and Codex use
without weakening the complete evidence representations already available.

Real use showed that acquisition, run listing, set listing, search, and
relationship navigation emit enough repeated JSON to consume thousands of
lines for modest result sets. This task changes projection and presentation,
not research semantics or stored data.

## Global output contract

Support one consistent CLI option:

```text
--output compact|full|ids|ndjson
```

The option must work in a predictable position documented by `--help`.
Unsupported output modes must fail non-zero with a useful message.

Meanings:

- `compact`: structured JSON containing the information needed to select a next
  operation, with bounded content excerpts and no repeated evidence payloads;
- `full`: the current complete structured representation, including canonical
  events, observations, reasons, diagnostics, and relationship evidence;
- `ids`: a JSON array of relevant result identifiers, preserving event/account
  type when a command can mix entity types;
- `ndjson`: one compact result record per line, with an optional first metadata
  record only when needed to preserve query or operation context.

Output must remain deterministic and machine-readable. Do not introduce
terminal tables, color, interactive prompts, or parsing based on screen width.

## Command defaults

- `acquire`, `search`, `accounts`, `related`, `run list`, and `set list`
  default to `compact`.
- Explicit evidence inspection commands (`inspect`, `account`, `run inspect`,
  `set inspect`, and `set explain`) default to `full`.
- Mutating set commands default to a compact acknowledgement with stable set
  identity and relevant member counts.
- `--output full` must preserve access to all previously observable information.

## Compact projections

### Acquisition

Return:

- database path;
- completion reason and recorded run ID when present;
- received, invalid, observations, newly stored, and duplicate counts;
- one concise outcome per requested relay;
- acquired event IDs.

Do not include the full acquired-observation or recorded-run result payload
unless `full` is requested.

### Event and account search

Each compact event result contains:

- ID, kind, author, creation time;
- a bounded single-line content excerpt;
- distinct relay names;
- concise but unambiguous match reasons.

Each compact account result contains:

- public key;
- current display/name fields that are actually stored;
- source metadata event ID and relay names;
- match reasons.

Do not invent missing profiles, trust, ranking, or display data.

### Relationships

Return the subject once. Each compact relationship contains only:

- direction and relationship type;
- target type, ID, and resolution state;
- source event ID;
- protocol and interpretation evidence needed to understand the edge.

Do not repeat a complete source event and observations inside every
relationship. `full` retains the complete representation.

### Runs and sets

- `run list` returns ID, operation, status, start/finish times, result count,
  and diagnostic count.
- `set list` returns ID, name, creation time, total member count, event count,
  and account count.
- Detailed run results, set members, membership reasons, and provenance remain
  available through explicit inspection or `--output full`.

## Invocation ergonomics

Add one obvious root npm command so the CLI can be invoked without knowing its
source path, for example:

```text
npm run research -- --db .data/research.sqlite search ...
```

It must use the local workspace binary and must not attempt a registry lookup.
Document it in the root and package README.

Do not hide all Node warnings globally. If the built-in SQLite experimental
warning can be suppressed narrowly and portably for the CLI entry point, do
so; otherwise document it as runtime noise and leave it unchanged.

## Scope boundaries

- Do not change acquisition, query, navigation, run, or set semantics.
- Do not change the SQLite schema.
- Do not add pagination, ranking, recommendations, set-to-filter generation,
  UI integration, or new research methodology.
- Do not remove full evidence or provenance.
- Do not introduce a general serializer framework or duplicate public domain
  objects solely for each command.

## Verification

- Adapt the existing black-box CLI functional scenarios rather than creating
  a test for every command and output mode.
- Verify that one representative acquisition/search/relationship/list flow is
  concise and machine-readable, and that `full` still exposes complete
  evidence.
- Verify `ids` can feed a subsequent command without text scraping.
- Verify NDJSON records can be parsed independently.
- The independent reviewer must run a small real or fixture-backed research
  path and compare compact versus full output size and usefulness.

## Acceptance criteria

- Default output for result-producing commands is materially smaller than the
  current full representation.
- A caller can identify results and choose a next operation without requesting
  full output.
- Compact relationships do not duplicate source events.
- List commands do not expand complete runs or sets by default.
- Full mode retains complete evidence, provenance, reasons, and diagnostics.
- IDs and NDJSON modes are deterministic and composable.
- The root npm command invokes the local CLI without hanging or registry
  lookup.
- Existing public library behavior and SQLite data remain unchanged.
- Reference-client behavior and source remain unchanged.
- Permanent test growth remains small and boundary-focused.
