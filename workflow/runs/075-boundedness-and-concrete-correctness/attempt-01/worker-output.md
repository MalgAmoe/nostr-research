Deliverables changed:
- Bounded observations to 100 per event with exact deduplication and machine-readable omission counts.
- Preserved omission facts through snapshots, archives, resolution, corpus facts, and presentation.
- Unified collection-kind refinement for `equals` and single-value `in`.
- Made chained division null-preserving.
- Converted synchronous WebSocket send failures into attributed `peer-error` outcomes.
- Added incorrect Schnorr-signature coverage.
- Shared runtime paths remain unchanged for Node and browser consumers.

Validation:
- `npm run check` passed.
- `npm test` passed: 39/39 tests.
- `git diff --check` passed.

Permanent tests expanded:
- Memory/session: bounded provenance, deduplication, archive visibility, and schema constraint.
- Collection/relation: typed refinement, compatible movement, and null-preserving division.
- Acquisition: deterministic synchronous send failure.
- Protocol: structurally valid but cryptographically incorrect signature.
- These protect stable public behavior that would otherwise require repeated manual multi-path verification.

Unresolved uncertainties: none. Workflow-owned task/run files were not modified by this worker.