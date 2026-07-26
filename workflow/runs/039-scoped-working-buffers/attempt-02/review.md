BLOCKED

The prior test-coverage finding remains after the second worker attempt. In `declarative-observation.functional.test.js:189`, the replacement scenario fabricates an acquisition report, calls the internal console projection directly, and performs only corpus-scoped session selections. It never acquires into a named session handle, selects using that acquisition handle, or requests coverage through the declarative boundary.

Therefore it does not protect the required stable public workflow—named acquisition → scoped selection → bounded default response/opt-in coverage → non-destructive handle replacement. Per the review policy, this repeated substantive finding requires reassessment rather than a third mechanical change request.