---
id: 069-event-content-facts
status: done
max_attempts: 4
validation: workflow/tasks/069-event-content-facts.validate.sh
depends_on:
---

# Add factual event role, format, and conversation fields

## Authority

Implement Task 1 from
[`EVENT-CONTENT-ENGINE-DESIGN.md`](../../EVENT-CONTENT-ENGINE-DESIGN.md).
That document settles vocabulary and scope. Do not expand the kind table,
invent scoring, or add a content-classification operation.

## Goal

Give ordinary research relations factual visibility into a sparse set of known
event roles, human-facing formats, and conversation roles through the existing
relation algebra.

## Required work

1. Add one dependency-light event-content interpretation module. Its canonical
   input is one immutable event and it owns no memory.
2. Implement exactly the initial kind mapping in the design document.
   Unlisted kinds return `unknown`; kinds with no human content format return
   `none`.
3. Reuse the existing exported protocol-relationship interpretation for
   kind-1 reply and quote facts. Do not add a second NIP-10 parser.
4. Expose lazy source-backed relation fields:
   `event.role`, `event.format`, and `event.conversationRole`.
5. Preserve the current evidence-lifetime model: these fields resolve from
   current canonical evidence and become unresolved after evidence disappears.
6. Make the fields visible through relation description and contextual schema
   without introducing a new operation, result kind, or presentation model.
7. Keep canonical events byte-for-byte conceptually unchanged.
8. Update durable documentation only where implementation establishes public
   behavior.

## Acceptance criteria

- Direct relation use, plans, sessions, JSONL, and the browser Worker reach the
  same relation implementation.
- Known kinds expose the documented facts; unknown kinds remain unknown.
- Original, reply, quote, repost, reaction, comment, and chat roles are not
  conflated.
- Reposts describe the outer event and do not inherit the target's content
  format.
- No trust, quality, subject-matter, media, warning, or moderation policy is
  introduced in this task.

## Verification

- Extend one existing public-boundary relation scenario with representative
  correctly signed events. Do not test every table row.
- Protect unknown-kind behavior, kind-1 reply/quote behavior, repost behavior,
  lazy resolution, and contextual field visibility.
- Do not import private interpretation helpers solely for tests.
- Run syntax checks, the functional suite, and browser smoke validation.
