# Operation and state inventory

Date: 2026-07-27

This is an analysis of the current tree, not a target API. The current policy is
`docs/research/system-simplification-direction.md` and
`docs/research/system-simplification-plan.md`; archived reviews are used only
as reports to reproduce. No product source or permanent test was changed.

## Surfaces and vocabulary

The package root exports the memory and subject constructors, acquisition,
continuation, plan, relation, relation-backed acquisition, and declarative
session APIs (`src/index.js:2945-2972`). The canonical *plan/session operation
names* are the 34 keys of `RESEARCH_OPERATIONS` (`src/operations.js:43-73`).
Plans accept exactly that registry (`src/plan.js:98-181`); the session adds
adapter commands around it (`src/interpreter.js:24-40`). Direct callers can
also invoke the lower-level public memory methods and exported executors.

Kinds are not interchangeable:

| Value | Current responsibility and shape |
| --- | --- |
| subject collection | `result-collection` of stable subjects, membership reasons and provenance; kinds `subjects`, `events`, `accounts`, or `relationships`. It is identity/navigation state, although current transforms can turn it into typed projections/groups/summaries (`src/index.js:273-315`, `src/operations.js:114-128`). |
| research relation | `research-relation` rows containing bounded derived `values` plus subjects, reasons, provenance and source-field references. Source fields re-resolve against memory (`src/relation.js:34-53`, `src/relation.js:640-674`). |
| acquisition report | One external attempt: request, budget, times, relay outcomes, counts, acquired IDs/observations, corpus additions and coverage; it embeds an event collection for composition (`src/acquire.js:24-93`, `src/acquire.js:214-257`). It is a returned report, not memory history. |
| memory | Owner of buffer, archive, notebook and their indexes, not a result kind (`src/index.js:173-201`). |
| session | Owner of named handles, revision, command queue/cancellation and response envelopes. It delegates research execution to the plan executor (`src/interpreter.js:43-119`, `src/interpreter.js:346-382`). |

Legend below: **R** is read-only; **M** mutates memory; **H** mutates only
session handle/revision state; **E** contacts explicit relays and may ingest
buffer evidence. “Direct” means the exported executor or corresponding public
memory/acquisition function. Every registry operation is callable in a plan and
as an individual session command, so those callers are stated once rather than
repeated in every row: `executeResearchPlan` and `DeclarativeResearchSession`
both call `executeResearchOperation` (`src/plan.js:38-77`,
`src/interpreter.js:346-382`).

## Authoritative operation inventory

### Evidence acquisition, selection, navigation, and memory

