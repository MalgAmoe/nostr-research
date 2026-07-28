PASS

The size-limit fallback now verifies serialized byte length, compacts oversized summary fields, preserves the required factual core, and reports explicit presentation omissions. The public regression test confirms the 1,000-byte boundary. The previous substantive finding is resolved, and validation passes all 33 tests.