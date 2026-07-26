CHANGES_REQUIRED

1. Scoped selection applies the query and `limit` to the whole corpus before filtering to the acquisition buffer (`src/plan.js:202-225`). This can omit matching buffer subjects when unrelated corpus events consume the limit, and prefix resolution can become ambiguous because of out-of-scope events. Selection must be evaluated within the scoped subjects.

2. The default acquisition envelope does not explicitly report duplicate observations or successful relay-level completeness (`src/interpreter.js:479-541`). It only exposes accepted observations, distinct events, and unsuccessful relays. Add bounded duplicate and relay outcome/completeness summaries as required.