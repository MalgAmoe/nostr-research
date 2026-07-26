Implemented the requested review corrections.

- Deliverables changed: public pipeline schema now exposes operation-specific fields, input kinds, operand/value types, `event.tag`’s special predicate form, aggregation vocabularies, and compatible set requirements. Aggregation preflight now rejects invalid `count` fields and unsupported limits.
- Validation: task validation passed; 25 tests passed, 15 network tests skipped because loopback listeners are sandbox-restricted. `git diff --check` passed.
- Permanent tests expanded: public algebra-boundary coverage now protects schema accuracy and aggregation preflight rejection. Temporary validation alone was insufficient because this is stable public discoverability behavior.
- Unresolved uncertainties: none.