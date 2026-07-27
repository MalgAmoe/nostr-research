# Declarative operations field trials

## Purpose

These trials observe how JavaScript is actually used to research Nostr through
the current library. Their purpose is to gather evidence for a future safe,
declarative operation vocabulary. They do not assume that every convenient
JavaScript expression belongs in the library or in that vocabulary.

Each trial records meaningful research phases rather than every console
keystroke. Conclusions remain provisional until compared across several
different tasks.

## Observation categories

Every non-trivial operation is eventually classified as one of:

- **Library primitive** — neutral, stable behavior that belongs in the core.
- **Declarative candidate** — a reusable composition a future command plan
  should be able to express.
- **Presentation concern** — changes how evidence is shown, not what it means.
- **User judgment** — an interpretation or decision the system must not make.
- **Incidental JavaScript** — task-specific glue that does not deserve a
  permanent abstraction.

The working log uses:

| Intent | JavaScript performed | Existing primitives | Observation |
| --- | --- | --- | --- |

## Trial 1 — Orient from noise

### Task

Acquire a broad, mostly random buffer and discover one coherent topical group
without selecting the topic beforehand.

### Success conditions

- Retain at least eight distinct profiles.
- The common interest is narrower than Bitcoin or Nostr.
- At least five profiles have direct profile or activity evidence for the
  interest.
- One prolific author or repeated template cannot define the group.
- Record rejected false trails and why the user rejected them.

### Working log

| Intent | JavaScript performed | Existing primitives | Observation |
| --- | --- | --- | --- |
| Acquire orientation evidence without a chosen topic | Acquired 500 distinct recent kind-1 events from `nos.lol` and `relay.primal.net` into a capacity-1,000 corpus | `acquire`, `summary` | The explicit observation, distinct-event, timeout, concurrency, and corpus-capacity bounds expressed the operation adequately. |
| Inspect the broad sample | Selected all 500 notes and requested facets | `events`, `facets` | Facets immediately exposed dominant authors, technical tags, linked domains, media presence, and relay coverage. The ten-value facet presentation was insufficient for inspecting the long tail. |
| Inspect the topic-tag long tail | Reduced every event's `t` tags into a case-normalized count map, sorted it, and printed a longer slice | Event records supplied the data; aggregation was handwritten | General grouping, normalization, counting, and sorting were reconstructed in JavaScript. This is a declarative-operation candidate, while choosing `t` as meaningful remained research judgment. |
| Reject false orientations | Compared dominant tags, domains, authors, and representative content | `facets`, `limitPer`, direct event records | Machine activity, RSS/news automation, semantic-search spam, and a coordinated freelance/Solana promotion dominated frequency. Frequency supplied candidates but could not decide whether a trail was useful. |
| Test the first human-facing signal | Selected notes containing image URLs, counted distinct authors, and limited examples to three per author | `exclude`, `limitPer` | Media presence led toward photography, but URL detection required a handwritten regular expression because the presence facet was not itself a selectable result. The resulting material still mixed personal photos, memes, pornography, generated images, reposts, and spam. |
| Expand the photography trail | Acquired 200 distinct kind-1 events carrying `photography`, `photostr`, or `photo` tags | `acquire`, `events` | Targeted acquisition was directly expressible after the user chose the trail. It produced 200 notes from 41 authors. |
| Build author evidence | Grouped the 200 notes by author and accumulated note count, three content samples, and linked domains, then sorted by count | Event records supplied the data; aggregation was handwritten | This was the most substantial repeated JavaScript composition. It joined several neutral reductions into one account-oriented evidence view. |
| Reject dominant false candidates | Inspected representative notes and domains | Handwritten author evidence plus user judgment | Two accounts posted 80 stock images from Pexels; two unrelated high-volume accounts injected semantic-search links; other candidates contained repeated explicit spam or duplicated contest text. The system exposed evidence; rejection remained judgment. |
| Attach profiles to candidates | Constructed ten account subjects, hydrated kind-0 metadata, then filtered the account result back to those IDs and projected names and descriptions | `collection`, `hydrate`, `accounts` | Hydration was simple, but correlating returned profiles with the candidate list required an ID membership join in JavaScript. |
| Retain the result with reasons | Selected nine accounts, annotated whether evidence came from profile plus activity or activity alone, constructed a reason-bearing collection, and retained it | `annotate`, `collection`, `retain` | Per-account reasons could be preserved, but constructing them required manual item mapping. The user supplied both membership and rationale. |

### JavaScript performed

The following are the substantive expressions used during the trial. Console
variable declarations and formatting are preserved because they reveal where
the interaction currently requires manual composition.

#### Broad acquisition and orientation

```js
var relays = [
  'wss://nos.lol/',
  'wss://relay.primal.net/',
];

var broad = await research.acquire({
  relays,
  filter: { kinds: [1], limit: 400 },
  timeoutMs: 12_000,
  observationLimit: 650,
  distinctEventLimit: 500,
  concurrency: 2,
});

research.summary();

var notes = research.events({
  kinds: [1],
  limit: 600,
});

research.facets(notes);
```

#### Topic-tag long-tail aggregation

```js
var topicCounts = [
  ...notes.items.reduce((counts, item) => {
    for (var tag of item.record.event.tags) {
      if (tag[0] === 't' && tag[1]) {
        var value = tag[1].toLowerCase();
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    }
    return counts;
  }, new Map()),
].sort((left, right) => right[1] - left[1]);

topicCounts.slice(0, 60);
JSON.stringify(topicCounts.slice(0, 100));
```

The `JSON.stringify` call was only a workaround for the console's compact
array preview. It did not contribute to the research result.

#### Image-bearing candidate notes

```js
var imageNotes = research.exclude(
  notes,
  item => !/(https?:\/\/\S+\.(?:jpg|jpeg|png|webp)|blossom\.|image\.nostr\.build)/i
    .test(item.record.event.content),
);

var imageBalanced = research.limitPer(
  imageNotes,
  item => item.record.event.pubkey,
  3,
);

({
  raw: imageNotes.items.length,
  balanced: imageBalanced.items.length,
  authors: new Set(
    imageNotes.items.map(item => item.record.event.pubkey),
  ).size,
  samples: imageBalanced.items.slice(0, 20).map(item => ({
    author: item.record.event.pubkey,
    content: item.record.event.content.slice(0, 180),
  })),
});
```

#### Targeted photography acquisition

```js
var visualAcquisition = await research.acquire({
  relays,
  filter: {
    kinds: [1],
    '#t': ['photography', 'photostr', 'photo'],
    limit: 220,
  },
  timeoutMs: 12_000,
  observationLimit: 300,
  distinctEventLimit: 200,
  concurrency: 2,
});

var visualNotes = research.events({
  kinds: [1],
  tags: {
    '#t': ['photography', 'photostr', 'photo'],
  },
  limit: 300,
});

({
  notes: visualNotes.items.length,
  authors: new Set(
    visualNotes.items.map(item => item.record.event.pubkey),
  ).size,
});
```

#### Per-author evidence aggregation

