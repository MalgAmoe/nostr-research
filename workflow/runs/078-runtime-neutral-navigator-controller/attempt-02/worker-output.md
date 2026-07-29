Implemented the review fix.

Deliverables changed:
- Synchronized catalog now preserves the complete bounded `list.result`, including `preview`, `count`, and `omitted`.
- Updated controller documentation.
- Added a functional scenario with six handles and a five-entry preview.

Validation:
- Package tests: 4/4 passed.
- Full repository suite: 47/47 passed.
- All workspace syntax checks passed.
- Protected research-engine source and tests unchanged.

Permanent test added:
- Protects visible catalog incompleteness at the public controller boundary. Temporary validation would not prevent future loss of `count` or `omitted`.

Unresolved uncertainties: none.