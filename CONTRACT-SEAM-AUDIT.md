# Public contract seam audit

Status: implementation baseline recorded on 2026-07-27. The milestone described
below has since been implemented; the findings remain as the rationale and
before-state inventory.

## Implementation outcome

The contract-seam milestone was completed in one pass:

- false parameter claims were corrected;
- the ineffective `compare.limit` input was removed;
- complex relation shapes and effective defaults became factual structured
  contracts;
- execution-independent contract facts now supply normalizers and schema
  projections from one foundational module;
- focused schema includes non-parameter operation facts such as scan result
  shape;
- plan and tag-subject session contracts were corrected;
- the duplicate complete research contract was removed from the nested session
  schema after a live JSONL trial exposed it;
- one public-session functional test constructs representative commands from
  the published contracts.

## Purpose

The research engine has one real usability defect at its public seam: runtime
normalizers know more than the schemas that are meant to describe them. The
engine itself is not broadly incoherent, and the problem does not justify a new
validation framework. It is a concentrated mismatch between:

1. the operation representation accepted by runtime preflight;
2. `operationSchema()`, which describes all research operations;
3. contextual `schema`, which describes operations applicable to one handle;
4. `sessionSchema()`, which describes the JSONL protocol;
5. the effective defaults supplied by session configuration.

This audit treats runtime preflight as the authority. It distinguishes:

- **contradiction**: the schema can cause a caller to construct an invalid
  command, or claims a parameter that runtime rejects;
- **missing fact**: runtime accepts something materially useful that schema
  does not disclose;
- **intentional separation**: different surfaces describe different contexts
  without disagreeing.

## Method

Every public research operation was traced through:

- `normalizeResearchOperation()` and `preflightResearchOperation()`;
- its owning normalizer in `acquire.js`, `memory.js`, `collection.js`,
  `relation.js`, `continuation.js`, or `pipeline-source.js`;
- `operationSchema().parameterContracts`;
- contextual operation schema construction;
- `sessionSchema()` where a session-level command has extra semantics.

The highest-risk discrepancies were also exercised through the public
declarative-session boundary. This is deliberately not a proposal for a schema
language: it is an inventory of facts the existing interface needs to expose
reliably.

## Findings

### Confirmed contradictions

| Operation or command | Runtime truth | Published claim | Consequence |
| --- | --- | --- | --- |
| `filter` | `limit` defaults to 100 and must be 1–1000 for both collection and relation inputs | “non-negative output bound” | The schema permits `0`, which runtime rejects. |
| `move` | `limit` defaults to 100 and must be 1–1000 | “non-negative output bound” | The schema permits `0`, which runtime rejects. |
| `scan` | Accepted keys are `fields`, `terms`, `match`, `matchMode`, `caseSensitive`, and `limit` | `resultShape` is placed inside `parameterContracts.scan` | A caller can reasonably send the advertised explanatory field and receive an unknown-parameter error. |
| `remember` | `reason` and `attribution` are required non-empty strings; at least one of label, note, judgment, or summary is also required | Global contract does not mark the first two required and does not disclose the content requirement | A schema-valid-looking command can fail runtime normalization. |
| `inspect` | Accepts event, account, and tag subjects | Session schema says event or account | Valid tag inspection is hidden. |
| `notebook` | `limit` defaults to 50 and must be 1–1000 | Session schema says “optional non-negative integer” | The schema permits `0` and omits the upper bound. |

These are the only verified cases where the current public description directly
misleads a caller about accepted input.

### Material missing facts

| Operation or command | Missing from the public contract |
| --- | --- |
| `project` | Optional outer `limit` (1–1000, default 100); `fields` accepts a string name or `{field, name}` mapping entries. |
| `aggregate` | Optional outer `limit`; exact aggregation names (`count`, `countDistinct`, `collect`, `sample`, `min`, `max`, `sum`); when `field` is required; nested `limit` for `collect` and `sample`; exact grouping-field mappings. |
| `derive` | Recursive expression forms: `{constant}`, `{field}`, or `{operation, args}` with `add`, `subtract`, `multiply`, `divide`, and `coalesce`. |
| `filter` | The global contract does not state the relation predicate grammar: recursive `all`, `any`, and `not`, or one of `equals`, `in`, `contains`, `gte`, and `lte`. The focused schema correctly distinguishes collection and relation fields, but does not supply this complete shape. |
| `continue` | Optional `depth`, default 3, bounded 1–100. Defaults for `source`, `offset`, and `eventLimit` are not stated in the global contract. |
| `fetch` | Bindable filter keys are exactly `ids`, `authors`, `#e`, `#p`, and `#t`. The static `filter` and dynamic `bindings` objects are separate; current wording blurs that boundary. |
| `scan` | Terms are 1–50 non-empty strings, each at most 200 characters. `match`, `matchMode`, `caseSensitive`, and `limit` defaults are not stated. The result-shape fact belongs in operation metadata, not parameters. |
| `balance` | `limitPer` is required. Both limits are 1–1000 and the outer `limit` defaults to 100. |
| `select` | Query `limit` defaults to 50 rather than the common result default of 100. ID and author prefixes must be 4–64 lowercase hexadecimal characters. |
| `acquire` and `hydrate` | Runtime defaults exist even without session configuration; contextual schema shows effective session defaults only when configured relays are present. |
| `plan` | The session advertises `plan` as a research command but does not publish its envelope: a non-empty stage array plus optional outputs/replacement behavior at the session adapter. |
| Set operations | `union`, `intersection`, and `difference` return bounded collections. `compare` accepts a normalized `limit` but produces one summary row and does not use the value. |