```js
var visualRank = Object.values(
  visualNotes.items.reduce((groups, item) => {
    var event = item.record.event;
    var group = groups[event.pubkey] ??= {
      id: event.pubkey,
      count: 0,
      samples: [],
      domains: new Set(),
    };

    group.count++;

    if (group.samples.length < 3) {
      group.samples.push(event.content.slice(0, 220));
    }

    for (var match of event.content.matchAll(/https?:\/\/([^/\s]+)/g)) {
      group.domains.add(match[1]);
    }

    return groups;
  }, {}),
)
  .map(group => ({
    ...group,
    domains: [...group.domains],
  }))
  .sort((left, right) => right.count - left.count);

visualRank.slice(0, 20);
```

#### Candidate construction, hydration, and profile join

```js
var candidateIds = [
  'b3a249dbf5d8ecbc17b03aaf46c90fc593c68c4ec665578630e295ac049f4736',
  '64bfa9abffe5b18d0731eed57b38173adc2ba89bf87c168da90517f021e722b5',
  'b311b758edec235c6b962c08acb97ee97c8965ec0d008a2d8c7ba6179d3b88ad',
  '7937540697665014c0de0809cdc75f37e900b1091a6b3d812af4178fe672caa9',
  'e49f3fe533b2dac0b9820d54d6843d34ba3ce8b86bacea2e5b68ea89304d8288',
  '784097c4d8521468de52e91c0395c08ab1f1d2560b039fe095402ef532245370',
  '1e6039cba2f956ae2bf962d333ed46beb2b120bbeddf3869f5afb908e562fb21',
  'e3d5cb40fff93e3f2af7d97e290f87b48b2e9e1d7a4b838ee644691301888c2b',
  '88b69f6c153a0c495df034414d5902eedbf68319b1c13a0822afad84aafe44c7',
  '3ae860e498e285d7cd48ca47643bf10c21de8143e1e52e8b696288d25cae4ac7',
];

var candidates = research.collection(
  candidateIds.map(id => ({
    subject: { type: 'account', id },
  })),
);

await research.hydrate(candidates, {
  relays,
  kinds: [0],
  timeoutMs: 12_000,
  concurrency: 2,
});

research.accounts({ limit: 500 }).items
  .filter(item => candidateIds.includes(item.subject.id))
  .map(item => ({
    id: item.subject.id,
    name: item.record.profile.display_name
      || item.record.profile.name,
    about: (item.record.profile.about || '').slice(0, 260),
  }));
```

#### Annotation and reason-bearing retention

```js
var chosenIds = candidateIds.filter(
  id => id !== 'b311b758edec235c6b962c08acb97ee97c8965ec0d008a2d8c7ba6179d3b88ad',
);

var profileEvidence = new Set([
  'b3a249dbf5d8ecbc17b03aaf46c90fc593c68c4ec665578630e295ac049f4736',
  '64bfa9abffe5b18d0731eed57b38173adc2ba89bf87c168da90517f021e722b5',
  '7937540697665014c0de0809cdc75f37e900b1091a6b3d812af4178fe672caa9',
  'e49f3fe533b2dac0b9820d54d6843d34ba3ce8b86bacea2e5b68ea89304d8288',
  '784097c4d8521468de52e91c0395c08ab1f1d2560b039fe095402ef532245370',
  '1e6039cba2f956ae2bf962d333ed46beb2b120bbeddf3869f5afb908e562fb21',
  'e3d5cb40fff93e3f2af7d97e290f87b48b2e9e1d7a4b838ee644691301888c2b',
  '88b69f6c153a0c495df034414d5902eedbf68319b1c13a0822afad84aafe44c7',
]);

chosenIds.forEach(id => {
  research.annotate(
    { type: 'account', id },
    {
      labels: ['trial-1', 'photography'],
      note: profileEvidence.has(id)
        ? 'Photography supported by profile and recent activity.'
        : 'Photography supported by repeated recent activity; profile is not descriptive.',
    },
  );
});

var photoGroup = research.collection(
  chosenIds.map(id => ({
    subject: { type: 'account', id },
    reasons: [{
      type: 'field-trial-selection',
      trial: 1,
      evidence: profileEvidence.has(id)
        ? 'profile-and-activity'
        : 'activity',
    }],
  })),
  {
    operation: 'field-trial-selection',
    trial: 1,
    topic: 'photography',
  },
);

research.retain(
  photoGroup,
  'Trial 1 — photographers',
  {
    note: 'Discovered from an initially random buffer through image presence, then photography tags; excludes stock-image automation, semantic-search spam, explicit spam, and one weakly described candidate.',
  },
);
```

### Result and findings

The trial retained nine photography profiles:

- Amy Gann
- alt_smij
- BTCPhoto
- danielw
- Minz
- Lillian
- shanomag
- Dawn Photography
- ElrickErikose

Eight profiles explicitly claimed photography or closely related visual work
and had matching recent activity. `alt_smij` had a non-descriptive profile but
repeated wildlife-photography activity. One additional candidate, Shisoka, was
rejected because the profile only said “Testing”; although its recent notes
looked photographic, the group already met the success threshold with stronger
evidence.

The trial began with 500 random notes from 208 authors and ended with 709
resident events from 248 authors after targeted acquisition and profile
hydration. No eviction occurred.

False trails were important:

- Technical activity-state and `miasma-peer` tags described application or
  machine behavior rather than a useful topical group.
- News, RSS, airport, and sport signals were dominated by automated feeds.
- Eighteen `opensource`-tagged notes were part of a repeated
  freelance/Solana promotion, not evidence of an open-source community.
- Image presence alone was much too broad.
- Photography tags still admitted stock-image automation, unrelated hashtag
  injection, explicit spam, and repeated promotional content.

The library adequately handled bounded acquisition, local selection, profile
hydration, annotations, and retention. JavaScript was mainly required for:

1. arbitrary long-tail grouping and counting;
2. per-author evidence aggregation;
3. selecting representative records;
4. joining a candidate ID set with hydrated account results; and
5. constructing reason-bearing retained members.

The trial does not yet justify one `accountEvidence` library method. It does
provide evidence that a future declarative vocabulary needs generic grouping,
aggregation, sampling, joining, and reason-preserving selection.

## Trial 2 — Navigate from one profile

### Task

Choose one credible active profile from the corpus. Navigate follows,
mentions, replies, quotations, and shared tags to identify two distinct
neighboring groups.

### Success conditions

- Produce two groups of at least five profiles.
- Record the evidence path by which every profile entered.
- Preserve overlap rather than forcing profiles into one group.
- Use at least two relationship types during navigation.

### Working log

