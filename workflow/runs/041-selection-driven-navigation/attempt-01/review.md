CHANGES_REQUIRED

1. `src/continuation.js:167-215, 263-280` does not support `expansion` from account subjects. Account inputs are discarded, relay acquisition returns no filter, and each account is reported as `unsupported-subject-type`. Implement bounded local and relay-backed expansion from selected accounts as explicitly required.

2. `src/continuation.js:274-286` does not expose per-input omissions for valid inputs that produce no result. In a mixed multi-account authored-notes continuation, an account with no matching notes is silently omitted. Report resolution/results per input and distinguish absent evidence, partial external resolution, and valid empty outcomes.

3. `src/continuation.js:46-55` attaches every starting subject to every result’s continuation reason. For multi-subject input this falsely claims that unrelated inputs led to each result. Provenance must identify the specific input relationship responsible for each member.

4. `src/continuation.js:172-180, 65-72` can incorrectly report a local result as complete and exhaustive. Projection is internally capped at 1,000 items; with `eventLimit: 1000`, additional resident matches cannot be detected, so `truncated` remains false. Completeness must reflect the actual bounded query.

5. `test/continuation.functional.test.js` covers only local authored notes and inbound conversation traversal from single-subject handles. Extend the one functional scenario to protect the required multi-subject omission/completeness behavior and account-driven expansion without adding tests per relationship.