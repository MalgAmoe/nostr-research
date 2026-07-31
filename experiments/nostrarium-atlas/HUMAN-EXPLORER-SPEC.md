# Atlas human explorer — replacement surface specification

Status: proposed human-facing replacement for the third-slice navigation
workspace. The Atlas action/store/resolver architecture remains unchanged.

## Why replace the current surface

The third Atlas slice succeeded as an architecture and state-coherence test. A
real voyage proved that acquisition, local views, exact selection, profile
hydration, local and relay-backed traversal, retained branches, and restoration
all use one predictable path.

It did not produce an understandable human interface. The screen asks the
navigator to learn Atlas's implementation model before learning what is in
Nostr:

- Ground, Branch, Place, Context, Field, Inspector, Lens, Door, Draft, and
  Attempt all compete for attention;
- ordinary actions are framed by execution locality and lifecycle state;
- technical honesty is repeated throughout the default surface instead of
  being available when it matters; and
- the navigator must understand how Atlas stores a journey before simply
  opening a note, an account, or related material.

The deleted Solid client had the opposite qualities. Its state and execution
paths became unreliable, but its immediate objects were understandable:
results, notes, accounts, facets, conversations, references, and more by the
author. This specification keeps that interaction model and rejects its old
implementation.

## Translation rule

The default interface speaks the navigator's language. The underlying system
continues to speak its exact language behind the boundary.

| Human surface | Existing Atlas meaning |
| --- | --- |
| Results | Current immutable Ground or branch handle |
| Open results | Retained places |
| Selected note/account | Current exact local selection |
| Related notes/accounts | Local or explicit relay-backed traversal result |
| Filters and facets | Replaceable local views over the current handle |
| Search / browse | Explicit acquisition draft and execution |
| Details / evidence | Attributed observations, provenance, bounds, commands, and responses |

This is presentation translation, not semantic concealment. A relay request
must still be explicit before it runs. Partiality and unresolved evidence must
remain visible. Exact commands and provenance remain available. They no longer
form the primary labels of the interface.

## Primary mental model

At any moment the navigator should need to understand only four things:

1. **What results am I viewing?**
2. **What note or account have I selected?**
3. **What related direction can I open?**
4. **What local filter or new relay request do I want?**

Selection does not change the result set. Opening a related set does. Back and
Forward restore prior result sets and their local state.

## Desktop surface

### Header

Keep one thin header:

- Nostrarium;
- Back and Forward;
- the current result-set label;
- one local text filter for displayed results;
- `Browse / search`;
- an unobtrusive status indicator when a relay request is running or ended
  partially.

Do not place engine revision, counting-unit vocabulary, relay count, or draft
state in the main header. Those facts belong to result information.

### Left sidebar — results and facets

The sidebar answers “what can I use to understand or narrow these results?”

**Results**

- Show the current result set and retained related result sets as a compact
  list called `Open results`.
- Use human labels such as `Recent notes`, `Replies`, or `Notes by Alice`.
- Show a simple item count.
- Keep the navigator's reason as optional secondary text.
- Removing an entry is a small local control. Handle-release semantics stay in
  an evidence disclosure rather than the row label.

**Facets**

- Show factual aggregates derived from the current results.
- The existing account-frequency facet is the first implementation: account
  identity, attributed name when known, and note count.
- Clicking a facet row selects the account; it does not immediately move or
  contact relays.
- `Show only these results` and `Search more broadly` belong to one selected
  facet's contextual controls, not every row.
- Bounds or truncation use one concise marker such as `showing 20 of at least
  34`; full lineage and commands remain under `How this was calculated`.

The sidebar should not contain author hydration controls, execution drafts, a
second history model, or general activity logs.

### Center — readable results

The center is always the dominant surface.

- Notes read like notes: attributed author when known, time, readable content,
  links, hashtags, Nostr references, and explicitly authorized media.
- Accounts read like accounts: attributed name, picture claim when authorized,
  public-key fallback, and a concise description when resolved.
- Clicking a note selects the note.
- Clicking its author selects the account.
- A small action row may expose familiar navigation: `Open note`, `Replies`,
  `References`, and `More by author`.
- Actions that can use current data should do so locally. When more relay data
  is required, the UI says `Check relays` before presenting the bounded request.
- Event ID, kind, observed relays, and provenance belong in a quiet footer or
  evidence disclosure.

