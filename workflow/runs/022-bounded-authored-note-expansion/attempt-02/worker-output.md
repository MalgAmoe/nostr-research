Deliverables changed:

- Fixed authored-note functional assertions to resolve traversal subjects through durable memory.
- Made the local WebSocket relay fixture preserve partial TCP frames.
- Existing bounded authored-note expansion implementation and field-trial artifact remain in place.

Validation:

- `npm test`: 20 passed, 0 failed, 8 network/loopback tests skipped by sandbox.
- Syntax checks and console help check passed.
- `git diff --check` passed.

Unresolved uncertainty:

- The required successful live public-relay trial remains blocked: DNS and outbound connections are unavailable (`ENOTFOUND`; direct-IP connection also rejected). The artifact honestly records the unsuccessful trial, so review finding 2 is not resolved in this environment.