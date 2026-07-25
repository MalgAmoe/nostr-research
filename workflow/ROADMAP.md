# Provisional roadmap

Only tasks with complete definitions under `workflow/tasks/` are executable.
This roadmap records likely later slices without pretending their boundaries
are settled before the foundation is reviewed.

## 005 — Live acquisition slice

Acquire events from explicitly selected relays, validate and persist them,
retain relay observations, report relay completion and failures, and distinguish
newly acquired results from existing local memory. Expose the slice through the
same public library and CLI used by functional validation.

The executable task should be written after task 004 passes so its API and
acceptance criteria reflect the actual storage foundation.

## 006 — First research navigation slice

Use accumulated memory to search notes and accounts, inspect events and account
context, traverse observable replies, mentions, tags, and authors, save a
research set, expand it, and reopen it with provenance and reasons for
membership.

The executable task should be written after the acquisition slice reveals what
relationship extraction and research-run records are actually needed.
