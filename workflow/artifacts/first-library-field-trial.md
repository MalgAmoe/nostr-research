# First library field trial

## Outcome and research questions

This trial used retained real relay evidence in the Git-ignored database
`.data/first-research.sqlite`. I independently checked its acquisition run,
per-event observations, relay outcomes, and counts before continuing the
research through the public CLI. Claims below apply only to this bounded
sample, not to Nostr generally or to complete relay coverage.

The first question was: **Within a recent relay sample tagged `#nostr`, which
notes mention relay-related work and lead to inspectable relationships?** This
was chosen because the protocol tag supplies a reproducible starting point,
while the text refinement and relationship pivots test directed exploration.

The connected account question was: **For the author and an account referenced
by a selected note, what locally stored evidence explains their presence and
what can be preserved for continuation?** This tests whether an account clue
becomes a traceable research path even when profile metadata is absent.

## Acquisition, bounds, and outcomes

Acquisition run `8e93f2b6-d5a2-4717-a88c-30676035b5f0` was made through the
public CLI on 2026-07-25 from:

- `wss://relay.damus.io/`
- `wss://nos.lol/`
- `wss://relay.primal.net/`

Its exact recorded input was filter
`{"#t":["nostr"],"kinds":[1],"limit":50}`, operation timeout 12,000 ms,
global accepted-observation limit 75, and concurrency 4. The equivalent
significant command was:

```sh
npm run --silent research -- --db .data/first-research.sqlite acquire \
  --relay wss://relay.damus.io/ --relay wss://nos.lol/ \
  --relay wss://relay.primal.net/ \
  --filter-json '{"#t":["nostr"],"kinds":[1],"limit":50}' \
  --timeout-ms 12000 --event-limit 75 --record --output full
```

There was no `since` or `until` event-time bound in the recorded filter. The
acquisition was bounded by the per-relay limit, global observation limit, and
timeout. This omission is itself a reproducibility weakness: the observed
events happened to span 2026-07-25T06:00:05Z through
2026-07-25T11:10:12Z, but that observed range is not an acquisition time
constraint and must not be described as one.

The run stopped at the global limit. `nos.lol` and `relay.primal.net` each
reported `limit`; Damus reported `connection-failure` with the generic
WebSocket diagnostic. The retained database initially contained 63 distinct
valid kind-1 events and 75 observations: 40 observations from `nos.lol` and 35
from `relay.primal.net`. Twelve events were seen on both successful relays.
There were no kind-0 metadata events. After the trial it contains the same 63
events and 75 observations, three runs, and five sets.

## Research path 1: topic to evidence and relationships

A compact local query over kind 1 and `t=nostr` made the sample navigable:

```sh
npm run --silent research -- --db .data/first-research.sqlite \
  search --kind 1 --tag t=nostr --limit 12 --output compact
```

The compact excerpts quickly exposed both low-context material (images, terse
numeric posts) and a substantive note about Earthly. A recorded refinement for
the text `relay` produced event-query run
`0ad58212-3820-4987-b501-756ec442c3a7` and selected event
`ac62b451fc255e1bd5931894dce9e6016f80f0ee99a73dc3df0a567720855b0b`.
Its match reasons explicitly showed kind 1, `#t=nostr`, and text `relay`.

Full inspection was useful only after selection. It showed the complete note,
canonical tags, author
`3aa5817273c3b2f94f491840e0472f049d0f10009e23de63006166bca9b36ea3`,
and observations from both successful relays (observation IDs 5 and 28).
Relationship navigation then exposed two useful account pivots:

- `author`, derived from the NIP-01 `pubkey` field;
- `mentioned-account`, derived from the note's `p` tag, to
  `6b3780ef2972e73d370b84a3e51e7aa9ae34bf412938dcfbd9c5f63b221416c8`.

It also exposed topic and generic tag relationships, including `nostr`,
`Blossom`, URLs, and the client tag. The saved query set
`bd8cc654-c289-46a6-bb8c-23c04be464e1` (`relay-notes`) retained the event and
its original query reasons/provenance. Expanding it through `author` created
`154afde8-0dc1-4e44-b429-5ea03714b3ae` (`relay-authors`); expanding through
`mentioned-account` created
`63498715-c52b-44b2-94e6-1d01572874e8` (`mentioned-accounts`).

Separate CLI invocations closed and reopened the SQLite database. On reopen,
set inspection preserved the member and relationship reason. Combining the two
account sets with a union created
`a44f45a4-4dcd-4e0a-b359-ee3217ccd457` (`earthly-accounts`), with both source
sets and their distinct reasons still visible. This supplied useful next
choices without rerunning acquisition.

## Research path 2: account clues to authored and referenced evidence

Starting from the selected author's key, an IDs-only authored query returned
only the selected note:

```sh
npm run --silent research -- --db .data/first-research.sqlite \
  search --author 3aa5817273c3b2f94f491840e0472f049d0f10009e23de63006166bca9b36ea3 \
  --limit 20 --output ids
```

