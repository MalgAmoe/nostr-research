Implemented both review findings.

Deliverables changed:

- Preserved observation mode, mode-specific content, and compact `nextOperations` under the 1,000-byte response bound.
- Relation `details` now resolves bounded canonical evidence for selected subjects.
- Expanded the public session workflow test to cover all five bounded observation modes and relation evidence details.

Validation:

- Full package suite: 16/16 passing.
- Task validation script: passing.
- Syntax checks and `git diff --check`: passing.

Permanent tests expanded:

- Public JSONL/session workflow now protects bounded semantic observation responses, contextual discovery, and canonical evidence resolution. Temporary validation would not adequately protect this stable response contract.

Unresolved uncertainties: none.