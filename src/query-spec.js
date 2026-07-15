export const emptyQueryConstraints = () => ({ author: "", kinds: [], tag: "", tagValue: "", days: 0, domain: "", media: "", relay: "" });

export function hasRelayConstraints(constraints = {}) {
  return Boolean(constraints.promotedTopic || constraints.author || constraints.kinds?.length || (constraints.tag && constraints.tagValue) || constraints.days > 0 || constraints.facetDay || constraints.relay);
}

export function constraintsFromFacets(facets = {}, current = emptyQueryConstraints()) {
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

export function constraintChips(constraints = {}) {
  const chips = [];
  if (constraints.promotedTopic) chips.push({ key: "promotedTopic", label: `topic: ${constraints.promotedTopic}`, scope: "relay" });
  if (constraints.author) chips.push({ key: "author", label: `author: ${constraints.author}`, scope: "relay" });
  if (constraints.kinds?.length) chips.push({ key: "kinds", label: `kinds: ${constraints.kinds.join(", ")}`, scope: "relay" });
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

export function applyRelayConstraints(filter, constraints, nowSeconds = Math.floor(Date.now() / 1000)) {
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
