CHANGES_REQUIRED

1. The functional validation fails in `acquisition.functional.test.js:226-229`. Its relay helper only encodes WebSocket payloads shorter than 126 bytes, but real Nostr `EVENT` frames exceed that size. Implement proper extended-length server frames so the deterministic scenarios execute and pass.

2. `src/acquire.js:61-68` and `159-179` can report completion while a socket is still connecting. `WebSocket.close()` may throw in `CONNECTING`; the error is swallowed, the socket is removed from tracking, and the acquisition resolves without confirming closure. Cancellation, timeout, and limit handling must actually terminate or continue tracking connecting sockets until closed, satisfying the owned-resource closure criterion.