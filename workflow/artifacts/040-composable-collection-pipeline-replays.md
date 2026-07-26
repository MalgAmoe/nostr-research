# Declarative replay of two field-trial reductions

Executed on 2026-07-26 through `createDeclarativeResearchSession` against a
disposable in-memory corpus. The fixture contained four technology notes: two
ordinary notes by one author, one note linking the exact campaign domain from
Trial 3, and one note carrying both `solana` and `freelance` tags. It also
contained two travel and two photography notes whose author sets were
deliberately `{A, B}` and `{B, C}`. All evidence was observed at
`wss://fixture.example/`; no relay was contacted during either reduction.

## Campaign exclusion, stable ordering, and bounded author sample

This replays Trial 3's handwritten Boolean exclusion and subsequent bounded
author extraction. After a declarative `select` installed `initial-notes`, the
session executed:

```json
{"commandId":"exclude-campaign","command":"filter","input":"initial-notes","parameters":{"where":{"not":{"any":[{"field":"event.linkedDomain","equals":"column-secretary-acne-arbor.trycloudflare.com"},{"all":[{"field":"event.tag","name":"t","value":"solana"},{"field":"event.tag","name":"t","value":"freelance"}]}]}},"limit":500},"resultId":"refined-notes"}
{"commandId":"stable-notes","command":"sort","input":"refined-notes","parameters":{"by":"event.createdAt","direction":"descending"},"resultId":"stable-notes"}
{"commandId":"authors","command":"move","input":"stable-notes","parameters":{"to":"authors","limit":100},"resultId":"authors"}
{"commandId":"sample-authors","command":"sample","input":"authors","parameters":{"seed":"campaign-review-1","limit":1},"resultId":"author-sample"}
{"commandId":"show-refined","command":"show","input":"refined-notes","parameters":{"previewLimit":5}}
{"commandId":"show-sample","command":"show","input":"author-sample","parameters":{"previewLimit":5}}
```

Observed results:

```json
{"commandId":"show-refined","ok":true,"count":2,"createdAt":[1,4],"omitted":0,"cardinality":{"inputCount":4,"outputCount":2,"omittedCount":2,"truncated":true},"provenance":{"observations":2,"relays":["wss://fixture.example/"]}}
{"commandId":"show-sample","ok":true,"count":1,"omitted":0,"moveCardinality":{"inputCount":2,"outputCount":1,"omittedCount":1,"truncated":true},"sampleCardinality":{"inputCount":1,"outputCount":1,"omittedCount":0,"truncated":false},"provenance":{"observations":2,"relays":["wss://fixture.example/"]}}
```

The filter removed exactly the domain match and the two-tag conjunction. The
two retained events appeared oldest-first in the filtered observation and the
recorded sort stage deterministically reversed them before author extraction.
The move's omission is identity deduplication: two notes produced one author.

## Compare overlapping travel and photography neighborhoods

After declarative `select` and `move` commands installed compatible named
account results `travel-accounts` and `photo-accounts`, the session executed:

```json
{"commandId":"overlap","command":"intersection","input":"travel-accounts","parameters":{"with":"photo-accounts","limit":100},"resultId":"shared-accounts"}
{"commandId":"comparison","command":"compare","input":"travel-accounts","parameters":{"with":"photo-accounts","limit":100},"resultId":"neighborhood-comparison"}
{"commandId":"show-overlap","command":"show","input":"shared-accounts","parameters":{"previewLimit":5}}
{"commandId":"show-comparison","command":"show","input":"neighborhood-comparison","parameters":{"previewLimit":5}}
```

Observed results:

```json
{"commandId":"show-overlap","ok":true,"count":1,"omitted":0,"cardinality":{"inputCount":1,"outputCount":1,"omittedCount":0,"truncated":false,"leftCount":2,"rightCount":2},"provenance":{"observations":2,"relays":["wss://fixture.example/"]}}
{"commandId":"show-comparison","ok":true,"count":1,"values":{"left":2,"right":2,"shared":1,"leftOnly":1,"rightOnly":1},"omitted":0,"cardinality":{"leftCount":2,"rightCount":2,"outputCount":1,"omittedCount":0,"truncated":false},"provenance":{"observations":4,"relays":["wss://fixture.example/"]}}
```

The intersection preserved the shared stable account subject and merged its
reasons and provenance. The comparison reproduced the handwritten ID-set
reduction without returning the prior oversized detailed comparison value.
