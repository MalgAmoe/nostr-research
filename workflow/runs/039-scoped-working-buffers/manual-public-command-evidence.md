# Task 039 outer-sandbox public-command evidence

The worker sandbox could not bind a loopback listener, so the primary agent
ran the temporary verification from the repository's outer execution
environment on 2026-07-26. The temporary assertions were removed immediately
afterward and are not part of the permanent suite.

Command:

```text
node --test --test-name-pattern="declarative session preserves handles" packages/nostr-research/test/acquisition.functional.test.js
```

The temporary extension used only `createDeclarativeResearchSession.execute`
and the test's real loopback relay. It performed:

```text
acquire(resultId="acquired")
show(input="acquired", mode="summary")
select(input="acquired", resultId="scoped")
show(input="acquired", mode="coverage")
select(input="acquired", resultId="acquired", replace=true)
```

Observed bounded results:

- acquisition handle: `events`, count `1`, scope `acquisition`;
- default acquisition response: one-item bounded preview and facets, no full
  coverage enumeration;
- scoped selection: count `1`, scope `acquisition`;
- opt-in coverage: type `acquisition-coverage`, one relay and one observed
  event, with zero omissions;
- replacement: handle `acquired` advanced to revision `6`;
- canonical corpus after replacement: still one resident event;
- external status: `partial`, with `observation-budget` explicitly reported;
- process result: one test passed, zero failed, zero skipped.

This demonstrates the complete public named-acquisition -> scoped-selection ->
concise-default -> opt-in-coverage -> non-destructive-replacement chain without
adding a production injection seam or retaining a relay-network regression
test.
