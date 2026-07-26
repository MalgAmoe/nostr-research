CHANGES_REQUIRED

1. `packages/nostr-research/README.md:148-152` still states that a `select` stage using an acquisition input queries the whole corpus and is not scoped to acquired event IDs. This directly contradicts the implemented behavior and the newer documentation at lines 336-340. Update the named-plan documentation to describe acquisition-scoped selection accurately.

2. `packages/nostr-research/src/presentation.js:371-374` still reports raw `additions.added.length` and `additions.refreshed.length` in the default acquisition projection. Duplicate observations can therefore inflate counts or count one subject in both categories. Apply the same distinct, mutually exclusive subject accounting used by the concise command envelope.