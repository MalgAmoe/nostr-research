# Nostrarium control and data map

This document maps what a navigator can control through the current research
session and what the engine returns, retains, derives, or discards. It is a
factual reference for the CLI, controller, desktop agent, and future adapters.

The central distinction is:

> Controls change contact, attention, memory, or presentation. Data records
> evidence, derivation, uncertainty, and navigator judgment.

An adapter may arrange or emphasize these controls. It must not change what
they mean or hide the complete command surface from the agent.

## The whole loop

```text
configure contact and bounds
        ↓
acquire a bounded field
        ↓
observe evidence and coverage
        ↓
form replaceable views
        ↓
navigate to related subjects or values
        ↓
acquire missing evidence when explicitly requested
        ↓
observe again
        ↓
record navigator judgment in narration and preserve selected evidence
        ↓
continue, release views, or end the voyage
```

There are four different kinds of engine/session state in this loop:

1. **Corpus evidence** — immutable Nostr events currently in the observation
   buffer or deliberately copied into the archive.
2. **Observations and provenance** — where and when events were observed, why
   subjects entered a result, and how relationships were interpreted.
3. **Named result handles** — replaceable views over subjects, relations, or
   reports. They are working instruments, not saved research.
4. **Session configuration** — current relay, acquisition, and presentation
   defaults.

These must remain distinct. Releasing a handle does not remove corpus evidence.
Preserving evidence does not mean the navigator endorsed it. Navigator
judgments live in narration, temporary caller-side attention, or an explicit
exported artifact rather than a parallel engine store.

## 1. Session and command controls

Every JSONL command uses a common envelope:

- `commandId` — caller-owned correlation only;
- `ifRevision` — optional optimistic-concurrency guard;
- `command` — the requested action;
- `input` or `inputs` — named result handles consumed by the action;
- `parameters` — operation-specific controls;
- `resultId` — name for a newly produced handle;
- `replace` — explicit permission to replace an existing handle.

Successful mutations increment `sessionRevision`. Observation commands do not.
Failed commands leave the session unchanged.

This makes a voyage inspectable as a sequence of explicit decisions. A future
caller may generate these envelopes through buttons, forms, recipes, or another
protocol adapter without creating a second engine path.

## 2. Configuration controls

### Construction-time memory bounds

The session is created with independent capacities for:

- the renewable observation buffer;
- the deliberate evidence archive.

These capacities are subject counts, not byte budgets. They are honest and
simple, but canonical archived events cost much more memory than references.
That difference should be measured before introducing weighted accounting.

Buffer eviction follows first insertion order. Observing an existing event
again adds provenance but does not refresh its position in the eviction order.
Recently observed and recently inserted are therefore different properties.

Each canonical event retains at most 100 observation records across current
memory resolution. Identical retained observations are deduplicated. Additional
observation attempts are discarded and counted explicitly; that count measures
discarded attempts, not distinct unseen evidence.

### Mutable session defaults

`configure` can change:

- default relay URLs;
- acquisition timeout;
- observation limit;
- distinct-event limit;
- relay concurrency;
- default content-warning exclusion;
- preview length;
- text excerpt length;
- maximum response size.

Per-operation acquisition and presentation parameters can override the relevant
defaults. The effective configuration is visible through `status`.

Configuration is therefore part of a caller's research posture, not a hidden
classification. Two voyages using the same general method may use different bounds when the
navigator deliberately changes them.

## 3. Contact with the Nostr field

### `acquire`

`acquire` sends an explicit NIP-01 filter to the configured or supplied relays.
The navigator controls:

- relays;
- event IDs, authors, kinds, time bounds, tag filters, and relay-side limit;
- timeout;
- observation budget;
- distinct-event budget;
- concurrency;
- content-warning exclusion.

The result is both:

- an events handle over the acquired distinct events; and
- an acquisition report describing the attempt.

The report records requested filters, effective bounds, per-relay attempt
lifecycle, received packets, invalid and non-matching events, excluded content
warnings, duplicate observations, corpus additions and evictions, relay
notices, AUTH challenges, CLOSED reasons, EOSE hints, completion reason, and
uncertainty.

It never claims relay completeness.

### `hydrate`

`hydrate` explicitly acquires missing evidence for an existing subject
collection, most commonly kind-0 metadata for accounts. Its completeness report
distinguishes:

- requested subjects;
- resolved subjects;
- missing subjects;
- acquired immutable events;
- accounts with multiple metadata events;
- relay and request bounds.

The subject count and event-handle count may differ. That is expected for
replaceable metadata.

### `continue`

`continue` performs one declared relationship traversal, locally or through
relays when the relationship supports external acquisition.

Account routes:

- authored notes;
- profiles;
- follow lists;
- followed accounts;
- followers.

