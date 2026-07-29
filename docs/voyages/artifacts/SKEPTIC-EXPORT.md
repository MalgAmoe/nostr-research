# Skeptic voyage export

Status: experimental caller-side artifact produced on 2026-07-29.

## Scope

This is a bounded export from the first Skeptic expedition. It is not a
profile endorsement, identity verification, exhaustive account history, or
claim that the selected account is human. It records why one candidate
survived the navigator's attempted invalidation within the evidence observed.

## Selected profile

**KAZも**

- Public key:
  `aa5556df2d2ad3660b5f75e36999d798a637f765fada7082170f743a98b456e1`
- Profile metadata event:
  `706c10a54001456ff2b95f776062fa27c96a43cd644dc685d72c1e2882c1d13c`
- Navigator judgment: `interested`
- Strength: `0.82`
- Collection: `skeptic-survivors`

Strength is a navigator-relative annotation from 0 to 1 expressing how firmly
the navigator recorded this qualified judgment. It is not a probability,
engine score, or transferable measure of account quality.

The profile described an eccentric personal identity involving flexibility,
computer cleaning, and hot weather. That description was initially interesting
because it was specific and unlike the automated, promotional, and generic
profiles nearby. It was also uncertain because it could have been a joke or a
thin persona unsupported by authored activity.

## Attempted invalidation

The navigator acquired a bounded 40-note authored window and looked for
repetition, automation, promotional templating, or activity inconsistent with
the apparent personal identity.

The observed stream instead varied across ordinary situated subjects:

- travel and fatigue;
- food and restaurants;
- games and Wordle;
- vehicle repair;
- conversation addressed to other people; and
- an original food image.

The navigator selected the following representative references from the
bounded window to expose variety across the evidence rather than only its
strongest or most favorable notes:

- `743df36535c0d45b03461bfc418f5035326d14130dd2c96e4b8e3016b01fa814`
  — a note about travelling roughly 200 kilometres;
- `3bf4126e05b384e26a7509a48fc2714fb445c345997a77ccd8a0d4c17de03fab`
  — returning home tired;
- `febd7c173dc92d20a98821e08d413d3a4ce22200928919f0e86f659d383e285d`
  — a situated comment about udon;
- `520b0d48d86563005953f8cc71bd6ff003c7051ed90a67a2c18dd1eb022b963d`
  — a food note with an image;
- `07dbd8b5ff7442418c0c9ef759aeea08f225c77b2c3d5d8a6b453fd7201168fd`
  — a mechanical repair observation; and
- `dde673924e523e93f19fe1fb9aed2d4c29122bc1be357c46a564e43d9243aa1e`
  — a direct conversational message.

## Qualification

The original reason survived in a narrower form: the account appears to carry
a varied personal voice worth revisiting. The evidence does not establish the
person's offline identity, profession, reliability, or the literal truth of
the profile description. No trust or quality score was inferred.

The other two candidates from the expedition are deliberately absent from the
collection:

- a technically specific wallet profile resolved into repetitive service
  telemetry rather than a person to follow; and
- a claimed podcast and music creator had only one promotional authored note,
  leaving the claim unresolved.

## Evidence bounds

- Starting field: 380 distinct recent kind-1 events.
- Profile discovery: deterministic sample of 40 authors, 13 resolved profiles.
- Candidate authored evidence: at most 40 notes per candidate.
- Selected evidence was observed through three configured relays:
  `nos.lol`, `relay.primal.net`, and `relay.snort.social`.
- The underlying archive and notebook were process-local. Stable Nostr subject
  IDs survive in this artifact; the in-memory observations and handles do not.

## Export finding

A useful artifact can be produced without adding an engine export command. The
caller can project a selected membership, navigator judgment, qualification,
and stable evidence references into a readable document. What is lost after
the process closes is the rich in-memory provenance and exact observation
state. That is acceptable for this experiment, but it clearly marks the
boundary a future export format would need to carry if stronger
reproducibility becomes a real requirement.