| Operation | Research intention; input -> output | Execution/state | Normalize, validate/preflight, execute; current callers | Overlap and recommendation |
| --- | --- | --- | --- | --- |
| `acquire` | Perform one bounded relay/filter attempt; no input -> acquisition report containing events | E, M buffer | Options in `src/acquire.js:323-356`; preflight `src/plan.js:202-215`; execute `src/plan.js:332`; direct `acquireRelayEvents`; acquisition, reliability and session tests | **Keep**, named honestly. Make it one external executor route in Task 053. |
| `select` | Select resident/archive-complete events, optionally scoped to an acquisition report; none/report -> events collection | local R | Query normalization/validation in `src/index.js:245-270`, preflight `src/plan.js:217-228`, scoped execution `src/plan.js:333-384`; direct `memory.select`; memory/query/acquisition tests | **Keep** as local identity selection. Its report-scoping code belongs with execution, not as a second selector. |
| `move` | Navigate known identities over author/reference/authored/follow routes; collection -> subject collection | local R | Route registry `src/operations.js:14-20`; collection normalization `src/index.js:1969-1981`; execute `src/index.js:2462-2496`; collection and continuation tests | **Keep** as collection graph movement. Do not move into relation algebra. |
| `continue` | Follow one named relationship locally or through an explicit bounded relay attempt; subjects -> continuation report with collection | local R or E/M by `source` | Relationship registry/schema `src/operations.js:22-41`; normalize `src/continuation.js:91-164`; preflight `src/plan.js:267-285`; execute/project `src/continuation.js:23-88`, `304-374`; continuation/session tests | **Rename/merge external wording in Task 053**: retain the relationship capability, but distinguish local navigation from relay acquisition. `profiles` overlaps `hydrate`; resolve that duplication rather than retain both paths. |
| `hydrate` | Fetch profile/contact-list events for accounts; accounts -> hydration report containing events | E, M buffer | Options `src/acquire.js:358-389`; preflight `src/plan.js:263-266`; execute `src/plan.js:413-416`, `src/acquire.js:261-321`; acquisition/continuation tests | **Merge** with relay profile continuation or a parameterized acquisition operation. It is a specialized acquire whose result/report machinery duplicates `continue profiles`. |
| `fetch` | Bind relation fields into an exact NIP-01 filter and acquire; relation -> acquisition report/events | E, M buffer | validate/normalize `src/pipeline-source.js:20-47`; execute `src/pipeline-source.js:49-79`; dispatch `src/plan.js:330`; declarative operations tests | **Keep**, but lower into the authoritative external executor in Task 053. This is valuable relation-to-acquisition composition, not a second acquisition model. |
| `expand` | Bind relation fields into a continuation; relation -> continuation report | local R or E/M by `source` | validate `src/pipeline-source.js:82-97`; execute `src/pipeline-source.js:99-126`; dispatch `src/plan.js:329`; declarative operations tests | **Keep capability, rename/lower** alongside `continue`: it is relation input binding followed by the same continuation executor. |
| `preserve` | Deliberately retain references, excerpts, or canonical evidence; subjects -> same collection with mutation context | local M archive | validation `src/index.js:353-371`; preflight `src/plan.js:286-290`; execute `src/plan.js:417-425`, storage `src/index.js:440-494`; archive/turnover tests | **Keep** at memory boundary. |
| `archived` | Query archive entries by level/type; no input -> subjects collection | local R | query/storage `src/index.js:496-519`; preflight `src/plan.js:229-237`; execute `src/plan.js:385-402`; archive/turnover tests | **Keep** as archive-to-collection bridge. |
| `release-archive` | Remove deliberate preserved evidence without deleting notebook history; subjects -> released subject collection | local M archive | preflight `src/plan.js:286-290`; execute `src/plan.js:426-434`, storage `src/index.js:521-550`; archive/turnover tests | **Keep**, rename to `release-evidence` only if Task 053 standardizes noun/verb wording. Do not merge with session `release`. |
| `remember` | Record caller judgment/labels/note per subject; subjects -> input collection | local M notebook | parameter validation/preflight `src/plan.js:292-297`; execute `src/plan.js:435-439`, storage `src/index.js:904-930`; declarative observation/turnover tests | **Keep** as notebook knowledge mutation. |
| `notebook` | Query notebook entries; no input -> subjects collection | local R | query `src/index.js:938-964`; preflight `src/plan.js:238-247`; execute `src/plan.js:404`; notebook/turnover tests | **Keep** as notebook-to-collection bridge. |
| `remember-membership` | Replace a named stable-subject membership with reasons; subjects -> notebook-membership | local M notebook | plan normalization `src/plan.js:160-176`; preflight `src/plan.js:299-304`; execute fallback `src/plan.js:440-442`, storage `src/index.js:1034-1106`; session/turnover tests | **Keep**. Session-only `replace-membership` duplicates its storage effect and should merge into this operation. |

