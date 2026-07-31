export type SignalKind = 'note' | 'reply' | 'media' | 'account';

export type Signal = {
  id: string;
  fieldId: string;
  kind: SignalKind;
  authorId: string;
  author: string;
  handle: string;
  content: string;
  createdAt: string;
  position: [number, number, number];
  relayCount: number;
  parentId?: string;
  media?: { type: 'image' | 'video'; src?: string; label: string };
};

export type Field = {
  id: string;
  label: string;
  shortLabel: string;
  role: 'ground' | 'branch';
  reason: string;
  handle: { id: string; kind: string; count: number };
  defaultFocusId: string;
  source: string;
  completion: string;
  uncertainty: string;
  excludedWarnings: number;
  signals: Signal[];
};

const groundSignals: Signal[] = [
  {
    id: '7e4a', fieldId: 'ground', kind: 'media', authorId: 'npub-orchid', author: 'Orchid Relay', handle: '@orchid',
    content: 'The garden is finally broadcasting again. Tiny radio, wet soil, no audience required.',
    createdAt: '23:41:08 UTC', position: [0, 0.5, 0], relayCount: 2,
    media: { type: 'image', src: '/media/orbit-garden.svg', label: 'Orbital garden at dusk' },
  },
  {
    id: 'ae12', fieldId: 'ground', kind: 'note', authorId: 'npub-mira', author: 'Mira', handle: '@mira',
    content: 'Some networks feel less like a feed and more like weather.', createdAt: '23:39:51 UTC',
    position: [-3.3, 1.8, -1.7], relayCount: 1,
  },
  {
    id: 'b932', fieldId: 'ground', kind: 'reply', authorId: 'npub-hex', author: 'Hex River', handle: '@hexriver',
    content: 'A map is only honest when it shows where the fog begins.', createdAt: '23:37:18 UTC',
    position: [3.5, 1.4, -2.2], relayCount: 2,
  },
  {
    id: 'c118', fieldId: 'ground', kind: 'note', authorId: 'npub-rin', author: 'Rin', handle: '@rin',
    content: 'late train, open protocol, one good song', createdAt: '23:34:05 UTC',
    position: [-4.5, -1.7, -3.4], relayCount: 1,
  },
  {
    id: 'd0f4', fieldId: 'ground', kind: 'media', authorId: 'npub-sable', author: 'Sable', handle: '@sable',
    content: 'Thirty seconds of rain against the observatory window.', createdAt: '23:30:44 UTC',
    position: [4.8, -1.9, -3.8], relayCount: 1,
    media: { type: 'video', label: 'Short video · not loaded in fixture flight' },
  },
  {
    id: 'e711', fieldId: 'ground', kind: 'note', authorId: 'npub-ash', author: 'Ash', handle: '@ash',
    content: 'Build the strange thing, but leave a door back to plain text.', createdAt: '23:26:02 UTC',
    position: [-1.7, -2.7, -4.8], relayCount: 3,
  },
  {
    id: 'f640', fieldId: 'ground', kind: 'note', authorId: 'npub-io', author: 'Io', handle: '@io',
    content: 'What did your relay show you tonight?', createdAt: '23:22:17 UTC',
    position: [1.8, 2.8, -5.1], relayCount: 2,
  },
  {
    id: '08bc', fieldId: 'ground', kind: 'note', authorId: 'npub-noon', author: 'Noon', handle: '@noon',
    content: 'A quiet note from a loud planet.', createdAt: '23:20:31 UTC',
    position: [5.4, 0.2, -5.7], relayCount: 1,
  },
  {
    id: '19da', fieldId: 'ground', kind: 'note', authorId: 'npub-kite', author: 'Kite', handle: '@kite',
    content: 'Leaving this signal here for whoever passes next.', createdAt: '23:17:09 UTC',
    position: [-5.7, 0.4, -6.1], relayCount: 1,
  },
];

const conversationSignals: Signal[] = [
  { ...groundSignals[0], fieldId: 'conversation', position: [0, 1.9, -1] },
  {
    id: '21a0', fieldId: 'conversation', kind: 'reply', authorId: 'npub-mira', author: 'Mira', handle: '@mira',
    content: 'The no-audience-required part is the best part.', createdAt: '23:43:22 UTC',
    position: [-3.8, 0.1, -2.2], relayCount: 2, parentId: '7e4a',
  },
  {
    id: '31b1', fieldId: 'conversation', kind: 'reply', authorId: 'npub-hex', author: 'Hex River', handle: '@hexriver',
    content: 'What frequency? I want to listen from the workshop.', createdAt: '23:45:06 UTC',
    position: [3.7, 0.2, -2.4], relayCount: 1, parentId: '7e4a',
  },
  {
    id: '42c2', fieldId: 'conversation', kind: 'reply', authorId: 'npub-orchid', author: 'Orchid Relay', handle: '@orchid',
    content: 'Tiny packet radio for now. I will publish the build notes when they stop embarrassing me.',
    createdAt: '23:46:19 UTC', position: [2.7, -2.4, -3.7], relayCount: 2, parentId: '31b1',
  },
  {
    id: '53d3', fieldId: 'conversation', kind: 'reply', authorId: 'npub-kite', author: 'Kite', handle: '@kite',
    content: 'Plants are excellent network operators: patient, local, and mostly indifferent to metrics.',
    createdAt: '23:49:02 UTC', position: [-2.8, -2.3, -3.8], relayCount: 1, parentId: '7e4a',
  },
  {
    id: '64e4', fieldId: 'conversation', kind: 'reply', authorId: 'npub-sable', author: 'Sable', handle: '@sable',
    content: 'Please keep one microphone near the rain barrel.', createdAt: '23:51:44 UTC',
    position: [0, -3.6, -5], relayCount: 1, parentId: '42c2',
  },
];

