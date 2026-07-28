CHANGES_REQUIRED

1. `src/reference.js:56-65` leaks `ResearchMemoryError` for decodable but non-canonical `naddr` values (for example kind `1`) instead of the decoder’s bounded `InvalidNostrReferenceError`. Normalize canonical-address failures at this public decoding boundary so malformed/unsupported references fail consistently and predictably.

2. `src/interpreter.js:1097,1107` only says “public reference.” The task requires the existing schema, as well as documentation, to expose accepted forms and hint semantics factually. Enumerate `npub`, `nprofile`, `note`, `nevent`, and `naddr`, and state that encoded author/kind/relay hints are unverified and never followed automatically.