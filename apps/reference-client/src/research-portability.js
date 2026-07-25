const clean = (value) => String(value ?? "").trim();

export function muteRulesFromEvent(event) {
  const rules = { accounts: [], topics: [], words: [], events: [], relays: [] };
  if (event?.kind !== 10000) return rules;
  for (const tag of event.tags ?? []) {
    const value = clean(tag[1]);
    if (!value) continue;
    if (tag[0] === "p" && /^[0-9a-f]{64}$/i.test(value)) rules.accounts.push(value.toLowerCase());
    if (tag[0] === "t") rules.topics.push(value.toLowerCase().replace(/^#/, ""));
    if (tag[0] === "word") rules.words.push(value.toLowerCase());
    if (tag[0] === "e" && /^[0-9a-f]{64}$/i.test(value)) rules.events.push(value.toLowerCase());
    if (tag[0] === "relay" && /^wss:\/\//i.test(value)) rules.relays.push(value.replace(/\/$/, ""));
  }
  return Object.fromEntries(Object.entries(rules).map(([key, values]) => [key, [...new Set(values)]]));
}

export function muteEventDraft(rules, pubkey = "") {
  return {
    kind: 10000,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    content: "",
    tags: [
      ...(rules.accounts ?? []).map((value) => ["p", value]),
      ...(rules.topics ?? []).map((value) => ["t", value]),
      ...(rules.words ?? []).map((value) => ["word", value]),
      ...(rules.events ?? []).map((value) => ["e", value]),
      ...(rules.relays ?? []).map((value) => ["relay", value]),
    ],
  };
}

export function eventMatchesMuteRules(event, rules, sources = []) {
  if ((rules.accounts ?? []).includes(event.pubkey?.toLowerCase())) return "account";
  if ((rules.events ?? []).includes(event.id?.toLowerCase())) return "event";
  const topics = (event.tags ?? []).filter((tag) => tag[0] === "t").map((tag) => clean(tag[1]).toLowerCase());
  if (topics.some((topic) => (rules.topics ?? []).includes(topic))) return "topic";
  const content = ` ${String(event.content ?? "").toLowerCase()} `;
  if ((rules.words ?? []).some((word) => word && content.includes(word))) return "word";
  if (sources.some((relay) => (rules.relays ?? []).includes(relay.replace(/\/$/, "")))) return "relay";
  return "";
}

const fingerprint = (values) => {
  let hash = 2166136261;
  for (const character of values.join("\n")) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export function createResearchManifest({ query, constraints, strategy, relays, relayStates, events, blocked, collectedAt = Date.now() }) {
  const eventIds = [...new Set((events ?? []).map((event) => event.id).filter(Boolean))].sort();
  return {
    format: "nostr-research-manifest-v1",
    collectedAt,
    query: query ?? "",
    constraints: constraints ?? {},
    strategy: strategy ?? "search",
    relays: [...new Set(relays ?? [])],
    relayResults: Object.fromEntries([...(relayStates ?? new Map())].map(([relay, state]) => [relay, { state: state.state, count: state.count ?? 0, durationMs: state.duration ?? null }])),
    exclusions: blocked ?? {},
    eventCount: eventIds.length,
    eventIds,
    corpusFingerprint: fingerprint(eventIds),
  };
}