Stream, Gallery, and Accounts may remain as result views, but should look like
ordinary view choices rather than transformations of an engine handle.

### Right panel — selected note or account

The panel answers “what is this, and where can I go from here?”

**Selected note**

- author, time, full readable returned content, and media;
- familiar related groups: conversation, replies, parent, quotes, mentions,
  references, and author;
- each group reports what is already known and offers `Check relays` only when
  the navigator requests more;
- exact tags, relationship interpretation, provenance, bounds, commands, and
  responses live under one `Technical evidence` disclosure.

**Selected account**

- attributed profile presentation or explicit unresolved/public-key fallback;
- `Resolve profile` when not yet requested;
- `Notes in these results` when applicable;
- `More notes by this account` as an explicit relay-backed action;
- topics, domains, kinds, mentions, and other account context may be added only
  when derived from ordinary engine evidence and proven useful in later
  voyages;
- technical observations and commands live under `Technical evidence`.

The panel must not display every possible operation. It displays the common
note/account navigation vocabulary. A separate advanced escape can expose the
complete system later.

## Browse and search

Opening `Browse / search` presents a compact human form, not an always-visible
engine draft.

First slice:

- recent notes;
- exact hashtag;
- exact account public key;
- exact event ID;
- time window;
- result amount using human presets with an optional exact bound;
- selected relays behind `Relay settings`.

The form compiles through existing navigator actions and resolvers. Nothing
runs until the navigator confirms it. Advanced request facts remain visible
before execution under `Request details`.

A successful request opens new results. The UI must state whether it replaces
the current primary results or opens another retained result set before the
request runs. Do not restore the old client's ambiguous query/current-corpus
state.

## Honest uncertainty without protocol-console density

The default result header needs one concise factual sentence, for example:

> 20 notes from a bounded request to 1 relay · more may exist

When evidence is unresolved:

> 8 accounts · 5 identified · 3 unresolved

When a relay attempt is partial:

> Request finished with incomplete relay coverage

Each sentence opens the exact coverage, bounds, omissions, warnings, and
commands. Honesty remains one interaction away; it is not repeated in every
card and control.

## Narrow layout

Use three recognizable destinations:

- `Results` — the readable center and default;
- `Filters` — open results and facets;
- `Details` — the selected note or account.

These labels replace Context, Field, and Inspector. Switching does not reset
results, selection, local filter, projection, paging, facets, prepared request,
or authorized media.

## Architecture constraints

- Keep the current Atlas store as the single UI/research-state owner.
- Components call only typed navigator actions.
- Resolvers alone construct and execute controller commands.
- Do not restore code from the Solid client.
- Do not add a parallel router, execution store, generic dispatcher, or state
  mirror.
- No automatic acquisition, hydration, continuation, retry, relay selection,
  ranking, recommendation, or media loading.
- Keep immutable result handles and explicit request boundaries.
- Preserve exact evidence and uncertainty even when the default projection is
  concise.

## First implementation slice

This replacement should initially rearrange proven Atlas capabilities rather
than add analysis features:

1. rename and simplify the global vocabulary;
2. turn retained places into compact `Open results`;
3. keep the account facet but present it as an ordinary factual filter;
4. make notes/accounts and their familiar navigation actions dominant;
5. consolidate technical material under result-level and subject-level
   disclosures;
6. replace Context/Field/Inspector narrow modes with
   Filters/Results/Details; and
7. simplify the acquisition overlay into the compact Browse/search form while
   retaining an advanced request disclosure.

No new facet family is required for this slice.

## Acceptance voyage

A person who has not read the engine documentation can, without coaching:

1. browse recent notes;
2. understand the result count and that the request was bounded;
3. read a note and open its author;
4. resolve the author's profile deliberately;
5. return to the note and open locally known related notes;
6. explicitly check relays for more replies;
7. return to the original results;
8. use the account facet to inspect another account;
9. open notes by that account; and
10. start another browse/search request without accidentally retaining hidden
    constraints from the previous one.

At no point should the person need to understand handles, revisions, relation
algebra, result installation, operation stages, or the distinction between an
Atlas Place and Branch. Those facts remain available through evidence
disclosures for advanced investigation and debugging.

## Validation decision

Do not promote the replacement merely because it passes automated tests. The
slice succeeds only if the user can perform the acceptance voyage and describe
what happened using ordinary note/account/result language.

If that voyage remains confusing, simplify the surface again without changing
the coherent action/store/resolver foundation.