The same query was recorded as run
`a256cec4-717c-4706-a429-583da70b6e65` and preserved as set
`b3297e0e-ff23-4557-a890-ec83198edfd8` (`earthly-authored`). The author's
account relationship had one inbound authored event. Trying full account
resolution failed explicitly because no stored kind-0 event exists; the
account is resolved as evidenced in relationships, but has no locally known
profile. That distinction was understandable once observed, though the word
“resolved” initially suggested that profile metadata might be available.

The referenced account's inbound navigation returned the same source event
with relationship type `mentioned-account` and the exact `p` tag as evidence.
Full membership explanation for the `mentioned-accounts` set linked that
account back to the source event and source set. Thus the second path preserved
both authored evidence and referenced-account evidence without inventing an
identity or fetching an unrecorded profile.

## What the output modes enabled

- **Compact** was the best navigation view: bounded content excerpts, author,
  relay names, and match reasons were enough to choose a note. Compact set
  inspection, however, shows counts rather than member IDs, so another command
  is needed to continue from a set.
- **IDs** made the authored query directly composable and confirmed its
  one-event scope without parsing display fields.
- **NDJSON** made each relationship independently parseable. In practice it
  also emitted a subject line followed by many relationships; selecting only
  `author` and `mentioned-account` still required an external NDJSON filter or
  manual reading because relationship navigation has no type filter.
- **Full** made canonical event content, tags, observations, membership
  reasons, and combined-set lineage inspectable. It was too verbose for
  navigation, as intended.

Provenance and query match reasons were clear and traceable. Membership reasons
were especially strong: run-derived, relationship-derived, and union-derived
members retained different explanations. Search and continuation produced a
useful path. Relationship navigation produced useful account choices but also
many generic tag/URL records. Saved sets worked well as durable research
bookmarks; the compact set view was less useful for choosing the next member.

## Limitations, defects, and research-method questions

### Relay and data-quality limitations

- Damus failed while the other two relays contributed evidence. This trial
  cannot distinguish relay availability from the acquisition environment.
- The global limit ended both successful relay attempts. Counts are a sample,
  not coverage, and relay overlap cannot establish completeness.
- A broad `#nostr` sample included terse numeric posts, promotional material,
  image links, repeated timestamps, and one long substantive project update.
  Tag presence alone was a weak relevance signal.
- No profile metadata or conversational event references were present for the
  chosen note. The trial could examine authorship and account mention, but not
  an evidence-backed reply thread.

### Software behavior and usability friction

- The recorded acquisition lacked `since`/`until`; the CLI permitted a bounded
  but temporally non-reproducible sample. This was operator error enabled by
  the interface, not corrupt storage.
- Compact relationship output included many `other-tag` URL records, obscuring
  the two account pivots. There is no relationship-type filter on `related`.
- Compact saved-set inspection reports counts but not member identifiers, so
  it cannot itself drive the next command.
- `account <key>` failed clearly for missing kind-0 metadata, while
  relationships called the same account `resolved: true`. These mean
  evidence-resolved and profile-resolved respectively, but the shared term is
  misleading during research.
- Node's experimental SQLite warning appears on stderr for every CLI process.
  It did not corrupt machine-readable stdout but was noisy during composed use.

### Command failures and awkward transformations

The full account command exited non-zero with “No stored kind-0 metadata event
found,” a useful honest failure. Damus produced a structured relay failure
while the acquisition command remained successful; automation therefore must
inspect relay outcomes rather than process exit alone. NDJSON relationship
selection required manual reading because there was no built-in type filter.
The IDs output avoided a JSON transformation for the authored query, but a
shell composition would still need to remove Node's stderr warning if stderr
were being collected with stdout.

### Research-methodology questions

The sample does not show whether text search, protocol tags, or author pivots
are generally the best starting strategy. It shows only that a text refinement
rescued one useful lead from this particular noisy tag sample. A future trial
should declare an event-time window in advance and compare more than one
starting query before drawing ranking or search conclusions.

## Prioritized candidate next tasks

1. **Require or prominently confirm an explicit event-time bound for field
   acquisitions.** The retained run was otherwise bounded but lacked
   `since`/`until`, weakening reproducibility.
2. **Add relationship-type filtering to local relationship output.** The
   useful author and mentioned-account pivots were buried among many generic
   URL/tag relationships, and NDJSON still needed external filtering.
3. **Make compact set inspection list bounded member IDs and types.** Counts
   verified persistence but did not provide a direct continuation choice.
4. **Distinguish evidence-resolved accounts from profile-resolved accounts in
   terminology/output.** The author was `resolved: true` yet account inspection
   correctly failed for missing metadata.
5. **Offer an explicit metadata-acquisition continuation from an account
   clue.** The second path reached a real author/reference but could not
   inspect identity metadata; such a command should remain bounded and record
   its own acquisition provenance.

## What not to build yet

Do not build ranking, recommendations, trust scores, moderation policy, relay
health scoring, automatic fallback relays, or a relationship visualization
from this sample. Do not infer reply-thread UX requirements when the selected
evidence had no stored event references. Rich UI workflows, broad pagination,
portability, and automatic identity claims should remain unimplemented until
repeated field trials show that they solve observed research needs. The
current evidence supports clearer bounds, narrower navigation, and more
precise account state—not a new product architecture.