Event routes:

- replies;
- ancestors;
- mentions;
- quotes;
- referenced events;
- conversation.

Local-only event routes:

- shared tags;
- linked domains.

External continuation reports per-input outcomes and aggregate statuses while
keeping relay failures in an attributed external block. A zero result is only
an `empty-valid-result` when all requested relays reached a conclusive terminal
state; otherwise it remains unverifiable.

Before the global event limit is applied, continuation interleaves candidates
across input subjects. This gives each explicit input a chance to contribute
before a prolific input supplies additional results.

### Relay-specific external operations

`relay-info` retrieves attributed NIP-11 advertisements. Retrieval failure,
non-JSON responses, document content, supported NIPs, and advertised
limitations remain claims about a specific relay, not observed protocol truth.

`relay-count` performs NIP-45 COUNT requests. Results remain per relay and carry
exact or approximate metadata. Counts are planning evidence and are never
summed into a false global total.

## 4. Local subject controls

Subject collections contain stable event, account, address, or tag identities.
They can be shaped without new network contact.

### Selection and bounds

- `select` finds subjects already in the corpus.
- `filter` applies identity predicates.
- `pick` chooses explicit members.
- `limit` takes a bounded prefix.
- `sample` takes a bounded sample.

### Set operations

- `union`;
- `intersection`;
- `difference`;
- `compare`.

These allow snapshot deltas and overlap analysis. Set operations remain
identity-based; they do not invent similarity.

### Typed movement

From events:

- authors;
- referenced accounts;
- referenced events;
- referenced addresses.

From addresses:

- current resolved events.

From accounts:

- authored events already in the corpus;
- followed accounts already evidenced by follow events.

`move` is local and mechanical. `continue` is the explicit operation when the
route may require further relay contact.

## 5. Relation controls

`relate` turns a subject collection into rows. Relations are where the navigator
can inspect and recombine properties without losing the route back to stable
subjects.

### Initial shared fields

Every row can expose:

- subject type and ID;
- evidence resolution source;
- observed relays;
- reasons and provenance;
- field definitions and subject lineage.

Relation values resolve against current memory. If supporting buffer evidence
is evicted between stages, an existing relation or collection may later resolve
less evidence. The handle remains valid and reports the changed resolution;
working views are not implicit archives.

Event rows can additionally expose:

- author, kind, creation time, tags, text;
- event role, format, and conversation role;
- links and domains;
- media presence, families, and sources;
- normalized attachments, attachment count, and omitted-attachment count.

Account rows can expose resolved metadata such as:

- name and display name;
- description;
- NIP-05 identifier;
- picture and banner.

Fields are sparse and evidence-dependent. Absence is not equivalent to a
negative fact.

### Row-shaping algebra

- relation `filter` — retain rows matching predicates;
- `project` — choose and rename fields;
- `distinct` — deduplicate by selected values;
- `sort` — order rows;
- `slice` — take a bounded window;
- `balance` — take bounded representation per distinct key.

### Derivation and decomposition

- `derive` — compute a new field from declared expressions;
- `explode` — turn array elements, such as raw tags or attachments, into rows;
- `scan` — match terms across selected textual fields.

Direct field aliases preserve subject lineage. Computed values do not acquire
identity merely because they resemble a pubkey or event ID.

### Combination and summarization

- `join` — combine relations on explicit keys;
- `aggregate` — group and compute counts or other declared aggregates;
- `fetch` — bind relation values into a new explicit relay acquisition.

### Return to subjects

`extract` converts a lineage-bearing relation field back into an event, account,
or address collection. This is the critical bridge that lets an analysis become
the next movement rather than a dead report.

Relation operations are deliberately generic. For example, mention frequency is
not an engine feature:

```text
relate events
→ explode event.tags as tag
→ filter tag.0 equals "p"
→ aggregate by tag.1
→ sort by count
→ extract selected tag.1 values as accounts
```

The navigator decides whether that frequency is meaningful.

## 6. What the engine derives from events

The engine keeps canonical events intact and exposes sparse derived facts.

### Content facts

- role;
- format;
- conversation role;
- media presence;
- media families;
- media sources;
- normalized attachments.

Attachments may come from explicit NIP-94-style metadata tags or URLs in event
content. Their source remains visible. Unknown media is not guessed into a
category.

### Relationship facts

Relationships can include:

- authorship;
- replies and roots;
- event, account, and address references;
- mentions and quotes;
- inline NIP-27 references;
- follow relationships;
- shared topics and domains.

Each relationship carries mechanical evidence, direction, source subject,
interpretation, and raw supporting material where appropriate.

### Content warnings

Direct self-warnings are excluded during acquisition by default. The exclusion
is configurable, reported in acquisition counts, and does not claim to detect
untagged sensitive content.

