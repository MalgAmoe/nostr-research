import { eventDomains, kindName, ranked, tags } from "./event-analysis.js";

export const PULSE_WINDOWS = [[1, "1 hour"], [6, "6 hours"], [24, "24 hours"], [168, "7 days"]];
export const PULSE_DEPTHS = [[50, "quick"], [150, "standard"], [400, "deep"]];
export const PULSE_SCOPES = [
  ["notes", "Notes", [1, 1111]],
  ["notes_articles", "Notes + articles", [1, 1111, 30023]],
  ["media", "Visual media", [20, 21, 22]],
  ["all", "All public content", [1, 6, 7, 16, 20, 21, 22, 1111, 30023, 9735]],
];

export const defaultPulseSettings = (relays = []) => ({ windowHours: 24, depth: 150, scope: "notes_articles", relays: relays.slice(0, 2) });
export const pulseKinds = (scope) => PULSE_SCOPES.find(([value]) => value === scope)?.[2] ?? PULSE_SCOPES[1][2];

const countMap = (values) => {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
};
const mediaType = (event) => {
  if ([20].includes(event.kind) || /https?:\/\/[^\s<>]+\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s<>]*)?/i.test(event.content)) return "images";
  if ([21, 22].includes(event.kind) || /https?:\/\/[^\s<>]+\.(?:mp4|webm|mov|m3u8)(?:\?[^\s<>]*)?/i.test(event.content)) return "video";
  if (/https?:\/\/[^\s<>]+\.(?:mp3|wav|ogg|m4a|flac)(?:\?[^\s<>]*)?/i.test(event.content)) return "audio";
  if (/https?:\/\//i.test(event.content)) return "links";
  return "text";
};

export function analyzePulse(current, previous, relays, sourcesFor) {
  const currentTopics = countMap(current.flatMap((event) => tags(event, "t").map((topic) => topic.toLowerCase())));
  const previousTopics = countMap(previous.flatMap((event) => tags(event, "t").map((topic) => topic.toLowerCase())));
  const rising = [...currentTopics].map(([topic, count]) => {
    const before = previousTopics.get(topic) ?? 0;
    return { topic, count, before, delta: count - before, growth: before ? (count - before) / before : null, state: before ? "recurring" : "new" };
  }).filter((item) => item.count >= 2).sort((a, b) => (b.growth ?? 10) - (a.growth ?? 10) || b.delta - a.delta || b.count - a.count).slice(0, 18);
  const relayRows = relays.map((relay) => {
    const events = current.filter((event) => sourcesFor(event).includes(relay));
    return { relay, count: events.length, topics: ranked(events.flatMap((event) => tags(event, "t").map((topic) => topic.toLowerCase())), 5), uniqueHere: events.filter((event) => sourcesFor(event).length === 1).length };
  });
  const received = relayRows.reduce((sum, row) => sum + row.count, 0);
  return {
    rising,
    topics: ranked([...currentTopics.entries()].flatMap(([topic, count]) => Array(count).fill(topic)), 18),
    authors: ranked(current.map((event) => event.pubkey), 12).map(([pubkey, count]) => ({ pubkey, count, relays: new Set(current.filter((event) => event.pubkey === pubkey).flatMap(sourcesFor)).size })),
    domains: ranked(current.flatMap(eventDomains), 12),
    kinds: ranked(current.map((event) => kindName(event.kind)), 12),
    media: ranked(current.map(mediaType), 8),
    relayRows,
    received,
    unique: current.length,
    duplicates: Math.max(0, received - current.length),
    overlapCount: current.filter((event) => sourcesFor(event).length > 1).length,
  };
}
