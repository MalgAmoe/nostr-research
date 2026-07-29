# Neutral navigator controller proposal

Status: implementation proposal based on the first voyage trials and the
current adapter boundaries. No controller has been implemented yet.

## Outcome of the code inspection

The engine already has the boundary the controller needs:

```text
structured command
        ↓
DeclarativeResearchSession.execute()
        ↓
stable structured response
```

There is one session implementation.

- The JSONL adapter owns Node streams, process arguments, signals, memory
  construction, and one `DeclarativeResearchSession`.
- The browser Worker owns Worker messages, memory construction, and one
  `DeclarativeResearchSession`.
- Both pass the same command objects to `session.execute()`.
- Normalization, validation, execution, handle ownership, revisions,
  presentation, and errors all remain inside that session.

The controller therefore requires no new engine API, alternate executor, or
new command language. It should be a caller-side protocol client whose only
hard dependency is:

```js
request(command) -> Promise<response>
```

The request function may send JSONL to a child process, post a message to a
Worker, or call an in-process session. Those are transport choices, not
research semantics.

## Purpose

The neutral controller removes mechanical burdens observed during direct
voyages:

- maintaining one live session;
- creating unique command IDs;
- correlating commands and responses;
- remembering the current revision;
- retaining a bounded verbatim transcript;
- tracking named handles;
- consulting contextual schema;
- seeing a compact receipt after each operation;
- releasing or replacing working views deliberately.

It must not:

- choose a research operation;
- recommend a route;
- rank handles or subjects;
- issue acquisition, movement, observation, judgment, or preservation commands
  on its own;
- reinterpret evidence;
- introduce named hidden procedures;
- know about vessels;
- become a second source of operation contracts.

The engine still owns facts. A later vessel may arrange attention. The
navigator still decides.

## Smallest useful interface

The controller can begin with one small runtime-neutral object:

```js
const controller = createNavigatorController({
  request,
  transcript: {
    maxEntries: 500,
    maxBytes: 2_000_000,
  },
});
```

Its public surface should remain narrow:

```js
await controller.execute(commandDraft)
controller.state()
controller.transcript(options)
await controller.synchronize()
await controller.close()
```

### `execute(commandDraft)`

The caller supplies the ordinary session command without needing to provide a
`commandId`. The controller:

1. allocates a unique caller-owned ID;
2. sends exactly one visible command through `request`;
3. verifies that the response carries the same ID;
4. records the verbatim command and response;
5. updates its observed revision;
6. updates only state directly declared by the response;
7. returns the original response plus a compact mechanical receipt.

The controller should not add `ifRevision` automatically. Commands are already
serialized by the session, and unconditional optimistic concurrency would turn
ordinary sequential use into unnecessary conflicts. A caller may still supply
`ifRevision` explicitly.

The command remains inspectable in the transcript. There is no convenience
method such as `findInterestingAccounts()` and no rewritten operation syntax.

### `state()`

Returns controller-owned operational state, not research evidence:

- lifecycle state: starting, open, closing, or closed;
- latest observed session revision;
- pending command IDs;
- last synchronized handle catalog;
- transcript entry and byte counts;
- transcript omission counts;
- last protocol or transport failure.

It must label the handle catalog with the revision at which it was synchronized
so stale state is never presented as current.

There should initially be no controller-owned “current selection.” Commands
already name inputs explicitly. A visual caller may later hold a selected
handle as presentation state without changing this controller contract.

### `transcript(options)`

Returns bounded verbatim command/response entries. Every entry contains:

- sequence number;
- command ID;
- command object exactly as sent;
- response object exactly as received;
- start and finish timestamps;
- elapsed time;
- transport failure when no valid protocol response exists.

When old entries are removed to respect the configured entry or byte bound,
the transcript reports how many entries and bytes were omitted.

This transcript is controller bookkeeping, not corpus evidence, notebook
knowledge, acquisition coverage, or persistence. Exporting it later can be an
explicit caller action. The initial controller keeps it only in process.

### `synchronize()`

Performs explicit, visible observation commands to refresh controller state:

- `list` for the authoritative handle catalog;
- `status` for session revision, lifecycle-relevant counts, and configuration.

These commands must use normal command IDs and appear in the transcript.
Synchronization is never hidden network activity: both observations are local
and read-only.

The first version should synchronize only when the caller asks. This avoids
adding two observations after every engine command and keeps session traffic
legible. A later presentation may request synchronization after particular
actions, but that is caller policy.

### `close()`

Sends the ordinary visible `close` command once, records its response, closes
the transport, and rejects new commands locally with a controller lifecycle
error. It does not invent alternate session-closing semantics.

## Compact mechanical receipt

The controller should not automatically run `show summary` or `show preview`.
Choosing an observation mode determines attention and therefore belongs to the
navigator or a later vessel.

It may derive a compact receipt from the response already returned by the
engine:

```js
{
  commandId,
  ok,
  revisionBefore,
  revisionAfter,
  mutated,
  handle: { id, kind, count, scope },
  external: {
    status,
    boundsReached,
  },
  warningCount,
  warnings,
  error: { code, message }
}
```

Only fields present in the original response may appear. Missing facts stay
absent. Warning text remains visible because an external warning can determine
whether the next research decision is meaningful. The original response
remains available beside the receipt.

