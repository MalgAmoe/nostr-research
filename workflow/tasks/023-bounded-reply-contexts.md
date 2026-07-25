---
id: 023-bounded-reply-contexts
status: ready
max_attempts: 5
validation: workflow/tasks/023-bounded-reply-contexts.validate.sh
depends_on: 022-bounded-authored-note-expansion
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add bounded reply-context resolution

## Reason

The subjective account-behavior trial could sample an account's authored
notes, but understanding its replies required comparing each reply with the
note it answered. Recreating that correctly in exploratory JavaScript would
duplicate NIP-10 interpretation, parent acquisition, shared budgets,
deduplication, provenance, partial failures, and unresolved-reference
handling.

Interpretation must remain in JavaScript. The library should resolve evidence,
not decide whether a reply is relevant, annoying, automated, or valuable.

## Objective

Add one exported, composable library operation and a thin persistent-console
wrapper that resolve a bounded set of authored replies together with their
direct parent notes.

An intended usage is:

```js
const contexts = await research.replyContexts(accounts, {
  relays,
  authoredLimit: 20,
  parentLimit: 20,
  timeoutMs: 12_000,
  eventLimit: 60,
  concurrency: 3
})
```

The exact result representation may follow the project's established
collection conventions, but JavaScript callers must be able to associate each
reply with its resolved parent or an explicit unresolved-parent result, and
inspect reasons and relay provenance for both.

## Semantics

- Inputs are explicit account subjects or an existing collection containing
  explicit account subjects.
- Acquire at most `authoredLimit` recent kind-1 notes per starting account.
- Only notes interpreted as replies under the library's existing NIP-10 rules
  become contexts.
- Resolve the direct reply parent, not an arbitrary mentioned event or merely
  the thread root.
- Acquire no more than `parentLimit` distinct missing parents.
- Authored-note and parent acquisition share the operation-wide timeout and
  event/observation budget.
- Deduplicate accounts, replies, and parent requests.
- A missing or unavailable parent remains explicit and does not discard the
  reply.
- Returned evidence retains ordinary event records, relationship
  interpretation, observations, and relay provenance.
- Report all bounds, request outcomes, counts, partial failures, and unresolved
  parents.
- Do not mutate the temporary research session selection.

Reject invalid bounds, unsupported inputs, and unusable relay options before
networking.

## Boundaries

- No relevance, tone, annoyance, automation, or semantic-similarity scoring.
- No generic conversation crawler or exhaustive thread reconstruction.
- No automatic recursion from parent notes.
- No pagination framework, UI, query DSL, or assessment model.
- Do not add general grouping/projection helpers solely for this operation.
- Keep the console surface a thin wrapper over the exported library operation.

## Verification

Use one public functional scenario with real SQLite and local NIP-01 WebSocket
relays proving:

- explicit accounts yield only their bounded authored replies;
- marked NIP-10 parents are preferred correctly over roots and mentions;
- legacy positional NIP-10 fallback follows the library's existing semantics;
- already-stored and newly acquired parents both resolve;
- unavailable parents are explicit;
- duplicate parent references generate one bounded request;
- per-account, parent, timeout, and global event budgets are enforced;
- reasons, provenance, partial relay failures, and session independence
  survive; and
- results remain usable as ordinary JavaScript data for caller-defined
  comparisons.

Do not create unit tests for presentation details or trivial helpers. Run the
complete suite and syntax checks.

## Acceptance criteria

- A caller can obtain a bounded reply-plus-parent corpus from explicit account
  selections without manually implementing protocol acquisition.
- Every returned reply has either its direct parent evidence or an explicit
  unresolved-parent state.
- Operation reports are bounded and explainable.
- No interpretation policy is encoded.
- Existing acquisition, expansion, session, and console behavior remain
  usable.
