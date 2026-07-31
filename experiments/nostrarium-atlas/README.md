# Nostrarium Atlas

Status: **disposable browser interaction experiment implementing the first two Place/Ground/Branch slices and a provisional action/resolver boundary**.

Atlas proves bounded navigator-controlled reading and traversal above the neutral controller:

```text
explicit relay acquisition → rich readable Ground notes → exact subject selection
→ typed local relationship branch / editable relay relationship draft
→ returned event branch → explicit attributed author resolution
→ return to retained places with projection, selection, facets, constraints, and media state intact
```

It contains no bundled field, universal command surface, notebook/archive model, relay scoring, persistence, or Atlas-specific engine operation.

## Provisional action boundary

Atlas is incrementally testing one predictable UI path:

```text
component gesture → typed stateless navigator action → narrow resolver intent
→ ordinary controller commands → one explicit store commit
```

Initial acquisition, place navigation and view state, media authorization,
local note/account observation, local handle paging, account projection,
account-frequency derivation, and local account-note branching use this path.
The actions do not own research
state, recommend a route, dispatch by generic event name, or hide the emitted
engine commands. Resolvers alone construct and execute the migrated command
sequences; the Atlas store remains the single owner of current UI and research
state while its `research` view aliases the existing field, note, and account
maps rather than copying them.

Profile/authored-note work, relay continuations, and author resolution remain
on the older direct path. They are kept visibly transitional rather than
wrapped behind a second abstraction. Further migration should happen one
coherent action family at a time only when the boundary continues to make the
interface easier to reason about.

## Run

```sh
npm run dev --workspace @nostrarium/atlas
npm test --workspace @nostrarium/atlas
npm run test:browser --workspace @nostrarium/atlas
npm run build --workspace @nostrarium/atlas
```

## Place boundary

A successful explicit initial acquisition installs one caller-allocated ordinary result handle as both **Ground** and current place. Running another main acquisition is visibly labelled as replacing Ground; the former Ground remains a branch reference. Atlas never executes a command with `replace: true` for a place-owned handle.

Each place retains:

- a UI place ID and immutable engine handle ID;
- the handle installation revision;
- Ground or branch role;
- origin command and controller receipt;
- navigator-visible reason;
- result kind and counting unit;
- projection and visible local text constraint;
- local handle-page offset;
- selected note or account and selected account facet;
- bounded command/response observation snapshots attributed to their source handle and observed revision;
- displayed bounds, attempt status, warnings, partiality, and unresolved evidence;
- dedicated selected-note relationship and selected-account research state when requested;
- per-resource explicit media authorization/failure state; and
- the place-scoped Resolve authors draft and attributed outcome.

The global note/account maps are bounded presentation caches built from public responses. They are not treated as canonical evidence. Exact evidence claims in the inspector come from retained attributed observation snapshots.

Back, Forward, Ground, and branch activation restore the place’s own projection, local constraint, page offset, selection, facet, and last observations. Removing a branch removes only its UI reference. Atlas exposes no handle-release control in this slice and does not issue `release` while removing a place.

## Place projections

Every event place starts as a readable Stream and can switch to Gallery without an engine command. **Accounts** is an explicit local transformation: Atlas runs public `move` to authors, retains the supporting never-replaced account handle and installation revision, and observes a bounded preview and summary. Its human-readable account list retains command, receipt, counting unit, bounds, omissions, and selection state with the source place. Returning to that place restores the account projection. The transformation contacts no relay and does not replace the place’s event handle.

## Account-frequency facet

Ground exposes one optional explicit local derivation:

```text
Ground events
→ relate
→ aggregate event.author as account with noteCount
→ observe aggregate bounds
→ sort noteCount descending
→ bounded preview, summary, and schema observations
```

The displayed facet lives in the left **Context and controls** surface rather than the central place projection. It retains its source Ground place and handle, every deriving command, relation handle IDs, row counting unit, schema lineage, cardinality bounds, truncation, response-provided omissions, selection, and both doors when the navigator returns to that place. Counts describe only bounded Ground rows; Atlas does not present them as popularity, quality, activity, humanity, or network-wide frequency.