`continue` has 14 internal relationship modes:
`authored-notes`, `profiles`, `follow-lists`, `followed-accounts`, `followers`,
`replies`, `ancestors`, `mentions`, `quotes`, `referenced-events`,
`conversation`, `shared-tags`, `linked-domains`, and `expansion`
(`src/operations.js:22-41`). They accept the input/output kinds declared there;
all but `linked-domains` allow local or relay source. These are parameter modes,
not additional dispatcher operations. The implementation splits local
selection/traversal (`src/continuation.js:166-223`), relay filter construction
(`251-286`), and shared projection/pagination (`304-374`). Keep the useful
relationship vocabulary, merge `profiles`/`hydrate`, and remove the vague
`expansion` name once its exact routes are represented.

### Collection algebra

| Operation | Research intention; input -> output | Execution/state | Normalize/validate/execute; current callers | Overlap and recommendation |
| --- | --- | --- | --- | --- |
| `filter` | Retain subjects/typed items matching fields; collection -> same/refined kind. On relation, retain rows | local R | collection normalization/execution `src/index.js:1983-2058`, `src/index.js:2215-2242`; relation route `src/relation.js:55-105`, `274-279`; plan kind-switch `src/plan.js:248-262`; collection/relation/session tests | **Merge/lower to relation** for field analysis. Retain only identity-kind selection at the collection boundary (or express it in `select`). Current name has two semantics. |
| `pick` | Take explicit 1-based positions; collection -> same kind | local R | `src/index.js:1850-1867`, execution `src/index.js:2189-2197`; collection tests | **Keep** as bounded identity picking; no relation duplicate. |
| `project` | Produce chosen values; collection -> projections, or relation -> relation | local R | collection `src/index.js:1869-1890`, `2244-2254`; relation `src/relation.js:132-136`, `281-290`; collection/relation tests | **Lower to relation**; remove collection projection after callers convert with `relate`. |
| `distinct` | Unique values by field; collection -> projections, or relation -> rows unique by fields | local R | collection `src/index.js:1892-1905`, `2256-2273`; relation `src/relation.js:138-141`, `293-304`; collection/relation tests | **Lower to relation**. One relation definition should own value distinctness. |
| `sort` | Order by field; collection -> same kind, or relation -> relation | local R | collection `src/index.js:1907-1925`, `2275-2292`; relation `src/relation.js:142-149`, `306-316`; collection/relation tests | **Lower analytical sorting to relation**. If identity selection needs ordering, keep it as selection/pick policy, not duplicate algebra. |
| `limit` | Bound prefix; collection -> same kind, or relation -> first rows | local R | collection `src/index.js:1927-1933`, `2294-2298`; relation `src/relation.js:150-155`, `318-323`; many functional tests | **Merge** into relation `slice` (`offset:0`) for values; keep a small collection `pick/limit` identity bound only if current navigation callers require it. |
| `sample` | Deterministically sample stable subjects; collection -> same kind | local R | `src/index.js:1935-1948`, `2300-2318`; collection tests/field trials | **Keep** as identity-oriented bounded sampling. |
| `group` | Group collection members and retain bounded examples/aggregation inputs; collection -> typed groups | local R | `src/index.js:1950-1967`, `2319-2383`; collection tests | **Remove/merge into relation `aggregate` plus `balance`**. Its retained nested mini-collections duplicate analytical grouping. |
| `summarize` | Aggregate collection or groups; collection -> typed summaries | local R | `src/index.js:2059-2100`, `2385-2459`; collection/reference tests | **Remove/merge into relation `aggregate`**. Aggregation vocabularies differ (`distinct` versus relation `countDistinct`) and should have one owner. |
| `union` | Stable identity set union; two same-kind collections -> collection | local R | common set normalization/execution `src/index.js:2102-2144`, `src/index.js:2330-2360`; plan reference rewrite `src/plan.js:50-55`; collection/session tests | **Keep** as collection set composition. |
| `intersection` | Stable identity intersection; two collections -> collection | local R | same paths as `union`; collection/session tests | **Keep**. |
| `difference` | Stable identity subtraction; two collections -> collection | local R | same paths as `union`; collection/session tests | **Keep**. |
| `compare` | Compare two memberships and counts; two collections -> summaries | local R | same normalization and `src/index.js:2330-2360`; collection/session tests | **Rename/lower** to a presentation/summary of set difference, or remove if no non-test caller remains. It is not a collection identity result and overlaps the other three set operations plus observation. |

