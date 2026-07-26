CHANGES_REQUIRED

1. `packages/nostr-research/test/acquisition.functional.test.js:startRelay` requires `certificateDirectory`, but all callers now omit it after temporary-directory setup was removed. `join(undefined, ...)` causes nine functional tests to fail before networking begins. Restore a valid disposable certificate directory or otherwise provide certificate paths so the complete functional suite passes. This is not a loopback-listener sandbox failure.

2. The required task validation exits with code 1 because only 16 of 25 tests pass. Re-run and provide successful complete functional-suite, syntax, search, dependency, and console field verification after correcting the test failure.