Each account row has two equally explicit doors:

- **Local · Notes here by this account** filters the retained Ground relation on `event.author`, extracts `subject.id` as events, installs the resulting never-replaced handle as a branch, and makes it current. It contacts no relay and leaves Ground unchanged.
- **Draft · Research this account on relays** replaces the independent main acquisition draft with fresh defaults plus `authors:[pubkey]` and `kinds:[1]`. It clears old text, event, tag, time-window, and other hidden constraints, foregrounds visible relays and bounds, executes nothing, and does not move.

## Rich notes and external resources

Stream and Gallery turn already-returned bounded content into readable multiline text with safe `http(s)` links, visible hashtags, and visible `nostr:` references. They do not rewrite canonical events or classify URLs themselves. Once explicit local note observation returns public normalized attachment facts, both projections retain their URL, media family, MIME declarations, classification, sources, dimensions, duration, hashes, fallbacks, and omission counts when supplied.

Every image, video, audio, unknown file, and relay-observed profile-picture claim begins as a factual placeholder. Atlas inserts no external media element before the navigator authorizes that exact URL. Loading one resource does not authorize another, never changes place, and leaves a failed load visible with its URL and metadata. Place-local resource state survives projection changes and backtracking.

## Selection and observations

Selecting a note or account changes only the selected-subject surface of the current place. It does not create history, move place, change projection or paging, alter facets, or rewrite any acquisition draft.

The selection gesture authorizes disclosed bounded local commands immediately. Atlas retains their commands, controller receipts, bounded responses, source handle, and observed revision. Note observation uses ordinary `filter`, `move`, `relate`, `inspect`, and `show` operations. Account selection retains an ordinary account handle through either the facet relation or a known event-author relationship. These operations contact no relay.

The note inspector labels unresolved, omitted, and bound-sized material honestly. Public content and tags remain bounded; Atlas makes no raw canonical JSON promise. Acquisition preserves the configured direct-content-warning exclusion, but Atlas makes no reliable per-event warning claim.

## Typed note doors

After bounded local note observation retains an exact event handle, Atlas exposes the public continuation routes for parent/ancestors, replies, quotes, mentions, and referenced events. Each route shows separate, equally weighted controls:

- **Open bounded local branch** executes ordinary `continue` with `source:"local"`, a visible relationship and event limit. It contacts no relay, installs the returned never-replaced event handle, and opens it even when resident memory returns zero.
- **Prepare relay draft** executes nothing. It opens a dedicated editable draft containing the exact relationship, relay targets, event limit, timeout, observation limit, distinct-event limit, concurrency, and warning exclusion. Confirmation executes ordinary `continue` with `source:"relays"`; success installs and opens the returned event handle, including bounded empty results.

Already-observed referenced events, mentioned/referenced accounts, and referenced addresses remain typed exact-subject controls. Choosing one changes only current-place selection; unresolved stable identifiers stay visible. The author control selects the exact public key locally. The move/continue commands, supporting handles, counts, bounds, completeness, failures, and source distinction remain disclosed. Atlas neither recommends nor automatically combines routes.

## Explicit account relay actions

Profile and authored-note actions do not read the independent main acquisition draft. Each selected account receives two dedicated drafts prefilled from the producing place’s relay set and operation-appropriate bounds. Relay URLs, timeout, observation limit, distinct-event limit, concurrency, warning exclusion, and authored event limit are visible and editable before execution.

- **Profile hydration** executes public `hydrate` as an enrichment door. Its supporting event handle, external outcome, completeness, account inspection, claims, provenance, and resolution remain attached to the selected account in the source place. It never changes place. When claims resolve, the selected-account header prefers the relay-observed `display_name`/`name`, shows the attributed `about` claim, and exposes any picture claim with a separate explicit image-load action. The public key remains visible. Not-requested, loading, unresolved, and failed states keep distinct fallback wording and never become canonical identity claims.
- **Authored notes** executes public relay-backed `continue`. On success, its ordinary event handle is installed immediately as a branch and made current, including when its bounded preview is empty. Ground remains unchanged.

