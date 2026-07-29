# Archivist dossier 1

Date: 2026-07-29

Status: bounded one-hop context dossier completed.

## Posture

The Archivist reconstructs attributed context around one navigator-chosen
event. It does not claim complete context, establish truth, or assign trust.

The dossier boundary for this voyage was declared before expansion:

- exact focal event;
- directly referenced or quoted events;
- focal author metadata;
- direct replies found by one bounded relay attempt; and
- unresolved or deliberately unexpanded edges recorded as omissions.

Without this boundary, context expansion can recurse indefinitely.

## Boarding

A fresh random kind-1 acquisition returned 400 events from:

- `wss://nos.lol/`
- `wss://relay.primal.net/`
- `wss://relay.snort.social/`

The airlock classified the bounded field mechanically:

- 339 original notes;
- 57 replies; and
- four quotes.

The navigator inspected the four quotes and selected the first because it made
a substantive claim and explicitly referred to supporting receipts.

## Focal event

Event:

`d39173e9067bc6fc32a6dcc00b1d0e0c42e95369c4d13e553c741b0c57f5e1b0`

Author:

`77f56243a824d22573fb755dd52c73c14986d15c0c98512d45f4deb08e9f879a`

Current resolved profile name:

`BitcoinIsFuture`

The note says it mostly agrees with another analysis and alleges that
influencers are compromised by venture sponsors, naming Galaxy, Citrea, and
Epoch and saying “receipts are below.” The event contains two `q` tags:

- `4cd2a8929070942665a2c3f48ebb0934f9bf3f3ccef3f689be10db50fc7c2ae8`
- `8ec0487d24fd64f5bac1a53565368841fb4d5b1fb7c575cec15d6d29792131d9`

Both were unresolved in the initial buffer and then resolved through an
explicit bounded acquisition by exact IDs.

## Direct quoted context

### Quoted event by another author

Event:

`4cd2a8929070942665a2c3f48ebb0934f9bf3f3ccef3f689be10db50fc7c2ae8`

This note argues that many influencers are unwilling to understand a Bitcoin
proposal themselves and instead repeat propaganda. It is itself a reply in a
larger conversation and includes additional event and account references.
Those second-hop edges were recorded but not expanded under this dossier's
one-hop boundary.

### Quoted event by the focal author

Event:

`8ec0487d24fd64f5bac1a53565368841fb4d5b1fb7c575cec15d6d29792131d9`

This earlier note says the author is concerned about compromised influencers,
names several accounts, discusses BIP 110, and attaches several images. It
also contains root, reply, account, and quote references. Those are evidence
that more context exists, not evidence that the focal allegations are true.
They were not recursively expanded.

## Replies to the focal event

A bounded reply continuation queried all three configured relays:

- all three opened, subscribed, and reached EOSE;
- zero reply events were returned;
- the result was classified as an empty valid bounded attempt; and
- relay-wide exhaustiveness was not claimed.

This means no replies were observed under this attempt. It does not mean no
reply exists anywhere on Nostr.

## Bounds and operation

- Final corpus: 403 events, 40.3% pressure.
- The dossier added two quoted events and one profile event to the initial
  field.
- Live handles: eleven.
- Archive and notebook: empty; this document is the dossier artifact.
- Protocol command failures: zero.
- One attempted composer path was rejected before command construction because
  `fetch` is not compatible with the unresolved event collection. The
  navigator then used ordinary exact-ID acquisition.

## Finding

The Archivist produced a useful artifact because it declared a scope. It
recovered:

- what the focal note actually said;
- the exact events it quoted;
- who authored the focal note according to currently resolved metadata;
- which additional edges remain unexpanded; and
- the outcome and bounds of a direct-reply search.

It did not determine whether the sponsorship allegations were true, whether
the attached images proved them, or whether the participants were credible.
Those are navigator judgments requiring further research.

The important vessel convention is therefore not “collect all context.” It is:

> Declare a dossier boundary, resolve every edge inside it, and expose every
> edge or uncertainty left outside it.

No new engine operation is required.