| Intent | JavaScript performed | Existing primitives | Observation |
| --- | --- | --- | --- |
| Establish one explicit seed | Constructed shanomag as an account collection and hydrated kinds 0 and 3 | `collection`, `hydrate`, `inspect`, `follows` | The seed had a descriptive travel-photography profile and 504 follows. The contact list was available but too broad to define a useful neighborhood. |
| Acquire recent seed activity | Expanded from the account with `authoredLimit: 30` | `expand` | Two failed calls revealed that authored expansion implicitly requires the `author` relationship and an inbound-capable direction. The successful call acquired 30 notes. |
| Inspect available relationship signals | Traversed author, mentioned-account, quoted-event, and topic relationships | `traverse`, `facets` | The notes contained strong travel and photography topics but almost no useful mentions or quotations. A navigation method must tolerate absent interpersonal edges. |
| Expand shared topics | Acquired bounded `travel`/`wanderlust` and `photography`/`photostr` slices | `acquire`, `events` | Topic expansion yielded 178 travel notes from 19 authors and 184 photography notes from 33 authors. |
| Traverse topic to author | First traversed directly from topic subjects through topic and author edges, then replaced that attempt with topic-filtered events followed by author traversal | `collection`, `traverse`, `events` | Direct two-hop traversal exhausted its 1,000-item result limit on events and tag edges before reaching most authors. Staging the path as topic selection followed by author traversal was clearer and complete. |
| Compare neighborhoods | Filtered traversal results to accounts, called `compare`, then replaced the oversized output with ID-set counts | `collection`, `compare` | The semantic comparison was correct but emitted roughly 41,000 tokens of reasons and provenance. A concise comparison projection is a presentation need. The neighborhoods had three shared candidates before manual selection. |
| Hydrate candidate profiles | Unioned the two account-ID arrays, constructed one collection, and hydrated kind 0 | `collection`, `hydrate`, `accounts` | Forty-eight of 49 neighboring profiles were found. Joining profiles to activity again required a handwritten ID map. |
| Assemble evidence per author | Grouped notes by author with counts and two content samples, then attached profile name and description from a map | Direct records plus handwritten aggregation | This substantially repeated Trial 1's per-author aggregation and join. |
| Inspect the seed's follows within candidates | Intersected evidence rows with the 504-account follow set | `follows` plus handwritten set membership | Three useful photography candidates and two weak candidates were followed by the seed. Follow evidence added context but did not establish quality: one followed profile was a stock-image feed. |
| Retain two overlapping groups | Constructed reason-bearing members, added the seed's follow relationship when present, annotated memberships, and retained both groups | `collection`, `annotate`, `retain` | The final travel group contained five profiles; photography contained nine. shanomag and TravelTelly remained in both groups. |

### Result and findings

The travel neighborhood contains:

- shanomag
- iTravelRox
- TravelTelly
- Ruben Storm
- nomadforecast

The photography neighborhood contains:

- shanomag
- TravelTelly
- BTCPhoto
- jwilly
- Minz
- ElrickErikose
- danielw
- Dawn Photography
- Amy Gann

shanomag and TravelTelly deliberately belong to both groups. BTCPhoto and
jwilly had both topical activity and a direct follow edge from the seed.

The travel slice was heavily contaminated by a coordinated luxury-travel
publication campaign: approximately a dozen profiles repeated substantially
the same weekly-issue text. Semantic-search accounts also injected unrelated
content through broad hashtags. The photography slice contained two prolific
Pexels feeds and similar unrelated hashtag injection. These were rejected by
the user after representative evidence was assembled.

The seed's contact list and shared topics described different relationships:
the contact list was broad social evidence, while matching recent notes were
activity evidence. Neither was treated as a conclusion. Direct mentions and
quotations were not useful for this seed.

This trial strengthened the case for:

- staged, explicit pipelines instead of opaque multi-hop traversal;
- selecting result subjects by type without handwritten array filtering;
- concise comparison summaries with optional detailed evidence;
- reusable grouping plus profile attachment; and
- preserving several relationship reasons on one selected member.

It also showed that a declarative plan must represent an unavailable or
unproductive path. “Try mentions, find nothing useful, continue through
topics” is normal research rather than an exceptional failure.

### JavaScript performed

#### Seed construction and hydration

```js
var relays = [
  'wss://nos.lol/',
  'wss://relay.primal.net/',
];

var seedId =
  'b3a249dbf5d8ecbc17b03aaf46c90fc593c68c4ec665578630e295ac049f4736';

var seed = research.collection([{
  subject: { type: 'account', id: seedId },
  reasons: [{ type: 'trial-seed', trial: 2 }],
}]);

await research.hydrate(seed, {
  relays,
  kinds: [0, 3],
  timeoutMs: 12_000,
  concurrency: 2,
});

({
  profile: research.inspect({ type: 'account', id: seedId }),
  follows: research.follows({ type: 'account', id: seedId }).items.length,
  summary: research.summary(),
});
```

#### Failed authored-expansion attempts

These calls were executed and rejected before networking:

```js
await research.expand(seed, {
  relays,
  relationshipTypes: [
    'mentioned-account',
    'quoted-event',
    'topic',
  ],
  direction: 'outbound',
  depth: 1,
  limit: 250,
  authoredLimit: 30,
  timeoutMs: 12_000,
  observationLimit: 180,
  distinctEventLimit: 100,
  concurrency: 2,
});
// ResearchMemoryError:
// Expansion authoredLimit requires the "author" relationship.

await research.expand(seed, {
  relays,
  relationshipTypes: [
    'author',
    'mentioned-account',
    'quoted-event',
    'topic',
  ],
  direction: 'outbound',
  depth: 1,
  limit: 250,
  authoredLimit: 30,
  timeoutMs: 12_000,
  observationLimit: 180,
  distinctEventLimit: 100,
  concurrency: 2,
});
// ResearchMemoryError:
// Expansion authoredLimit requires an inbound-capable direction.
```

#### Successful authored expansion and relationship inspection

```js
var authored = await research.expand(seed, {
  relays,
  relationshipTypes: [
    'author',
    'mentioned-account',
    'quoted-event',
    'topic',
  ],
  direction: 'both',
  depth: 1,
  limit: 250,
  authoredLimit: 30,
  timeoutMs: 12_000,
  observationLimit: 180,
  distinctEventLimit: 100,
  concurrency: 2,
});

research.facets(authored);

var seedNetwork = await research.expand(seed, {
  relays,
  relationshipTypes: [
    'author',
    'mentioned-account',
    'quoted-event',
    'topic',
  ],
  direction: 'both',
  depth: 2,
  limit: 300,
  timeoutMs: 12_000,
  observationLimit: 180,
  distinctEventLimit: 100,
  concurrency: 2,
});

seedNetwork.items
  .filter(item => item.subject.type === 'tag')
  .map(item => item.subject);
```

#### Topic acquisition

```js
var travelAcquisition = await research.acquire({
  relays,
  filter: {
    kinds: [1],
    '#t': ['travel', 'wanderlust'],
    limit: 180,
  },
  timeoutMs: 12_000,
  observationLimit: 240,
  distinctEventLimit: 160,
  concurrency: 2,
});

var photoAcquisition = await research.acquire({
  relays,
  filter: {
    kinds: [1],
    '#t': ['photography', 'photostr'],
    limit: 180,
  },
  timeoutMs: 12_000,
  observationLimit: 240,
  distinctEventLimit: 160,
  concurrency: 2,
});
```

