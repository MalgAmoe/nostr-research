# Consolidated navigation field trial

Date: 2026-07-27

## Verdict

The consolidated handle path completed against public relays in the outer
workflow environment. The restricted worker first received connection
failures from four relays; repeating the same executable with public WebSocket
access acquired evidence and completed the named-handle sequence.

No dynamic JavaScript was used. No event ID or account public key was manually
copied to perform a research operation. After the intended long-tail choice,
every research command below consumes a named handle.

## Real executable and live trial

The process was the package executable, not an in-process substitute:

```sh
node packages/nostr-research/bin/nostr-research-session.js --capacity 300
```

Orientation:

```jsonl
{"commandId":"orientation","command":"acquire","parameters":{"relays":["wss://relay.damus.io","wss://relay.primal.net","wss://nos.lol"],"filter":{"kinds":[1],"limit":80},"timeoutMs":12000,"observationLimit":120,"distinctEventLimit":80,"concurrency":3},"resultId":"orientation"}
{"commandId":"choose-topic-2","command":"filter","input":"orientation","parameters":{"where":{"field":"event.text","contains":"Zcash"},"limit":8},"resultId":"topic-notes"}
{"commandId":"topic-account-2","command":"move","input":"topic-notes","parameters":{"to":"authors","limit":1},"resultId":"topic-account"}
```

Bounded results: orientation acquired 80 distinct events from 119 observations
and stopped at the distinct-event budget. Its facets exposed `Zcash` as a
one-event long-tail tag. Filtering the human-selected term produced one event;
moving to authors produced one account.

Continuation:

```jsonl
{"commandId":"authored","command":"continue","input":"topic-account","parameters":{"relationship":"authored-notes","source":"relays","relays":["wss://relay.damus.io","wss://relay.primal.net","wss://nos.lol"],"eventLimit":20,"timeoutMs":12000,"observationLimit":30,"distinctEventLimit":20,"concurrency":3},"resultId":"authored-notes"}
{"commandId":"referenced","command":"move","input":"authored-notes","parameters":{"to":"referencedAccounts","limit":12},"resultId":"referenced-accounts"}
{"commandId":"hydrate-neighbors","command":"hydrate","input":"referenced-accounts","parameters":{"relays":["wss://relay.damus.io","wss://relay.primal.net","wss://nos.lol"],"kinds":[0,3],"timeoutMs":12000,"observationLimit":24,"distinctEventLimit":24,"concurrency":3},"resultId":"hydrated-neighbors"}
{"commandId":"followed","command":"continue","input":"topic-account","parameters":{"relationship":"followed-accounts","source":"relays","relays":["wss://relay.damus.io","wss://relay.primal.net","wss://nos.lol"],"eventLimit":20,"timeoutMs":12000,"observationLimit":24,"distinctEventLimit":20,"concurrency":3},"resultId":"followed-accounts"}
{"commandId":"hydrate-followed","command":"hydrate","input":"followed-accounts","parameters":{"relays":["wss://relay.damus.io","wss://relay.primal.net","wss://nos.lol"],"kinds":[0],"timeoutMs":12000,"observationLimit":20,"distinctEventLimit":20,"concurrency":3},"resultId":"hydrated-followed"}
```

Bounded results: authored-note continuation returned 20 events. Those notes
contained no referenced accounts, so the correctly typed neighbor account
handle and its hydration were empty. Follow continuation returned 16 accounts;
hydration resolved 13 profile events and reported 3 missing after reaching the
20-observation budget. Empty evidence did not break composition.

## Non-network functional evidence

The permanent named-handle workflow exercises the same consolidated route over
real process-local memory: account handle -> authored notes -> referenced
accounts -> bounded neighbor hydration -> followed accounts -> bounded follow
hydration. Its observed collection kinds are respectively `accounts`,
`events`, `accounts`, `events`, `accounts`, and `events`. This establishes that
handles and normalized result kinds compose, but it does not replace the
missing public-relay evidence.

## Friction

- The restricted worker could not reach public WebSocket relays. The outer
  workflow environment could, so live-network evidence must remain a field
  check rather than a permanent test.
- The first topic-filter command used the intuitive but unsupported field
  `event.content`; schema uses `event.text`. Validation rejected it without
  mutating session state, and the corrected command succeeded. Field
  discoverability is the only interface friction found in the completed path.
- The first attempt exposed an obsolete internal coercion: acquisition built
  its collection by feeding its partially constructed report back through
  generic `asCollection`. The trial now constructs an explicit event
  collection, including attempt provenance.
- Empty hydration and continuation collections need their authoritative
  output kind even when they have zero items. The collection constructor now
  accepts that kind rather than inferring the false generic `subjects` kind.
- Dynamic JavaScript needed: no.
- Manual stable-ID extraction or copying needed: no.
- Unresolved requirement: none for this milestone.
