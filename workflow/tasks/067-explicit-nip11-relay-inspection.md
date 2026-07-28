---
id: 067-explicit-nip11-relay-inspection
status: done
max_attempts: 4
validation: workflow/tasks/067-explicit-nip11-relay-inspection.validate.sh
depends_on: 066-relay-message-and-outcome-visibility
---

# Add explicit attributed NIP-11 relay inspection

## Confirmed code seam

The operation registry, normalizer/executor, plans, declarative session,
handles, presentation, schema, JSONL adapter, and browser Worker already form
one public execution path. NIP-11 must enter through that path as an explicit
external operation.

Existing non-relation handles are assumed to contain subject collections in
parts of contextual schema and presentation. A relay-information report is not
a Nostr subject collection, acquisition report, notebook entry, or archive
record. Supporting it therefore requires one factual result kind and explicit
presentation/schema handling; it must not be coerced through
`memory.asCollection`.

The runtime-neutral core has standard `fetch` available in Node and browser
environments. Node streams, filesystem access, and process configuration
remain adapter concerns.

## Goal

Allow a caller to explicitly inspect what selected relays advertise through
NIP-11 and how each retrieval actually behaved, without mutating research
memory or turning advertisements into observed capability or trust.

## Required work

1. Add one input-free external research operation named `relay-info`.
2. Accept explicit relay URLs, or configured session relay defaults, plus
   bounded timeout and concurrency parameters. Reuse the shared relay URL
   normalization rule and the established configuration precedence.
3. Convert each normalized `wss://` relay URL to the corresponding HTTPS
   NIP-11 endpoint without changing its host or path.
4. Request the document with `Accept: application/nostr+json` through the
   runtime's standard fetch interface. Do not create a Node-only HTTP path or
   serialize runtime capabilities into command parameters.
5. Bound:
   - number of concurrent requests;
   - operation duration;
   - retained response bytes;
   - retained strings, arrays, unknown fields, and presentation output.
   A hostile or malformed relay response must not consume unbounded memory.
6. Return one attributed `relay-information-report` containing the exact
   requested relays, retrieval time/bounds, and one outcome per relay.
7. Distinguish successful document retrieval from connection failure, timeout,
   non-success HTTP status, incompatible content, invalid JSON, oversized
   response, and malformed known fields. Preserve useful bounded HTTP status,
   content type, diagnostic, and omission information.
8. Retain the bounded advertised document as attributed relay evidence and
   expose normalized convenience fields only where they are unambiguous,
   including supported NIPs and advertised limitations. Missing optional
   fields mean absent claims, not retrieval failure.
9. Keep `advertisedAuthRequired` as a NIP-11 claim. It must not become an
   acquisition outcome or evidence that another request was refused.
10. Register the operation once in the authoritative operation semantics,
    normalization, preflight, execution, schema, plans, and session path. The
    operation mutates no observation-buffer, archive, or notebook state.
11. Make the ephemeral report nameable as a session handle with a factual
    `relay-information` descriptor and count equal to requested relay outcomes.
    Handle release must behave like other working views.
12. Extend bounded presentation for this result only:
    - `show summary` gives compact outcome/capability counts;
    - `show preview` gives bounded per-relay advertised highlights;
    - `show coverage` gives retrieval outcomes, bounds, and omissions; and
    - `show details` gives bounded retained documents and diagnostics.
    `show explain` and direct `inspect` must not be repurposed for relay
    information.
13. Extend contextual schema to describe relay-information structure and its
    observation modes without pretending it supports subject-collection or
    relation operations. Do not advertise invented next actions.
14. Keep the report separate from acquisition coverage. Ordinary acquisition
    must not issue a hidden NIP-11 request.
15. Keep the report out of the research notebook and evidence archive. A later
    caller may interpret or compare it explicitly, but M5 adds no relay
    subject, trust score, quality ranking, or persistence.
16. Update package documentation, `NEXT-STEPS.md`, the capability map, and
    `CONTEXT.md` only to record the implemented explicit operation and durable
    distinctions.

## Acceptance criteria

- Direct execution, plans, declarative sessions, JSONL, and the browser Worker
  reach one `relay-info` implementation.
- The operation uses session relay defaults when explicit relays are absent
  and per-command values override those defaults.
- A named relay-information handle can be listed, shown in its four supported
  bounded modes, queried through contextual schema, and released.
- Contextual schema never attempts to coerce the report into a subject
  collection and advertises no collection, relation, notebook, archive, or
  subject-inspection operation.
- HTTP and document failures remain attributed per-relay outcomes and cannot
  masquerade as an empty advertisement.
- Advertised capability remains distinct from observed acquisition behavior.
- No hidden NIP-11 request occurs during acquisition.
- No Node-only dependency, alternate executor, relay identity subject,
  persistence, scoring, retry policy, NIP-42 response, or NIP-45 count is
  introduced.

## Verification

- Permanent tests expected: yes, through one existing public-boundary
  operation/session scenario using a temporarily installed deterministic
  standard global `fetch` fixture. Do not add a production injection seam
  solely to satisfy the test.
- Stable public behavior protected: operation normalization, plans and
  sessions sharing one executor, configured defaults, per-relay outcome
  attribution, bounded response handling, handle lifecycle, presentation, and
  schema.
- Include representative success, HTTP failure, malformed JSON, oversized
  response, missing optional fields, and `advertisedAuthRequired` behavior
  without importing private parsing helpers.
- Temporary task validation: syntax checks, the complete functional suite,
  and the existing runtime-neutral/browser smoke validation.
- Explicitly excluded: live public-relay checks, HTTP server tests, TCP/TLS,
  browser UI, exact fetch scheduling, snapshotting entire NIP-11 documents,
  and tests that freeze private parser structure.
