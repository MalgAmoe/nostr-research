CHANGES_REQUIRED

1. packages/nostr-research/test/acquisition.functional.test.js:307 calls `context.cleanup()`, but `createContext()` only provides `close()`. This causes the required full test suite and task validation to fail. Change the functional scenario to use the actual cleanup method and verify the suite passes.