No profile or authored request runs on selection, hover, branch return, or draft preparation. Atlas performs no automatic retry, relay substitution, query broadening, or hydration.

Successful explicit profile observations also populate a process-local, attributed presentation cache. Notes, account lists, facets, and account headers may reuse the relay-observed `display_name`/`name` and picture claim across retained places while keeping public-key access and attribution. This cache is not canonical evidence and never changes event or account identity.

A separate **Resolve authors in this place** control first prepares an editable bounded draft. Confirmation runs public `move(to:"authors")`, observes that bounded account handle, and runs public `hydrate(kinds:[0])`. It retains both supporting handles, every command, relay and bound, external completeness, and per-author inspection accounting. Resolved, unresolved, partial, empty, and failed outcomes remain distinct. It never runs on acquisition, selection, scrolling, paging, or branch activation and never changes place.

## Paging and status

`Load more from this handle` pages the current immutable handle locally and updates only that place’s page offset and attributed observation snapshot. The former mutable newer/older merge behavior is deliberately absent because changing a place’s handle would violate place identity.

The compact conditions bar shows current role/counting unit, producing relay-target count, latest external status, excluded-warning count, and partiality/boundary wording. Full memory pressure and catalogue-staleness instrumentation remain outside this slice.

## Real-relay trials — 2026-07-31

First-slice headless Chromium voyages against `wss://nos.lol` used a five-event, one-hour Ground acquisition:

- the acquisition installed one Ground/current place and displayed five notes;
- local account-list projection and account-frequency derivation produced bounded account rows with no relay contact;
- selecting a facet account created no place and produced two independent editable external drafts;
- relay-research preparation produced a fresh 64-character author constraint with no retained text search;
- the local account-note door opened a branch while Ground retained its Gallery projection, `local` text constraint, selected account, selected facet, and observation snapshots;
- profile hydration returned attributed profile claims in the final voyage, retained its supporting handle, and left the place count and current place unchanged; a separate run completed honestly as **unresolved**;
- authored-note acquisition created and opened another branch;
- returning to Ground restored its projection, constraint, and selected account; and
- no browser console or page errors were observed.

The observed Ground attempt was partial in one run and is displayed as such. The separately unresolved profile was not presented as evidence that no profile exists. Relay and network completeness are never inferred from either successful voyage.

Second-slice voyages used 20- and 50-event bounded Ground acquisitions:

- media-bearing content remained readable as safe links while zero image/video/audio elements had an external `src` before observation;
- two explicit local note observations exposed public normalized attachment placeholders; authorizing one resource left the other note’s resource a placeholder with no external media element;
- the individually authorized resource loaded or retained a visible failure without changing place or losing state after a local branch and Back;
- exact author selection changed neither external status nor history and retained public-key access;
- all five supported typed event relationships were visible with separate local and relay actions;
- local replies installed a distinct never-replaced branch with a valid resident-memory zero and no relay contact;
- an editable relay replies draft with event limit `5` installed a second distinct branch with a bounded empty result while retaining the earlier local attempt and handle;
- Back restored the Ground note selection and authorized resource state;
- explicit five-author resolution retained separate author/profile handles and reported **4 resolved, 1 unresolved, 0 failed, partial**; four Ground note cards then displayed attributed relay-observed profile names; and
- no browser console or page errors were observed.

## Deliberate omissions

No automatic background acquisition, update polling, hydration or traversal, retry, relay substitution, capability discovery, recommendation, relevance ranking, other facet families, relay places, generic conversation or relation workbench, raw console, schema composer, notebook/archive mutation, persistence, signing, messaging, or shared experiment framework is included.
