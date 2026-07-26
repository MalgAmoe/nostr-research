CHANGES_REQUIRED

1. `packages/nostr-research/src/presentation.js` does not recognize `typed-collection` values. Group and summary operations produce this type, so `show` fails with “research.show does not recognize this value.” Add bounded shared projections for groups and summaries, including omitted counts.

2. `packages/nostr-research/src/interpreter.js:56-59` aborts active operations immediately for any apparent `close` command, before envelope and `ifRevision` validation. A malformed or revision-conflicting close can therefore mutate running work despite failing. Cancellation must occur only after the close command is validated consistently.

3. `packages/nostr-research/src/interpreter.js:444-466` incorrectly treats `distinctEventLimit` as the number of results requested. This can report `status: "complete"` alongside nonzero `missing`, and implies expected/exhaustive result counts that acquisition budgets do not establish. Derive requested/resolved/missing from genuinely countable requests, such as hydration subjects, or represent unquantifiable acquisition completeness without inventing missing results.