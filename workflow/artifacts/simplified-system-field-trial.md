# Simplified system sustained field trial

## Method and evidence limits

Two sequential sessions were run through the packaged persistent
`nostr-research-session` executable on 2026-07-27, with observation-buffer
capacities of 10 and 8.

A preliminary external attempt contacted `wss://relay.damus.io` and
`wss://nos.lol`; both failed DNS resolution in the worker sandbox. The
successful trials therefore used a disposable WebSocket substitute serving 22
valid signed canonical events: six kind-0 profiles and sixteen kind-1 notes
covering climate, energy, ocean, AI, news, art, profile claims, links, tags,
and one reply edge. Acquisition still passed through the real executable,
session, operation executor, exact NIP-01 filter matching, canonical
validation, budgets, ingestion, coverage, and buffer eviction.

This setup validates system capability and composition. It does not validate
public-relay availability, represent real Nostr data quality, or make the
synthetic authors credible. Canonical signatures establish valid event form,
not truth, expertise, or identity ownership.

## Session 1: goal-directed profile research

The goal was to find potentially credible climate profiles. Credibility
remained a researcher judgment; the system supplied attributed evidence and
mechanical signals.

1. `acquire` requested eight kind-1 climate-tagged events from one explicit
   relay with observation and distinct-event limits of eight. Coverage showed
   the exact filter and budgets, eight observations, eight distinct events,
   no invalid/non-matching packets, `observation-budget`, and a non-exhaustive
   partial result.
2. The executable's discovered next scoped `select` initially exposed a
   contract defect: the acquired value lacked its advertised
   `acquisition-report` type. After correction and restart, `select` produced
   eight local event subjects without network access.
3. `show details` exposed bounded canonical excerpts, authors, relays, buffer
   resolution, `nextOffset`, and four byte-bound omissions. Its discovered
   operations included `pick`, `relate`, membership, and author navigation.
4. `relate` made eight value rows. `scan` searched `event.text` for `method`,
   `source`, `data`, and `uncertainty`, yielding nine match rows from five
   subjects. Each retained source subject, coordinates, excerpt, author,
   reasons, resolution source, and provenance. A match was not treated as a
   credibility classification.
5. `move` transitioned events to four author accounts. External `hydrate`
   resolved four of four profile events at EOSE, filled the buffer, and
   evicted two notes. Relating the original account handle then exposed
   literal profile name, display name, description, and NIP-05 claims from the
   newly resident events.
6. A relation `filter` retained three descriptions mentioning data or ecology.
   The researcher treated these only as candidates. `expand` explored their
   local neighborhood, reached its ten-subject bound, and reported partiality
   plus three omissions. Explanations showed author, mention, topic, and reply
   reasons. An identity filter narrowed the mixed neighborhood back to three
   accounts.
7. `remember-membership` recorded `credible-climate-profiles` with the
   researcher's screening criterion and attribution. Later `membership`
   inspection restored stable accounts and explained membership context,
   source relationships, attribution, and source references.
8. `preserve` archived canonical profile evidence for those accounts. A
   redirecting general-note acquisition added ten events and evicted all ten
   prior buffer entries. `status` separated ten resident buffer events, twelve
   cumulative evictions, three canonical archive entries, one membership, and
   thirteen handles.
9. `inspect` resolved preserved Alice from `archive`; unpreserved Eve was
   `unresolved`. `release-all` discarded fourteen working handles without
   touching archive or membership state. `delete-membership` separately
   discarded the named judgment set.
10. An archive query copied from `schema` exposed a mismatch: the schema
    advertised plural query fields while execution accepted singular `level`
    and exact `subject`. The schema was corrected.

The session transitioned through acquisition coverage, events, text evidence,
accounts, profile events, account relations, a bounded neighborhood, a named
account collection, archived evidence, and a redirected event sample.
`acquire` and `hydrate` were external; all selection, analysis, navigation,
preservation, inspection, and lifecycle operations were local.

## Session 2: open-ended exploration

1. A fresh process acquired eight recent kind-1 events into an eight-event
   buffer. Coverage again showed exact budgets and non-exhaustive
   `observation-budget` partiality. Scoped `select` retained the attempt's
   exact subjects locally.
2. Seeded `sample` kept four orientation events and reported four omissions.
   Details exposed an art/media note, a climate reply, and a climate summary,
   allowing branches to be chosen without copying IDs.
