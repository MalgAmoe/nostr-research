export const kindName = (kind) => ({ 0: "profile metadata", 1: "short note", 3: "follow list", 4: "legacy direct message", 5: "deletion request", 6: "repost", 7: "reaction", 13: "seal", 14: "direct message", 16: "generic repost", 20: "picture", 21: "video", 22: "short video", 40: "channel creation", 41: "channel metadata", 42: "channel message", 1059: "gift wrap", 1111: "comment", 30023: "long-form article", 30078: "app data", 9735: "zap receipt" }[kind] ?? "event");

export const tags = (event, type) => event?.tags?.filter((tag) => tag[0] === type).map((tag) => tag[1]).filter(Boolean) ?? [];

export const ranked = (values, limit = 10) => [...values.reduce((map, value) => value !== undefined && value !== null && value !== "" ? map.set(value, (map.get(value) ?? 0) + 1) : map, new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

export const eventDomains = (event) => [...new Set((event?.content?.match(/https?:\/\/[^\s<>]+/gi) ?? []).flatMap((value) => { try { return [new URL(value.replace(/[),.;!?]+$/, "")).hostname.replace(/^www\./, "")]; } catch { return []; } }))];

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
