const tagValues = (event, name) => (event?.tags ?? []).filter((tag) => tag[0] === name && tag[1]).map((tag) => tag[1]);
const firstTag = (event, name) => (event?.tags ?? []).find((tag) => tag[0] === name && tag[1]);
const relayHint = (tag) => tag?.slice(2).find((value) => /^wss?:\/\//i.test(value)) ?? "";

function eventClass(kind) {
  if (kind === 0 || kind === 3 || (kind >= 10000 && kind < 20000)) return "replaceable";
  if (kind >= 20000 && kind < 30000) return "ephemeral";
  if (kind >= 30000 && kind < 40000) return "addressable";
  return "regular";
}

function eventAddress(event) {
  if (!event || eventClass(event.kind) !== "addressable") return "";
  return `${event.kind}:${event.pubkey}:${firstTag(event, "d")?.[1] ?? ""}`;
}

export function parseEventSemantics(event) {
  const result = {
    class: eventClass(event?.kind),
    address: eventAddress(event),
    root: null,
    parent: null,
    quotes: tagValues(event, "q"),
    mentions: [...new Set([...tagValues(event, "p"), ...tagValues(event, "P")])],
    topics: [...new Set(tagValues(event, "t").map((value) => value.toLowerCase()))],
    addresses: [...new Set([...tagValues(event, "a"), ...tagValues(event, "A")])],
    external: [...new Set([...tagValues(event, "r"), ...tagValues(event, "i"), ...tagValues(event, "I")])],
    relayHints: [...new Set((event?.tags ?? []).map(relayHint).filter(Boolean))],
    references: [],
  };

  if (event?.kind === 1111) {
    const root = firstTag(event, "E") ?? firstTag(event, "A") ?? firstTag(event, "I");
    const parent = firstTag(event, "e") ?? firstTag(event, "a") ?? firstTag(event, "i");
    if (root) result.root = { type: root[0], value: root[1], kind: firstTag(event, "K")?.[1] ?? "", relay: relayHint(root) };
    if (parent) result.parent = { type: parent[0], value: parent[1], kind: firstTag(event, "k")?.[1] ?? "", relay: relayHint(parent) };
  } else if (event?.kind === 1) {
    const eventTags = (event.tags ?? []).filter((tag) => tag[0] === "e" && tag[1]);
    const markedRoot = eventTags.find((tag) => tag[3] === "root");
    const markedParent = eventTags.find((tag) => tag[3] === "reply");
    if (markedRoot) result.root = { type: "e", value: markedRoot[1], relay: relayHint(markedRoot), inferred: false };
    if (markedParent) result.parent = { type: "e", value: markedParent[1], relay: relayHint(markedParent), inferred: false };
    if (!markedRoot && !markedParent && eventTags.length) {
      result.root = { type: "e", value: eventTags[0][1], relay: relayHint(eventTags[0]), inferred: true };
      result.parent = { type: "e", value: eventTags.at(-1)[1], relay: relayHint(eventTags.at(-1)), inferred: true };
    } else if (markedRoot && !markedParent) {
      result.parent = { ...result.root };
    }
  }

  const structural = new Set([result.root?.value, result.parent?.value, ...result.quotes].filter(Boolean));
  result.references = [...new Set([
    ...tagValues(event, "e"), ...tagValues(event, "E"), ...tagValues(event, "a"), ...tagValues(event, "A"), ...result.quotes,
  ].filter((value) => !structural.has(value)))];
  return result;
}

export function describeTag(event, tag) {
  const semantics = parseEventSemantics(event);
  const name = tag?.[0] ?? "";
  const value = tag?.[1] ?? "";
  if (semantics.root?.type === name && semantics.root.value === value) return { role: "thread root", relation: true };
  if (semantics.parent?.type === name && semantics.parent.value === value) return { role: "direct parent", relation: true };
  if (name === "q") return { role: "quoted event", relation: true };
  if (name === "p" || name === "P") return { role: name === "P" ? "root author" : "mentioned account", relation: true };
  if (name === "a" || name === "A") return { role: name === "A" ? "root address" : "address reference", relation: true };
  if (name === "e" || name === "E") return { role: "event reference", relation: true };
  if (name === "t") return { role: "topic", relation: true };
  if (name === "r") return { role: "web resource", relation: true };
  if (name === "i" || name === "I") return { role: name === "I" ? "external root" : "external parent", relation: true };
  if (name === "d") return { role: "address identifier", relation: false };
  if (name === "k" || name === "K") return { role: name === "K" ? "root kind" : "parent kind", relation: false };
  if (name === "l") return { role: "content label", relation: false };
  if (name === "L") return { role: "label namespace", relation: false };
  if (name === "expiration") return { role: "expiration time", relation: false };
  if (["title", "summary", "subject", "image", "published_at", "alt", "client"].includes(name)) return { role: "event metadata", relation: false };
  return { role: "custom protocol field", relation: false };
}

export function reconcileEventState(events = []) {
  const state = new Map(events.map((event) => [event.id, { state: "current", replacedBy: "", deletionBy: "" }]));
  const versions = new Map();
  for (const event of events) {
    const classification = eventClass(event.kind);
    const key = classification === "replaceable" ? `${event.pubkey}:${event.kind}` : classification === "addressable" ? eventAddress(event) : "";
    if (!key) continue;
    if (!versions.has(key)) versions.set(key, []);
    versions.get(key).push(event);
  }
  for (const group of versions.values()) {
    group.sort((left, right) => right.created_at - left.created_at || left.id.localeCompare(right.id));
    for (const older of group.slice(1)) state.set(older.id, { state: "superseded", replacedBy: group[0].id, deletionBy: "" });
  }
  const byId = new Map(events.map((event) => [event.id, event]));
  for (const request of events.filter((event) => event.kind === 5)) {
    for (const id of tagValues(request, "e")) {
      const target = byId.get(id);
      if (target?.pubkey === request.pubkey) state.set(id, { ...state.get(id), state: "deletion requested", deletionBy: request.id });
    }
    for (const address of tagValues(request, "a")) for (const target of events) {
      if (target.pubkey === request.pubkey && eventAddress(target) === address) state.set(target.id, { ...state.get(target.id), state: "deletion requested", deletionBy: request.id });
    }
  }
  return state;
}
