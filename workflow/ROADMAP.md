# Workflow status

Task definitions under `workflow/tasks/` are the authoritative record of
completed and ready work. Run records are execution history, not current
product policy.

The current foundation is one UI-independent, process-local research memory:

- a renewable, capacity-bounded observation buffer owns recently acquired
  canonical events, observations, and reproducible temporary indexes;
- a bounded evidence archive owns only explicitly preserved references,
  excerpts, and complete canonical events;
- a research notebook owns attributed judgments, notes, bounded derived
  observations, and named stable-subject membership;
- subject collections, research relations, and declarative-session handles are
  replaceable working views which resolve source evidence from the archive,
  then the current buffer, or report it unresolved; and
- normalized operations, named plans, the declarative session, and the JSONL
  executable share one operation and result vocabulary.

Acquisition and local querying remain separate. Relay attempts expose exact
filters, budgets, per-relay outcomes, and bounded coverage directly to the
caller. Acquisition writes only to the observation buffer. It does not infer
trust or quality, preserve evidence, write notebook knowledge, or claim an
exhaustive relay index.

Two sustained executable sessions confirm that the system supports
goal-directed profile research and open-ended sample exploration. They
composed acquisition, bounded inspection, navigation, relations, preservation,
notebook knowledge, turnover, release, and redirection without arbitrary
JavaScript or another session model. The durable evidence and its data-quality
limits are in `workflow/artifacts/simplified-system-field-trial.md`.

There is deliberately no persistence format, database, UI, implicit active
selection, JavaScript research console, legacy retention store, annotation
store, ingest-time preservation mode, or copied-event relation archive.

Future work must continue to come from field evidence. Open areas include relay reliability
and retry contracts, validation and trust boundaries, provenance and notebook
semantics, relay metadata and planning, pagination and portability, and any
future adapter. Removing the remaining Node dependencies is a separate
milestone.
