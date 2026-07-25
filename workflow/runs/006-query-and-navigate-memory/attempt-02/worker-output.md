Implemented all three review findings.

Deliverables changed:

- Merged equivalent tag aliases (`t` and `#t`) using OR semantics.
- Restricted NIP-22 reply interpretation to kind-1111 events.
- Exposed uppercase `E` tags on other kinds as best-effort event references.
- Account relationships now resolve from stored author/reference evidence independently of kind-0 metadata.
- Added functional regression coverage and updated documentation.

Validation:

- Query/navigation tests passed.
- Syntax checks passed.
- `git diff --check` passed.
- Direct CLI help checks passed for `search` and `related`.

Unresolved uncertainties:

- The canonical validator’s `npm exec` CLI probe exhausted Node’s heap under npm 11.11.0. The same CLI succeeds directly through `node` and `node_modules/.bin`.
- Four loopback acquisition tests remain sandbox-skipped; five runnable tests passed.