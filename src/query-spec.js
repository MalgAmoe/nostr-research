import { eventDomains, eventUrls, mediaTypeForUrl } from "./event-analysis.js";

export const emptyQueryConstraints = () => ({ author: "", kinds: [], tag: "", tagValue: "", days: 0, domain: "", media: "", relay: "" });
const KNOWN_KIND_NAMES = new Map([[0, "Profiles"], [1, "Short notes"], [3, "Follow lists"], [6, "Reposts"], [7, "Reactions"], [20, "Pictures"], [21, "Videos"], [22, "Short videos"], [1111, "Comments"], [9735, "Zap receipts"], [30023, "Long articles"]]);
const OPERATIONS = new Set(["replace", "union", "intersect"]);
const MODES = new Set(["topic", "person", "note", "words"]);

export function createResearchDraft(value = {}) {
  const constraints = { ...emptyQueryConstraints(), ...(value.constraints ?? {}) };
  return {
    text: String(value.text ?? ""),
    mode: MODES.has(value.mode) ? value.mode : "topic",
    constraints: { ...constraints, kinds: [...(constraints.kinds ?? [])] },
    operation: OPERATIONS.has(value.operation) ? value.operation : "replace",
    limit: Math.min(1000, Math.max(10, Number(value.limit) || 100)),
  };
}

export function createSearchRequest(draft, overrides = {}) {
  const request = createResearchDraft({ ...draft, ...overrides });
  request.text = request.text.trim();
  return request;
}

export function searchRequestProblem(request) {
  if (request.text || hasRelayConstraints(request.constraints)) return "";
  return constraintChips(request.constraints).length
    ? "Domain and media refine retrieved events locally. Add a relay constraint such as a topic, author, kind, tag, date, or relay."
    : "Enter something to research or add at least one relay constraint.";
}

export function compileRelayPlan(basePlan, request, resolvedConstraints = request.constraints, keywordRelays = [], baseEventIds = []) {
  let filter = applyRelayConstraints(basePlan.filter, resolvedConstraints);
  if (resolvedConstraints.promotedTopic) {
    filter = { ...filter, search: [filter.search, resolvedConstraints.promotedTopic].filter(Boolean).join(" ") };
  }
  const relays = resolvedConstraints.relay ? [resolvedConstraints.relay] : filter.search ? keywordRelays : basePlan.relays;
  const exactLookup = Boolean(filter.ids || (filter["#d"] && filter.authors));
  return {
    ...basePlan,
    filter,
    relays,
    operation: request.operation,
    constraints: resolvedConstraints,
    query: request.text,
    limit: request.limit,
    intersectionBaseIds: request.operation === "intersect" ? baseEventIds : [],
    exactLookup,
  };
}

function hasRelayConstraints(constraints = {}) {
  return Boolean(constraints.promotedTopic || constraints.author || constraints.kinds?.length || (constraints.tag && constraints.tagValue) || constraints.days > 0 || constraints.facetDay || constraints.relay);
}

function constraintsFromFacets(facets = {}, current = emptyQueryConstraints()) {
  return {
    ...current,
    author: facets.author || current.author,
    kinds: facets.kind !== null && facets.kind !== undefined ? [facets.kind] : current.kinds,
    days: facets.day ? 0 : current.days,
    domain: facets.domain || current.domain,
    media: facets.media || current.media,
    relay: facets.relay || current.relay,
    facetDay: facets.day || current.facetDay || "",
    promotedTopic: facets.topic || current.promotedTopic || "",
  };
}

export function researchPatchFromFacets(facets = {}, currentText = "", currentConstraints = emptyQueryConstraints()) {
  const constraints = constraintsFromFacets(facets, currentConstraints);
  return {
    constraints,
    text: hasRelayConstraints(constraints) ? "" : currentText,
    operation: "replace",
  };
}

