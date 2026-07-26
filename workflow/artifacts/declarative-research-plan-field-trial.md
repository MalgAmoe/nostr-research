# Declarative named research plan field trial

## Outcome

Keep the small named-stage abstraction, without expanding it.

The sandboxed worker first proved complete composition against controlled
canonical events because its relay DNS was unavailable. An initial reviewer
correctly blocked the task because fixtures were not a live field trial. The
same implementation was then run from a network-enabled repository session
against:

- `wss://nos.lol/`
- `wss://relay.primal.net/`

A separate 60-event orientation buffer exposed media presence, machine
activity, and a known campaign domain. The caller chose media-bearing notes as
the direction and supplied two explicit exclusions. The engine did not infer
that judgment.

The complete live plan acquired 100 distinct recent notes, selected the
resident notes, filtered to 15 media-bearing notes, moved to ten authors,
grouped and summarized their evidence, hydrated ten profiles, and retained ten
account subjects with a caller-supplied reason.

## Complete live plan data actually executed

```json
[
  {
    "id": "orientation",
    "operation": "acquire",
    "parameters": {
      "relays": ["wss://nos.lol/", "wss://relay.primal.net/"],
      "filter": {"kinds": [1], "limit": 100},
      "timeoutMs": 12000,
      "observationLimit": 150,
      "distinctEventLimit": 100,
      "concurrency": 2
    }
  },
  {
    "id": "notes",
    "operation": "select",
    "input": "orientation",
    "parameters": {"kinds": [1], "limit": 120, "order": "newest"}
  },
  {
    "id": "media-evidence",
    "operation": "filter",
    "input": "notes",
    "parameters": {
      "as": "media notes excluding machine activity and known campaign domain",
      "where": {
        "all": [
          {"field": "event.hasMedia", "equals": true},
          {
            "not": {
              "field": "event.tag",
              "name": "is_activity",
              "value": "true"
            }
          },
          {
            "not": {
              "field": "event.linkedDomain",
              "equals": "column-secretary-acne-arbor.trycloudflare.com"
            }
          }
        ]
      },
      "limit": 30
    }
  },
  {
    "id": "media-authors",
    "operation": "move",
    "input": "media-evidence",
    "parameters": {
      "as": "authors of selected media evidence",
      "to": "authors",
      "limit": 10
    }
  },
  {
    "id": "author-groups",
    "operation": "group",
    "input": "media-evidence",
    "parameters": {
      "as": "selected media evidence by author",
      "by": "event.author",
      "itemLimit": 3,
      "limit": 10
    }
  },
  {
    "id": "author-summary",
    "operation": "summarize",
    "input": "author-groups",
    "parameters": {
      "as": "bounded author evidence summary",
      "limit": 10,
      "aggregations": [
        {"name": "noteCount", "operation": "count"},
        {"name": "examples", "operation": "sample", "field": "subject", "limit": 2},
        {"name": "domains", "operation": "collect", "field": "event.linkedDomain", "limit": 4},
        {"name": "newest", "operation": "max", "field": "event.createdAt"}
      ]
    }
  },
  {
    "id": "profiles",
    "operation": "hydrate",
    "input": "media-authors",
    "parameters": {
      "relays": ["wss://nos.lol/", "wss://relay.primal.net/"],
      "kinds": [0],
      "timeoutMs": 12000,
      "observationLimit": 20,
      "distinctEventLimit": 10,
      "concurrency": 2
    }
  },
  {
    "id": "retained",
    "operation": "retain",
    "input": "media-authors",
    "parameters": {
      "name": "Live trial — media trail accounts",
      "options": {
        "reason": {
          "type": "caller-judgment",
          "note": "Caller chose media presence from random-buffer facets and excluded machine activity plus one known campaign domain."
        }
      }
    }
  }
]
```

## Budgets, eviction, and stage results

The live acquisition completed by reaching its 100-distinct-event budget.
Hydration completed by reaching its ten-distinct-event budget. The capacity-120
corpus finished with 110 events and no eviction:

- event count: 110
- remaining capacity: 10
- authors: 78
- kinds: 2
- outbound/inbound relationships: 352 each

| Stage | Result kind | Count or outcome |
| --- | --- | --- |
| `orientation` | `acquisition-report` | 100 distinct; budget reached |
| `notes` | `events` | 100 |
| `media-evidence` | `events` | 15 |
| `media-authors` | `accounts` | 10 |
| `author-groups` | `groups` | 10 |
| `author-summary` | `summaries` | 10 |
| `profiles` | `hydration-report` | 10 distinct; budget reached |
| `retained` | `retained-selection` | 10 accounts, 22 reasons |

Every summary retained event reasons and relay provenance. The retained set
preserved ten account IDs plus movement and caller-judgment reasons.

The hydrated profiles were:

- Antônio Marcos
- djmeistro
- V2Bot Agent
- itsme_Mary
- Live on Shosho
- Shiza khan
- Abang Tan
- Chucha
- epicfailMF
- Zulfiqar Ali M

