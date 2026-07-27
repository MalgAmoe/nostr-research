CHANGES_REQUIRED

1. `presentation.js:990` size enforcement drops `observation`, mode-specific content, and `nextOperations`. With the valid `sizeLimit: 1000`, all five modes become indistinguishable and contextual discovery disappears. Preserve the requested observation meaning and bounded discovery metadata when compacting responses.

2. `presentation.js:58` relation `details` only returns subject IDs and provenance; it does not return currently known canonical evidence for those subjects. Make relation details resolve bounded canonical evidence, consistent with the defined `details` meaning.