All collection transforms are normalized by
`normalizeTransformOperation` and field-specific switches in
`src/index.js:1810-2100`, result kinds are separately predicted in
`src/operations.js:114-128`, preflight calls `memory.validateTransform`
(`src/plan.js:248-262`), and execution calls `memory.transform`
(`src/plan.js:405-409`). That four-place route is the concrete consolidation
target for Task 053.

### Relation algebra

| Operation | Research intention; input -> output | Execution/state | Normalize/validate/execute; current callers | Overlap and recommendation |
| --- | --- | --- | --- | --- |
| `relate` | Convert subject collection to value rows linked back to subjects/evidence; collection -> relation | local R | `src/relation.js:34-53`, validate/execute `55-105`; relation/declarative tests | **Keep** as the explicit identity-to-analysis transition. |
| `join` | Join two named relations on values; `{left,right}` -> relation | local R | `src/relation.js:55-73`, parameter normalization `170-210`, execution `325-367`; declarative operations tests | **Keep**. It is the real multi-input analytical operation. |
| `aggregate` | Group relation rows and calculate named aggregates; relation -> relation | local R | `src/relation.js:212-256`, `369-396`; declarative operations/reference tests | **Keep**, absorb collection `group`/`summarize`. |
| `derive` | Add bounded arithmetic/coalesce values; relation -> relation | local R | `src/relation.js:258-267`, `398-415`, expressions `535-567`; declarative operations tests | **Keep**. |
| `slice` | Offset/limit a relation window; relation -> relation | local R | `src/relation.js:150-155`, `318-323`; declarative operations tests | **Keep**, absorb relation `limit`. |
| `explode` | Expand an array value to rows; relation -> relation | local R | `src/relation.js:157-169`, `417-438`; declarative operations tests | **Keep**. |
| `scan` | Find terms in selected fields, emitting one row per field/term match; relation -> relation | local R | schema `src/operations.js:198-206`; normalize `src/relation.js:171-216`; execute `440-478`; declarative operations tests | **Keep**, but presentation must state match-row, distinct-subject and author counts separately. |
| `balance` | Cap rows per value-key while retaining a global bound; relation -> relation | local R | `src/relation.js:218-230`, `480-491`; declarative operations tests | **Keep** as analytical sampling/balancing. |

Relation execution also accepts the shared names `filter`, `project`,
`distinct`, `sort`, and `limit` even though `RELATION_OPERATIONS` in
`operations.js` omits them and `relation.js` independently includes them
(`src/operations.js:44-46`, `src/relation.js:21-24`). `plan.js` contains a
special input-kind switch to reach them (`src/plan.js:248-254`). This is the
clearest duplicate registry/dispatcher defect.

## Direct public and internal operation inventory

These calls are outside the 35-name operation language but are current package
behavior:

