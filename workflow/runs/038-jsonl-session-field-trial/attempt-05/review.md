CHANGES_REQUIRED

1. `packages/nostr-research/src/acquire.js` does not reliably close the owned relay socket during signal termination. The process test `JSONL executable cancels active external work on a termination signal` fails with `session closure left the relay socket open`. Fix cancellation so the peer observes closure, then rerun the full validation with all functional tests passing.