Implemented the review fix.

- Changed retain handling so parameter/schema validation occurs before the empty-result guard.
- Unsupported fields now consistently return `INVALID_OPERATION`; valid empty retention still returns `EMPTY_RESULT` unless `allowEmpty: true`.
- Expanded the public session-lifecycle functional scenario to protect this error precedence.

Validation:

- Task validation script: passed.
- Full test suite: 27 passed, 15 skipped because loopback listeners are unavailable.
- Syntax checks and `git diff --check`: passed.
- Debug instrumentation: none.

Permanent test expanded: the existing lifecycle scenario now protects stable public retain validation and response-envelope semantics. Temporary validation alone was insufficient because the prior acquisition scenario depended on loopback availability.

Unresolved uncertainties: live relay/loopback scenarios remain unexecuted in this sandbox. No files were staged or committed.