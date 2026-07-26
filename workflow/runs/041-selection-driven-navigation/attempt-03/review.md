CHANGES_REQUIRED

1. `packages/nostr-research/src/continuation.js:44-54, 300-335` computes per-input `resultCount` before applying the global `eventLimit`. With multiple inputs, later inputs can have every result removed by the final slice while still being reported as `resolved`, with no omission. Per-input outcomes must describe membership in the returned bounded collection and expose limit-caused omissions.

2. `packages/nostr-research/src/continuation.js:284-286` treats every empty `followed-accounts` result as `absent-local-evidence`. An existing empty kind-3 follow list is valid evidence of an empty result, distinct from having no follow-list evidence. Preserve this required distinction and protect it within the existing functional continuation scenario.