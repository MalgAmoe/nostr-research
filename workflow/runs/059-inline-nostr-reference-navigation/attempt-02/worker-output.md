Deliverables changed:
- Added a trailing alphanumeric token boundary to NIP-27 inline-reference recognition.
- Extended the public navigation scenario with malformed references ending in lowercase `b` and uppercase `X`.

Validation:
- Focused protocol/navigation test: 3/3 passed.
- Full task validation: syntax checks passed; 23/23 functional tests passed.
- `git diff --check` passed.

Permanent tests:
- Expanded the existing public-boundary NIP-27 scenario to protect rejection of valid Bech32 prefixes embedded in longer malformed tokens. Temporary validation would not reliably prevent this parsing regression.

Unresolved uncertainties: none.