#### Abandoned direct topic traversal

```js
var travelTags = research.collection([
  {
    subject: { type: 'tag', id: 'travel' },
    reasons: [{ type: 'seed-topic', from: seedId }],
  },
  {
    subject: { type: 'tag', id: 'wanderlust' },
    reasons: [{ type: 'seed-topic', from: seedId }],
  },
]);

var photoTags = research.collection([
  {
    subject: { type: 'tag', id: 'photography' },
    reasons: [{ type: 'seed-topic', from: seedId }],
  },
  {
    subject: { type: 'tag', id: 'photostr' },
    reasons: [{ type: 'seed-topic', from: seedId }],
  },
]);

var travelNetwork = research.traverse(travelTags, {
  relationshipTypes: ['topic', 'author'],
  direction: 'both',
  depth: 2,
  limit: 1_000,
});

var photoNetwork = research.traverse(photoTags, {
  relationshipTypes: ['topic', 'author'],
  direction: 'both',
  depth: 2,
  limit: 1_000,
});
```

Each traversal returned 1,002 items but only two or three accounts because
intermediate event and tag relationships consumed the result limit.

#### Staged topic-to-author traversal

```js
var travelNotes = research.events({
  kinds: [1],
  tags: {
    '#t': ['travel', 'wanderlust'],
  },
  limit: 300,
});

var photoNotes = research.events({
  kinds: [1],
  tags: {
    '#t': ['photography', 'photostr'],
  },
  limit: 300,
});

var travelAuthors = research.traverse(travelNotes, {
  relationshipTypes: ['author'],
  direction: 'outbound',
  depth: 1,
  limit: 500,
});

var photoAuthors = research.traverse(photoNotes, {
  relationshipTypes: ['author'],
  direction: 'outbound',
  depth: 1,
  limit: 500,
});

var accountsOnly = value => research.collection(
  value.items.filter(item => item.subject.type === 'account'),
);

var travelAccounts = accountsOnly(travelAuthors);
var photoAccounts = accountsOnly(photoAuthors);
```

#### Comparison and concise overlap reconstruction

```js
research.compare(travelAccounts, photoAccounts);
```

The direct comparison generated an impractically large detailed value.
The concise facts were then reconstructed:

```js
var accountIds = value => value.items
  .filter(item => item.subject.type === 'account')
  .map(item => item.subject.id);

var travelIds = accountIds(travelAccounts);
var photoIds = accountIds(photoAccounts);
var overlapIds = travelIds.filter(id => photoIds.includes(id));

({
  travel: travelIds.length,
  photo: photoIds.length,
  overlap: overlapIds.length,
  travelOnly: travelIds.filter(id => !photoIds.includes(id)).length,
  photoOnly: photoIds.filter(id => !travelIds.includes(id)).length,
});
```

#### Candidate hydration and evidence join

```js
var neighborIds = [...new Set([
  ...travelIds,
  ...photoIds,
])];

var neighbors = research.collection(
  neighborIds.map(id => ({
    subject: { type: 'account', id },
  })),
);

await research.hydrate(neighbors, {
  relays,
  kinds: [0],
  timeoutMs: 12_000,
  concurrency: 2,
});

var profilesById = new Map(
  research.accounts({ limit: 500 }).items.map(item => [
    item.subject.id,
    item.record.profile,
  ]),
);

var evidence = collection => Object.values(
  collection.items.reduce((groups, item) => {
    var event = item.record.event;
    var group = groups[event.pubkey] ??= {
      id: event.pubkey,
      count: 0,
      samples: [],
    };

    group.count++;
    if (group.samples.length < 2) {
      group.samples.push(event.content.slice(0, 180));
    }
    return groups;
  }, {}),
)
  .map(group => ({
    ...group,
    name: profilesById.get(group.id)?.display_name
      || profilesById.get(group.id)?.name,
    about: (profilesById.get(group.id)?.about || '').slice(0, 180),
  }))
  .sort((left, right) => right.count - left.count);

var travelEvidence = evidence(travelNotes);
var photoEvidence = evidence(photoNotes);
```

#### Follow intersection

```js
var seedFollows = research.follows({
  type: 'account',
  id: seedId,
});

var followedIds = new Set(
  seedFollows.items.map(item => item.subject.id),
);

({
  travelFollowed: travelEvidence
    .filter(item => followedIds.has(item.id))
    .map(item => ({
      id: item.id,
      name: item.name,
      count: item.count,
    })),
  photoFollowed: photoEvidence
    .filter(item => followedIds.has(item.id))
    .map(item => ({
      id: item.id,
      name: item.name,
      count: item.count,
    })),
});
```

#### Overlapping reason-bearing groups

```js
var travelGroupIds = [
  seedId,
  '0f27a1813385746f9b6587c0efb519b89c1aaa12c3c7643a63281483b3294510',
  '7d33ba57d8a6e8869a1f1d5215254597594ac0dbfeb01b690def8c461b82db35',
  'b2caa9b3ef30faad605e5eeed8da2c8fd7b4ca872becdc440029f4fb9eab0fb5',
  '7f239fe83b5d2b66d0e3e83a575ba73fbcfb2de6ca55863be1e1cc1362b929ea',
];

var photoGroupIds = [
  seedId,
  '7d33ba57d8a6e8869a1f1d5215254597594ac0dbfeb01b690def8c461b82db35',
  '64bfa9abffe5b18d0731eed57b38173adc2ba89bf87c168da90517f021e722b5',
  '34fad5244f7de844c1c9e001e2737ed23f3ea96ceda2e20d241d46fee5824f16',
  '7937540697665014c0de0809cdc75f37e900b1091a6b3d812af4178fe672caa9',
  'e49f3fe533b2dac0b9820d54d6843d34ba3ce8b86bacea2e5b68ea89304d8288',
  '784097c4d8521468de52e91c0395c08ab1f1d2560b039fe095402ef532245370',
  'e3d5cb40fff93e3f2af7d97e290f87b48b2e9e1d7a4b838ee644691301888c2b',
  '1e6039cba2f956ae2bf962d333ed46beb2b120bbeddf3869f5afb908e562fb21',
];

var groupMember = (id, topic) => ({
  subject: { type: 'account', id },
  reasons: [
    {
      type: 'shared-topic-path',
      seed: seedId,
      topic,
    },
    {
      type: 'authored-matching-note',
    },
    ...(followedIds.has(id)
      ? [{
          type: 'followed-by-seed',
          seed: seedId,
        }]
      : []),
  ],
});

var travelGroup = research.collection(
  travelGroupIds.map(id => groupMember(id, 'travel')),
  {
    operation: 'trial-neighborhood',
    trial: 2,
    topic: 'travel',
  },
);

var photoGroup = research.collection(
  photoGroupIds.map(id => groupMember(id, 'photography')),
  {
    operation: 'trial-neighborhood',
    trial: 2,
    topic: 'photography',
  },
);

research.retain(
  travelGroup,
  'Trial 2 — travel neighborhood',
);

research.retain(
  photoGroup,
  'Trial 2 — photography neighborhood',
);
```