| Surface | Intention and state | Current callers | Recommendation |
| --- | --- | --- | --- |
| `memory.ingest` | Validate immutable canonical event, record observation, update derived indexes, FIFO-evict buffer (M) (`src/index.js:207-235`) | acquisition implementation; memory/reliability tests | **Keep public boundary** for non-relay consumers. |
| `getEvent`, `lookup`, `resolve`, `inspect` | Resolve stable event/account references from archive then buffer, exposing source/unresolved state (R) (`src/index.js:237-243`, `422-434`, `616-688`, `869-902`) | operations, presentation, tests | **Keep**, rationalize overlap internally in Task 054. |
| `collection`, `asCollection` | Construct stable-subject views and re-resolve their evidence (R) (`src/index.js:273-290`, `374-420`) | all operation modules/tests | **Keep deep conversion boundary**; do not make handles a storage layer. |
| `transform`, `validateTransform`, `describeCollectionPipeline` | Collection algebra, parallel validation and schema (R) (`src/index.js:296-341`) | plan/session/direct collection tests | **Lower analytical transforms in Task 053**, derive schema from the final operation model. |
| `currentEvent`, `follows`, `connections`, `traverse`, `project` | Low-level local protocol/navigation and older presentation projection (R) (`src/index.js:690-867`, `1108-1178`) | continuation, presentation and protocol/query tests | **Keep as lowered memory/index primitives**, not top-level operation registry entries. `project` is also a naming collision with transform `project`; rename/lower internally. |
| archive/notebook methods | `preserve`, `archived`, `releaseEvidence`, `remember`, `notebook`, `forget`, membership CRUD (R/M) (`src/index.js:440-550`, `904-1106`) | plan/session/turnover tests | **Keep state ownership**, route public mutations through one operation model where possible. |
| `describe`, `reset`, `close` | Report owner counts; clear all process-local state; close owner (R/M) (`src/index.js:1180-1220`) | session/presentation/tests | **Keep**. |
| acquisition/continuation/relation/pipeline-source exported validators and executors | Lower execution boundaries listed above | plan and direct functional tests | **Keep only useful public consumers; lower duplicated public validators behind Task 053’s executor.** |
| presentation exports | `showResearchValue`, `explainResearchMembership`, handle/status/facet projections (`src/presentation.js:12-210`) | session and declarative observation/reference tests | **Keep bounded observation**, but Task 054 should replace overlapping eager rules with explicit projections. |

Internal helpers that are operations in substance include query matching and
indexes, relationship derivation/traversal, collection transform switches,
relation normalization/application, continuation filter/projection, report
presentation, and session handle installation. They should remain delegated
deep helpers; the problem is their duplicated *policy*, not their existence.

## Session-only command inventory

The session exposes all registry operations plus:

| Command | Responsibility; mutation | Recommendation |
| --- | --- | --- |
| `plan` | Preflight and sequentially execute the same operation representation; optionally install named outputs (E/R/M/H) (`src/interpreter.js:438-489`) | **Keep**, thin over authoritative executor. |
| `forget` | Delete notebook entries for every subject in an input handle (M) (`src/interpreter.js:408-436`) | **Rename/merge** into an explicit notebook operation; it is currently absent from `RESEARCH_OPERATIONS`. |
| `show`, `inspect`, `explain` | Bounded result view, exact-subject view, membership reason/provenance (R) (`src/interpreter.js:128-160`) | **Keep**, consolidate as explicit preview/summary/coverage/details/explain modes in Task 054. |
| `list`, `status` | Bounded handle list and owner-separated memory/session counts (R) (`src/interpreter.js:170-181`, `214-220`) | **Keep**. |
| `schema` | Operation/field/session discovery (R) (`src/interpreter.js:161-169`) | **Keep but rebuild** from Task 053 authority; current guidance gaps are confirmed below. |
| `memberships`, `membership` | List/read notebook named memberships (R) (`src/interpreter.js:182-213`) | **Keep**, potentially expose through notebook query rather than special semantics. |
| `release`, `release-all` | Drop one/all handles only (H) (`src/interpreter.js:223-258`) | **Keep**; distinguish clearly from archive release. |
| `replace-membership`, `delete-membership` | Mutate membership through session-only commands (M) (`src/interpreter.js:260-287`) | **Merge** replacement with `remember-membership`; retain explicit delete under notebook operations. |
| `reset`, `close` | Clear handles and all memory; close also ends lifecycle/cancels active work (M/H) (`src/interpreter.js:289-315`, `94-125`) | **Keep**. |

Command envelope validation, named input resolution, result-target checks,
revision mutation inference, handle installation, and presentation all live in
`interpreter.js` (`61-119`, `317-489`). Operation semantics should leave this
module in Task 053; sequencing, cancellation, lifecycle, handles, revision and
envelopes should remain.

## State ownership and lifecycle

