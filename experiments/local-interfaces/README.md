# Local interface experiments

Two support interfaces turn a result handle into a local research vocabulary
without reducing the underlying engine. They remain because the overlapping
cockpits use them, not as independent product directions.

## Context palette

```js
const palette = await palettes.open(fieldResult);
palette.controls;
const authors = await palette.invoke('move:authors');
```

Schema becomes data. This is suitable for agents, terminal menus, and future
visual controls, but requires an explicit discovery round.

## Four-channel dock

```js
const field = docks.dock(fieldResult);
const authors = await field.go('authors');
const view = await authors.look('identities');
```

Only four verbs exist:

- `look` — observe;
- `go` — traverse a typed route;
- `work` — perform any operation locally;
- `escape` — submit an ordinary command draft.

`map()` exposes contextual controls when the operator needs them.

Both call the same flight console. Context is derived from factual
session schema. None recommends a route or performs a hidden workflow.