## Trial 3 — Refine positive and negative interest

### Task

Begin with a broad subject and progressively select relevant examples,
irrelevant examples, constraints to include, and patterns to exclude.

### Success conditions

- Preserve the initial and final candidate sets for comparison.
- Perform at least two refinement cycles.
- Improve the result through explicit user choices rather than a universal
  relevance or quality rule.
- Record which constraints generalize and which only fit this investigation.

### Working log

| Intent | JavaScript performed | Existing primitives | Observation |
| --- | --- | --- | --- |
| Preserve a broad starting point | Acquired and retained 320 technology-tagged notes from 198 authors | `acquire`, `events`, `retain`, `facets` | The initial set was explicit and reproducible from its acquisition filter. |
| Select negative examples | Inspected facets and representative content, then identified one 166-note repeated freelance/Solana toolkit campaign | Direct evidence plus user judgment | One coordinated pattern constituted more than half the broad result. The decision to reject it was not derived from a universal spam label. |
| First refinement cycle | Excluded the selected campaign by its repeated domain or the conjunction of `solana` and `freelance` tags | `exclude` plus a handwritten tag predicate | The set fell from 320 notes and 198 authors to 154 notes and 32 authors. Combining negative constraints required JavaScript boolean logic. |
| Select positive and further negative examples | Chose open-source software construction, releases, self-hosting, and developer material as positive; chose two news sources and semantic-search domains as negative | Facets and representative records | This was a user-defined research direction, not a property of “technology” in general. |
| Second refinement cycle | Excluded selected negative domains and notes that lacked a caller-written positive text pattern | `exclude` plus a handwritten regular expression | The set fell from 154 to 55 notes. Positive selection was expressed awkwardly as exclusion of non-matches. |
| Balance the final evidence | Limited the remaining set to three notes per author | `limitPer` | The final evidence contained 16 notes from nine authors instead of being dominated by a few aggregators. |
| Preserve each stage | Retained the initial, first-cycle, and final collections with a user-written rationale | `retain` | Saved stages allow comparison without inventing persistent universal preferences. |
| Inspect final authors | Extracted author IDs, hydrated profiles, and joined account metadata back to the final IDs | `collection`, `hydrate`, `accounts` plus handwritten ID operations | Seven of nine profiles were found. The profile join repeated the previous trials. |

### Result and findings

The initial broad technology set contained 320 notes from 198 authors. The
first negative-example cycle removed a 166-note coordinated toolkit campaign.
The second cycle removed caller-selected news and semantic-search sources and
required a caller-selected open-source/software signal. Balancing produced 16
representative notes from nine authors.

The final profiles that hydrated were:

- GitHub Trending
- Akamaister
- satslist
- Shawon Shovon
- Lumen
- Nostrord
- Laddr

Two authors did not return kind-0 metadata during the bounded hydration. Their
notes remained in the evidence set.

The final result was improved for the stated interest, but not universally
“better.” It still contained project announcements, aggregators, services, and
an explicitly software-based actor. That is correct: the trial refined
interest in open-source software evidence, not interest in human developers.

The first negative constraint appears specific and disposable: a particular
temporary domain and a particular tag conjunction identified one campaign.
The second cycle's selected concepts—release, self-hosting, source code,
software, developer work—may recur in similar investigations, but their exact
regular expression should not become a library rule.

This trial adds evidence for declarative boolean composition:

- include when any selected condition matches;
- exclude when any selected condition matches;
- combine structured tags, domains, text terms, and subject IDs;
- preserve named stages;
- balance by a selected field; and
- compare stage counts without rendering full records.

The operation language must distinguish a reusable operation such as
`matches-domain` from the user's supplied domain value. It must also preserve
the asymmetry between positive and negative conditions without pretending
that either is an objective quality assessment.

### JavaScript performed

#### Initial acquisition and retention

```js
var relays = [
  'wss://nos.lol/',
  'wss://relay.primal.net/',
];

var initialAcquisition = await research.acquire({
  relays,
  filter: {
    kinds: [1],
    '#t': [
      'technology',
      'tech',
      'programming',
      'opensource',
    ],
    limit: 350,
  },
  timeoutMs: 12_000,
  observationLimit: 480,
  distinctEventLimit: 320,
  concurrency: 2,
});

var initial = research.events({
  kinds: [1],
  tags: {
    '#t': [
      'technology',
      'tech',
      'programming',
      'opensource',
    ],
  },
  limit: 400,
});

research.facets(initial);

research.retain(
  initial,
  'Trial 3 — initial technology slice',
);
```

#### First negative-example cycle

```js
var hasTag = (event, name) => event.tags.some(
  tag => tag[0] === 't'
    && tag[1]?.toLowerCase() === name,
);

var cycle1 = research.exclude(initial, item => {
  var event = item.record.event;

  return event.content.includes(
    'column-secretary-acne-arbor.trycloudflare.com',
  ) || (
    hasTag(event, 'solana')
    && hasTag(event, 'freelance')
  );
});

research.retain(
  cycle1,
  'Trial 3 — after negative example cycle',
  {
    note: 'Removed the repeated freelance/Solana toolkit campaign selected from representative examples.',
  },
);
```

#### Positive and negative refinement cycle

```js
var negativeDomains = [
  'www.journaldugeek.com',
  'www.01net.com',
  'aepiot.com',
  'aepiot.ro',
  'allgraph.ro',
  'headlines-world.com',
];

var positivePattern =
  /(github\.com|\bself-host(?:ed|ing)?\b|\bopen[ -]source\b|\brelease\b|\bsoftware\b|\bprogramming\b|\bdeveloper\b|\bcommand[- ]line\b|\bcli\b|\bsource code\b)/i;

var cycle2 = research.exclude(cycle1, item => {
  var content = item.record.event.content;

  return negativeDomains.some(
    domain => content.includes(domain),
  ) || !positivePattern.test(content);
});

var finalBalanced = research.limitPer(
  cycle2,
  item => item.record.event.pubkey,
  3,
);

({
  initial: initial.items.length,
  cycle1: cycle1.items.length,
  cycle2: cycle2.items.length,
  finalBalanced: finalBalanced.items.length,
  authors: new Set(
    finalBalanced.items.map(
      item => item.record.event.pubkey,
    ),
  ).size,
});

research.retain(
  finalBalanced,
  'Trial 3 — refined open-source software evidence',
  {
    note: 'Kept notes matching caller-selected software-building and open-source signals; excluded caller-selected news and semantic-search domains; balanced to three notes per author.',
  },
);
```

#### Final author hydration

```js
var finalAuthorIds = [
  ...new Set(
    finalBalanced.items.map(
      item => item.record.event.pubkey,
    ),
  ),
];

var finalAuthors = research.collection(
  finalAuthorIds.map(id => ({
    subject: { type: 'account', id },
  })),
);

await research.hydrate(finalAuthors, {
  relays,
  kinds: [0],
  timeoutMs: 12_000,
  concurrency: 2,
});

research.accounts({ limit: 500 }).items
  .filter(item => finalAuthorIds.includes(item.subject.id))
  .map(item => ({
    id: item.subject.id,
    name: item.record.profile.display_name
      || item.record.profile.name,
    about: (item.record.profile.about || '').slice(0, 180),
  }));
```