| State/value | Authoritative owner | Creation/change | Eviction, release, reset/close | References and copying |
| --- | --- | --- | --- | --- |
| observation-buffer evidence | `InMemoryResearchMemory.#buffer`, an `IndexedObservationBuffer`, plus observation IDs/eviction count (`src/index.js:77-169`, `174-185`) | `ingest`; relay operations call it only after canonical validation/filter matching (`src/index.js:207-235`, `src/acquire.js:112-168`) | FIFO canonical-event eviction at capacity; refresh observations do not add distinct events. `reset`/`close` clears it (`src/index.js:223-228`, `1199-1220`) | Owns canonical cloned event, observations, author/kind/tag and relationship indexes. |
| archived evidence | `#archive` plus `#archivedCanonical` (`src/index.js:180-181`) | explicit `preserve` at reference/excerpt/canonical level; capacity preflight fails before mutation (`src/index.js:440-494`) | never buffer-evicted; explicit `releaseEvidence`; reset/close clears (`src/index.js:521-550`, `1199-1220`) | Reference may resolve nowhere; excerpt is bounded interpretation; canonical is copied immutable evidence and indexed for resolution. |
| notebook knowledge | `#notebookEntries`, `#notebookMemberships` (`src/index.js:184-185`) | explicit `remember`, membership replace/remember/delete (`src/index.js:904-1106`) | outlives buffer/archive release; explicit forget/delete; reset/close clears | Stores caller attribution, labels/judgments/notes/reasons/source references and stable subjects, not canonical evidence. |
| subject collection | returned immutable-by-convention value; memory owns no registry of collections | selection, lookup, navigation, notebook/archive queries, transforms | caller drops it; session handle release drops only the handle. Evidence can become unresolved after eviction/release | Holds stable subjects/reasons/provenance; `asCollection` re-resolves records from current memory (`src/index.js:374-420`). |
| research relation | returned value; memory owns no relation registry | `relate` and relation operations | caller/handle lifetime; no independent eviction | Rows hold bounded values and field references; presentation re-resolves source fields. It must not become an archive (`src/relation.js:34-53`, `640-674`). |
| acquisition report | returned operation value only | each `acquire`, `hydrate`, relay `continue`, or `fetch` attempt | caller/handle lifetime; never registered as global history | Contains exact attempt coverage and corpus deltas plus a composable collection; ingestion side effects live in memory. |
| session handles | `DeclarativeResearchSession.#handles` (`src/interpreter.js:47-55`) | successful command/plan output installation; revision increments (`src/interpreter.js:103-112`, `372-377`, `459-468`) | `release`, `release-all`, reset, close; releasing never erases memory evidence | Owns result values/descriptors, not corpus copies. Relation/source values may later resolve differently as memory turns over. |

## Seam reproduction and classification

