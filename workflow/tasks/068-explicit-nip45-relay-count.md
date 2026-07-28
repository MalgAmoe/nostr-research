---
id: 068-explicit-nip45-relay-count
status: ready
max_attempts: 4
validation: workflow/tasks/068-explicit-nip45-relay-count.validate.sh
depends_on: 067-explicit-nip11-relay-inspection
---

# Add explicit attributed NIP-45 relay count

## Confirmed code seam

The authoritative operation registry, normalizer/executor, plans, declarative
session, JSONL adapter, browser Worker, handles, presentation, and contextual
schema already provide one path for input-free external reports. NIP-45 count
must enter through that path as an explicit operation, not as hidden work
inside acquisition.

The existing acquisition transport now preserves bounded `NOTICE`, `AUTH`,
`CLOSED`, peer-close, timeout, and cancellation facts. Count is a separate
one-shot WebSocket exchange, but equivalent relay messages must retain the
same meaning and bounded representation. Share only stable protocol facts or
small helpers where that prevents drift; do not introduce a generic transport
framework.

A live task-level probe established current interoperability:

- `wss://nos.lol` returned a valid exact `COUNT` response;
- `wss://relay.primal.net` returned a `NOTICE` saying the command was unknown;
- `wss://relay.snort.social` returned a `NOTICE` saying the message type was
  unknown.

Therefore an attributed `NOTICE` received before a count response must become
a visible terminal outcome for this one-shot operation rather than being
discarded or left to masquerade as a timeout. Its human text remains evidence;
do not infer a standardized refusal category from arbitrary prose.

## Goal

Allow a researcher to request the estimated size of one exact NIP-01 filter
from selected relays before acquisition, while preserving per-relay
attribution, approximation metadata, and honest failure outcomes.

## Required work

1. Add one input-free external research operation named `relay-count`.
2. Accept:
   - one normalized NIP-01 `filter`;
   - explicit relay URLs or configured session relay defaults;
   - bounded timeout and concurrency parameters; and
   - the ordinary runtime cancellation signal at the internal execution seam.
   Reuse shared relay URL normalization and existing configuration precedence.
3. Keep the public request singular. NIP-45 permits multiple OR-ed filters,
   but this milestone counts the same one-filter request that a caller can
   subsequently pass to acquisition. Do not add multi-filter `REQ`, hidden
   partitioning, or aliases with competing parameter shapes.
4. For each relay, send `["COUNT", requestId, filter]` and accept only the
   matching `["COUNT", requestId, payload]` response.
5. Validate the response conservatively:
   - `count` is a required non-negative safe integer;
   - `approximate`, when present, is boolean;
   - `hll`, when present, is a bounded valid 512-character hexadecimal value.
   Retain the HLL payload as attributed protocol evidence, but do not decode,
   merge, estimate from, or compare sketches in this milestone.
6. Return one `relay-count-report` with the exact requested filter, relays,
   operation bounds, timestamps, and one outcome per requested relay.
7. Distinguish at least:
   - valid exact and approximate count responses;
   - explicit `CLOSED` refusal, retaining standardized prefix and raw reason;
   - bounded `NOTICE`;
   - malformed matching response;
   - failure before WebSocket open;
   - peer close after open;
   - timeout and cancellation.
8. Preserve a neutral bounded `AUTH` challenge fact if observed. It does not
   mean the count was refused; only an actual `auth-required:` `CLOSED` outcome
   establishes that fact.
9. Treat `NOTICE` as an attributed terminal count outcome because this is a
   one-response request and deployed relays use it to reject unknown commands.
   Name the outcome factually (for example `notice`); never parse arbitrary
   notice prose into a claim that NIP-45 is unsupported.
10. Keep every count relay-local. Presentation, completeness, warnings, and
    machine-readable output must never sum counts or expose an unexplained
    global total because relay corpora overlap.
11. Record whether each successful response is exact or approximate according
    to the protocol response. Absence of `approximate: true` means the returned
    count is exact for that relay's response, not globally complete Nostr
    truth.
12. Register the operation once through authoritative semantics, preflight,
    execution, plans, session defaults, schema, and both adapters. It mutates
    no observation buffer, archive, or notebook.
13. Make the ephemeral report nameable as a session handle with a factual
    `relay-count` descriptor and count equal to the number of requested relay
    outcomes. Release behaves like other working handles.
14. Add bounded presentation specific to this report:
    - `show summary` reports outcome and exact/approximate category counts,
      never summed event counts;
    - `show preview` reports bounded per-relay counts/outcomes;
    - `show coverage` reports attempts, bounds, failures, diagnostics, and
      omissions; and
    - `show details` exposes bounded per-relay response evidence.
    `show explain` and subject `inspect` remain incompatible.
15. Extend global and contextual factual schema so an agent can construct the
    operation and understand the report shape and supported show modes without
    being offered collection, relation, notebook, archive, or subject
    operations.
16. Do not consult NIP-11 automatically before counting. Advertised NIP
    support and observed count behavior remain separate attributed facts.
17. Update package documentation, `NEXT-STEPS.md`, the capability map, and
    `CONTEXT.md` only where implementation establishes durable behavior.

## Acceptance criteria

- Direct execution, plans, declarative sessions, JSONL, and the browser Worker
  reach one `relay-count` implementation.
- Configured relays and bounds apply when command parameters omit them;
  explicit command values override session defaults.
- A valid exact or approximate response is attributed to exactly one relay,
  includes its protocol metadata, and is never merged with another relay.
- `NOTICE`, `CLOSED`, malformed response, connection failure, peer close,
  timeout, and cancellation remain distinguishable bounded outcomes.
- A named relay-count handle can be listed, shown in four supported modes,
  queried through contextual schema, and released.
- Contextual schema does not coerce the report into a Nostr subject collection
  or invent next actions.
- Count does not mutate any research-memory store and ordinary acquisition
  does not issue a hidden count request.
- No retry policy, relay ranking, signer, NIP-42 response, NIP-11 fetch,
  multi-filter acquisition, HLL aggregation, global count, persistence,
  alternate executor, or generalized transport subsystem is introduced.

## Verification

- Permanent tests expected: yes, by extending the existing public-boundary
  external-operation/session coverage with a deterministic standard global
  WebSocket fixture. Do not add TCP, TLS, a real server, or a production
  dependency-injection seam solely for tests.
- Stable public behavior protected: normalization, session defaults, plans and
  sessions sharing one executor, per-relay attribution, report immutability,
  bounded diagnostics, handle lifecycle, presentation, and schema.
- Exercise representative exact, approximate plus HLL, `NOTICE`, standardized
  `CLOSED`, malformed matching response, and cancellation/bound behavior.
  Assertions must use the public package/session surface, not private parser or
  socket helpers.
- Verify explicitly that no presented or structured summary sums successful
  per-relay counts.
- Temporary task validation: syntax checks, the complete functional suite,
  and the runtime-neutral browser smoke validation.
- Live public-relay validation is a task-level trial after implementation, not
  a permanent test or a requirement for deterministic review.