## Trial 4 — Understand an unfamiliar account

### Task

Select an unfamiliar account and assemble evidence sufficient for a user to
understand its activity without classifying the account.

### Success conditions

- Include profile metadata and varied recent notes.
- Include reply context where available.
- Summarize recurring tags, domains, mentions, timing, and repetition.
- Preserve relay provenance.
- Do not conclude whether the account is a person, project, automation,
  credible, or interesting.

### Working log

The account was selected from previously encountered Nostr activity rather
than from prior personal knowledge:

- account: `Akamaister`
- pubkey: `2b998b04e2a1fe6855b2e0ab10bb92b774b5dfa0f78926c7a65ae08086727e47`
- relays: `wss://nos.lol/`, `wss://relay.primal.net/`
- corpus capacity: 700 events

The acquisition yielded profile metadata, a follow list, 40 recent authored
notes, and nine reply candidates. Seven reply parents were resolved. Two
events contained `e` tags with an `edit` marker which the best-effort NIP-10
fallback treated as parents; they remained explicitly unresolved.

The evidence assembly deliberately stopped before deciding whether the
subject was a person, project, automation, credible, or interesting. It
instead described:

- profile self-description;
- authored-note time range;
- clients, tags, linked domains, and mentioned pubkeys;
- exact normalized repetition;
- balanced standalone and reply examples;
- paired reply/parent excerpts;
- per-record relay provenance.

Two failed operations were material:

1. `research.accounts({ prefix: accountId })` failed because `prefix` is not
   an account query field. Getting one known account currently requires
   querying a broad account collection and filtering it in JavaScript.
2. After `replyContexts` refreshed observations for events already in the
   corpus, `research.distinctBy(notes, ...)` rejected the earlier `notes`
   collection because its embedded records no longer exactly matched the
   canonical records. Re-running `research.events(...)` made the operation
   succeed. Stable event identity should survive provenance refreshes.

The final attempt to create a retained representative-evidence set also
failed because `representative` was a library collection rather than an
array, and therefore had no direct `.map`. The account itself was retained
with a neutral annotation.

### JavaScript performed

#### Account acquisition and profile evidence

```js
var accountId =
  '2b998b04e2a1fe6855b2e0ab10bb92b774b5dfa0f78926c7a65ae08086727e47';

var relays = [
  'wss://nos.lol/',
  'wss://relay.primal.net/',
];

await research.acquire({
  relays,
  filter: {
    kinds: [0, 1, 3],
    authors: [accountId],
    limit: 80,
  },
  timeoutMs: 12_000,
  observationLimit: 140,
  distinctEventLimit: 80,
  concurrency: 2,
});

// Failed: prefix is not a supported account query field.
research.accounts({ prefix: accountId });

var account = research.accounts({ limit: 500 }).items.find(
  item => item.subject.id === accountId,
);

var notes = research.events({
  kinds: [1],
  authors: [accountId],
  limit: 80,
});
```

#### Reply-context acquisition and concise projection

```js
var replies = await research.replyContexts(account, {
  relays,
  authoredLimit: 30,
  parentLimit: 20,
  timeoutMs: 12_000,
  observationLimit: 120,
  distinctEventLimit: 60,
  concurrency: 2,
});

// This raw inspection was far too verbose for assessment.
replies.contexts.slice(0, 2);

var replySummary = replies.contexts.map(ctx => ({
  replyId: ctx.reply.subject.id,
  reply: ctx.reply.record.event.content.slice(0, 220),
  parentStatus: ctx.parent.status,
  parentId: ctx.parent.subject?.id,
  parent: ctx.parent.record?.event?.content?.slice(0, 220),
  relationship: ctx.relationship.evidence,
  replyRelays: [
    ...new Set(ctx.reply.provenance.map(item => item.relay)),
  ],
  parentRelays: [
    ...new Set(
      (ctx.parent.provenance || []).map(item => item.relay),
    ),
  ],
}));
```

#### Neutral aggregation

```js
var normalizeContent = item => item.record.event.content
  .toLowerCase()
  .replace(/https?:\/\/\S+/g, '<url>')
  .replace(/\s+/g, ' ')
  .trim();

// Failed after replyContexts refreshed observations for canonical records:
// ResearchMemoryError: Embedded record must exactly match the canonical
// record stored in research memory.
research.distinctBy(notes, normalizeContent);

// Refreshing the selection made the same operation work.
notes = research.events({
  kinds: [1],
  authors: [accountId],
  limit: 80,
});

var exactNormalized = research.groupBy(notes, normalizeContent);
var exactRepetition = research.sort(
  research.count(exactNormalized),
  item => item.count,
  'desc',
);

var eventTags = notes.items.flatMap(
  item => item.record.event.tags,
);

var clients = Object.entries(
  eventTags
    .filter(tag => tag[0] === 'client')
    .reduce((counts, tag) => {
      counts[tag[1]] = (counts[tag[1]] || 0) + 1;
      return counts;
    }, {}),
).sort((a, b) => b[1] - a[1]);

var topics = Object.entries(
  eventTags
    .filter(tag => tag[0] === 't')
    .reduce((counts, tag) => {
      var key = tag[1]?.toLowerCase();
      if (key) counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {}),
).sort((a, b) => b[1] - a[1]);

var domains = Object.entries(
  notes.items
    .flatMap(item => [
      ...item.record.event.content.matchAll(
        /https?:\/\/([^/\s]+)/gi,
      ),
    ])
    .map(match => match[1].toLowerCase())
    .reduce((counts, domain) => {
      counts[domain] = (counts[domain] || 0) + 1;
      return counts;
    }, {}),
).sort((a, b) => b[1] - a[1]);

var mentions = Object.entries(
  eventTags
    .filter(tag => tag[0] === 'p')
    .reduce((counts, tag) => {
      counts[tag[1]] = (counts[tag[1]] || 0) + 1;
      return counts;
    }, {}),
).sort((a, b) => b[1] - a[1]);

var timestamps = notes.items.map(
  item => item.record.event.created_at,
);

var timeRange = {
  first: new Date(Math.min(...timestamps) * 1000).toISOString(),
  last: new Date(Math.max(...timestamps) * 1000).toISOString(),
};

var representative = research.limitPer(
  research.sort(
    notes,
    item => item.record.event.created_at,
    'desc',
  ),
  item => item.record.event.tags.some(tag => tag[0] === 'e')
    ? 'reply'
    : 'standalone',
  4,
);

({
  timeRange,
  exactRepetition: exactRepetition.items.slice(0, 10),
  clients,
  topics,
  domains,
  mentions: mentions.slice(0, 12),
  representative: representative.items.map(item => ({
    id: item.subject.id,
    content: item.record.event.content.slice(0, 300),
    relays: [
      ...new Set(item.provenance.map(entry => entry.relay)),
    ],
  })),
});
```

