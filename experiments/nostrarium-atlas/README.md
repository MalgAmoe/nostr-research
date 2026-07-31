# Nostrarium Atlas

Status: **disposable live-only content exploration experiment**.

Atlas tests a direct interaction premise:

> Notes and event authors are the primary interface. Relay-producing actions
> are explicit and bounded; navigation among already-observed content is local
> and immediate.

Atlas contains no bundled notes, accounts, images, videos, or sample field.

## Run

```sh
npm run dev --workspace @nostrarium/atlas
npm test --workspace @nostrarium/atlas
npm run test:browser --workspace @nostrarium/atlas
npm run build --workspace @nostrarium/atlas
```

## Live journey

1. Atlas opens with relay sources and search controls embedded in the left
   sidebar; they are not a modal or overlay. On narrow screens this search
   section appears above the results.
2. Select nos.lol, Primal, Snort, the unverified Searchnos search preset, or
   add a valid custom `wss://` URL. Selected relay URLs remain visible even
   while the local relay-list filter is active.
3. Combine exact event ID, exact author, hashtag, time window, a 5–100 per-relay
   limit, and the direct content-warning policy. Experimental NIP-50 text search
   is a distinct one-relay mode because support and matching vary by relay.
4. Click `Search and update buffer`. This sends one visible `plan` containing
   explicit acquisition and acquisition-scoped selection stages.
5. Review the buffered identity count and acquisition facts, then click
   `Display … notes`. This sends one visible `show` command.
6. Use `Load more from buffer` to request the next explicit 20-item presentation
   page without network contact. Drain that handle before starting another relay
   acquisition so buffered identities are not abandoned.
7. For structured recent-note fields, use `Check for updates` or `Acquire older
   notes` to send a new, visibly bounded acquisition. Timestamp boundaries are
   inclusive and event identities are deduplicated. NIP-50 fields are refreshed
   by running another explicit one-relay search instead.
8. Read and locally filter notes, inspect observed event authors, switch between
   Stream and Gallery, use Back/Forward and the trail, or pin subjects. The note
   remains in the center list; the inspector instead shows event identifiers,
   exact time, query settings, relay observations, media loading, and actions.
9. Remote image/video URLs are not contacted until `Load actual image/video` is
   clicked.

The header filter remains strictly local to the displayed field. `Experimental
NIP-50 text search` is an explicit one-relay network filter. Atlas does not claim
relay capability or preserve relevance ordering: it displays returned matches
newest-first and labels that policy before acquisition.

## Experiment sources

Atlas reuses findings, not implementations:

- Evidence Desk: readable single-note/account inspection and separate evidence,
  provenance, and claim boundaries;
- Field Board and voyage-system slice: one shared focus and recoverable position,
  translated into ordinary browser history and a trail;
- controller trials: commands, bounds, outcomes, exclusions, and uncertainty
  remain visible;
- cockpit: readable Stream and Gallery views remain primary.

Atlas imports no other experiment. It uses the browser Worker and neutral
controller. The memory package passes the optional NIP-50 `search` filter to the
relay without interpreting matching semantics; Atlas then explicitly selects
and displays the bounded result newest-first.

## Boundary

Live contact occurs only after `Search and update buffer`, `Check for updates`,
or `Acquire older notes`; every selected relay URL and the request summary are
visible. Acquisition/selection and display are separate visible commands. No
display, retry, broadening, relay substitution, profile request, or follow-up is
issued automatically. `Load more from buffer` issues only an explicit paged
`show`. Clicking a note, account, view, history entry, pin, or local filter
performs no acquisition.

- Live account panels initially show only the public key observed in an event;
  profile metadata is explicitly reported as unrequested.
- Relay count is not presented as trust or quality.
- Local filtering never broadens or acquires another field.
- Returned counts and EOSE never imply relay completeness.
- Pinned state and browser history are presentation-local; they are not the
  engine notebook or archive.

## Deliberate omissions and gaps

No profile metadata acquisition, live conversation continuation, automatic
relay-capability discovery, search-result verification or relevance-order
preservation, comparison UI, raw console, schema composer, write or signing support, reactions,
messaging, or shared UI package is included.

Live media recognition currently uses direct image/video URLs visible in the
bounded content excerpt. Tag-only `imeta` attachments are unavailable in that
preview. External media can fail independently; Atlas retains and displays the
declared URL.