This solves the “three-kilobyte acknowledgement” problem without hiding the
complete bounded response or inventing a second presentation model.

Actual research sensing remains explicit:

```text
execute operation
→ read receipt
→ navigator chooses show summary, preview, coverage, or details
```

## Handle catalog

The session remains the sole owner of handles. The controller should not
reimplement installation, replacement, release, plan-output, or reset rules.

The authoritative catalog is the latest successful `list` response. Between
synchronizations, the controller may expose response-declared handle
acknowledgements as `observedChanges`, but it must not claim that it has a
complete current catalog.

This avoids duplicating command semantics merely to keep a convenient cache
perfect. It also makes lifecycle truth simple:

```text
catalog at revision 12
current observed revision 15
→ catalog is visibly stale
```

A caller can then choose to synchronize before presenting handle-management
controls.

## Schema-derived controls

The controller should expose ordinary `schema` commands through `execute`; it
should not translate schema into a new validation framework.

A future UI or vessel may build controls from:

- the global session schema;
- an input-free focused operation schema;
- one handle's contextual schema;
- populated fields and recognized transitions;
- effective defaults and bounds.

Schema caching is initially unnecessary. If later justified, contextual entries
must be keyed by handle identity and revision.

The focused `extract` contract now explicitly marks `subjectType` as required.
No other engine change was found necessary for the controller.

## Subject pivots

The voyages repeatedly used:

```text
relation
→ extract stable subject
→ hydrate or continue
→ observe
```

They also exposed the less obvious profile transition:

```text
account collection
→ hydrate
→ immutable kind-0 event handle
→ move to authors
→ current account collection
→ relate current account rows
```

The controller must not collapse these into one opaque action. It can make the
types, counts, lineage, and available contextual controls visible so a caller
can present the transition coherently. A later vessel or UI may render the
sequence as a familiar arrangement, but every engine command remains visible
and separately attributable.

## Transport boundary

The runtime-neutral controller core should receive an injected request
function. Transport implementations remain thin.

### Node JSONL transport

Owns:

- spawning `nostr-research-session`;
- writing one JSON object per line;
- parsing one response per line;
- correlating by `commandId`;
- process exit, stderr, and malformed-line failures;
- graceful input and process closure.

It does not store research state or interpret commands.

### Browser Worker transport

Owns:

- creating or receiving a Worker;
- the explicit initialization message;
- posting commands;
- correlating response messages;
- Worker error and termination behavior.

It uses the existing Worker adapter unchanged.

Functional verification may inject `session.execute()` directly as the request
function. This is a test seam, not a named public transport.

## Proposed repository placement

Keep the engine package unchanged. Add one caller-side package only when
implementation begins:

```text
packages/nostrarium-controller/
  src/controller.js
  src/node-jsonl-transport.js
  src/worker-transport.js
  README.md
```

The package should depend on structured protocol behavior, not import engine
normalizers, memory internals, relations, or presentation helpers. The
in-process test harness may inject `session.execute` without making the
controller core depend on the session class.

This separation is small but meaningful: the research engine does not know
about navigation ergonomics, while the controller cannot become a competing
engine.

## First implementation milestone

Do not implement all transports at once.

### Task 1: runtime-neutral controller core

- injected asynchronous `request`;
- sequential command dispatch;
- generated command IDs;
- correlation validation;
- observed revision and lifecycle;
- bounded verbatim transcript with visible omissions;
- mechanical response receipt;
- explicit `synchronize`;
- explicit `close`.

Verification should use the real public `DeclarativeResearchSession` through
an injected request function and exercise one short functional workflow,
including one failed command. A scripted public request should also verify the
receipt for a partial external response without introducing a permanent
WebSocket test. It should not unit-test private transcript helpers.

### Task 2: Node JSONL transport and direct voyage

- persistent child-process transport over the existing executable;
- clear transport errors distinct from protocol errors;
- direct executable invocation without an npm wrapper;
- malformed stdout, process exit, and broken stdin settle pending requests as
  bounded transport failures rather than hanging them;
- bounded stderr and raw-line diagnostics remain separate from protocol
  responses;
- graceful shutdown;
- one public-boundary functional test for correlation and closure;
- repeat one account-oriented voyage through the controller.

The voyage, not extensive adapter tests, determines whether the controller
actually removes friction.

### Later, only after use

- Worker transport;
- a human-facing shell or visual presentation;
- automatic synchronization policy;
- reusable caller-side recipes;
- transcript export;
- vessel conventions.

These should be promoted only if the Node controller trial demonstrates the
need.

## Acceptance criteria

The first controller is successful when:

1. A navigator can conduct a sequential voyage without manually constructing
   command IDs or managing a subprocess.
2. Every engine command and response remains recoverable from a bounded,
   omission-aware transcript.
3. The navigator can distinguish current session revision from a stale handle
   catalog.
4. Schema, sensing, movement, judgment, and collection remain ordinary visible
   session commands.
5. The controller adds no domain classification, next-action recommendation,
   hidden acquisition, or vessel policy.
6. The same controller core can be exercised through an in-process request and
   a Node JSONL request without behavioral branching.

If achieving these criteria requires changes to operation semantics, the
controller design has crossed the boundary and should be reconsidered.
