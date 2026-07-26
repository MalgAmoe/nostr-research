Implemented the named research plan field-trial correction.

Deliverables changed:
- Added preflight validation for retain reason objects and unsupported retain options.
- Added functional coverage proving invalid plans fail before external acquisition.
- Updated README documentation.
- Updated the live field-trial report and recommendation.

Validation performed:
- Task validation passed.
- 17 tests passed; 14 loopback tests skipped by sandbox.
- Syntax and whitespace checks passed.

Unresolved uncertainties:
- The documented live trial was not repeated inside this network-restricted sandbox. No implementation issues remain.