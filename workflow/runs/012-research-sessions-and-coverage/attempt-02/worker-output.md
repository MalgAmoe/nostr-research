Implemented both review fixes:

- Excluding a focused subject no longer clears session focus.
- relayQueryLimit() now accepts fetchRelayInformation() results directly, while retaining raw NIP-11 document support.
- Added public functional regressions covering both behaviors.

Validation performed:

- Targeted functional tests: 3 passed.
- Full package suite: 14 passed, 4 network tests skipped because loopback listeners are sandbox-blocked.
- Syntax checks passed.
- Task validation script passed.
- git diff --check passed; no debug instrumentation remains.

Unresolved uncertainties: none.