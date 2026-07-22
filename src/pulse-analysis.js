import { eventDomains, kindName, ranked, tags } from "./event-analysis.js";

export const PULSE_WINDOWS = [[1, "1 hour"], [6, "6 hours"], [24, "24 hours"], [168, "7 days"]];
export const PULSE_DEPTHS = [[250, "quick"], [1000, "standard"], [5000, "deep"], [10000, "massive"]];
export const PULSE_SCOPES = [
  ["notes", "Notes", [1, 1111]],
  ["notes_articles", "Notes + articles", [1, 1111, 30023]],
  ["media", "Visual media", [20, 21, 22]],
  ["all", "All public content", [1, 6, 7, 16, 20, 21, 22, 1111, 30023, 9735]],
];

export const defaultPulseSettings = (relays = []) => ({ windowHours: 24, depth: 1000, scope: "notes_articles", relays: relays.slice(0, 4) });
export const pulseKinds = (scope) => PULSE_SCOPES.find(([value]) => value === scope)?.[2] ?? PULSE_SCOPES[1][2];
export function pulseTimeSlices(until, windowSeconds, target, maxPerQuery = 500) {
  const count = Math.max(1, Math.ceil(target / maxPerQuery));
  const width = windowSeconds / count;
  const baseLimit = Math.floor(target / count);
  const remainder = target % count;
  return Array.from({ length: count }, (_, index) => ({
    since: Math.floor(until - (index + 1) * width),
    until: Math.floor(until - index * width),
    limit: baseLimit + (index < remainder ? 1 : 0),
  }));
}

const countMap = (values) => {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
};
const dayFor = (event) => new Date(event.created_at * 1000).toISOString().slice(0, 10);
const normalizedContent = (event) => String(event.content ?? "").toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();

export function analyzeTopicSignals(events, previous = [], sourcesFor = () => []) {
  const previousAuthors = new Map();
  for (const event of previous) for (const topic of tags(event, "t").map((value) => value.toLowerCase())) {
    if (!previousAuthors.has(topic)) previousAuthors.set(topic, new Set());
    previousAuthors.get(topic).add(event.pubkey);
  }
  const grouped = new Map();
  for (const event of events) for (const topic of tags(event, "t").map((value) => value.toLowerCase())) {
    if (!grouped.has(topic)) grouped.set(topic, []);
    grouped.get(topic).push(event);
  }
  return [...grouped].map(([topic, topicEvents]) => {
    const byAuthor = countMap(topicEvents.map((event) => event.pubkey));
    const authors = byAuthor.size;
    const largest = Math.max(...byAuthor.values());
    const dominance = largest / topicEvents.length;
    const days = new Set(topicEvents.map(dayFor)).size;
    const relays = new Set(topicEvents.flatMap(sourcesFor)).size;
    const conversations = topicEvents.filter((event) => tags(event, "e").length || tags(event, "q").length).length;
    const capped = new Set(topicEvents.map((event) => `${event.pubkey}:${dayFor(event)}`)).size;
    const before = previousAuthors.get(topic)?.size ?? 0;
    const deltaAuthors = authors - before;
    const score = authors * 4 + days * 2 + relays * 2 + conversations * 0.5 + capped - dominance * 8;
    const signal = dominance > 0.65 ? "dominated" : authors >= 5 && days >= 2 ? "broad + sustained" : authors >= 3 ? "independent contributors" : "early signal";
    return { topic, events: topicEvents.length, authors, before, deltaAuthors, dominance, days, relays, conversations, capped, score, signal };
  }).filter((item) => item.authors >= 2).sort((a, b) => b.score - a.score || b.authors - a.authors).slice(0, 18);
}

export function analyzeAccountSignals(events, sourcesFor = () => []) {
  const grouped = new Map();
  for (const event of events) {
    if (!grouped.has(event.pubkey)) grouped.set(event.pubkey, []);
    grouped.get(event.pubkey).push(event);
  }
  const all = [...grouped].map(([pubkey, authored]) => {
    const count = authored.length;
    const days = new Set(authored.map(dayFor)).size;
    const relays = new Set(authored.flatMap(sourcesFor)).size;
    const uniqueContent = new Set(authored.map(normalizedContent).filter(Boolean)).size;
    const originality = count ? uniqueContent / count : 0;
    const conversations = authored.filter((event) => tags(event, "e").length || tags(event, "q").length).length;
    const topics = new Set(authored.flatMap((event) => tags(event, "t").map((value) => value.toLowerCase()))).size;
    const perDay = count / Math.max(1, days);
    const noisy = count >= 8 && (originality < 0.45 || perDay > 80);
    const role = noisy ? "high-volume / repetitive" : conversations >= 3 && topics >= 5 ? "bridge + conversational" : conversations >= 3 ? "conversational" : topics > 0 && topics <= 4 && days >= 2 ? "specialist" : "contributor";
    const score = Math.log2(count + 1) * 2 + days * 2 + relays * 2 + originality * 6 + Math.min(conversations, 10) - Math.max(0, perDay - 20) * 0.15;
    return { pubkey, count, days, relays, originality, conversations, topics, perDay, noisy, role, score };
  });
  return {
    recommended: all.filter((item) => !item.noisy).sort((a, b) => b.score - a.score || b.count - a.count).slice(0, 12),
    noise: all.filter((item) => item.noisy).sort((a, b) => b.count - a.count).slice(0, 12),
  };
}

export function analyzePulse(current, previous, relays, sourcesFor) {
  const relayRows = relays.map((relay) => {
    const events = current.filter((event) => sourcesFor(event).includes(relay));
    return { relay, count: events.length, topics: ranked(events.flatMap((event) => tags(event, "t").map((topic) => topic.toLowerCase())), 5), uniqueHere: events.filter((event) => sourcesFor(event).length === 1).length };
  });
  const received = relayRows.reduce((sum, row) => sum + row.count, 0);
  const accountSignals = analyzeAccountSignals(current, sourcesFor);
  const conversationGroups = new Map();
  for (const event of current) for (const id of [...tags(event, "e"), ...tags(event, "q")]) {
    if (!conversationGroups.has(id)) conversationGroups.set(id, { id, events: 0, authors: new Set() });
    const item = conversationGroups.get(id); item.events += 1; item.authors.add(event.pubkey);
  }
  return {
    authors: ranked(current.map((event) => event.pubkey), 12).map(([pubkey, count]) => ({ pubkey, count, relays: new Set(current.filter((event) => event.pubkey === pubkey).flatMap(sourcesFor)).size })),
    topicSignals: analyzeTopicSignals(current, previous, sourcesFor),
    accountSignals: accountSignals.recommended,
    noiseAccounts: accountSignals.noise,
    conversations: [...conversationGroups.values()].map((item) => ({ ...item, authors: item.authors.size })).filter((item) => item.authors >= 2).sort((a, b) => b.authors - a.authors || b.events - a.events).slice(0, 12),
    domains: ranked(current.flatMap(eventDomains), 12),
    kinds: ranked(current.map((event) => kindName(event.kind)), 12),
    relayRows,
    received,
    unique: current.length,
    duplicates: Math.max(0, received - current.length),
    overlapCount: current.filter((event) => sourcesFor(event).length > 1).length,
  };
}