This list is evidence of correct navigation, not a claim that these profiles
form a valuable group. In fact, it confirms that media presence alone is a
weak direction. The user or agent must inspect the evidence and choose the next
refinement.

## User/agent judgment supplied as parameters

The caller supplied:

- media presence as the positive signal;
- the `is_activity=true` exclusion;
- the known campaign-domain exclusion;
- author grouping and limits;
- relay, timing, observation, distinct-event, and corpus budgets;
- the retained name and reason.

The engine supplied no spam, person/project, credibility, interest, or quality
classification.

## JavaScript still required outside the plan

The following is the complete JavaScript used outside the plan. It was run
from `packages/nostr-research`. The exact plan-construction statement was
`const plan = ` followed by the complete JSON array in **Complete live plan
data actually executed** above and a final semicolon. That array is not
duplicated here, so there is only one authoritative transcription of the plan.

```js
import {
  acquireRelayEvents,
  createInMemoryResearchMemory,
  executeResearchPlan,
} from './src/index.js';
import { createResearchEnvironment } from './src/console.js';

const relays = ['wss://nos.lol/', 'wss://relay.primal.net/'];

// A disposable, bounded orientation buffer. This was closed before the plan
// run, so none of its evidence was carried into the field-trial corpus.
const orientationMemory = createInMemoryResearchMemory({ capacity: 60 });
const orientationEnvironment = createResearchEnvironment(orientationMemory);
const orientationAcquisition = await acquireRelayEvents(orientationMemory, {
  relays,
  filter: { kinds: [1], limit: 60 },
  timeoutMs: 12_000,
  observationLimit: 90,
  distinctEventLimit: 60,
  concurrency: 2,
});
const orientationNotes = orientationMemory.select({
  kinds: [1],
  limit: 60,
  order: 'newest',
});
const orientationFacets =
  orientationEnvironment.research.facets(orientationNotes);
console.dir({
  acquisition: {
    completionReason: orientationAcquisition.completionReason,
    counts: orientationAcquisition.counts,
    additions: orientationAcquisition.additions,
    corpusAfter: orientationAcquisition.corpusAfter,
  },
  facets: orientationFacets,
}, { depth: null });
orientationEnvironment.close();

// Human/agent inspection of that output supplied the positive media
// predicate, is_activity exclusion, campaign-domain exclusion, limits, name,
// and retention reason in the exact plan declaration described above.
const memory = createInMemoryResearchMemory({ capacity: 120 });
const report = await executeResearchPlan(memory, plan);

const conciseStages = report.stages.map((stage) => {
  if (stage.resultKind === 'acquisition-report'
      || stage.resultKind === 'hydration-report') {
    return {
      id: stage.id,
      resultKind: stage.resultKind,
      completionReason: stage.result.completionReason,
      counts: stage.result.counts,
    };
  }
  if (stage.resultKind === 'retained-selection') {
    return {
      id: stage.id,
      resultKind: stage.resultKind,
      subjectCount: stage.result.members.length,
      reasonCount: stage.result.members.reduce(
        (count, member) => count + member.reasons.length,
        0,
      ),
    };
  }
  return {
    id: stage.id,
    resultKind: stage.resultKind,
    count: stage.result.items.length,
  };
});

const authorStage = report.stages.find(({ id }) => id === 'media-authors');
const publicKeys = authorStage.result.items.map(({ subject }) => subject.id);
const hydratedProfiles = memory.searchAccounts({
  publicKeys,
  limit: publicKeys.length,
}).results.map(({ publicKey, profile }) => ({
  publicKey,
  name: profile.display_name ?? profile.name ?? null,
}));

console.dir({
  plan: report.plan,
  corpus: memory.describe(),
  stages: conciseStages,
  hydratedProfiles,
}, { depth: null });
memory.close();
```

The pause between orientation and plan construction is intentional. The
evidence does not justify automatic choice, branching syntax, or executable
callbacks.

## Failed or awkward operations

- The worker sandbox could not resolve public relay DNS. The first controlled
  report was useful functional evidence but correctly failed the live-trial
  acceptance criterion.
- The first live plan reached retention, then failed because `options.reason`
  was supplied as a string. Plan normalization accepted it while retention
  requires a reason object. The corrected plan used `{type, note}`. Plan
  validation now rejects the wrong shape before performing external stages.
- The first reporting projection called the console-only `accounts()` helper
  on memory. The library form is
  `memory.asCollection(memory.searchAccounts(query))`. This does not affect
  plan execution, but shows an unnecessary difference between console and
  library access.
- `select` names acquisition as an ordering dependency but selects from the
  authoritative resident corpus, not only the acquisition report.
- Hydration returns a report, so later retention correctly reuses the earlier
  account stage rather than the hydration output.
- The trial needed a separate summary branch and account-move branch from the
  filtered evidence. Reusing one named earlier stage handled this without a
  graph runtime.

## Recommendation

Keep the named plan and its current operations, but do not add a DSL, graph
runtime, classifier, persistence, or more algebra. The field-trial correction
is limited to validating retain reason shape before any external stage runs.
The library/console account projection difference may merit later
consideration, but does not justify expanding this task.