#### Neutral annotation and retention

```js
research.annotate(
  { type: 'account', id: accountId },
  {
    labels: ['trial-4', 'neutral-evidence-review'],
    note: 'Evidence assembled from profile, authored notes, client/domain/tag/mention aggregates, provenance, and reply-parent contexts. No account-type, credibility, or interest conclusion was assigned.',
  },
);

// Failed: collections expose `.items`; the collection itself is not an array.
var representativeEvidence = research.collection(
  representative.map(item => ({
    subject: item.subject,
    reasons: [{
      type: 'trial-4-representative-evidence',
      role: item.record.event.tags.some(tag => tag[0] === 'e')
        ? 'reply'
        : 'standalone',
    }],
  })),
);

research.retain(
  research.collection([{
    subject: { type: 'account', id: accountId },
    reasons: [{ type: 'trial-4-subject' }],
  }]),
  'Trial 4 — reviewed account',
  {
    note: 'Account retained as reviewed subject without classification.',
  },
);
```

### Result and findings

The system assembled enough neutral evidence for a user to form a view:

- the profile describes software, publishing systems, and the Continuum
  project;
- recent authored activity spanned July 12–26, 2026;
- the dominant clients were Primal web/iOS and local Continuum clients;
- the dominant linked domain was `media.mycontinuum.xyz`;
- the notes included product tests, longer announcements, technical replies,
  and unrelated conversation;
- no exact normalized note body repeated, despite several semantically
  similar signer-test notes;
- reply-parent pairs revealed more context than reply text alone.

The library did not classify the account. The caller still decides what the
evidence means.

Three broadly useful changes emerged:

1. Collection transforms should resolve by stable subject identity, or refresh
   records automatically, when only provenance/observations changed.
2. A declarative evidence summary should cover time range, structured tag and
   domain counts, repetition, balanced representative sampling, and paired
   reply-parent projection.
3. Account lookup and collection projection need concise, direct forms; broad
   query-plus-filter and `.items.map(...)` are recurring incidental ceremony.

## Trial 5 — Navigate under a strict information budget

### Task

Start with a random buffer under fixed corpus and relay budgets. Find five
profiles worth retaining while deliberately allowing less useful evidence to
leave the working corpus.

### Success conditions

- Fix capacity and acquisition budgets before starting.
- Make at least three explicit expand, narrow, or move decisions.
- Observe corpus pressure or eviction.
- Preserve retained subjects while distinguishing missing resident evidence.
- Record what was protected, retained, and allowed to disappear.

### Working log

The trial fixed all bounds before acquiring anything:

- corpus capacity: 120 events;
- relays: `wss://nos.lol/`, `wss://relay.primal.net/`;
- initial random acquisition: at most 90 distinct kind-1 events;
- directed acquisition: at most 75 distinct kind-1 events;
- profile move: kind-0 metadata for six candidate accounts.

The initial buffer contained 90 events by 54 authors. Its facets exposed a
mixture of human conversation, application state, empty machine events,
stream notifications, a coordinated freelance campaign, and a small
cybersecurity/infosec path.

The explicit navigation decisions were:

1. **Narrow:** remove the already recognized campaign and application-state
   events, then choose one cybersecurity note as the protected anchor.
2. **Expand:** query the relays for up to 75 distinct cybersecurity/infosec
   notes. This filled the corpus and caused 44 evictions.
3. **Narrow:** exclude caller-selected semantic-search domains and balance the
   remaining evidence per author.
4. **Move:** turn six activity authors into account subjects and hydrate their
   profiles. Five metadata events were found, causing five more evictions.

At the end the corpus remained exactly at capacity, with 49 cumulative
evictions. The initially protected event was no longer resident, but its
retained subject remained inspectable with `resident: false` and
`evidence: null`.

### JavaScript performed

#### Bounded random buffer

```js
var relays = [
  'wss://nos.lol/',
  'wss://relay.primal.net/',
];

var initialAcq = await research.acquire({
  relays,
  filter: {
    kinds: [1],
    limit: 90,
  },
  timeoutMs: 12_000,
  observationLimit: 140,
  distinctEventLimit: 90,
  concurrency: 2,
});

research.summary();

var initial = research.events({
  kinds: [1],
  limit: 120,
});

research.facets(initial);
```

#### First narrow decision and protected anchor

```js
var nonCampaign = research.exclude(initial, item =>
  item.record.event.content.includes(
    'column-secretary-acne-arbor.trycloudflare.com',
  ) || item.record.event.tags.some(
    tag => tag[0] === 'is_activity',
  )
);

// Failed: there is no generic select operation.
research.select(
  nonCampaign,
  item => item.record.event.content
    .toLowerCase()
    .includes('github.com'),
);

// The inverse exclude form worked, but this path was empty.
var githubSlice = research.exclude(
  nonCampaign,
  item => !item.record.event.content
    .toLowerCase()
    .includes('github.com'),
);

var anchor = nonCampaign.items.find(
  item => item.record.event.pubkey
    === '75852265177807ec78d1fe93304731bb0a179bcf8a75cc4e3a2d6a6f8c432226',
);

research.retain(
  research.collection([{
    subject: anchor.subject,
    reasons: [{
      type: 'trial-5-anchor',
      decision: 'narrow-to-cybersecurity',
    }],
  }]),
  'Trial 5 — protected initial anchor',
);
```

#### Directed expansion under pressure

```js
var cyberAcq = await research.acquire({
  relays,
  filter: {
    kinds: [1],
    '#t': ['cybersecurity', 'infosec'],
    limit: 80,
  },
  timeoutMs: 12_000,
  observationLimit: 120,
  distinctEventLimit: 75,
  concurrency: 2,
});

research.summary();

var anchorAfterCyber = research.inspect(anchor.subject);

// Failed because inspect exposes `context.resolved` only in its presented
// form; the direct object returned here has `resident` at the top level.
({
  resident: anchorAfterCyber.context.resolved,
  preview: anchorAfterCyber.preview,
});

anchorAfterCyber;

var cyber = research.events({
  kinds: [1],
  tags: {
    '#t': ['cybersecurity', 'infosec'],
  },
  limit: 120,
});

var cyberBalanced = research.limitPer(
  cyber,
  item => item.record.event.pubkey,
  3,
);
```

#### Second narrow decision and account move

```js
var junkDomains = [
  'aepiot.com',
  'aepiot.ro',
  'allgraph.ro',
  'headlines-world.com',
];

var cleanCyber = research.exclude(cyberBalanced, item =>
  junkDomains.some(
    domain => item.record.event.content.includes(domain),
  )
);

var candidateIds = [
  ...new Set(
    cleanCyber.items.map(
      item => item.record.event.pubkey,
    ),
  ),
].slice(0, 6);

var candidates = research.collection(
  candidateIds.map(id => ({
    subject: { type: 'account', id },
    reasons: [{
      type: 'trial-5-clean-cyber-activity',
    }],
  })),
);

var hydrateResult = await research.hydrate(candidates, {
  relays,
  kinds: [0],
  timeoutMs: 12_000,
  concurrency: 2,
});

research.summary();

var hydratedProfiles = research.accounts({
  limit: 500,
}).items.filter(
  item => candidateIds.includes(item.subject.id),
);
```

