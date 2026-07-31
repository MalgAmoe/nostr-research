# Nostrarium Atlas

Status: **disposable live-only content exploration experiment**.

Atlas tests a direct research journey:

> Acquire a bounded field, open one observed note locally, inspect its author,
> explicitly request profile claims, and explicitly acquire that account's
> authored notes as another navigable field.

Atlas contains no bundled notes, accounts, images, videos, or sample field. It
uses only public controller/session commands and does not expose a generic
command builder.

## Run

```sh
npm run dev --workspace @nostrarium/atlas
npm test --workspace @nostrarium/atlas
npm run test:browser --workspace @nostrarium/atlas
npm run build --workspace @nostrarium/atlas
```

## Relay field journey

1. Choose visible relay URLs and bounded NIP-01 filters in the left sidebar.
   Experimental NIP-50 text search requires exactly one relay and Atlas displays
   its returned identities newest-first rather than claiming relevance order.
2. `Search and update buffer` sends an explicit bounded acquisition/selection
   plan. Review the outcome, then explicitly display its first page.
3. Every installed field retains its ordinary engine result-handle identifier,
   paging position, bounds, relay selection, and minimal UI merge state. Opening
   another field does not replace that operational reference. Back, Forward, and
   Trail restore the corresponding field and its remaining local buffer pages.
4. `Load more from buffer` is a local `show` operation. Structured query fields
   can explicitly request newer or older bounded acquisitions. NIP-50 fields are
   refreshed with another explicit one-relay search.

The header filter remains strictly local to the displayed field.

## Note → account → authored notes

### Open a note: local observation

Selecting a note is immediate. Atlas then uses the installed field's retained
handle with ordinary local `filter`, `move`, `relate`, `inspect`, and `show`
commands. This does **not** contact a relay.

The inspector reports only response-provided facts:

- resident/resolved/unresolved state and resolution source;
- content as complete only when its returned projection is shorter than the
  requested 1,000-character observation bound; a response reaching that bound
  is labelled potentially truncated, and absent canonical evidence is labelled
  unavailable;
- canonical event tags plus their explicit omission count;
- engine-derived event role, conversation role, and referenced event/account/
  address subjects;
- normalized attachments and attachment omissions;
- observed relay provenance, freshness/corpus facts, and cardinality bounds only
  when the response includes them.

The local event and author handles are ordinary named session results. Atlas
stores their identifiers only so subsequent actions can continue through public
operations; it does not copy the engine's evidence model.

### Request profile: explicit external hydration

Opening the account remains local. Atlas shows the exact currently selected
relay URLs and fixed request bounds. `Request profile` explicitly runs public
`hydrate` for kind 0 events from those relays. No profile request occurs on
selection or hover.

Returned profile fields are displayed as relay-observed claims. The inspector
retains and exposes response-provided external status, completeness, resolution,
and provenance. A successful command with no resolvable profile remains
unresolved; partial relay attempts remain partial. Absence is never presented as
proof that no profile exists.

### Authored notes: explicit external continuation

`Authored notes` explicitly runs public `continue` with relationship
`authored-notes`, source `relays`, the displayed relay URLs, and the displayed
global event bound. It retains the returned ordinary event handle and reports
its external/completeness facts before navigation.

`Open … authored notes` is a separate local `show`. It contacts no relay,
installs another engine-backed Atlas field, and adds that field to browser
history and the Trail. Returning to either field restores its own retained
handle and paging state.

## Media boundary

Normalized attachment facts come from local engine observation. External image
or video bytes are not requested until `Load actual image/video` is clicked.
External media can fail independently; Atlas keeps the declared URL visible.
Tag-only attachments can appear in the evidence inspector even when the compact
field card did not identify media.

## Command and evidence boundary

Relay contact occurs only after these labelled actions:

- `Search and update buffer`;
- `Check for updates`;
- `Acquire older notes`;
- `Request profile`;
- `Authored notes`.

Local selection, history, Trail, pins, field filtering, note/account observation,
`Load more from buffer`, and `Open … authored notes` perform no acquisition.
Commands and outcomes remain inspectable in Activity, but Atlas offers no raw
console, schema composer, relation workbench, or universal action catalogue.

Returned counts, EOSE, profile resolution, and relay observations never imply
relay or network completeness. Relay observations attached to event evidence
are cumulative process/session facts and may include earlier requests.

## Deliberate omissions

No automatic profile hydration, traversal, retry, query broadening, relay
substitution, capability discovery, relevance ranking, conversation UI, generic
relation UI, notebook/archive integration, write/signing support, reactions,
messaging, or shared UI package is included.

The slice required no Atlas-specific engine operation or engine shortcut. The
public field handles, local collection/relation observations, hydration, and
continuation operations were sufficient.