const authorSignals: Signal[] = [
  { ...groundSignals[0], fieldId: 'author', position: [0, 1.6, -1] },
  {
    id: '75f5', fieldId: 'author', kind: 'note', authorId: 'npub-orchid', author: 'Orchid Relay', handle: '@orchid',
    content: 'Solar controller survived the storm. The cheap enclosure did not.', createdAt: 'Yesterday',
    position: [-3.7, 0.5, -2.5], relayCount: 2,
  },
  {
    id: '86a6', fieldId: 'author', kind: 'media', authorId: 'npub-orchid', author: 'Orchid Relay', handle: '@orchid',
    content: 'First leaf from the seed exchange.', createdAt: '2 days ago', position: [3.8, 0.4, -2.8], relayCount: 1,
    media: { type: 'image', src: '/media/orbit-garden.svg', label: 'Seedling fixture frame' },
  },
  {
    id: '97b7', fieldId: 'author', kind: 'note', authorId: 'npub-orchid', author: 'Orchid Relay', handle: '@orchid',
    content: 'Garden telemetry is public again: temperature, moisture, battery. No interpretation attached.',
    createdAt: '4 days ago', position: [-2.4, -2.1, -4], relayCount: 3,
  },
  {
    id: 'a8c8', fieldId: 'author', kind: 'note', authorId: 'npub-orchid', author: 'Orchid Relay', handle: '@orchid',
    content: 'Antenna moved twelve centimeters east. Signal improved. Causality not established.',
    createdAt: '6 days ago', position: [2.5, -2.2, -4.2], relayCount: 2,
  },
];

export const fields: Record<string, Field> = {
  ground: {
    id: 'ground', label: 'Near-field signals', shortLabel: 'GROUND', role: 'ground',
    reason: 'Recorded bounded kind-1 fixture field.', handle: { id: 'fixture-ground', kind: 'events', count: groundSignals.length },
    defaultFocusId: '7e4a', source: 'wss://fixture.nostrarium.invalid', completion: 'EOSE', excludedWarnings: 1,
    uncertainty: 'Recorded bounded attempt · relay completeness is not implied.', signals: groundSignals,
  },
  conversation: {
    id: 'conversation', label: 'Garden conversation', shortLabel: 'THREAD', role: 'branch',
    reason: 'Explicit fixture continuation from signal 7e4a.', handle: { id: 'fixture-conversation', kind: 'events', count: conversationSignals.length },
    defaultFocusId: '7e4a', source: 'fixture continuation', completion: 'RECORDED', excludedWarnings: 0,
    uncertainty: 'Fixture relationship field · no live acquisition occurred.', signals: conversationSignals,
  },
  author: {
    id: 'author', label: 'Orchid signal history', shortLabel: 'AUTHOR', role: 'branch',
    reason: 'Explicit fixture author-history selection.', handle: { id: 'fixture-author-history', kind: 'events', count: authorSignals.length },
    defaultFocusId: '7e4a', source: 'fixture author selection', completion: 'RECORDED', excludedWarnings: 0,
    uncertainty: 'Bounded fixture history · account ownership is not inferred.', signals: authorSignals,
  },
};

export const accountFacts: Record<string, { name: string; handle: string; publicKey: string; claim: string }> = {
  'npub-orchid': {
    name: 'Orchid Relay', handle: '@orchid', publicKey: 'npub1orchid7h5…4q9m',
    claim: 'Small radios, wet soil, occasional build notes.',
  },
  'npub-mira': { name: 'Mira', handle: '@mira', publicKey: 'npub1mira92e…n7pc', claim: 'Field notes and passing weather.' },
  'npub-hex': { name: 'Hex River', handle: '@hexriver', publicKey: 'npub1hex44aa…s2kt', claim: 'Workshop transmissions.' },
  'npub-rin': { name: 'Rin', handle: '@rin', publicKey: 'npub1rin5df…89je', claim: 'Late trains and open systems.' },
  'npub-sable': { name: 'Sable', handle: '@sable', publicKey: 'npub1sable8g…0lqv', claim: 'Sound fragments.' },
  'npub-ash': { name: 'Ash', handle: '@ash', publicKey: 'npub1ash87c…3mx0', claim: 'Plain-text doors.' },
  'npub-io': { name: 'Io', handle: '@io', publicKey: 'npub1io50ke…8bc1', claim: 'Questions in public.' },
  'npub-noon': { name: 'Noon', handle: '@noon', publicKey: 'npub1noon0a…9f4q', claim: 'Quiet notes.' },
  'npub-kite': { name: 'Kite', handle: '@kite', publicKey: 'npub1kite33…5ypa', claim: 'Signals left in passing.' },
};
