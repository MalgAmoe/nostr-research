Deliverables changed:
- Corrected per-input continuation counts after the global event limit.
- Added explicit `event-limit` omissions and omitted counts.
- Distinguished empty stored follow lists from missing follow-list evidence.
- Expanded the existing functional continuation scenario for both cases.

Validation:
- Task validation passed: 26 tests passed, 15 network/loopback tests skipped by sandbox.
- Syntax checks passed.

Permanent tests expanded:
- Existing continuation functional scenario now protects bounded multi-input membership and valid empty follow-list semantics. Temporary checks would not adequately protect these stable public completeness rules.

Unresolved uncertainties:
- Live relay path was not exercised because network tests are unavailable in this sandbox.