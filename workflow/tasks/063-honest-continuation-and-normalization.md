---
id: 063-honest-continuation-and-normalization
status: done
max_attempts: 4
validation: workflow/tasks/063-honest-continuation-and-normalization.validate.sh
depends_on: 062-browser-worker-adapter
---

# Make continuation and normalized public inputs honest

## Confirmed defects

Three public paths currently disagree with their own advertised or normalized
behavior:

1. `shared-tags` is advertised as supporting relay-backed continuation, but
   the continuation produces no relay filter, performs no acquisition, and
   can still report a bounded relay attempt.
2. Session configuration accepts some relay URLs that acquisition later
   rejects, including URLs containing credentials or fragments.
3. Named notebook membership creation trims its name, while lookup,
   replacement, and deletion use the raw caller value. Replacement can also
   store untrimmed attribution although ordinary membership creation trims it.

## Goal

Reject unsupported work before claiming it occurred, and apply one
normalization rule to values that cross more than one public path.

## Required work

1. Mark `shared-tags` as unavailable for external continuation in the
   authoritative continuation relationship facts.
2. Reject `source: "relays"` for `shared-tags` during normalization, before
   acquisition or mutation. Use the established unsupported-external-
   relationship error style without hard-coding another relationship-specific
   branch.
3. Ensure global and contextual schema no longer advertise relay source for
   `shared-tags`. Local `shared-tags` navigation must remain available.
4. Give relay URL structure one small shared owner used by both session
   configuration and acquisition. Retain the stricter existing acquisition
   policy: relay URLs must use `wss://` and must not contain credentials or a
   fragment.
5. Preserve the distinct contextual error labels needed by configuration and
   acquisition without duplicating the URL acceptance rule or creating a URL
   framework.
6. Normalize membership names through the existing
   `normalizeMembershipName` rule at every public memory boundary: create,
   get, replace, and delete.
7. Replacement must retain the canonical stored membership name and key.
   Attribution must be normalized consistently in remember and replace paths.
8. Update public documentation only if the observable accepted input or
   continuation capability is currently stated incorrectly.

## Acceptance criteria

- Relay-backed `shared-tags` fails honestly before any WebSocket is
  constructed, and schema does not offer that source.
- Local `shared-tags` behavior is unchanged.
- A relay URL accepted as a session default is structurally acceptable to the
  acquisition path; credentials and fragments are rejected consistently.
- Membership names with surrounding whitespace refer to one canonical
  membership through creation, lookup, replacement, and deletion.
- Replacement cannot create a second raw-name key or store avoidable
  attribution whitespace.
- No `#t` relay expansion, authentication, key management, retry policy, or
  generalized validation framework is introduced.

## Verification

- Permanent tests expected: yes, by extending the existing public-boundary
  continuation/configuration/notebook scenarios rather than adding a suite.
- Stable public behavior protected: honest continuation capability,
  configuration/acquisition URL agreement, and canonical membership identity.
- Temporary task validation: syntax checks and the complete functional suite.
- Explicitly excluded: live relay access, TCP/TLS/WebSocket implementation
  tests, private-helper tests, NIP-42 authentication, and exact error prose.
