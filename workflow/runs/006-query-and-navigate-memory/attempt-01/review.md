CHANGES_REQUIRED

1. `packages/nostr-research/src/index.js:412-418` overwrites equivalent tag constraints such as `t` and `#t`. Values for one tag are documented to combine with OR, but `{t: ['alpha'], '#t': ['missing']}` incorrectly discards `alpha`. Merge normalized aliases or reject duplicates explicitly.

2. `packages/nostr-research/src/index.js:643-673` labels any event containing uppercase `E` plus unmarked `e` tags as known NIP-22 reply evidence, regardless of event kind. NIP-22 comment interpretation must be limited to applicable kind-1111 events; otherwise expose the relationship as fallback/general tag evidence.

3. `packages/nostr-research/src/index.js:586-601` considers an account resolved only when kind-0 metadata exists. In the fresh black-box scenario, even the canonical author relationship was marked unresolved despite stored events proving that account and `relatedAccount()` successfully navigating it. Account existence/resolution must reflect stored author/reference evidence separately from whether profile metadata is available.