export function constraintChips(constraints = {}) {
  const chips = [];
  if (constraints.promotedTopic) chips.push({ key: "promotedTopic", label: `topic: ${constraints.promotedTopic}`, scope: "relay" });
  if (constraints.author) chips.push({ key: "author", label: `author: ${constraints.author}`, scope: "relay" });
  if (constraints.kinds?.length) chips.push({ key: "kinds", label: constraints.kinds.map((kind) => `${KNOWN_KIND_NAMES.get(kind) ?? "Event"} · kind ${kind}`).join(" + "), scope: "relay" });
  if (constraints.tag && constraints.tagValue) chips.push({ key: "tag", label: `#${constraints.tag}=${constraints.tagValue}`, scope: "relay" });
  if (constraints.days) chips.push({ key: "days", label: `last ${constraints.days}d`, scope: "relay" });
  if (constraints.facetDay) chips.push({ key: "facetDay", label: `day: ${constraints.facetDay}`, scope: "relay" });
  if (constraints.domain) chips.push({ key: "domain", label: `domain: ${constraints.domain}`, scope: "local" });
  if (constraints.media) chips.push({ key: "media", label: `media: ${constraints.media}`, scope: "local" });
  if (constraints.relay) chips.push({ key: "relay", label: `relay: ${constraints.relay.replace(/^wss:\/\//, "")}`, scope: "relay" });
  return chips;
}

export function removeConstraint(constraints, key) {
  if (key === "kinds") return { ...constraints, kinds: [] };
  if (key === "days") return { ...constraints, days: 0 };
  if (key === "tag") return { ...constraints, tag: "", tagValue: "" };
  return { ...constraints, [key]: "" };
}

function applyRelayConstraints(filter, constraints, nowSeconds = Math.floor(Date.now() / 1000)) {
  const next = { ...filter };
  if (constraints.author) next.authors = [constraints.author];
  if (constraints.kinds?.length) next.kinds = constraints.kinds;
  if (constraints.tag && constraints.tagValue) next[`#${constraints.tag.replace(/^#/, "").slice(0, 1)}`] = [constraints.tagValue.replace(/^#/, "")];
  if (constraints.days > 0) next.since = nowSeconds - constraints.days * 86400;
  if (constraints.facetDay) {
    next.since = Math.floor(new Date(`${constraints.facetDay}T00:00:00Z`).getTime() / 1000);
    next.until = next.since + 86_399;
  }
  return next;
}

export function applyLocalConstraints(events, constraints = {}, sourcesFor = () => [], nowSeconds = Math.floor(Date.now() / 1000)) {
  const dayStart = constraints.facetDay ? Math.floor(new Date(`${constraints.facetDay}T00:00:00Z`).getTime() / 1000) : 0;
  return events.filter((event) => {
    const eventTags = event.tags ?? [];
    const tagValues = (type) => eventTags.filter((tag) => tag[0] === type).map((tag) => String(tag[1] ?? ""));
    const urls = eventUrls(event);
    const domains = eventDomains(event);
    const media = constraints.media;
    const hasMedia = !media || (media === "link" ? urls.length > 0 : urls.some((url) => mediaTypeForUrl(url) === media));
    const promoted = String(constraints.promotedTopic ?? "").toLowerCase().replace(/^#/, "");
    return (!constraints.author || event.pubkey === constraints.author) &&
      (!constraints.kinds?.length || constraints.kinds.includes(event.kind)) &&
      (!(constraints.tag && constraints.tagValue) || tagValues(constraints.tag.replace(/^#/, "").slice(0, 1)).includes(constraints.tagValue.replace(/^#/, ""))) &&
      (!(constraints.days > 0) || event.created_at >= nowSeconds - constraints.days * 86400) &&
      (!dayStart || (event.created_at >= dayStart && event.created_at <= dayStart + 86_399)) &&
      (!constraints.domain || domains.includes(constraints.domain)) &&
      hasMedia &&
      (!constraints.relay || sourcesFor(event).includes(constraints.relay)) &&
      (!promoted || tagValues("t").some((value) => value.toLowerCase() === promoted) || String(event.content ?? "").toLowerCase().includes(promoted));
  });
}