| Reported seam | Classification and concrete evidence | Owner / next task |
| --- | --- | --- |
| mixed conversation -> authors | **Obsolete (fixed in current tree).** Archived report records an internal failure on a 31-event mixed-kind conversation (`docs/research/archive/open-ended-research-usage-review.md:480-500`). Current continuation declares `conversation` output as `events` (`src/operations.js:33`), creates that typed collection (`src/continuation.js:43-51`), and `move authors` reads the common canonical `record.event.pubkey` without a kind-specific event branch (`src/index.js:2462-2476`). The functional session path also asserts a conversation handle kind of `events` (`test/continuation.functional.test.js:279-290`). A fixture-backed conversation-to-authors scenario succeeds in the baseline below. | Collection construction/move; no fix in 052. Preserve in Task 053 public functional coverage if the transform moves. |
| inconsistent `event.hasMedia` | **Confirmed semantic inconsistency, not a dispatcher failure.** Collection filter/project uses one regex over event content (`src/index.js:2306`, `2736-2739`) and the functional fixture test proves its narrow extension-based behavior (`test/collection-algebra.functional.test.js:58-72`). Relation source fields do **not** include `event.hasMedia` (`src/relation.js:7-19`), while collection schema advertises it (`src/index.js:2562`, `2613`). URLs without recognized suffix/host therefore appear media-like to a researcher but return false, matching archived evidence (`docs/research/archive/research-library-and-command-usage-review.md:273-283`). | Field semantics/collection-vs-relation split; Task 053 chooses one field definition, Task 054 repairs behavior only after that ownership is settled. |
| collection vs relation pagination | **Confirmed.** Collection `limit` has no offset and irreversibly takes a prefix (`src/index.js:1927-1933`, `2294-2298`); relation has both `limit` as offset-zero slice and explicit `slice(offset,limit)` retaining `totalCount` (`src/relation.js:91`, `150-155`, `318-323`). Separately, `show` paginates either value without transforming it (`src/presentation.js:35-63`, `216-277`). Thus “pagination” currently means three different mechanisms. | Algebra in Task 053 (one relation slice, identity pick/bound); observation window in Task 054. |
| scan rows vs distinct events/authors | **Confirmed.** `scan` emits one row for each matching field/term (`src/relation.js:440-478`), while relation presentation reports only `rows.length` (`src/presentation.js:35-63`). Subject counts exist per preview row, but no aggregate distinct subject/author counts. Archived review explicitly found this misleading (`docs/research/archive/open-ended-research-usage-review.md:137-151`, `685-689`). | Relation result semantics stay in Task 053; summary/coverage projection belongs to Task 054. |
| multi-input retrieval starvation | **Confirmed.** Relay continuation builds one combined filter with global `limit: eventLimit` (`src/continuation.js:251-279`); local projection then merges inputs in input order and applies one global slice (`src/continuation.js:304-374`). Early/noisy inputs can consume the relay and projection bounds. The schema itself admits results are “not balanced per input” (`src/operations.js:188-190`). Per-input outcomes report omissions but do not prevent starvation. | Acquisition/continuation executor and completeness in Task 053; repair after ownership in Task 054 (for example explicit balance, not hidden fairness). |
| incomplete operation/schema guidance | **Confirmed.** `operationSchema` lists names but detailed contracts for only acquire/select/hydrate/continue/membership/archive/scan (`src/operations.js:149-207`). `collectionPipelineSchema` relation list omits `explode`, `scan`, and `balance` even though executable, and omits relation parameter contracts (`src/index.js:2619-2630` versus `src/relation.js:21-24`). Shared operation names have kind-dependent shapes not explained contextually. `schema` simply combines these structures (`src/interpreter.js:161-169`). | Duplicate registries/schema switches; Task 053 derives complete constraints from authority, Task 054 adds valid-next-operation guidance. |
| PTY command echo interleaving | **Confirmed as a PTY transport characteristic; not reproducible in the JSONL adapter itself.** Archived field evidence observed terminal echo when batched input was written to a PTY (`docs/research/archive/open-ended-research-usage-review.md:525-534`). The adapter sets Node readline `terminal:false` and writes only JSON responses (`src/jsonl-session.js:23-56`); pipes and the functional stream tests do not echo. A controlling PTY can independently echo typed bytes, so command text and stdout responses share the terminal display. | CLI/PTY adapter boundary in Task 054 or invocation harness; do not add TCP/PTY machinery to product or permanent tests in 052. |

### Fixture-backed evidence for the obsolete mixed-conversation seam

The existing fixture-backed public tests separately establish the path on which
the old failure depended: local conversation continuation produces an `events`
handle (`test/continuation.functional.test.js:279-290`), and event collections
move to author accounts (`test/collection-algebra.functional.test.js:102-112`).
Current source no longer has the old event-kind dispatch. This is source/test
reconstruction rather than a claim that the archived live 31-event corpus is
still available.

## Duplicate machinery and seam owners