3. The eight events became a relation. `explode` produced twelve tag rows;
   `aggregate` grouped tag values with counts and two bounded examples; `sort`
   placed climate first with three uses. The aggregate reported its omitted
   third example. That frequency described only this bounded sample.
4. The researcher redirected to media rather than the most common topic.
   Relation filtering on attributed `event.hasMedia` found one gallery event
   and its link/domain. Local text `select` restored it as an event collection.
5. `preserve` saved only an excerpt. `remember` separately recorded an
   attributed `anchor` judgment with `media` and `open-ended` labels.
6. `pick` selected the visible reply by one-based sample position. Local
   `continue` with `conversation` returned the reply and parent and reported
   complete resident-corpus coverage with no omissions. `show explain`
   exposed NIP-10 reply-parent reasons. It did not claim the relay held no
   other conversation events.
7. The ranked-tag handle was released. A redirecting bounded acquisition of
   eight older notes added seven events, refreshed one, and evicted seven.
8. After turnover, `inspect` of the media event was unresolved: excerpt
   preservation did not masquerade as canonical resolution. The notebook
   query still returned its stable subject and explained the caller-authored
   judgment, labels, and attribution.
9. `archived` found the excerpt, but observing/releasing its handle exposed a
   collection defect: the general `subjects` kind rejected a current subset
   containing only events. Validation was corrected so `subjects` can contain
   event-only, account-only, or mixed subsets.
10. `forget` removed the judgment. Final status separated eight buffer events,
    seven evictions, one excerpt entry, zero notebook entries, and working
    handles. Closing cleared the process-local environment.

This session transitioned among an event sample, deterministic orientation
collection, event relation, tag relation, aggregate facets, media relation,
selected event, conversation, excerpt archive, and notebook collection. It
repeatedly acquired, inspected, filtered, navigated, related, preserved,
discarded, and redirected.

## Capability versus judgment and data quality

System capability:

- one normalized operation vocabulary serves direct execution, plans, session
  handles, schema, and presentation;
- external acquisition and local querying remain visibly separate;
- page, byte, aggregation, acquisition, continuation, and buffer bounds remain
  observable with partiality and omissions;
- provenance and membership reasons survive composition, while archive,
  notebook, buffer, and handles retain independent lifetimes; and
- `schema` plus bounded `nextOperations` discovered every ordinary next step.

Researcher judgment supplied the vocabulary, meaning of credibility,
candidate criteria, branch choices, preservation levels, labels, and discard
decisions. Profile fields, NIP-05 strings, links, tag counts, text matches, and
graph proximity remained attributed evidence rather than trust scores.

The synthetic corpus supports no population-level finding. The failed live
attempt shows only sandbox DNS unavailability, not relay quality. A headline
without a source and a warning against generalization were useful because
their exact wording and attribution stayed inspectable.

## JavaScript need, missing capability, and verdict

No arbitrary JavaScript was needed. `pick`, moves, relation filtering, `scan`,
tag explosion, aggregation, sorting, continuation, notebook queries, and named
handles covered both investigations.

No new research primitive is justified by this evidence. The observed gaps
were narrow contract defects: acquisition result typing, the `subjects`
umbrella validation rule, and archive schema field names. One ergonomic
limitation remains: a hydration report cannot itself be scoped by `select`;
relating the original account handle after hydration resolves its profiles.
That composition worked and does not justify a duplicate profile-selection
operation.

## Post-trial cleanup audit

The package source, exports, executable commands, functional tests, and active
documentation were inspected after the trials. The live path is singular:
`operations.js` defines operation semantics; `plan.js` normalizes, preflights,
and executes them; `interpreter.js` owns the only declarative session;
`jsonl-session.js` and the executable are adapters over that session.
Collection, relation, continuation, acquisition, presentation, and pipeline
source modules are the deep implementations referenced by that path, not
alternate session or operation models.

No superseded command, export, test suite, or source module remained that
could be removed without deleting a supported public operation. The cleanup
therefore removed the disposable trial transport and task-era narrative from
active context, corrected the three exposed contract/schema defects, and
aligned `CONTEXT.md`, both READMEs, and `workflow/ROADMAP.md`. Historical task
and run records were left untouched as required.

Verdict: the simplified system supports sustained sequential research through
one persistent executable, with visible evidence loss and no JavaScript escape
hatch. The trials found no need for another session model, duplicate operation
path, or topic-specific operation.