#### Five retained profiles and evicted evidence check

```js
var retainedIds = hydratedProfiles.map(
  item => item.subject.id,
);

retainedIds.forEach(id => {
  research.annotate(
    { type: 'account', id },
    {
      labels: ['trial-5', 'cybersecurity'],
      note: 'Retained under a 120-event budget from cybersecurity/infosec activity after excluding selected junk domains; profile metadata was available.',
    },
  );
});

var retainedProfiles = research.collection(
  retainedIds.map(id => ({
    subject: { type: 'account', id },
    reasons: [
      {
        type: 'topic-activity',
        topics: ['cybersecurity', 'infosec'],
      },
      {
        type: 'profile-metadata-available',
      },
    ],
  })),
  {
    operation: 'trial-5-budgeted-navigation',
  },
);

research.retain(
  retainedProfiles,
  'Trial 5 — five profiles',
  {
    note: 'Five hydrated profiles retained after narrow → expand → exclude/balance → profile move.',
  },
);

({
  retainedIds,
  anchorStatus: research.inspect(anchor.subject),
  summary: research.summary(),
});
```

### Result and findings

Five hydrated profiles were retained:

- Photo Privacy Tips
- lillyn8n
- Mr. Smit, Artem
- Vulny.app
- Certeus

This was not a claim that all five were people, independent experts, or
globally valuable. Under this trial's caller-selected direction, each had
recent cybersecurity/infosec activity that survived the negative filter and
available profile metadata. The system preserved why each was retained and
left the meaning of those facts to the user.

The bounded-memory behavior worked as intended. Exploration could overwrite
less useful resident evidence without erasing explicitly retained subjects.
The key missing piece is not more automatic scoring; it is a concise
declarative navigation vocabulary which can express:

- narrow a collection by positive or negative conditions;
- expand from that stage with explicit acquisition bounds;
- balance evidence per subject;
- move from event authors to account subjects;
- hydrate the moved subjects;
- retain results with reasons;
- inspect whether retained evidence is still resident.

The trial also confirmed two small API inconsistencies: positive selection is
missing while negative selection exists, and raw inspection differs from its
presented console shape.

## Consolidated operation inventory

This section will be updated after every completed trial.

### Stable library primitives

- Bounded relay acquisition
- Local event and account selection
- Faceting
- Per-key limiting
- Explicit collection construction
- Profile hydration
- Caller annotations
- Reason-preserving retention

### Candidate declarative operations

- Group records by a selected field
- Count grouped records
- Accumulate selected fields per group
- Select representative records per group
- Sort and limit grouped results
- Join or attach records by stable subject ID
- Select media-bearing events without handwritten URL expressions
- Construct a selection while attaching caller-supplied reasons
- Select subjects of one type from a heterogeneous result
- Stage multi-hop navigation as explicit intermediate selections
- Intersect a candidate set with a relationship-derived set
- Preserve several evidence paths on one selected subject
- Represent an attempted path that yields no useful candidates
- Compose positive and negative conditions with `any`, `all`, and `not`
- Match structured tags, domains, text terms, and subject IDs
- Preserve and name intermediate refinement stages
- Balance results by a caller-selected field
- Summarize an account without classifying it
- Project reply and parent evidence into paired concise records
- Count clients, topics, domains, mentions, and normalized repetition
- Sample representative evidence by caller-selected roles
- Refresh or resolve a collection by stable subject identity after acquisition
- Narrow with a positive predicate rather than inverse exclusion
- Move from event authors to account subjects
- Report resident versus retained-but-nonresident evidence
- Compose bounded narrow, expand, balance, move, hydrate, and retain stages

### Presentation concerns

- Facet output needs a caller-controlled display limit or a reusable result
  form when inspecting the long tail.
- Account evidence is easier to assess when profile metadata, counts, domains,
  and representative notes are presented together.
- Comparison needs a concise default containing counts and subject IDs, with
  detailed reasons and provenance requested separately.
- Traversal limits need clearer visibility into which subject and edge types
  consumed the bound.
- Refinement comparisons need concise stage counts and retained examples
  without rendering both complete collections.
- Raw reply-context objects need a concise projection containing excerpts,
  resolution state, relationship evidence, and relay provenance.
- Account lookup by exact stable ID should not require a broad query followed
  by a handwritten filter.
- Raw `inspect` and its console presentation should expose one consistent
  resident/resolved shape.

### User or agent judgment

- Choosing which signal to follow
- Deciding whether repeated content is irrelevant in the current investigation
- Deciding whether profile and activity evidence support group membership
- Naming the group and defining its minimum evidence
- Rejecting weak or ambiguous candidates
- Choosing positive and negative examples
- Deciding which properties of an example become constraints
- Deciding whether a constraint applies only to one investigation or should be
  reused
- Deciding which neutral account evidence is meaningful
- Deciding what direction to follow when the working corpus is full
- Deciding what should be retained while its resident evidence is allowed to
  disappear

### Incidental JavaScript

- The exact image-URL regular expression used in this trial
- Photography-specific tags and exclusions
- The temporary hard-coded candidate ID arrays
- Console formatting used to bypass compact previews
- The exact travel and photography tags selected in Trial 2
- Temporary helper functions that converted heterogeneous traversal results to
  account-only ID arrays
- The campaign-specific domain and tag conjunction from Trial 3
- The exact technology-interest regular expression
- The account-specific client, topic, domain, and mention aggregation code
- The normalized-content regular expression used to inspect repetition
- Fixed excerpt lengths and representative-sample sizes
- The cybersecurity topic chosen from Trial 5's random buffer
- The campaign and semantic-search domains excluded in Trial 5

## Revisions to later trials

Later trial definitions may be sharpened in response to earlier evidence.
Changes must be recorded here before the affected trial begins.

None yet.

## Declarative implementation follow-up

The operation vocabulary was revisited after a live attempt to find working
cryptographers. That attempt reproduced the earlier difficulty of scanning
long-tail profile and activity evidence without handwritten JavaScript.

The current relation algebra now covers the central repeated compositions from
these trials:

- `aggregate` groups records, counts them, and collects or samples fields;
- `join` attaches profile, activity, or graph evidence by stable values;
- `explode` turns nested arrays such as Nostr tags into selectable rows;
- `scan` searches a caller-selected vocabulary across several fields and
  reports the matching field, term, and value;
- `balance` limits evidence per caller-selected key;
- `slice` and offset-aware `show` expose bounded windows; and
- `fetch` and `expand` direct bounded relay work from values already present in
  a relation.

Account evidence remains a composition of these neutral operations rather than
a special task-specific method. Choosing vocabulary, anchors, exclusions,
candidate membership, and the meaning of evidence remains user or agent
judgment.
