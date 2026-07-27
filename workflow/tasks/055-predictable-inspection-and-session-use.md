---
id: 055-predictable-inspection-and-session-use
status: ready
max_attempts: 5
validation: workflow/tasks/055-predictable-inspection-and-session-use.validate.sh
depends_on: 054-memory-and-result-ownership
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make inspection and persistent-session use predictable

## Objective

Make the JSONL session a thin, bounded, inspectable adapter over the same
operation executor, with enough visibility to direct sequential research
without arbitrary JavaScript.

## Work

- Limit session responsibilities to named handles, caller correlation,
  revision guards, sequencing/cancellation, lifecycle, response envelopes, and
  bounded presentation.
- Give observation five explicit meanings:
  - preview: a bounded member or row page;
  - summary: compact counts and characteristics;
  - coverage: sources, bounds, omissions, unresolved evidence, and partiality;
  - details: currently known canonical evidence for selected subjects;
  - explain: provenance and membership reasons.
- Make valid next operations discoverable from the current result, including
  accepted constraints and concise examples.
- Make collection/relation and relation/subject transitions explicit.
- Simplify multi-handle composition without introducing implicit active
  selection or parallel background work.
- Ensure read-only observation does not increment the session revision.
- Represent successful partial external outcomes with structured completeness,
  not only warnings.
- Remove eager secondary metadata that displaces the requested result, raw
  dumps as defaults, obsolete commands and terms, duplicated session-side
  operation rules, and avoidable PTY echo ambiguity.
- Update package documentation with a short sequential research walkthrough.

## Acceptance criteria

- Ordinary responses are bounded and requested content is primary.
- A caller can distinguish contents, provenance, coverage, and membership
  reasons without receiving the entire result.
- Valid next operations are discoverable contextually.
- The session delegates all research semantics to the authoritative executor.
- Revisions change only with interpreter-owned mutation; failures leave state
  unchanged.
- Partial external work is a successful command with machine-readable
  completeness.
- Representative research can proceed without arbitrary JavaScript or manual
  stable-ID extraction.

## Verification

- Permanent tests expected: a small number of public JSONL/session functional
  workflows covering response bounds, observation meanings, revisions,
  contextual discovery, and partial completeness.
- Stable public behavior protected: persistent sequential research and stable
  response envelopes.
- Temporary task validation or field evidence: replay representative commands
  through the executable and inspect bounded output.
- Explicitly excluded test levels or mechanisms: tests per command or
  projection field, PTY/network-stack tests, live-relay tests, UI, screenshots,
  and private presenter tests.
