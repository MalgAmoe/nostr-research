Deliverables changed:
- Console expansion now invokes shared library validation before accessing the supplied cancellation signal.
- Added public `research.expand` regression coverage asserting invalid signals produce the intended `ResearchMemoryError`.

Validation:
- Task validator passed: 20 tests passed, 6 loopback-dependent tests skipped by sandbox.
- Targeted regression test passed.
- Complete syntax checks passed.
- Protected workflow paths were unchanged.

Unresolved uncertainty:
- Local WebSocket relay tests could not run because the sandbox forbids loopback listeners.