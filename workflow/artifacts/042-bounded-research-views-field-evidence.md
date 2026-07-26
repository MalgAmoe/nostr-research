# Bounded research views: coherent live field evidence

This task validation was run on 2026-07-26 through the public declarative
session against one process-local corpus. It is bounded field evidence, not a
permanent network test or a claim that the sampled relays represent Nostr.
The executable trial is preserved at:

`workflow/runs/042-bounded-research-views/outer-field-trial.mjs`

## One coherent noisy buffer

The session acquired recent kind-1 events from `wss://nos.lol/` and
`wss://relay.damus.io/` with:

```text
capacity                 30 resident events
observation limit        50
distinct-event limit     40
relay count              2
```

The accepted run returned:

```text
acquisition subjects     40
resident working buffer  30
observations             48
duplicate observations    8
evictions                10
relay outcomes            1 EOSE, 1 distinct-event-budget
external status           partial, explicitly bounded
```

All projections and subsequent decisions below used this same corpus and
working buffer.

## Actual views and decisions

### Orientation

The bounded orientation showed 30 resident events, a five-item preview, 25
omitted subjects, 31 observations, two source relays, full corpus pressure,
and ten evictions. Facets exposed 27 distinct authors, tags, linked domains,
media presence, and freshness.

Decision enabled: do not inspect the 30 notes linearly. Use a low-frequency
topic as a provisional direction and keep corpus pressure visible before
acquiring more.

### Account evidence

Moving the same buffer to authors produced 27 account subjects with a
five-account preview and 22 omissions. No profile metadata was resident.
However, the live trial exposed a presentation defect: orientation called
these accounts nonresident and showed empty facets even though their
membership reasons and provenance came from the authored notes.

Decision enabled: hydrate a bounded subset rather than treating missing
profiles as missing account evidence. The account view must expose the
existing authored-note reasons/provenance to make that distinction explicit.

### Topic and long tail

Top tags included `bitcoin` with count 5. The deterministic long tail exposed
one-count topics including `seed`, `nostr`, and `moscowtime`; these would have
been hidden by a top-only display. The trial chose `seed`, yielding one
resident note whose evidence also carried `bip39` and `bitcoin`.

Decision enabled: inspect and hydrate the one seed-topic author, then expand
through adjacent `bip39`/`bitcoin` evidence. This is a researcher decision,
not an inferred quality score.

### Compatible-result comparison

The declarative comparison between the 30-event working buffer and the
one-event `seed` result reported:

```text
left       30
right       1
shared      1
left-only  29
right-only  0
```

Decision enabled: the topic stage selected a true subset rather than changing
identity or introducing outside subjects; keep the small result as a working
direction while leaving the original handle available for comparison.

### Conversation

A visible note was continued through `conversation` with strict relay,
observation, distinct-event, depth, and event bounds. The result contained two
subjects: the resident seed and a nonresident referenced parent. Its preview
correctly exposed `reply-root`; one relay reached EOSE while the other failed,
and partiality was machine-readable.

The live trial exposed a presentation defect: the orientation conversation
summary reported zero relationships even though the member reason summary
reported `reply-root`.

Decision enabled: inspect or reacquire the unresolved parent from another
relay before interpreting the conversation. The conversation orientation must
derive its counts from the same membership reasons/provenance already used by
the preview.

### Corpus and eviction

The corpus view reported capacity 30, resident events 30, pressure 1.0, ten
evictions, and zero remaining capacity. The acquisition handle originally
contained 40 stable subjects while the current working buffer contained the
30 surviving resident events.

Decision enabled: retain the chosen subject identities and reasons before
another continuation, while remembering that retention does not preserve
evicted canonical evidence.

## Result of the field validation and correction

Orientation, topic/long-tail, comparison, and corpus views directly enabled
bounded navigation decisions on one live noisy buffer. The trial also
identified two concrete presentation defects:

1. account orientation did not distinguish missing profile evidence from the
   authored-note reasons/provenance that produced the account;
2. conversation orientation did not count relationship evidence present in
   member reasons when collection-level relationship context was absent.

The subsequent correction remains a presentation over the same result
vocabulary. Account orientation now reports subjects with membership evidence,
reason/provenance counts, bounded reason types, and collection-provenance
freshness separately from canonical residency. Conversation orientation uses
collection relationship edges when present and otherwise projects relationship
reasons from members. A public functional scenario exercises both corrected
contracts, including a reason-only `reply-root` collection.

No model-generated classification or universal quality rule was used.