1. **Registries:** `RESEARCH_OPERATIONS`/its reduced
   `RELATION_OPERATIONS` list (`src/operations.js:43-73`),
   `RELATION_OPERATIONS` in `relation.js` (`21-24`), transform-name switches in
   `index.js`, session `COMMANDS`, and schema operation arrays. They disagree
   today.
2. **Validation/normalization:** plan normalization and special cases
   (`src/plan.js:98-304`), collection `normalizeTransformOperation`, relation
   `normalizeRelationParameters`, continuation/acquisition validators, and
   session envelope/result validation. Domain validation is legitimately
   delegated, but accepted input/output/locality policy is duplicated.
3. **Execution switches:** `executeResearchOperation`, `memory.transform`,
   `executeRelationOperation`, continuation local/filter/project switches, and
   session mutation inference. Result kind and mutation are reconstructed
   after execution in the plan/session.
4. **Field helpers:** collection `transformField`/`summaryField`, relation
   `SOURCE_FIELDS`/`relationValues`, selection query fields, and presentation
   facets each define overlapping event/account meaning. `event.hasMedia` makes
   the divergence observable.
5. **Presentation rules:** `showResearchValue` dispatches by every result
   shape; `presentResult` and `externalPresentation` in `interpreter.js`
   separately infer external/completeness detail; collection facets and compact
   context reconstruct operation meaning. Offset/limit and counts therefore
   differ by shape.

## Existing public functional baseline

Validation was run from the repository root on 2026-07-27:

| Check | Result |
| --- | --- |
| `npm run check` | PASS: syntax checks for all package source and CLI files |
| `npm test` | PASS: 22 tests, 22 passed, 0 failed/cancelled/skipped/todo |
| task artifact completeness/source comparison | PASS: all 34 `RESEARCH_OPERATIONS` names appear above; all 14 continuation modes and all 16 session-only command names are accounted for |
| live relay, WebSocket/TCP, UI, screenshot checks | not run, explicitly excluded |

The passing suite establishes current public paths for canonical ingestion and
eviction, local queries/navigation, archive/notebook turnover, acquisition and
continuation reports, collection and relation algebra, plans, declarative
session/JSONL envelopes, and bounded observation. It does not negate the
confirmed semantic seams above.

## Boundaries for Tasks 053 and 054

Task 053 should consolidate, without a new layer:

- make one existing operation module the discoverable registry/executor entry;
- move input/output kind, locality, normalization delegation, preflight,
  execution, mutation and completeness facts into that route;
- have direct single operations, plans and session commands call it;
- retain collections for selection/pick/sample/move/set composition and
  deliberate memory bridges;
- retain relations for filter/project/distinct/sort/slice/grouping/aggregate,
  join/derive/explode/scan/balance;
- merge collection group/summarize into relation aggregate, relation limit into
  slice, hydrate into explicit profile acquisition/continuation, and
  relation-bound `expand` into the same continuation route;
- delete superseded registries, switches and schema arrays after callers move.

Task 054 should then clarify existing ownership, not invent a storage or result
framework:

- keep buffer/archive/notebook/index resolution inside memory while moving
  analytical transformations out of `index.js`;
- keep collections and relations as caller/session-owned values whose source
  references resolve through memory;
- keep acquisition reports ephemeral and handles as views;
- repair media semantics, pagination terminology, scan distinct counts and
  explicit multi-input omissions/fairness at their owners;
- make session observation explicit (`preview`, `summary`, `coverage`,
  `details`, `explain`) and derive useful next-operation/schema guidance;
- address PTY echo only at the JSONL/terminal boundary.

Confirmed merges/removals are therefore: collection `project`, `distinct`,
analytical `filter`/`sort`, `group`, and `summarize` lower into relation
operations; relation `limit` merges into `slice`; `hydrate` merges with profile
relay retrieval; session `replace-membership` merges with
`remember-membership`; vague `expansion` and set `compare` should be removed or
renamed after current non-test callers are checked during migration. No
compatibility aliases are warranted for this experimental frontend.