## 7. Sensing controls

The observation surface is intentionally separate from transformation.

### `show summary`

Returns a stable compact block:

- result kind;
- count and count unit;
- operation lineage;
- evidence resolution;
- bounds and truncation;
- completeness and omissions where applicable;
- event-conditioned facts such as kind histogram, distinct authors, and time
  range when event evidence resolves.

Summary is for orientation, not exemplars, so its preview is intentionally
empty.

### `show preview`

Returns a bounded page of representative compact items or rows. It exposes
stable identities, compact values, reasons, relays, and resolution state.

### `show coverage`

Returns how the result is supported:

- sources and relay participation;
- corpus resolution;
- duplicate observations;
- bounds and omissions;
- external attempt outcomes.

Coverage is most meaningful for acquisition and continuation reports. It may be
empty for result kinds that have no separate coverage projection.

### `show details`

Returns bounded canonical or fully resolved evidence. It is intentionally
expensive. The requested item count can be reduced by the response-size bound.

### Independent presentation bounds

Every page has an offset and item limit, but the configured response-size bound
may stop it earlier. Responses declare:

- requested and returned counts;
- omitted items;
- next offset;
- whether size bounding occurred;
- the bound reason.

The senses therefore never silently promise that the requested number of items
fit in the response.

Presentation normally degrades by compacting fields or returning fewer items.
It fails only when the mandatory minimal summary itself cannot fit inside the
configured response-size bound.

### `inspect`

Resolves what is currently known about one exact Nostr subject: event, account,
address, or tag. It can show compact projection, resolution source, freshness,
corpus effects, and bounded evidence.

Residency has subject-specific factual meaning: an event is resident when that
exact event is buffered; an account is resident when its current kind-0
metadata is buffered; an address is resident when a matching replaceable or
addressable event is buffered. Unrelated events by an account do not make the
account or one of its addresses resident.

### `explain`

Explains why a subject belongs to a named result. This is result-membership
provenance, not canonical subject inspection.

### Discovery and orientation

- `schema` describes commands globally or in the context of a specific handle;
- `list` shows live result handles;
- `status` shows memory pressure, corpus indexes, archive, configuration,
  active operations, and handle count.

Schema reports available and populated fields, typed transitions, required
caller choices, defaults, and bounds. It describes possibilities; it does not
recommend a next action.

## 8. Navigator judgment

The engine exposes evidence, provenance, bounds, and working views; it does not
own navigator conclusions. Judgments belong in the live narrated ledger,
temporary caller-side attention when useful, or a deliberately exported
artifact. The engine does not infer judgments from activity, popularity, text,
or network position.

## 9. Collection and retention controls

The archive answers whether evidence should survive buffer turnover. It is not
a judgment or annotation store.

### Evidence archive

`preserve` copies selected evidence from the renewable buffer into one of three
levels:

- reference;
- excerpt;
- canonical.

`archived` creates views over archived subjects. `release-archive` removes
deliberately retained evidence.

Canonical archived events remain indexed alongside buffered evidence, so
selection, inspection, and local traversal can continue after buffer eviction.

The archive says, “carry this evidence through buffer turnover.”

Preserving a disturbing or doubtful event for analysis must not imply interest.

## 10. Working-view lifecycle

Named handles are disposable instruments:

- `release` removes one;
- `release-all` removes all;
- `reset` clears session-owned working state according to its contract;
- `close` terminates the session.

Handles should be released during long voyages, especially large relation
handles. Relations, joins, and explosions are eager and bounded; unreleased
derived views are the first likely source of pressure.

`plan` executes the same normalized operations as interactive commands in
batch. It is not a second workflow language. Caller-side recipes can compile to
visible plans without giving the engine hidden procedures.

Plans preflight their structure and roll back plan-owned memory mutations if a
stage fails. Relay requests that have already been sent are external facts and
cannot be undone.

## 11. What a navigator actually receives

The engine does not “slam all data into the navigator.” It provides several
progressively more expensive projections:

1. a handle acknowledgment with kind and cardinality;
2. a compact summary;
3. a small preview;
4. coverage and partiality;
5. detailed evidence on demand;
6. exact-subject inspection;
7. membership explanation.

The navigator decides when to pay for more visibility.

Every useful result also carries some combination of:

- stable subject identity;
- canonical evidence or its resolution status;
- observed relay provenance;
- membership reasons;
- relationship evidence;
- transformation lineage;
- cardinality and truncation;
- external completeness;
- omissions;
- corpus effects.

This supporting information is not decoration. It is what allows the navigator
to distinguish “no match,” “not fetched,” “evicted,” “relay failed,” “bounded
away,” and “not represented by this projection.”
