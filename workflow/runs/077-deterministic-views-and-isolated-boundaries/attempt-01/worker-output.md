Implemented deterministic derived views and isolated external test boundaries.

Deliverables changed:

- Added shared code-point comparison and locale-independent case-fold utilities.
- Applied deterministic ordering across collection, relation, memory, acquisition, interpreter, and presentation outputs.
- Corrected scan offsets/excerpts using folded-to-original UTF-16 offset mapping.
- Replaced continuation and relationship DNS access with a small shared in-process WebSocket fixture.
- Added a browser Worker functional lifecycle scenario using the real session engine.

Validation performed:

- Task validation script passed.
- Full suite: 43/43 tests passed.
- Full suite passed under `LC_ALL=C` and `LC_ALL=tr_TR.UTF-8`.
- Focused boundary tests passed.
- Syntax checks and `git diff --check` passed.

Permanent tests added/expanded:

- Deterministic relation ordering and Unicode case-expansion offsets: protects stable public ordering and original-text evidence positions.
- Browser Worker initialization, command exchange, malformed input, close, and post-close behavior: protects the exported adapter boundary.
- Continuation/relationship fixtures: protect deterministic outcomes without DNS or live network dependence.

Unresolved uncertainties: none.