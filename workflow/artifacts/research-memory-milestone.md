# Research memory milestone

## Why this milestone exists

Live research now succeeds through the declarative session, but a buffer
turnover trial exposed contradictory ownership:

- the indexed corpus is capacity-bounded and correctly removes canonical
  events and their temporary indexes on eviction;
- retained selections preserve subjects and reasons but not source evidence;
- annotations survive buffer eviction;
- research relations clone note text, tags, links, profile fields, reasons,
  and provenance into rows, so incidental handles can preserve more evidence
  than an explicit retained selection;
- copied relation fields such as `evidence.resident` can become stale;
- acquisition's `preserve` option protects IDs only during one ingest call and
  is not an evidence archive.

The result is neither a pure working buffer nor a deliberate research memory.
This milestone gives each kind of state one explicit owner.

## Required model

### Observation buffer

The buffer owns recently acquired canonical Nostr events, relay observations,
and reproducible indexes by event ID, author, kind, tags, and protocol
relationships. It has an explicit capacity and may evict evidence. Eviction
removes every temporary index entry derived from that event.

Relay acquisition writes only to this buffer unless a later explicit operation
preserves selected evidence.

### Evidence archive

The archive owns deliberately preserved evidence. Preservation level is
explicit:

- `reference`: stable subject or event identity plus preservation reason;
- `excerpt`: a bounded, visibly non-canonical snapshot of selected evidence
  fields and provenance;
- `canonical`: the complete immutable Nostr event plus selected observation
  provenance.

A reference alone does not claim that event evidence remains resolved. An
excerpt must never be presented as a canonical event. Complete canonical
events retain their original identity and signature without rewriting.

The archive has an explicit limit. Reaching it produces an actionable error;
ordinary relay acquisition must not evict archived research evidence.
Releasing archive material is explicit.

### Research notebook

The notebook owns interpretation and navigation knowledge, not Nostr source
evidence. It subsumes the useful meaning of annotations and retained
selections:

- judgments, optional strength, labels, and researcher notes;
- named membership of subjects with reasons;
- selected derived observations or summaries when explicitly recorded;
- stable source subject/event references explaining where an entry came from.

Notebook claims remain attributed to the caller or operation that recorded
them. They are provisional and replaceable. The library must not infer a
universal quality classification or automatically record every derived value.

Notebook limits and deletion are explicit. Buffer eviction does not alter the
notebook.

### Views and handles

Subject collections, research relations, and session handles are working
views. They own ordering, stable references, bounded derived values,
membership reasons, provenance references, and operation context. They do not
silently own complete canonical evidence.

Source-backed fields resolve in this order:

1. complete archived evidence;
2. current buffer evidence;
3. unresolved reference.

Resolution must expose its source and current status. Buffer residency is
computed at observation time, not copied as a permanent relation value.

Derived values may be materialized when their continued use is the declared
result of an operation, but they must be bounded and distinguishable from raw
source evidence. In particular, vocabulary scans should preserve match
location, term, subject reference, and a bounded excerpt rather than silently
copying an unlimited source field.

## Replacement and account semantics

For replaceable events such as profiles, "current" must be selected from the
available complete evidence across archive and buffer using the existing Nostr
ordering rule. Presentation must state the evidence source. An older archived
profile must not silently override a newer resident profile.

The same canonical event may be present in both archive and buffer. It remains
one event identity; observations may be combined without duplicating or
rewriting the event.

## Lifecycle invariants

- Acquisition changes only the observation buffer and session revision.
- Buffer eviction cannot delete archive or notebook state.
- Preserving evidence and recording notebook knowledge are explicit mutations.
- Releasing a result handle does not release archive or notebook state.
- Removing notebook membership does not release archived evidence.
- Releasing archived evidence does not erase notebook history or stable
  references; resolution becomes buffer-backed or unresolved as appropriate.
- Failed mutations leave every store unchanged.
- `reset` and `close` clear buffer, archive, notebook, indexes, and handles.
- No persistence or database format is introduced by this milestone.

## Migration posture

There is no legacy compatibility requirement. Existing `retain`, annotation,
relation, projection, and presentation behavior may be replaced when the new
semantics cover the useful research action more clearly. Delete superseded
code and tests rather than maintaining parallel models.

The implementation should remain simple JavaScript data structures owned by
one deep memory module. Do not introduce database adapters, repository
interfaces, event buses, reactive state, or speculative persistence seams.

## Milestone acceptance scenario

The completed milestone must support this functional path:

1. acquire a bounded buffer from deterministic or live evidence;
2. construct candidates and inspect source-backed fields;
3. record positive, negative, and uncertain notebook knowledge;
4. preserve one profile as a complete event and selected notes as excerpts or
   complete events;
5. retain named candidate membership and its reasons;
6. completely turn over or clear only the observation buffer;
7. continue filtering, inspecting, explaining, and directing a later
   acquisition using notebook knowledge and archived evidence;
8. show which evidence is archive-backed, buffer-backed, or unresolved;
9. explicitly release an archived item and observe resolution change without
   losing notebook history;
10. reset the session and verify that all process-local state is gone.

The field trial must also report approximate counts or serialized sizes for
the buffer, archive, notebook, and named views so accidental evidence
duplication is visible.
