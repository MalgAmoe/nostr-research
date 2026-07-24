export const kindName = (kind) => ({ 0: "profile metadata", 1: "short note", 3: "follow list", 4: "legacy direct message", 5: "deletion request", 6: "repost", 7: "reaction", 13: "seal", 14: "direct message", 16: "generic repost", 20: "picture", 21: "video", 22: "short video", 40: "channel creation", 41: "channel metadata", 42: "channel message", 1059: "gift wrap", 1111: "comment", 30023: "long-form article", 30078: "app data", 9735: "zap receipt" }[kind] ?? "event");

export const tags = (event, type) => event?.tags?.filter((tag) => tag[0] === type).map((tag) => tag[1]).filter(Boolean) ?? [];

export const ranked = (values, limit = 10) => [...values.reduce((map, value) => value !== undefined && value !== null && value !== "" ? map.set(value, (map.get(value) ?? 0) + 1) : map, new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

export const parseKindList = (value = "") => [...new Set(value.split(/[\s,]+/).filter(Boolean).map(Number).filter((kind) => Number.isInteger(kind) && kind >= 0))];

export const cleanEventUrl = (value = "") => value.replace(/[),.;!?]+$/, "");

export const eventUrls = (event) => [...new Set((event?.content?.match(/https?:\/\/[^\s<>]+/gi) ?? []).map(cleanEventUrl))];

export const mediaTypeForUrl = (url) => /\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s]*)?$/i.test(url) ? "image" : /\.(?:mp4|webm|mov|m4v)(?:\?[^\s]*)?$/i.test(url) ? "video" : /\.(?:mp3|m4a|ogg|wav|flac|aac)(?:\?[^\s]*)?$/i.test(url) ? "audio" : "";

export const eventMedia = (event) => eventUrls(event).map((url) => ({ url, type: mediaTypeForUrl(url) })).filter((item) => item.type);

export const eventDomains = (event) => [...new Set(eventUrls(event).flatMap((value) => { try { return [new URL(value).hostname.replace(/^www\./, "")]; } catch { return []; } }))];

const NOTE_LIKE_KINDS = new Set([1, 20, 21, 22, 30023]);
const contentFingerprint = (event) => NOTE_LIKE_KINDS.has(event.kind) ? (event.content ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim() : "";

export function dedupeForDisplay(events) {
  const groups = new Map();
  const output = [];
  for (const event of events) {
    const fingerprint = contentFingerprint(event);
    if (fingerprint.length < 24) { output.push(event); continue; }
    const key = `${event.kind}:${fingerprint}`;
    const group = groups.get(key);
    if (!group) {
      const representative = { ...event, duplicateCount: 1, duplicateAuthors: [event.pubkey], duplicateIds: [event.id] };
      groups.set(key, representative); output.push(representative);
    } else {
      group.duplicateCount += 1;
      if (!group.duplicateAuthors.includes(event.pubkey)) group.duplicateAuthors.push(event.pubkey);
      group.duplicateIds.push(event.id);
    }
  }
  return output;
}

export function buildGraphModel(events, { selectedId = "", eventLimit = 30, entityLimit = 10, sourcesFor = () => [] } = {}) {
  const corpusIds = new Set(events.map((event) => event.id));
  const referenceIds = (event) => {
    const semantics = parseEventSemantics(event);
    return [...new Set([semantics.root, semantics.parent].filter((item) => item?.type?.toLowerCase() === "e").map((item) => item.value).concat(semantics.quotes, semantics.references).filter((id) => corpusIds.has(id)))];
  };
  const score = (event) => (event.id === selectedId ? 1_000_000 : 0) + referenceIds(event).length * 10_000 + tags(event, "t").length * 100 + event.created_at;
  const chosen = [...events].sort((left, right) => score(right) - score(left)).slice(0, eventLimit);
  const chosenIds = new Set(chosen.map((event) => event.id));
  const authors = ranked(chosen.map((event) => event.pubkey), entityLimit).map(([value, count]) => ({ value, count }));
  const topics = ranked(chosen.flatMap((event) => tags(event, "t").map((value) => value.toLowerCase())), entityLimit).map(([value, count]) => ({ value, count }));
  const domains = ranked(chosen.flatMap(eventDomains), entityLimit).map(([value, count]) => ({ value, count }));
  const relays = ranked(chosen.flatMap(sourcesFor), entityLimit).map(([value, count]) => ({ value, count }));
  const edges = [];
  for (const event of chosen) {
    edges.push({ type: "authored", from: event.pubkey, to: event.id });
    for (const topic of [...new Set(tags(event, "t").map((value) => value.toLowerCase()))]) if (topics.some((item) => item.value === topic)) edges.push({ type: "topic", from: event.id, to: topic });
    for (const domain of eventDomains(event)) if (domains.some((item) => item.value === domain)) edges.push({ type: "domain", from: event.id, to: domain });
    for (const relay of sourcesFor(event)) if (relays.some((item) => item.value === relay)) edges.push({ type: "relay", from: event.id, to: relay });
    const semantics = parseEventSemantics(event);
    for (const id of referenceIds(event)) if (chosenIds.has(id)) {
      const type = semantics.parent?.value === id ? "reply" : semantics.root?.value === id ? "thread" : semantics.quotes.includes(id) ? "quote" : "reference";
      edges.push({ type, from: event.id, to: id });
    }
  }
  return { events: chosen, authors, topics, domains, relays, edges, omitted: Math.max(0, events.length - chosen.length) };
}
import { parseEventSemantics } from "./protocol-semantics.js";
