CHANGES_REQUIRED

1. `packages/nostr-research/src/deterministic-text.js:13` builds offset-aware folded text by lowercasing each Unicode code point separately, but terms are folded as whole strings. Context-sensitive casing therefore breaks valid matches: `"ΟΣ"` folds to `"ος"` as a term but `foldCaseWithOffsets("ΟΣ").text` becomes `"οσ"`. Update the mapper so its searchable text exactly matches whole-string folding while retaining correct original UTF-16 boundaries.

2. Extend the focused public scan scenario in `packages/nostr-research/test/reference-resolved-views.functional.test.js:22` with a context-sensitive casing example such as Greek final sigma. The current `İ` case covers length expansion but does not detect the inconsistent folding above.