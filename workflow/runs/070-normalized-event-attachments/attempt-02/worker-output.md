Deliverables changed:
- Fixed dedicated picture/video kind provenance for supported content URLs.
- Expanded the public attachment relation scenario to verify `picture-kind` plus `url-extension`, with declared classification.

Validation:
- Targeted functional test: passed.
- Syntax checks: passed.
- Full functional suite: 29/29 passed.
- `git diff --check`: passed.
- Browser smoke: blocked before execution by sandboxed Chromium (`bootstrap_check_in … Permission denied`).

Permanent tests expanded:
- Public relation scenario now protects dedicated-kind intent and separate inference provenance. Permanent coverage is justified because this stable construction-order behavior is otherwise easy to regress.

Unresolved uncertainties:
- Browser smoke requires validation outside this managed macOS sandbox.