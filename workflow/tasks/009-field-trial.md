---
id: 009-field-trial
status: in_progress
max_attempts: 4
validation: workflow/tasks/009-field-trial.validate.sh
depends_on: 008-agent-friendly-cli-output
protected_paths: apps packages CONTEXT.md docs package.json package-lock.json README.md workflow/ROADMAP.md workflow/WORKFLOW.md workflow/run.py workflow/prompts workflow/tasks
reviewer_sandbox: workspace-write
---

# Conduct a real Nostr research field trial

## Objective

Use the library and improved CLI as an actual research instrument before
planning more product architecture. Record what works, what obstructs research,
what the data itself reveals, and which next tasks are justified by evidence.

This is an evaluation task. Product and workflow code are read-only.

## Required research paths

Use a disposable or retained Git-ignored SQLite database under `.data/`.
Contact two to four explicitly named public relays with bounded acquisitions
when the worker environment permits network access. A retained database may be
used as real evidence when its recorded acquisition run contains the exact
relays, filters, bounds, outcomes, identifiers, and per-event provenance needed
to verify how it was acquired. Do not claim relay coverage beyond the observed
sample.

The retained `.data/first-research.sqlite` is available as a starting candidate.
It was created through the public CLI before this task and should be accepted
only after independently verifying its recorded acquisition run and evidence.
If it is absent, empty, or unverifiable, perform a new bounded acquisition or
return `BLOCKED`; never substitute fixtures.

Complete at least two connected research paths:

1. Start from a topic or text question, acquire evidence, query it locally,
   inspect selected notes, pivot through at least two relationship types, save
   a run and set, expand or combine a set, close the database, reopen it, and
   continue.
2. Start from an account or account clue found in the first path, acquire or
   inspect relevant metadata/evidence, examine authored and referenced
   relationships, and preserve a second selection path.

Use compact output for navigation and request full output only when inspecting
specific evidence. Exercise IDs or NDJSON output in at least one composed step.

The goal is not to reach a broad factual conclusion about Nostr from a tiny
sample. The goal is to evaluate whether this tool supports directed,
explainable exploration.

## Required deliverable

Create `workflow/artifacts/first-library-field-trial.md` containing:

- the research questions and why they were selected;
- exact relays, filters, time bounds, limits, and significant commands;
- acquisition outcomes and database counts;
- a concise narrative of both research paths;
- representative event/account/run/set identifiers so observations are
  traceable in the retained database when available;
- what compact, IDs, NDJSON, and full output each enabled;
- whether provenance and match/membership reasons were understandable;
- whether search, relationship navigation, saved sets, and continuation
  produced useful next choices;
- observed relay or data-quality limitations separated from software defects;
- usability friction, missing capabilities, misleading concepts, and
  unnecessary capabilities;
- any command failure or awkward manual transformation encountered;
- a prioritized list of no more than five candidate next tasks, each tied to
  field-trial evidence;
- explicit recommendations for what not to build yet.

Do not paste large raw event or CLI dumps into the report. Summarize and cite
identifiers.

## Review expectations

The independent reviewer must:

- inspect the report against the retained database and command capabilities
  where available;
- reproduce at least one compact local query and one saved-set inspection;
- distinguish opinions supported by the trial from speculation;
- reject next-task recommendations that are not connected to observed
  friction or research value;
- avoid requesting product changes as optional polish.

Live relay variability is expected. If one relay fails, record it and continue
with successful relays. Use `BLOCKED` only if neither a bounded real acquisition
nor a traceable retained real-evidence database is available.

## Acceptance criteria

- Both research paths use real relay evidence and the complete
  acquisition-to-continuation flow.
- The report is traceable without becoming a raw data dump.
- Product and workflow code remain unchanged.
- The evaluation distinguishes software behavior, protocol/data limitations,
  and research-methodology questions.
- Recommendations follow from observed use rather than the old UI inventory.
- At most five next tasks are proposed and clearly prioritized.
- The report identifies capabilities that should deliberately remain
  unimplemented for now.