The `compare.limit` case is different from ordinary missing documentation. It
is accepted input without an observable effect. The clean resolution is to
remove the parameter from `compare`, not to document it more prominently,
unless a bounded multi-row comparison is intentionally introduced later.

### Intentional and coherent separation

The following differences are not defects:

- Global `filter` and `move` contracts are input-agnostic; contextual schema
  supplies collection/relation variants and currently valid move routes.
- Contextual `continue` enumerates relationships and their available sources
  for the current collection kind.
- Contextual external operations can expose effective relay and acquisition
  defaults without repeating those defaults in every global contract.
- Observation and lifecycle commands belong to `sessionSchema()`, not
  `operationSchema()`.
- Plans and interactive research commands already share
  `normalizeResearchOperation()`, preflight, and execution.
- Presentation defaults belong to session configuration and are applied at the
  adapter boundary.
- Runtime normalizers remain authoritative for semantic checks that depend on
  the current input kind, relation fields, named handles, or memory state.

## Operation-family assessment

### Acquisition and corpus selection

`acquire`, `hydrate`, `select`, `continue`, and `fetch` have coherent runtime
ownership. Session defaults are applied before the shared executor, so the
engine does not have two execution paths. The schema seam needs exact bounds,
defaults, and binding facts; it does not need an acquisition abstraction.

### Stable subject collections

Collection operations are deliberately small and predictable. Their shared
limit behavior is already centralized in `collection.js`; the two incorrect
schema descriptions are simple factual drift. Contextual identity fields and
move routes are valuable because they depend on the input kind.

### Relations

The relation normalizer is the richest command grammar in the project, while
the global schema compresses it into prose. This is where generic discovery
currently loses the most power. The missing information is structural—nested
field mappings, predicates, aggregations, and expressions—not a need for
workflow advice or suggested next actions.

### Notebook and archive

Notebook mutation correctly requires attributed human or agent judgment.
Global and session schemas describe the same operation at different precision,
but the global description currently understates runtime requirements. Archive
operations are substantially aligned.

### Session adapter

The JSONL session correctly owns handles, revision checks, projection, and
lifecycle. Research operations still pass through the same executor used by
plans. The missing `plan` envelope and a few incorrect observation bounds are
local documentation defects, not competing semantics.

## Dependency and locality analysis

A literal implementation of “each runtime module exports a contract object and
`operations.js` imports all of them” would worsen the module graph:

- `collection.js` already imports operation facts from `operations.js`;
- `memory.js` already imports operation facts from `operations.js`;
- `continuation.js` already imports continuation facts from `operations.js`;
- `plan.js` coordinates all runtime owners and imports operation semantics.

Reversing those imports would create cycles or force an unnecessary
reorganization. The present seam has good execution locality—normalization
stays beside implementation—but incomplete contract locality.

The smallest coherent deepening is:

1. Keep semantic normalizers in their current owning modules.
2. Put only stable, dependency-free public facts in a small foundation module:
   result bounds, operation parameter keys, enums, defaults, and nested shape
   descriptors where they materially help construction.
3. Let both schema composition and normalizers consume those facts when doing
   so removes real duplication.
4. Keep state-dependent validation as ordinary code.
5. Keep contextual schema as a projection of global facts plus facts derived
   from the current handle.

This is not a universal validator, JSON Schema replacement, or second operation
language. It is a narrow shared vocabulary at the existing seam.

## Recommended implementation

One focused milestone is sufficient.

### 1. Correct false claims first

- Correct `filter.limit`, `move.limit`, notebook limit, and membership limit.
- Move `scan.resultShape` outside the parameter object.
- State `remember` requirements consistently.
- Include tag subjects in `inspect`.
- Remove the ignored `compare.limit` parameter from runtime and schema.

### 2. Make complex shapes constructible

Add factual nested shapes for:

- relation predicates;
- field mappings;
- aggregations;
- derive expressions;
- fetch bindings;
- the plan envelope.

These should describe accepted data, not recommend an operation or generate an
example based on guessed intent.

### 3. Share only facts that can drift

Extract a dependency-free contract-facts module only after the correction pass
shows which values are duplicated. Likely shared facts are:

- the 1–1000 result bound and defaults;
- scan term bounds and modes;
- continuation bounds and sources;
- aggregation and expression enums;
- fetch binding keys;
- notebook judgment values.

Do not move whole normalizers, dispatch, input-kind checks, or memory-dependent
validation into this module.

### 4. Preserve focused schema as a view

Focused `schema` should continue to return:

- the selected operation only;
- the current handle kind and count;
- populated/available fields where relevant;
- compatible routes or relationships;
- effective session defaults for external operations;
- the complete factual parameter shape for that operation.

It should not return suggested next operations, rankings, inferred intent, or
large examples.

## Verification policy

The implementation should add one public-boundary functional contract test, not
a unit test for every normalizer:

1. obtain global and focused schemas through a real session;
2. verify the corrected high-risk facts;
3. execute representative commands built from the advertised nested shapes;
4. verify unsupported advertised parameters do not exist;
5. verify plan and interactive commands still reach the same executor.

Existing functional tests should continue to cover execution behavior. A
schema-prose snapshot would be counterproductive; tests should assert only
machine-relevant structure, requiredness, enums, defaults, and bounds.

## Conclusion

The system remains generic. Its algebra and executor do not need replacement.
The immediate work is to make the factual interface a trustworthy description
of the power that already exists.

The correct architectural boundary is:

```text
dependency-free contract facts
        ↓
runtime normalizers + factual schema projections
        ↓
shared executor
        ↓
plan adapter / persistent JSONL adapter
```

That change improves agent and future UI use without encoding a research
workflow, introducing arbitrary guidance, or building a framework around the
framework.
