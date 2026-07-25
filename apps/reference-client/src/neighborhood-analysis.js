import { eventDomains, ranked, tags } from "./event-analysis.js";

const WORDS = /[\p{L}\p{N}_-]{5,}/gu;
const words = (events) => new Set(events.flatMap((event) => event.content?.toLowerCase().match(WORDS) ?? []).filter((word) => !["https", "nostr", "about", "there", "their", "would", "could", "should"].includes(word)));
const overlap = (left, right, limit = 6) => [...left].filter((value) => right.has(value)).slice(0, limit);

export function analyzeNeighborhood(events = [], direction = {}, sourcesFor = () => []) {
  const seedAuthors = new Set(direction.authors ?? []);
  const seedEventIds = new Set(direction.events ?? []);
  const seedEvents = events.filter((event) => seedAuthors.has(event.pubkey) || seedEventIds.has(event.id));
  const seedTopics = new Set([...(direction.topics ?? []), ...seedEvents.flatMap((event) => tags(event, "t").map((topic) => topic.toLowerCase()))]);
  const seedDomains = new Set([...(direction.domains ?? []), ...seedEvents.flatMap(eventDomains)]);
  const seedRelays = new Set(seedEvents.flatMap((event) => sourcesFor(event.id)));
  const seedWords = words(seedEvents);
  const followedBySeeds = new Map();
  const referencedBySeeds = new Map();

  for (const event of seedEvents) {
    if (event.kind === 3) for (const pubkey of tags(event, "p")) followedBySeeds.set(pubkey, (followedBySeeds.get(pubkey) ?? 0) + 1);
    for (const pubkey of tags(event, "p")) referencedBySeeds.set(pubkey, (referencedBySeeds.get(pubkey) ?? 0) + 1);
  }

  const byAuthor = new Map();
  for (const event of events) {
    if (seedAuthors.has(event.pubkey)) continue;
    byAuthor.set(event.pubkey, [...(byAuthor.get(event.pubkey) ?? []), event]);
  }

  return [...byAuthor.entries()].map(([pubkey, authored]) => {
    const candidateTopics = new Set(authored.flatMap((event) => tags(event, "t").map((topic) => topic.toLowerCase())));
    const candidateDomains = new Set(authored.flatMap(eventDomains));
    const candidateRelays = new Set(authored.flatMap((event) => sourcesFor(event.id)));
    const sharedTopics = overlap(seedTopics, candidateTopics);
    const sharedDomains = overlap(seedDomains, candidateDomains);
    const sharedRelays = overlap(seedRelays, candidateRelays);
    const sharedWords = overlap(seedWords, words(authored));
    const conversationEvents = authored.filter((event) =>
      tags(event, "p").some((value) => seedAuthors.has(value))
      || [...tags(event, "e"), ...tags(event, "q")].some((value) => seedEventIds.has(value) || seedEvents.some((seed) => seed.id === value))
    );
    const follows = followedBySeeds.get(pubkey) ?? 0;
    const references = referencedBySeeds.get(pubkey) ?? 0;
    const score = follows * 8 + conversationEvents.length * 6 + references * 4 + sharedTopics.length * 3 + sharedDomains.length * 3 + sharedRelays.length + Math.min(3, sharedWords.length);
    const reasons = [
      follows ? `followed by ${follows} seed account${follows === 1 ? "" : "s"}` : "",
      conversationEvents.length ? `${conversationEvents.length} conversation link${conversationEvents.length === 1 ? "" : "s"} to the direction` : "",
      references ? `referenced by ${references} seed event${references === 1 ? "" : "s"}` : "",
      sharedTopics.length ? `shared topics: ${sharedTopics.map((topic) => `#${topic}`).join(", ")}` : "",
      sharedDomains.length ? `shared domains: ${sharedDomains.join(", ")}` : "",
      sharedRelays.length ? `observed on ${sharedRelays.length} of the same relays` : "",
      sharedWords.length ? `shared vocabulary: ${sharedWords.join(", ")}` : "",
    ].filter(Boolean);
    return {
      pubkey, score, reasons,
      evidenceIds: [...new Set([...conversationEvents.map((event) => event.id), ...authored.filter((event) => sharedTopics.some((topic) => tags(event, "t").map((value) => value.toLowerCase()).includes(topic))).map((event) => event.id)])].slice(0, 12),
      events: authored.length,
      topics: sharedTopics.length,
      domains: sharedDomains.length,
      relays: sharedRelays.length,
    };
  }).filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || right.events - left.events)
    .slice(0, 50);
}
