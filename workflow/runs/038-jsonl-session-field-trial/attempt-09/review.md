CHANGES_REQUIRED

1. `packages/nostr-research/src/acquire.js` still leaves the underlying relay socket open after SIGTERM. The functional scenario fails at `jsonl-session.functional.test.js:187`, so the executable does not satisfy required cancellation and cleanup. Fix transport shutdown and make the complete validation pass.

2. `workflow/artifacts/declarative-session-field-trials.md` claims the termination scenario established prompt socket closure, contradicting the current validation. Correct the artifact to reflect verified results after rerunning the scenario successfully.