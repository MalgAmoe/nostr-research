PASS

Verified the reference client is moved intact to `apps/reference-client/`; all original product sources and tests are byte-identical. Root workspace commands target the client directly, runtime/generated artifacts are ignored at the new location, and `packages/nostr-research/` contains only a purpose README.

I also re-ran root tests (44 passing) and both syntax checks. Recorded production-build validation passed.