import { dedupeForDisplay, eventDomains, eventMedia, eventUrls, tags } from "./event-analysis.js";

export function mergeSearchResults(incoming, base, operation) {
  if (operation === "union") return uniqueById([...base, ...incoming]);
  if (operation === "intersect") {
    const incomingIds = new Set(incoming.map((event) => event.id));
    return base.filter((event) => incomingIds.has(event.id));
  }
  return incoming;
}

export function pageAdditions(incoming, current, plan = {}) {
  const existing = new Set(current.map((event) => event.id));
  const allowed = plan.operation === "intersect" ? new Set(plan.intersectionBaseIds ?? []) : null;
  return incoming.filter((event) => !existing.has(event.id) && (!allowed || allowed.has(event.id)));
}

export function presentCorpus(events, presentation = {}, sourcesFor = () => [], nowSeconds = Math.floor(Date.now() / 1000)) {
  const cutoff = presentation.sinceDays ? nowSeconds - presentation.sinceDays * 86400 : 0;
  const kindFilter = presentation.kindFilter ?? "all";
  const eligible = events.filter((event) =>
    (!cutoff || event.created_at >= cutoff) &&
    (kindFilter === "all" ||
      (kindFilter === "notes" && event.kind === 1) ||
      (kindFilter === "profiles" && event.kind === 0) ||
      (kindFilter === "follows" && event.kind === 3) ||
      (kindFilter === "articles" && event.kind === 30023) ||
      (kindFilter === "other" && ![0, 1, 3, 30023].includes(event.kind)))
  );
  const facets = presentation.facets ?? {};
  const visible = eligible.filter((event) =>
    (!facets.topic || tags(event, "t").some((topic) => topic.toLowerCase() === facets.topic)) &&
    (!facets.author || event.pubkey === facets.author) &&
    (facets.kind === null || facets.kind === undefined || event.kind === facets.kind) &&
    (!facets.day || new Date(event.created_at * 1000).toISOString().slice(0, 10) === facets.day) &&
    (!facets.domain || eventDomains(event).includes(facets.domain)) &&
    (!facets.relay || sourcesFor(event).includes(facets.relay)) &&
    (!facets.media || (facets.media === "link" ? eventUrls(event).length > 0 : eventMedia(event).some((item) => item.type === facets.media)))
  );
  return { eligible, visible: presentation.dedupe ? dedupeForDisplay(visible) : visible };
}

const uniqueById = (events) => [...new Map(events.filter((event) => event?.id).map((event) => [event.id, event])).values()];
