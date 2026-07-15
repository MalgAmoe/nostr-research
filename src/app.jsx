import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { render } from "solid-js/web";
import { SimplePool, nip19 } from "nostr-tools";
import { latestRun, listCollections, listRecipes, loadEvents, saveCollection, saveRecipe, saveRun, storeEvents } from "./research-store.js";
import { loadRelayInformationSet } from "./relay-info.js";
import "./styles.css";

const SEARCH_RELAYS_KEY = "nostr-research-relays-v2";
const PATHS_KEY = "nostr-research-paths-v3";
const SESSION_KEY = "nostr-research-session-v1";
const DEFAULT_SEARCH_RELAYS = ["wss://search.nos.today"];
const READ_RELAYS = ["wss://nos.lol", "wss://relay.damus.io", "wss://relay.primal.net"];
const FALLBACK_READ_RELAYS = ["wss://purplepag.es"];
const PAGE_SIZE = 40;
const MAX_WAIT = 4500;
const pool = new SimplePool({ enableReconnect: true });
const cache = new Map();
const sourceIndex = new Map();

const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  const serialized = JSON.stringify(value);
  try { localStorage.setItem(key, serialized); return true; }
  catch (error) {
    if (error?.name !== "QuotaExceededError") return false;
    try { localStorage.removeItem(key); localStorage.setItem(key, serialized); return true; }
    catch { return false; }
  }
};
const unique = (events) => [...new Map(events.filter((event) => event?.id).map((event) => [event.id, event])).values()];
const short = (value = "") => value.length > 18 ? `${value.slice(0, 9)}…${value.slice(-7)}` : value;
const tags = (event, type) => event?.tags?.filter((tag) => tag[0] === type).map((tag) => tag[1]).filter(Boolean) ?? [];
const compact = (value = "", length = 150) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text || "Untitled event";
};
const kindName = (kind) => ({ 0: "profile metadata", 1: "short note", 3: "follow list", 4: "legacy direct message", 5: "deletion request", 6: "repost", 7: "reaction", 13: "seal", 14: "direct message", 16: "generic repost", 20: "picture", 21: "video", 22: "short video", 40: "channel creation", 41: "channel metadata", 42: "channel message", 1059: "gift wrap", 30023: "long-form article", 30078: "app data" }[kind] ?? "event");
const ranked = (values, limit = 10) => [...values.reduce((map, value) => value !== undefined && value !== null && value !== "" ? map.set(value, (map.get(value) ?? 0) + 1) : map, new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
const emptyFacets = () => ({ topic: "", author: "", kind: null, day: "", domain: "", relay: "" });
const eventDomains = (event) => [...new Set((event?.content?.match(/https?:\/\/[^\s<>]+/gi) ?? []).flatMap((value) => { try { return [new URL(value.replace(/[),.;!?]+$/, "")).hostname.replace(/^www\./, "")]; } catch { return []; } }))];
const NOTE_LIKE_KINDS = new Set([1, 20, 21, 22, 30023]);
const contentFingerprint = (event) => NOTE_LIKE_KINDS.has(event.kind) ? (event.content ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim() : "";
const dedupeForDisplay = (events) => {
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
};

function logUsage(type, detail = {}) {
  fetch("/api/log", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, ...detail }) }).catch(() => {});
}

function parseRoute() {
  const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [kind = "search", ...rest] = path.split("/");
  return { kind: kind || "search", value: decodeURIComponent(rest.join("/")), params: new URLSearchParams(query) };
}

function routeForNip19(code) {
  try {
    const decoded = nip19.decode(code);
    if (decoded.type === "npub" || decoded.type === "nprofile") return `#/account/${typeof decoded.data === "string" ? decoded.data : decoded.data.pubkey}`;
    if (decoded.type === "note" || decoded.type === "nevent") return `#/event/${typeof decoded.data === "string" ? decoded.data : decoded.data.id}`;
    if (decoded.type === "naddr") return `#/address/${decoded.data.kind}:${decoded.data.pubkey}:${encodeURIComponent(decoded.data.identifier)}`;
  } catch {}
  return "";
}

async function queryRelay(relay, filter, label) {
  const started = performance.now();
  try {
    let timer;
    const events = await Promise.race([
      pool.querySync([relay], filter, { maxWait: MAX_WAIT, label }),
      new Promise((resolve) => { timer = setTimeout(() => resolve([]), MAX_WAIT); })
    ]);
    clearTimeout(timer);
    for (const event of events) {
      const sources = new Set(sourceIndex.get(event.id) ?? []);
      sources.add(relay);
      sourceIndex.set(event.id, [...sources]);
    }
    void storeEvents(events, sourceIndex);
    logUsage("relay_query", { relay, label, state: "ok", count: events.length, durationMs: Math.round(performance.now() - started) });
    return events;
  } catch (error) {
    logUsage("relay_query", { relay, label, state: "error", detail: error.message, count: 0, durationMs: Math.round(performance.now() - started) });
    return [];
  }
}

async function readEvents(filter, label, relays = READ_RELAYS) {
  const key = `${relays.join(",")}:${JSON.stringify(filter)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < 60_000) return cached.events;
  if (cached?.promise) return cached.promise;
  const promise = Promise.all(relays.map((relay) => queryRelay(relay, filter, label))).then((batches) => {
    const events = unique(batches.flat());
    cache.set(key, { at: Date.now(), events });
    return events;
  });
  cache.set(key, { promise });
  return promise;
}

function App() {
  const restored = load(SESSION_KEY, {});
  const [route, setRoute] = createSignal(parseRoute());
  const [query, setQuery] = createSignal(restored.query ?? "");
  const [results, setResults] = createSignal(restored.corpus ?? []);
  const [profiles, setProfiles] = createSignal(new Map());
  const [loading, setLoading] = createSignal(false);
  const [routeLoading, setRouteLoading] = createSignal(false);
  const [routeData, setRouteData] = createSignal(null);
  const [error, setError] = createSignal("");
  const [relayStates, setRelayStates] = createSignal(new Map());
  const [searchRelays, setSearchRelays] = createSignal(load(SEARCH_RELAYS_KEY, DEFAULT_SEARCH_RELAYS));
  const [relayDraft, setRelayDraft] = createSignal(searchRelays().join("\n"));
  const [kindFilter, setKindFilter] = createSignal(restored.kindFilter ?? "all");
  const [sinceDays, setSinceDays] = createSignal(restored.sinceDays ?? 0);
  const [combineMode, setCombineMode] = createSignal("replace");
  const [view, setView] = createSignal(restored.view ?? "list");
  const [pinned, setPinned] = createSignal(new Set(restored.pinned ?? []));
  const [selectedId, setSelectedId] = createSignal(restored.selectedId ?? "");
  const [steps, setSteps] = createSignal(restored.steps ?? []);
  const [paths, setPaths] = createSignal(load(PATHS_KEY, []));
  const [builderAuthor, setBuilderAuthor] = createSignal("");
  const [builderKinds, setBuilderKinds] = createSignal("");
  const [builderTag, setBuilderTag] = createSignal("");
  const [builderTagValue, setBuilderTagValue] = createSignal("");
  const [builderDays, setBuilderDays] = createSignal("");
  const [startMode, setStartMode] = createSignal("topic");
  const [entryReasons, setEntryReasons] = createSignal(restored.entryReasons ?? {});
  const [expansionStatus, setExpansionStatus] = createSignal(null);
  const [expansionOperation, setExpansionOperation] = createSignal("union");
  const [pulseEvents, setPulseEvents] = createSignal([]);
  const [pulseLoading, setPulseLoading] = createSignal(false);
  const [dedupeEnabled, setDedupeEnabled] = createSignal(restored.dedupeEnabled ?? true);
  const [lastQueryPlan, setLastQueryPlan] = createSignal(null);
  const [paging, setPaging] = createSignal(false);
  const [hasMore, setHasMore] = createSignal(true);
  const [pageMessage, setPageMessage] = createSignal("");
  const [activeRecipeId, setActiveRecipeId] = createSignal("");
  const [collections, setCollections] = createSignal([]);
  const [collectionDraft, setCollectionDraft] = createSignal("");
  const [lastRunDelta, setLastRunDelta] = createSignal(null);
  const [relayInformation, setRelayInformation] = createSignal(new Map());
  const [activeFacets, setActiveFacets] = createSignal(emptyFacets());
  let searchToken = 0;
  const knownEvents = new Map();
  const rememberEvents = (events) => { for (const event of events) knownEvents.set(event.id, event); return events; };
  rememberEvents(results());
  const selectedEvent = createMemo(() => knownEvents.get(selectedId()) ?? results().find((event) => event.id === selectedId()));
  const addStep = (step) => setSteps((current) => [...current, { id: crypto.randomUUID(), at: Date.now(), ...step }].slice(-30));

  const inspectRelays = async (relays) => {
    const information = await loadRelayInformationSet(relays);
    setRelayInformation((current) => new Map([...current, ...information]));
  };

  async function recordResearchRun(details, events) {
    const recipeId = activeRecipeId();
    if (!recipeId) return;
    const previous = await latestRun(recipeId);
    const eventIds = events.map((event) => event.id);
    const previousIds = new Set(previous?.eventIds ?? []);
    const currentIds = new Set(eventIds);
    const added = eventIds.filter((id) => !previousIds.has(id));
    const missing = [...previousIds].filter((id) => !currentIds.has(id));
    const overlap = previousIds.size ? [...currentIds].filter((id) => previousIds.has(id)).length / new Set([...previousIds, ...currentIds]).size : null;
    const run = { id: crypto.randomUUID(), recipeId, completedAt: Date.now(), eventIds, details, relayStates: Object.fromEntries(relayStates()) };
    await saveRun(run);
    setLastRunDelta({ previous: Boolean(previous), added: added.length, missing: missing.length, overlap });
  }

  const profileFor = (pubkey) => profiles().get(pubkey) ?? { name: short(pubkey), handle: "unresolved", about: "" };
  const rememberProfiles = (events) => {
    if (!events.length) return;
    setProfiles((previous) => {
      const next = new Map(previous);
      for (const event of events.sort((a, b) => a.created_at - b.created_at)) {
        try {
          const metadata = JSON.parse(event.content);
          next.set(event.pubkey, { name: metadata.display_name || metadata.name || short(event.pubkey), handle: metadata.nip05 || short(event.pubkey), about: metadata.about || "" });
        } catch {}
      }
      return next;
    });
  };
  const hydrateProfiles = async (events, token = searchToken) => {
    const authors = [...new Set(events.map((event) => event.pubkey).filter((pubkey) => !profiles().has(pubkey)))].slice(0, 100);
    if (!authors.length) return;
    const metadata = await readEvents({ authors, kinds: [0], limit: authors.length }, "profiles");
    if (token === searchToken) rememberProfiles(metadata);
  };

  async function resolveSearch(value) {
    const text = value.trim();
    if (/^[0-9a-f]{64}$/i.test(text)) return { filter: { ids: [text] }, relays: READ_RELAYS, mode: "event id" };
    if (text.startsWith("#")) return { filter: { "#t": [text.slice(1).toLowerCase()], limit: 50 }, relays: READ_RELAYS, mode: "topic" };
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) {
      const [name, domain] = text.split("@");
      const response = await fetch(`https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`);
      const pubkey = (await response.json()).names?.[name];
      if (!pubkey) throw new Error("NIP-05 identifier did not resolve");
      return { filter: { authors: [pubkey], limit: 50 }, relays: READ_RELAYS, mode: "NIP-05" };
    }
    if (/^(npub|nprofile|note|nevent|naddr)1/i.test(text)) {
      const decoded = nip19.decode(text);
      if (decoded.type === "npub") return { filter: { authors: [decoded.data], limit: 50 }, relays: READ_RELAYS, mode: "npub" };
      if (decoded.type === "nprofile") return { filter: { authors: [decoded.data.pubkey], limit: 50 }, relays: decoded.data.relays?.length ? decoded.data.relays : READ_RELAYS, mode: "nprofile" };
      if (decoded.type === "note") return { filter: { ids: [decoded.data] }, relays: READ_RELAYS, mode: "note" };
      if (decoded.type === "nevent") return { filter: { ids: [decoded.data.id] }, relays: decoded.data.relays?.length ? decoded.data.relays : READ_RELAYS, mode: "nevent" };
      if (decoded.type === "naddr") return { filter: { authors: [decoded.data.pubkey], kinds: [decoded.data.kind], "#d": [decoded.data.identifier] }, relays: decoded.data.relays?.length ? decoded.data.relays : READ_RELAYS, mode: "naddr" };
    }
    return { filter: { search: text, limit: 50 }, relays: searchRelays(), mode: "NIP-50" };
  }

  async function runSearch(value = query(), operation = combineMode()) {
    const text = value.trim();
    if (!text) return;
    const token = ++searchToken;
    const started = performance.now();
    const base = results();
    let incoming = [];
    setQuery(text); setLoading(true); setError("");
    if (operation === "replace") { setResults([]); setActiveFacets(emptyFacets()); }
    if (route().kind !== "search") location.hash = "#/search";
    logUsage("search_started", { query: text });
    try {
      const plan = await resolveSearch(text);
      setLastQueryPlan(plan); setHasMore(true); setPageMessage("");
      void inspectRelays(plan.relays);
      const states = new Map(plan.relays.map((relay) => [relay, { state: "searching", count: 0 }]));
      setRelayStates(states);
      await Promise.all(plan.relays.map(async (relay) => {
        const relayStarted = performance.now();
        const events = await queryRelay(relay, plan.filter, plan.mode);
        if (token !== searchToken) return;
        rememberEvents(events);
        incoming = unique([...incoming, ...events]);
        const next = operation === "union" ? unique([...base, ...incoming]) : operation === "intersect" ? base.filter((event) => incoming.some((candidate) => candidate.id === event.id)) : incoming;
        setResults(next.sort((a, b) => b.created_at - a.created_at));
        setRelayStates((current) => new Map(current).set(relay, { state: "ok", count: events.length, ids: events.map((event) => event.id), duration: Math.round(performance.now() - relayStarted) }));
      }));
      if (token !== searchToken) return;
      addStep({ type: "seed", label: `${operation} · ${text}`, inputCount: base.length, outputCount: results().length, query: text, operation });
      logUsage("search_completed", { query: text, mode: plan.mode, resultCount: results().length, durationMs: Math.round(performance.now() - started) });
      void recordResearchRun({ query: text, mode: plan.mode, filter: plan.filter, relays: plan.relays, operation }, results());
      hydrateProfiles(results(), token);
    } catch (cause) {
      setError(cause.message);
      logUsage("search_failed", { query: text, error: cause.message });
    } finally { if (token === searchToken) setLoading(false); }
  }

  async function loadMoreResults() {
    if (paging() || !results().length) return;
    setPaging(true); setPageMessage("Requesting older events from the relays…");
    try {
      const plan = lastQueryPlan() ?? await resolveSearch(query());
      setLastQueryPlan(plan);
      if (plan.filter.ids || (plan.filter["#d"] && plan.filter.authors)) { setHasMore(false); setPageMessage("This lookup identifies a specific event; there are no additional pages."); return; }
      const oldest = Math.min(...results().map((event) => event.created_at));
      const filter = { ...plan.filter, until: oldest - 1, limit: 100 };
      const batches = await Promise.all(plan.relays.map((relay) => queryRelay(relay, filter, `${plan.mode}-older`)));
      const incoming = rememberEvents(unique(batches.flat()));
      const existing = new Set(results().map((event) => event.id));
      const added = incoming.filter((event) => !existing.has(event.id));
      if (added.length) {
        setResults((current) => unique([...current, ...added]).sort((a, b) => b.created_at - a.created_at));
        setEntryReasons((current) => ({ ...current, ...Object.fromEntries(added.map((event) => [event.id, `older results for ${query()}`])) }));
        setPageMessage(`Added ${added.length} older ${added.length === 1 ? "event" : "events"}.`);
        hydrateProfiles(added, searchToken);
      } else {
        setHasMore(false); setPageMessage("No more older events were returned by these relays.");
      }
      logUsage("search_page", { query: query(), cursor: oldest - 1, returned: incoming.length, added: added.length });
    } catch (cause) { setPageMessage(`Could not load more: ${cause.message}`); }
    finally { setPaging(false); }
  }

  const mergeIncoming = (incoming, base, operation) => operation === "union" ? unique([...base, ...incoming]) : operation === "intersect" ? base.filter((event) => incoming.some((candidate) => candidate.id === event.id)) : incoming;

  async function executeFilter(filter, label, operation = combineMode(), relays = READ_RELAYS, reason = label) {
    const token = ++searchToken;
    const base = results();
    const started = performance.now();
    setLoading(true); setError("");
    if (route().kind !== "search") location.hash = "#/search";
    try {
      const states = new Map(relays.map((relay) => [relay, { state: "searching", count: 0 }]));
      setRelayStates(states);
      void inspectRelays(relays);
      const batches = await Promise.all(relays.map(async (relay) => {
        const relayStarted = performance.now();
        const events = await queryRelay(relay, filter, label);
        setRelayStates((current) => new Map(current).set(relay, { state: "ok", count: events.length, ids: events.map((event) => event.id), duration: Math.round(performance.now() - relayStarted) }));
        return events;
      }));
      if (token !== searchToken) return;
      const incoming = rememberEvents(unique(batches.flat()));
      const next = mergeIncoming(incoming, base, operation).sort((a, b) => b.created_at - a.created_at);
      setResults(next);
      setEntryReasons((current) => ({ ...current, ...Object.fromEntries(incoming.map((event) => [event.id, reason])) }));
      addStep({ type: "query", label: `${operation} · ${label}`, inputCount: base.length, outputCount: next.length, filter });
      logUsage("filter_query", { label, filter, operation, returned: incoming.length, resultCount: next.length, durationMs: Math.round(performance.now() - started) });
      void recordResearchRun({ label, filter, relays, operation }, next);
      hydrateProfiles(next, token);
    } catch (cause) { setError(cause.message); }
    finally { if (token === searchToken) setLoading(false); }
  }

  async function resolvePubkey(value) {
    const text = value.trim();
    if (!text) return "";
    if (/^[0-9a-f]{64}$/i.test(text)) return text;
    if (/^(npub|nprofile)1/i.test(text)) {
      const decoded = nip19.decode(text);
      return typeof decoded.data === "string" ? decoded.data : decoded.data.pubkey;
    }
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) {
      const [name, domain] = text.split("@");
      const response = await fetch(`https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`);
      return (await response.json()).names?.[name] ?? "";
    }
    throw new Error("Author must be a hex pubkey, npub, nprofile, or NIP-05 identifier");
  }

  async function runStructuredQuery() {
    try {
      logUsage("structured_query_started", { author: builderAuthor(), kinds: builderKinds(), tag: builderTag(), tagValue: builderTagValue(), days: builderDays() });
      const filter = { limit: 100 };
      const parts = [];
      const author = await resolvePubkey(builderAuthor());
      const kinds = builderKinds().split(/[\s,]+/).map(Number).filter(Number.isInteger);
      if (author) { filter.authors = [author]; parts.push(`author ${short(author)}`); }
      if (kinds.length) { filter.kinds = kinds; parts.push(`kinds ${kinds.join(",")}`); }
      if (builderTag() && builderTagValue()) { filter[`#${builderTag().replace(/^#/, "").slice(0, 1)}`] = [builderTagValue().replace(/^#/, "")]; parts.push(`#${builderTag()}=${builderTagValue()}`); }
      if (Number(builderDays()) > 0) { filter.since = Math.floor(Date.now() / 1000) - Number(builderDays()) * 86400; parts.push(`last ${builderDays()}d`); }
      if (parts.length === 0) throw new Error("Add at least one structured constraint");
      await executeFilter(filter, parts.join(" · "), combineMode());
    } catch (cause) { setError(cause.message); }
  }

  async function expandSelection(relation) {
    const event = selectedEvent();
    if (!event) return;
    const definitions = {
      replies: { filters: [{ "#e": [event.id], kinds: [1, 1111], limit: 100 }], label: "replies" },
      quotes: { filters: [{ "#q": [event.id], limit: 100 }], label: "quotes" },
      responses: { filters: [{ "#e": [event.id], kinds: [6, 7, 16, 9735], limit: 100 }], label: "reactions / reposts / zaps" },
      author: { filters: [{ authors: [event.pubkey], limit: 100 }], label: "author activity" },
      mentions: { filters: [{ "#p": [event.pubkey], limit: 100 }], label: "author mentions" },
      topics: { filters: tags(event, "t").slice(0, 4).map((topic) => ({ "#t": [topic], limit: 100 })), label: "shared topics" },
      references: { filters: [...tags(event, "e"), ...tags(event, "q")].slice(0, 100).length ? [{ ids: [...tags(event, "e"), ...tags(event, "q")].slice(0, 100) }] : [], label: "conversation ancestry / references" },
      network: { filters: [{ authors: [event.pubkey], kinds: [3], limit: 1 }], label: "author follow network" }
    };
    const definition = definitions[relation];
    if (!definition?.filters.length) { setExpansionStatus({ state: "empty", relation, label: definition?.label ?? relation, message: `This note contains no ${definition?.label ?? relation} to follow.` }); return; }
    const token = ++searchToken;
    const base = results();
    setLoading(true); setError(""); setExpansionStatus({ state: "loading", relation, label: definition.label, message: `Looking for ${definition.label} across ${READ_RELAYS.length} relays…` });
    try {
      const batches = await Promise.all(definition.filters.map((filter) => readEvents(filter, `expand-${relation}`, READ_RELAYS)));
      if (token !== searchToken) return;
      let incoming = rememberEvents(unique(batches.flat()));
      if (relation === "network" && incoming.length) {
        const followed = tags(incoming.sort((a, b) => b.created_at - a.created_at)[0], "p").slice(0, 80);
        if (followed.length) incoming = rememberEvents(unique([...incoming, ...await readEvents({ authors: followed, kinds: [1, 20, 21, 22, 30023], limit: 100 }, "expand-network", READ_RELAYS)]));
      }
      const existingIds = new Set(base.map((item) => item.id));
      const added = incoming.filter((item) => !existingIds.has(item.id));
      if (!incoming.length) {
        setExpansionStatus({ state: "empty", relation, label: definition.label, message: `No ${definition.label} were found for this note on the configured relays.` });
        logUsage("graph_expansion", { relation, from: event.id, returned: 0, added: 0, resultCount: base.length });
        return;
      }
      if (!added.length && expansionOperation() === "union") {
        setExpansionStatus({ state: "known", relation, label: definition.label, message: `${incoming.length} related ${incoming.length === 1 ? "note is" : "notes are"} already in this exploration.` });
        return;
      }
      const next = (expansionOperation() === "replace" ? incoming : expansionOperation() === "intersect" ? base.filter((item) => incoming.some((candidate) => candidate.id === item.id)) : unique([...base, ...incoming])).sort((a, b) => b.created_at - a.created_at);
      setResults(next);
      const reason = `${definition.label} from ${short(event.id)}`;
      setEntryReasons((current) => ({ ...current, ...Object.fromEntries(incoming.map((item) => [item.id, reason])) }));
      addStep({ type: "expand", label: `${expansionOperation()} · ${reason}`, inputCount: base.length, outputCount: next.length, returned: incoming.length, added: added.length });
      setExpansionStatus({ state: "added", relation, label: definition.label, message: expansionOperation() === "replace" ? `Opened ${incoming.length} connected ${incoming.length === 1 ? "event" : "events"} as the corpus.` : expansionOperation() === "intersect" ? `Kept ${next.length} current ${next.length === 1 ? "event" : "events"} that match this relationship.` : `Added ${added.length} new ${added.length === 1 ? "event" : "events"} to the corpus.` });
      logUsage("graph_expansion", { relation, operation: expansionOperation(), from: event.id, returned: incoming.length, added: added.length, resultCount: next.length });
      hydrateProfiles(incoming, token);
    } catch (cause) { setError(cause.message); setExpansionStatus({ state: "error", relation, label: definition.label, message: `Could not retrieve ${definition.label}: ${cause.message}` }); }
    finally { if (token === searchToken) setLoading(false); }
  }

  async function loadRoute(next = parseRoute()) {
    if (next.kind === "search") { setRoute(next); setRouteLoading(false); setRouteData(null); return; }
    const token = ++searchToken;
    const started = performance.now();
    setRouteLoading(true); setError(""); setRouteData(null); setRoute(next);
    try {
      if (next.kind === "topic") { setQuery(`#${next.value}`); location.hash = "#/search"; runSearch(`#${next.value}`); return; }
      if (next.kind === "event" || next.kind === "raw") {
        const cachedEvent = knownEvents.get(next.value);
        const event = cachedEvent ?? (await readEvents({ ids: [next.value] }, "event"))[0] ?? (await readEvents({ ids: [next.value] }, "event-fallback", FALLBACK_READ_RELAYS))[0];
        if (!event) throw new Error("Event was not returned by the read relays");
        rememberEvents([event]);
        setRouteData({ event, replies: [] });
        setRouteLoading(false);
        hydrateProfiles([event], token);
        const replies = await readEvents({ "#e": [event.id], kinds: [1, 1111], limit: 40 }, "event-context");
        if (token !== searchToken) return;
        rememberEvents(replies);
        setRouteData({ event, replies });
        hydrateProfiles(replies, token);
      } else if (next.kind === "address") {
        const [kind, pubkey, ...identifier] = next.value.split(":");
        const event = (await readEvents({ authors: [pubkey], kinds: [Number(kind)], "#d": [decodeURIComponent(identifier.join(":"))] }, "address"))[0];
        if (!event) throw new Error("Addressable event was not returned");
        rememberEvents([event]);
        setRouteData({ event, replies: [] });
      } else if (next.kind === "account" || next.kind === "follows") {
        const pubkey = next.value;
        if (!/^[0-9a-f]{64}$/i.test(pubkey)) throw new Error("Invalid account public key");
        const followOnly = next.kind === "follows";
        const [metadata, contacts, authored, mentions] = await Promise.all([
          readEvents({ authors: [pubkey], kinds: [0], limit: 1 }, "account-metadata"),
          readEvents({ authors: [pubkey], kinds: [3], limit: 1 }, "account-follows"),
          followOnly ? [] : readEvents({ authors: [pubkey], limit: 100 }, "account-events"),
          followOnly ? [] : readEvents({ "#p": [pubkey], limit: 30 }, "account-mentions")
        ]);
        if (token !== searchToken) return;
        rememberEvents([...metadata, ...contacts, ...authored, ...mentions]);
        rememberProfiles(metadata);
        const contact = contacts.sort((a, b) => b.created_at - a.created_at)[0];
        setRouteData({ pubkey, follows: tags(contact, "p"), authored: unique(authored).sort((a, b) => b.created_at - a.created_at), mentions: unique(mentions).filter((event) => event.pubkey !== pubkey).sort((a, b) => b.created_at - a.created_at) });
        hydrateProfiles([...authored, ...mentions], token);
      } else throw new Error("Unknown location");
      logUsage("navigation", { destination: next.kind, durationMs: Math.round(performance.now() - started) });
    } catch (cause) { if (token === searchToken) setError(cause.message); }
    finally { if (token === searchToken) setRouteLoading(false); }
  }

  const baseFilteredResults = createMemo(() => {
    const cutoff = sinceDays() ? Math.floor(Date.now() / 1000) - sinceDays() * 86400 : 0;
    return results().filter((event) => (!cutoff || event.created_at >= cutoff) && (kindFilter() === "all" || (kindFilter() === "notes" && event.kind === 1) || (kindFilter() === "profiles" && event.kind === 0) || (kindFilter() === "follows" && event.kind === 3) || (kindFilter() === "articles" && event.kind === 30023) || (kindFilter() === "other" && ![0, 1, 3, 30023].includes(event.kind))));
  });
  const filteredResults = createMemo(() => {
    const facets = activeFacets();
    const filtered = baseFilteredResults().filter((event) =>
      (!facets.topic || tags(event, "t").some((topic) => topic.toLowerCase() === facets.topic)) &&
      (!facets.author || event.pubkey === facets.author) &&
      (facets.kind === null || event.kind === facets.kind) &&
      (!facets.day || new Date(event.created_at * 1000).toISOString().slice(0, 10) === facets.day) &&
      (!facets.domain || eventDomains(event).includes(facets.domain)) &&
      (!facets.relay || (sourceIndex.get(event.id) ?? []).includes(facets.relay))
    );
    return dedupeEnabled() ? dedupeForDisplay(filtered) : filtered;
  });
  const corpusFacets = createMemo(() => {
    const events = baseFilteredResults();
    return {
      topics: ranked(events.flatMap((event) => tags(event, "t").map((topic) => topic.toLowerCase())), 12),
      authors: ranked(events.map((event) => event.pubkey), 8),
      kinds: ranked(events.map((event) => event.kind), 8),
      days: ranked(events.map((event) => new Date(event.created_at * 1000).toISOString().slice(0, 10)), 7),
      domains: ranked(events.flatMap(eventDomains), 8),
      relays: ranked(events.flatMap((event) => sourceIndex.get(event.id) ?? []), 6)
    };
  });
  const toggleFacet = (type, value) => setActiveFacets((current) => ({ ...current, [type]: current[type] === value ? (type === "kind" ? null : "") : value }));
  const activeFacetCount = createMemo(() => Object.values(activeFacets()).filter((value) => value !== "" && value !== null).length);
  const pulseTopics = createMemo(() => ranked(pulseEvents().flatMap((event) => tags(event, "t").map((topic) => topic.toLowerCase())), 18));
  async function loadRelayPulse() {
    setPulseLoading(true);
    try {
      const since = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
      const events = await readEvents({ kinds: [1], since, limit: 100 }, "relay-pulse", READ_RELAYS);
      setPulseEvents(events);
      logUsage("relay_pulse", { count: events.length, topics: ranked(events.flatMap((event) => tags(event, "t"))).length });
    } finally { setPulseLoading(false); }
  }
  const savePath = async () => {
    const existing = paths().find((path) => path.id === activeRecipeId());
    const id = existing?.id ?? crypto.randomUUID();
    const now = Date.now();
    const recipe = {
      id,
      title: query() || "Untitled investigation",
      query: query(),
      plan: lastQueryPlan(),
      operation: combineMode(),
      eventIds: results().map((event) => event.id),
      settings: { view: view(), kindFilter: kindFilter(), sinceDays: sinceDays(), dedupeEnabled: dedupeEnabled() },
      pinned: [...pinned()],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await storeEvents(results(), sourceIndex);
    await saveRecipe(recipe);
    setActiveRecipeId(id);
    setPaths((current) => [recipe, ...current.filter((path) => path.id !== id)].sort((a, b) => b.updatedAt - a.updatedAt));
    if (!(await latestRun(id))) await saveRun({ id: crypto.randomUUID(), recipeId: id, completedAt: now, eventIds: recipe.eventIds, details: { baseline: true, query: recipe.query }, relayStates: Object.fromEntries(relayStates()) });
    setLastRunDelta({ previous: false, added: 0, missing: 0, overlap: null });
    logUsage("recipe_saved", { recipeId: id, resultCount: recipe.eventIds.length });
  };
  const restorePath = async (path) => {
    const legacy = path.snapshot;
    const storedEvents = path.eventIds ? await loadEvents(path.eventIds, sourceIndex) : legacy?.corpus ?? [];
    setActiveRecipeId(path.id); setLastRunDelta(null);
    setQuery(path.query ?? legacy?.query ?? ""); setResults(storedEvents); rememberEvents(storedEvents); setSteps(legacy?.steps ?? []);
    setPinned(new Set(path.pinned ?? legacy?.pinned ?? [])); setView(path.settings?.view ?? legacy?.view ?? "list");
    setKindFilter(path.settings?.kindFilter ?? legacy?.kindFilter ?? "all"); setSinceDays(path.settings?.sinceDays ?? legacy?.sinceDays ?? 0);
    setDedupeEnabled(path.settings?.dedupeEnabled ?? true); setLastQueryPlan(path.plan ?? null);
    history.replaceState(null, "", "#/search"); setRoute(parseRoute());
    logUsage("recipe_opened", { recipeId: path.id, cachedEvents: storedEvents.length });
  };
  const rerunRecipe = () => {
    const recipe = paths().find((path) => path.id === activeRecipeId());
    if (!recipe?.query) return;
    setCombineMode("replace");
    void runSearch(recipe.query, "replace");
  };
  const newExploration = () => {
    if ((results().length || steps().length) && !window.confirm("Start a new exploration? Unsaved current results and steps will be cleared. Saved investigations will remain.")) return;
    searchToken += 1;
    localStorage.removeItem(SESSION_KEY);
    knownEvents.clear();
    setQuery(""); setResults([]); setProfiles(new Map()); setSteps([]); setSelectedId(""); setPinned(new Set());
    setEntryReasons({}); setExpansionStatus(null); setKindFilter("all"); setSinceDays(0); setCombineMode("replace"); setView("list");
    setRelayStates(new Map()); setError(""); setRouteData(null); setLastQueryPlan(null); setHasMore(true); setPageMessage(""); setActiveRecipeId(""); setLastRunDelta(null); setActiveFacets(emptyFacets());
    history.replaceState(null, "", "#/search"); setRoute(parseRoute());
    logUsage("exploration_reset", { preservedSavedInvestigations: paths().length });
  };
  const applyRelays = () => {
    const next = [...new Set(relayDraft().split(/[\s,]+/).map((relay) => relay.trim().replace(/\/$/, "")).filter((relay) => relay.startsWith("wss://")))];
    if (!next.length) return;
    setSearchRelays(next); save(SEARCH_RELAYS_KEY, next); setRelayDraft(next.join("\n"));
  };
  const savePinnedAsCollection = async () => {
    const eventIds = [...pinned()];
    if (!eventIds.length) return;
    const now = Date.now();
    const collection = { id: crypto.randomUUID(), title: collectionDraft().trim() || `Evidence · ${new Date(now).toLocaleDateString()}`, eventIds, createdAt: now, updatedAt: now };
    await storeEvents(eventIds.map((id) => knownEvents.get(id)).filter(Boolean), sourceIndex);
    await saveCollection(collection);
    setCollections((current) => [collection, ...current]); setCollectionDraft("");
    logUsage("collection_saved", { collectionId: collection.id, eventCount: eventIds.length });
  };
  const openCollection = async (collection) => {
    const events = await loadEvents(collection.eventIds, sourceIndex);
    rememberEvents(events); setResults(events.sort((a, b) => b.created_at - a.created_at)); setPinned(new Set(collection.eventIds));
    setQuery(collection.title); setView("table"); setSelectedId(""); setActiveFacets(emptyFacets());
    history.replaceState(null, "", "#/search"); setRoute(parseRoute());
    logUsage("collection_opened", { collectionId: collection.id, cachedEvents: events.length });
  };
  const toggleSet = (setter, id) => setter((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });

  createEffect(() => save(SESSION_KEY, {
    query: query(), eventIds: results().map((event) => event.id).slice(0, 1000), steps: steps().slice(-30), pinned: [...pinned()].slice(0, 150), selectedId: selectedId(), view: view(), kindFilter: kindFilter(), sinceDays: sinceDays(), entryReasons: Object.fromEntries(Object.entries(entryReasons()).slice(-150)), dedupeEnabled: dedupeEnabled(), activeRecipeId: activeRecipeId()
  }));

  onMount(async () => {
    const handler = () => loadRoute(parseRoute());
    window.addEventListener("hashchange", handler);
    onCleanup(() => { window.removeEventListener("hashchange", handler); pool.destroy(); });
    logUsage("client_opened", { framework: "solid", searchRelays: searchRelays() });
    const [recipes, storedCollections] = await Promise.all([listRecipes(), listCollections()]);
    if (storedCollections.length) setCollections(storedCollections);
    const legacyRecipes = load(PATHS_KEY, []);
    const knownRecipeIds = new Set(recipes.map((recipe) => recipe.id));
    const migrated = [];
    for (const legacy of legacyRecipes.filter((recipe) => !knownRecipeIds.has(recipe.id))) {
      const corpus = legacy.snapshot?.corpus ?? [];
      const recipe = {
        id: legacy.id,
        title: legacy.title || legacy.snapshot?.query || "Untitled investigation",
        query: legacy.snapshot?.query ?? legacy.query ?? "",
        plan: null,
        operation: "replace",
        eventIds: corpus.map((event) => event.id),
        settings: { view: legacy.snapshot?.view ?? "list", kindFilter: legacy.snapshot?.kindFilter ?? "all", sinceDays: legacy.snapshot?.sinceDays ?? 0, dedupeEnabled: true },
        pinned: legacy.snapshot?.pinned ?? [],
        createdAt: legacy.savedAt ?? Date.now(),
        updatedAt: legacy.savedAt ?? Date.now(),
      };
      await storeEvents(corpus, sourceIndex); await saveRecipe(recipe); migrated.push(recipe);
    }
    if (recipes.length || migrated.length) setPaths([...recipes, ...migrated].sort((a, b) => b.updatedAt - a.updatedAt));
    if (restored.eventIds?.length) {
      const stored = await loadEvents(restored.eventIds, sourceIndex);
      if (stored.length && !results().length) { setResults(stored); rememberEvents(stored); }
    }
    if (restored.activeRecipeId) setActiveRecipeId(restored.activeRecipeId);
    loadRelayPulse();
    loadRoute();
  });

  const openRoute = (target) => {
    history.pushState(null, "", target);
    const next = parseRoute();
    queueMicrotask(() => loadRoute(next));
  };

  const startSearch = () => {
    const value = query().trim();
    if (!value) return;
    runSearch(startMode() === "topic" && !value.startsWith("#") ? `#${value}` : value, combineMode());
  };
  const selectEvent = (id) => {
    setSelectedId(id); setExpansionStatus(null);
  };
  const navigateFromEvent = (id, relation) => {
    setSelectedId(id); setExpansionStatus(null);
    void expandSelection(relation);
  };

  return <div class="min-h-screen bg-[#050b08] text-emerald-100 selection:bg-lime-300 selection:text-black">
    <header class="sticky top-0 z-30 border-b border-emerald-900/80 bg-[#050b08]/95 backdrop-blur">
      <div class="mx-auto flex max-w-[1600px] items-center gap-5 px-4 py-3 lg:px-7">
        <button onClick={newExploration} class="font-mono text-sm font-bold tracking-[.14em] text-lime-200">NOSTR_RESEARCH<span class="text-emerald-700">://LIVE</span></button>
        <span class="hidden text-xs text-emerald-800 sm:block">real relay graph · local research state</span>
        <div class="ml-auto flex items-center gap-3"><button onClick={newExploration} class="rounded border border-lime-800 px-3 py-1.5 font-mono text-[11px] text-lime-300 hover:bg-lime-300 hover:text-black">＋ NEW</button><div class="hidden items-center gap-2 text-[11px] text-emerald-700 sm:flex"><span class="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-300"/>LIVE RELAYS</div></div>
      </div>
    </header>

    <div class="mx-auto grid max-w-[1800px] gap-4 px-4 py-5 xl:grid-cols-[250px_minmax(0,1fr)_310px] lg:px-6">
      <aside class="hidden space-y-4 xl:sticky xl:top-20 xl:block xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
        <Show when={results().length}><FacetPanel facets={corpusFacets()} active={activeFacets()} profileFor={profileFor} onFacet={toggleFacet} onOpenAuthor={(pubkey) => openRoute(`#/account/${pubkey}`)} onClear={() => setActiveFacets(emptyFacets())}/></Show>
        <Panel title="RESEARCH RECIPES"><Show when={paths().length} fallback={<p class="text-emerald-900">Save a search to make it rerunnable.</p>}><For each={paths().slice(0, 8)}>{(path) => <button onClick={() => void restorePath(path)} class={`block w-full border-b border-emerald-950 py-2 text-left hover:text-lime-300 ${activeRecipeId() === path.id ? "text-lime-300" : "text-emerald-500"}`}><span class="block truncate">{activeRecipeId() === path.id ? "› " : ""}{path.title}</span><span class="mt-0.5 block text-[9px] text-emerald-900">{path.eventIds?.length ?? path.snapshot?.corpus?.length ?? 0} cached nodes</span></button>}</For></Show></Panel>
        <Show when={collections().length}><Panel title="COLLECTIONS"><For each={collections().slice(0, 8)}>{(collection) => <button onClick={() => void openCollection(collection)} class="block w-full border-b border-emerald-950 py-2 text-left text-emerald-500 hover:text-lime-300"><span class="block truncate">{collection.title}</span><span class="mt-0.5 block text-[9px] text-emerald-900">{collection.eventIds.length} evidence items</span></button>}</For></Panel></Show>
        <Show when={results().length}><Panel title="CURRENT SET"><Stat label="retrieved" value={results().length}/><Stat label="visible" value={filteredResults().length}/><Stat label="active facets" value={activeFacetCount()}/><Stat label="evidence" value={pinned().size}/></Panel></Show>
      </aside>

      <main class="min-w-0">
        <Show when={results().length}><details class="mb-4 rounded border border-emerald-900 bg-emerald-950/10 p-3 font-mono text-xs xl:hidden"><summary class="text-lime-300">filter this corpus · {filteredResults().length}/{results().length} items</summary><div class="mt-3 border-t border-emerald-900 pt-3"><div class="flex flex-wrap gap-2"><For each={corpusFacets().topics.slice(0, 10)}>{([topic, count]) => <button onClick={() => toggleFacet("topic", topic)} class={`rounded border px-2 py-1 ${activeFacets().topic === topic ? "border-lime-400 bg-lime-300 text-black" : "border-emerald-900 text-emerald-500"}`}>#{topic} {count}</button>}</For><Show when={activeFacetCount()}><button onClick={() => setActiveFacets(emptyFacets())} class="text-emerald-600">clear</button></Show></div></div></details></Show>
        <section class="mb-4 rounded border border-emerald-900 bg-emerald-950/20 p-3 shadow-[0_0_40px_rgba(16,185,129,.04)]">
          <div class="mb-3 flex flex-wrap gap-2 font-mono text-xs"><span class="mr-1 self-center text-emerald-700">START FROM</span><For each={[['topic','a topic'],['person','a person'],['note','a note'],['words','keywords']]}>{([mode,label]) => <button type="button" onClick={() => { setStartMode(mode); setQuery(""); }} class={`rounded px-3 py-1.5 ${startMode() === mode ? "bg-lime-300 text-black" : "border border-emerald-900 text-emerald-500"}`}>{label}</button>}</For></div>
          <form class="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); startSearch(); }}>
            <span class="font-mono text-lime-300">→</span>
            <input value={query()} onInput={(event) => setQuery(event.currentTarget.value)} class="min-w-0 flex-1 bg-transparent px-1 py-2 font-mono text-sm text-emerald-50 outline-none placeholder:text-emerald-900" placeholder={{topic:"topic, for example bitcoin",person:"name@domain, npub, or public key",note:"note, nevent, or event ID",words:"words contained in notes"}[startMode()]} autofocus />
            <button disabled={loading()} class="rounded border border-lime-700 px-4 py-2 font-mono text-xs text-lime-200 transition hover:bg-lime-300 hover:text-black disabled:opacity-40">{loading() ? "SEARCHING…" : "EXPLORE"}</button>
          </form>
          <div class="mt-2 flex flex-wrap items-center gap-2 border-t border-emerald-900/70 pt-3 text-xs">
            <select aria-label="How to use these results" value={combineMode()} onChange={(event) => setCombineMode(event.currentTarget.value)} class="rounded border border-emerald-900 bg-[#07110c] px-2 py-1.5 text-lime-300"><option value="replace">replace current results</option><option value="union">add to current results</option><option value="intersect">keep only matches</option></select>
            <select aria-label="Content type" value={kindFilter()} onChange={(event) => setKindFilter(event.currentTarget.value)} class="rounded border border-emerald-900 bg-[#07110c] px-2 py-1.5 text-emerald-300"><option value="all">all content</option><option value="notes">short notes</option><option value="profiles">profiles</option><option value="follows">follow lists</option><option value="articles">long articles</option><option value="other">other data</option></select>
            <button type="button" aria-pressed={dedupeEnabled()} onClick={() => setDedupeEnabled((value) => !value)} class={`rounded border px-2 py-1.5 ${dedupeEnabled() ? "border-lime-800 bg-lime-950/30 text-lime-300" : "border-emerald-900 text-emerald-600"}`}>{dedupeEnabled() ? "duplicates collapsed" : "showing duplicates"}</button>
            <select value={sinceDays()} onChange={(event) => { const days = Number(event.currentTarget.value); setSinceDays(days); addStep({ type: "filter", label: days ? `last ${days} days` : "all time", inputCount: results().length, outputCount: filteredResults().length }); }} class="rounded border border-emerald-900 bg-[#07110c] px-2 py-1.5 text-emerald-300"><option value="0">all time</option><option value="1">last day</option><option value="7">last 7 days</option><option value="30">last 30 days</option><option value="90">last 90 days</option><option value="365">last year</option></select>
            <button type="button" onClick={() => void savePath()} class="rounded border border-emerald-900 px-2 py-1.5 text-emerald-500 hover:text-emerald-200">{activeRecipeId() ? "update recipe" : "save as recipe"}</button>
            <Show when={activeRecipeId()}><button type="button" disabled={loading()} onClick={rerunRecipe} class="rounded border border-lime-800 px-2 py-1.5 text-lime-300 disabled:opacity-40">rerun + compare</button></Show>
            <details class="relative"><summary class="cursor-pointer rounded border border-emerald-900 px-2 py-1.5 text-emerald-500">relays · {READ_RELAYS.length + searchRelays().length}</summary><div class="absolute right-0 top-9 z-40 w-80 rounded border border-emerald-800 bg-[#07110c] p-3 shadow-2xl"><div class="mb-3 text-[10px] tracking-wider text-lime-300">DEFAULT READ RELAYS</div><For each={READ_RELAYS}>{(relay) => <div class="mb-1 flex items-center gap-2 text-emerald-500"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"/>{new URL(relay).hostname}</div>}</For><div class="mb-2 mt-4 text-[10px] tracking-wider text-lime-300">KEYWORD SEARCH RELAYS</div><textarea aria-label="Keyword search relays" value={relayDraft()} onInput={(event) => setRelayDraft(event.currentTarget.value)} class="h-24 w-full resize-none bg-black/30 p-2 font-mono text-xs outline-none"/><button type="button" onClick={applyRelays} class="mt-2 border border-lime-700 px-3 py-1 text-lime-300">apply search relays</button><p class="mt-2 text-[10px] text-emerald-800">Topic, account, note, and relationship queries use the three read relays. Keyword searches use the editable NIP-50 list.</p></div></details>
          </div>
          <details class="mt-3 border-t border-emerald-900/70 pt-3 font-mono text-xs">
            <summary class="cursor-pointer text-emerald-700">Advanced: search protocol fields directly</summary>
            <form onSubmit={(event) => { event.preventDefault(); void runStructuredQuery(); }} class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[1.7fr_1fr_.45fr_1fr_.55fr_auto]">
              <input aria-label="author constraint" value={builderAuthor()} onInput={(event) => setBuilderAuthor(event.currentTarget.value)} class="rounded border border-emerald-900 bg-[#07110c] px-2 py-2 outline-none placeholder:text-emerald-900" placeholder="author: npub / hex / NIP-05"/>
              <input aria-label="kind constraints" value={builderKinds()} onInput={(event) => setBuilderKinds(event.currentTarget.value)} class="rounded border border-emerald-900 bg-[#07110c] px-2 py-2 outline-none placeholder:text-emerald-900" placeholder="kinds: 1,30023"/>
              <input aria-label="tag name" value={builderTag()} onInput={(event) => setBuilderTag(event.currentTarget.value)} class="rounded border border-emerald-900 bg-[#07110c] px-2 py-2 outline-none placeholder:text-emerald-900" placeholder="tag: t" maxlength="2"/>
              <input aria-label="tag value" value={builderTagValue()} onInput={(event) => setBuilderTagValue(event.currentTarget.value)} class="rounded border border-emerald-900 bg-[#07110c] px-2 py-2 outline-none placeholder:text-emerald-900" placeholder="tag value: nostr"/>
              <input aria-label="days constraint" value={builderDays()} onInput={(event) => setBuilderDays(event.currentTarget.value)} type="number" min="1" class="rounded border border-emerald-900 bg-[#07110c] px-2 py-2 outline-none placeholder:text-emerald-900" placeholder="days"/>
              <button type="submit" disabled={loading()} class="rounded border border-lime-700 px-3 py-2 text-lime-200 hover:bg-lime-300 hover:text-black">APPLY FILTER</button>
            </form>
            <p class="mt-2 text-[10px] text-emerald-800">Empty fields are omitted. The corpus operation above still applies, so filters can replace, union, or intersect.</p>
          </details>
        </section>

        <Show when={!routeLoading()} fallback={<LoadingPanel label="reading relay graph"/>}>
          <Show when={!error()} fallback={<ErrorPanel message={error()}/>}>
            <Show keyed when={route()}>{(currentRoute) => <Show when={currentRoute.kind === "search"} fallback={<RouteView route={currentRoute} data={routeData()} profileFor={profileFor} openRoute={openRoute}/> }>
                <Show when={!results().length && !query()}><HomeDiscovery topics={pulseTopics()} events={pulseEvents()} loading={pulseLoading()} profileFor={profileFor} onTopic={(topic) => { setQuery(`#${topic}`); runSearch(`#${topic}`, "replace"); }} onAuthor={(pubkey) => openRoute(`#/account/${pubkey}`)} onRefresh={loadRelayPulse}/></Show>
                <ResearchWorkspace view={view()} setView={setView} events={filteredResults()} loading={loading()} query={query()} profileFor={profileFor} pinned={pinned()} selectedId={selectedId()} openRoute={openRoute} onSelect={selectEvent} onNavigate={navigateFromEvent} onPin={(id) => toggleSet(setPinned, id)} onLoadMore={loadMoreResults} paging={paging()} hasMore={hasMore()} pageMessage={pageMessage()} canLoadMore={results().length > 0} facets={corpusFacets()} activeFacets={activeFacets()} onFacet={toggleFacet} entryReasons={entryReasons()}/>
              </Show>}</Show>
          </Show>
        </Show>
      </main>

      <Show when={results().length}><aside class="space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:pl-1">
        <Show when={selectedEvent()}>{(event) => <ExploreFromNode compact event={event()} corpus={results()} profile={profileFor(event().pubkey)} onExpand={expandSelection} operation={expansionOperation()} onOperation={setExpansionOperation} openRoute={openRoute} loading={loading()} status={expansionStatus()} reason={entryReasons()[event().id]}/>}</Show>
        <Panel title="RELAY PULSE · 24H"><Show when={pulseTopics().length} fallback={<p class="text-emerald-900">{pulseLoading() ? "sampling recent notes…" : "no tagged notes returned"}</p>}><div class="flex flex-wrap gap-1.5"><For each={pulseTopics().slice(0, 10)}>{([topic, count]) => <button onClick={() => { setQuery(`#${topic}`); runSearch(`#${topic}`, "replace"); }} class="rounded border border-emerald-900 px-2 py-1 text-emerald-500 hover:border-lime-700 hover:text-lime-300">#{topic} <span class="text-emerald-800">{count}</span></button>}</For></div></Show></Panel>
        <Panel title="EVIDENCE"><Show when={pinned().size} fallback={<p class="text-emerald-900">Pin nodes to build a lightweight evidence collection.</p>}><For each={[...pinned()].map((id) => knownEvents.get(id)).filter(Boolean)}>{(event) => <button onClick={() => setSelectedId(event.id)} class="block w-full border-b border-emerald-950 py-2 text-left"><span class="text-lime-500">{kindName(event.kind)}</span><span class="mt-1 block truncate text-emerald-600">{compact(event.content, 60)}</span></button>}</For><div class="flex gap-1 pt-2"><input aria-label="Collection name" value={collectionDraft()} onInput={(event) => setCollectionDraft(event.currentTarget.value)} placeholder="collection name" class="min-w-0 flex-1 rounded border border-emerald-900 bg-black/20 px-2 py-1 text-emerald-300 outline-none"/><button onClick={() => void savePinnedAsCollection()} class="rounded border border-lime-800 px-2 text-lime-300">save</button></div></Show></Panel>
        <Show when={lastRunDelta()}>{(delta) => <Panel title="RUN COMPARISON"><Show when={delta().previous} fallback={<p class="text-emerald-700">Baseline saved. Rerun this recipe later to measure change.</p>}><Stat label="new" value={`+${delta().added}`}/><Stat label="not returned" value={`−${delta().missing}`}/><Stat label="set overlap" value={`${Math.round((delta().overlap ?? 0) * 100)}%`}/></Show></Panel>}</Show>
        <CoveragePanel states={relayStates()} information={relayInformation()} />
      </aside></Show>
    </div>
  </div>;
}

function Panel(props) { return <section class="rounded border border-emerald-900 bg-emerald-950/10 p-3 font-mono text-xs"><h2 class="mb-3 border-b border-emerald-900 pb-2 text-[10px] tracking-[.16em] text-lime-300">{props.title}</h2><div class="space-y-2">{props.children}</div></section>; }
function Stat(props) { return <div class="flex justify-between text-emerald-700"><span>{props.label}</span><span class="text-emerald-300">{props.value}</span></div>; }
function CoveragePanel(props) {
  const rows = () => [...props.states.entries()].map(([relay, state]) => {
    const ids = state.ids ?? [];
    const exclusive = ids.filter((id) => (sourceIndex.get(id) ?? []).length === 1).length;
    return { relay, state, exclusive, information: props.information.get(relay) };
  });
  const responding = () => rows().filter((row) => row.state.state === "ok").length;
  return <Panel title="SEARCH COVERAGE"><Show when={rows().length} fallback={<p class="text-emerald-900">Run a search to see which relays contributed and what they support.</p>}>
    <div class="mb-2 flex justify-between text-emerald-700"><span>responded</span><span class="text-emerald-300">{responding()}/{rows().length}</span></div>
    <For each={rows()}>{(row) => <details class="border-b border-emerald-950 py-2">
      <summary class="flex items-center gap-2"><span class={`h-1.5 w-1.5 rounded-full ${row.state.state === "ok" ? "bg-emerald-400" : row.state.state === "searching" ? "animate-pulse bg-lime-300" : "bg-red-500"}`}/><span class="min-w-0 flex-1 truncate text-emerald-400">{new URL(row.relay).hostname}</span><span class="text-emerald-800">{row.state.state === "searching" ? "…" : row.state.count}</span></summary>
      <div class="mt-2 space-y-1 pl-3 text-[10px] text-emerald-800">
        <Show when={row.state.state === "ok"}><div>{row.exclusive} unique here · {row.state.duration}ms</div></Show>
        <Show when={row.information?.state === "available"} fallback={<div>capabilities unavailable</div>}>
          <div>{row.information.name}{row.information.version ? ` · ${row.information.version}` : ""}</div>
          <div>NIP-50 search: {row.information.supportedNips.includes(50) ? "advertised" : "not advertised"}</div>
          <Show when={row.information.limitations?.max_limit}><div>max query limit: {row.information.limitations.max_limit}</div></Show>
        </Show>
      </div>
    </details>}</For>
    <p class="pt-1 text-[9px] leading-4 text-emerald-900">Coverage describes only the relays queried. An empty result does not establish that no matching Nostr event exists.</p>
  </Show></Panel>;
}
function LoadingPanel(props) { return <div class="rounded border border-emerald-900 p-8 font-mono text-sm text-emerald-600"><span class="mr-3 inline-block animate-spin text-lime-300">◌</span>{props.label}…</div>; }
function ErrorPanel(props) { return <div class="rounded border border-red-950 bg-red-950/10 p-6 font-mono text-sm text-red-300">error: {props.message}</div>; }

function FacetPanel(props) {
  const hasFacets = () => props.facets.topics.length || props.facets.authors.length || props.facets.kinds.length;
  const hasActive = () => Object.values(props.active).some((value) => value !== "" && value !== null);
  return <Panel title="FILTER THIS CORPUS"><Show when={hasFacets()} fallback={<p class="py-2 text-emerald-900">Search something to generate useful facets here.</p>}>
    <Show when={hasActive()}><button onClick={props.onClear} class="mb-1 w-full rounded border border-lime-900 px-2 py-1 text-lime-400 hover:bg-lime-950/30">clear all active facets</button></Show>
    <Show when={props.facets.topics.length}><FacetGroup title="TOPICS"><For each={props.facets.topics}>{([topic, count]) => <Facet active={props.active.topic === topic} label={`#${topic}`} count={count} onClick={() => props.onFacet("topic", topic)}/>}</For></FacetGroup></Show>
    <Show when={props.facets.authors.length}><FacetGroup title="ACTIVE ACCOUNTS"><For each={props.facets.authors}>{([pubkey, count]) => <div class="flex items-center"><Facet active={props.active.author === pubkey} label={props.profileFor(pubkey).name} count={count} onClick={() => props.onFacet("author", pubkey)}/><button title="Open account" onClick={() => props.onOpenAuthor(pubkey)} class="px-1 text-emerald-800 hover:text-lime-300">↗</button></div>}</For></FacetGroup></Show>
    <Show when={props.facets.kinds.length}><FacetGroup title="CONTENT TYPES"><For each={props.facets.kinds}>{([kind, count]) => <Facet active={props.active.kind === kind} label={`${kindName(kind)} · ${kind}`} count={count} onClick={() => props.onFacet("kind", kind)}/>}</For></FacetGroup></Show>
    <Show when={props.facets.domains.length}><FacetGroup title="SOURCES / DOMAINS"><For each={props.facets.domains}>{([domain, count]) => <Facet active={props.active.domain === domain} label={domain} count={count} onClick={() => props.onFacet("domain", domain)}/>}</For></FacetGroup></Show>
    <Show when={props.facets.relays.length}><FacetGroup title="FOUND ON RELAYS"><For each={props.facets.relays}>{([relay, count]) => <Facet active={props.active.relay === relay} label={new URL(relay).hostname} count={count} onClick={() => props.onFacet("relay", relay)}/>}</For></FacetGroup></Show>
    <Show when={props.facets.days.length}><FacetGroup title="ACTIVE DAYS"><For each={props.facets.days}>{([day, count]) => <Facet active={props.active.day === day} label={day} count={count} onClick={() => props.onFacet("day", day)}/>}</For></FacetGroup></Show>
  </Show></Panel>;
}
function FacetGroup(props) { return <div class="border-b border-emerald-950 pb-2"><div class="mb-1 text-[9px] tracking-[.14em] text-emerald-800">{props.title}</div><div class="space-y-0.5">{props.children}</div></div>; }
function Facet(props) { return <button onClick={props.onClick} class={`flex min-w-0 flex-1 items-center justify-between rounded px-1 py-1 text-left hover:bg-emerald-950 hover:text-lime-300 ${props.active ? "bg-lime-950/40 text-lime-300" : "text-emerald-500"}`}><span class="truncate">{props.active ? "× " : ""}{props.label}</span><span class="ml-2 text-emerald-800">{props.count}</span></button>; }

function HomeDiscovery(props) {
  const activeAuthors = createMemo(() => ranked(props.events.map((event) => event.pubkey), 8));
  return <section class="mb-4 overflow-hidden rounded border border-emerald-900 bg-emerald-950/10"><div class="flex items-center justify-between border-b border-emerald-900 px-4 py-3"><div><h1 class="font-mono text-sm text-lime-200">WHAT IS MOVING ON THE RELAYS?</h1><p class="mt-1 text-xs text-emerald-700">A lightweight sample of public notes from the last 24 hours—not a global ranking.</p></div><button onClick={props.onRefresh} disabled={props.loading} class="rounded border border-emerald-900 px-2 py-1 font-mono text-xs text-emerald-500 hover:text-lime-300">{props.loading ? "sampling…" : "refresh"}</button></div><Show when={props.topics.length} fallback={<div class="p-8 text-sm text-emerald-800">{props.loading ? "Sampling recent notes from the default relays…" : "The relays returned no usable topic tags."}</div>}><div class="grid gap-0 lg:grid-cols-2"><div class="border-b border-emerald-900 p-4 lg:border-b-0 lg:border-r"><div class="mb-3 font-mono text-[10px] tracking-[.14em] text-emerald-700">RECENT TOPICS</div><div class="flex flex-wrap gap-2"><For each={props.topics}>{([topic, count]) => <button onClick={() => props.onTopic(topic)} class="rounded-full border border-emerald-800 px-3 py-1.5 text-sm text-lime-200 hover:bg-lime-300 hover:text-black">#{topic} <span class="ml-1 text-emerald-600">{count}</span></button>}</For></div></div><div class="p-4"><div class="mb-3 font-mono text-[10px] tracking-[.14em] text-emerald-700">ACTIVE IN THIS SAMPLE</div><div class="grid gap-2 sm:grid-cols-2"><For each={activeAuthors()}>{([pubkey, count]) => <button onClick={() => props.onAuthor(pubkey)} class="rounded border border-emerald-950 p-2 text-left hover:border-emerald-700"><span class="block truncate text-sm text-emerald-300">{props.profileFor(pubkey).name}</span><span class="font-mono text-[10px] text-emerald-800">{count} recent notes</span></button>}</For></div></div></div></Show></section>;
}

function ExploreFromNode(props) {
  const localCounts = createMemo(() => ({
    replies: props.corpus?.filter((event) => tags(event, "e").includes(props.event.id) && [1, 1111].includes(event.kind)).length ?? 0,
    quotes: props.corpus?.filter((event) => tags(event, "q").includes(props.event.id)).length ?? 0,
    responses: props.corpus?.filter((event) => tags(event, "e").includes(props.event.id) && [6, 7, 16, 9735].includes(event.kind)).length ?? 0,
    author: props.corpus?.filter((event) => event.pubkey === props.event.pubkey).length ?? 0,
    references: [...tags(props.event, "e"), ...tags(props.event, "q")].length,
    topics: tags(props.event, "t").length
  }));
  const known = (count) => count ? `${count} already in this corpus` : "query connected relays";
  return <section id="selected-note-navigation" class={`${props.compact ? "" : "mb-4 scroll-mt-20"} rounded border border-lime-800/70 bg-lime-950/10 p-4`}>
    <div class="flex flex-wrap items-start gap-3"><div class="min-w-0 flex-1"><div class="font-mono text-[10px] tracking-[.14em] text-lime-300">RESEARCH FROM THIS NOTE</div><div class="mt-1 text-xs text-emerald-600">by {props.profile.name}<Show when={props.reason}> · found via {props.reason}</Show></div><div class="mt-1 font-mono text-[9px] text-emerald-800">seen on {(sourceIndex.get(props.event.id) ?? []).map((relay) => new URL(relay).hostname).join(", ") || "restored cache"}</div><p class="mt-2 text-sm text-emerald-100">{compact(props.event.content, 220)}</p></div><div class="flex gap-2"><Action onClick={() => props.openRoute(`#/event/${props.event.id}`)}>read note</Action><Action onClick={() => props.openRoute(`#/raw/${props.event.id}`)}>raw event</Action></div></div>
    <div class="mt-4 border-t border-emerald-900 pt-3"><div class="mb-2 flex items-center gap-2 font-mono text-[11px] text-emerald-500"><span>Where do you want to go?</span><select aria-label="Relationship result behavior" value={props.operation} onChange={(event) => props.onOperation(event.currentTarget.value)} class="ml-auto max-w-32 rounded border border-emerald-900 bg-[#07110c] px-1 py-1 text-[9px] text-lime-300"><option value="union">add to corpus</option><option value="replace">open as corpus</option></select></div><div class={`grid gap-2 ${props.compact ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
      <Direction title="Conversation" detail={known(localCounts().replies)} loading={props.loading} onClick={() => props.onExpand("replies")}/>
      <Direction title="People discussing it" detail={known(localCounts().quotes)} loading={props.loading} onClick={() => props.onExpand("quotes")}/>
      <Direction title="What it points to" detail={localCounts().references ? `${localCounts().references} references in this event` : "no declared references"} loading={props.loading} onClick={() => props.onExpand("references")}/>
      <Direction title="More from this person" detail={known(localCounts().author)} loading={props.loading} onClick={() => props.onExpand("author")}/>
      <Direction title="Who mentions this person" detail="Inbound account mentions" loading={props.loading} onClick={() => props.onExpand("mentions")}/>
      <Direction title="Related topics" detail={localCounts().topics ? `${localCounts().topics} topic tags to follow` : "no topic tags"} loading={props.loading} onClick={() => props.onExpand("topics")}/>
      <Direction title="Reactions and reposts" detail={known(localCounts().responses)} loading={props.loading} onClick={() => props.onExpand("responses")}/>
      <Direction title="Author's network" detail="Follow list and recent notes from followed accounts" loading={props.loading} onClick={() => props.onExpand("network")}/>
    </div><Show when={props.status}><div class={`mt-3 rounded border p-3 font-mono text-xs ${props.status.state === "added" ? "border-lime-700 bg-lime-950/30 text-lime-200" : props.status.state === "loading" ? "border-emerald-700 text-emerald-300" : props.status.state === "error" ? "border-red-900 text-red-300" : "border-amber-900/70 bg-amber-950/10 text-amber-300"}`}>{props.status.message}<Show when={props.status.state === "empty"}><span class="mt-1 block text-[10px] text-amber-700">Nothing was added and no investigation step was created. Try another direction or select another note.</span></Show></div></Show><p class="mt-2 font-mono text-[10px] text-emerald-800">Only directions that add new notes become investigation steps. Select any new note to continue.</p></div>
  </section>;
}

function Direction(props) { return <button disabled={props.loading} onClick={props.onClick} class="rounded border border-emerald-900 bg-black/10 p-3 text-left hover:border-lime-700 hover:bg-emerald-950/50 disabled:cursor-wait disabled:opacity-40"><span class="block text-sm text-lime-200">{props.title} →</span><span class="mt-1 block text-[11px] text-emerald-700">{props.loading ? "Checking relays…" : props.detail}</span></button>; }

function ResearchWorkspace(props) {
  const workspace = () => ["table", "matrix"].includes(props.view) ? "analyze" : ["map", "graph"].includes(props.view) ? "map" : "explore";
  const modes = [
    { id: "explore", label: "EXPLORE", detail: "read and follow evidence", defaultView: "list", views: ["list", "thread", "timeline"] },
    { id: "analyze", label: "ANALYZE", detail: "sort and compare the corpus", defaultView: "table", views: ["table", "matrix"] },
    { id: "map", label: "MAP", detail: "see relationships and structure", defaultView: "map", views: ["map", "graph"] }
  ];
  const activeMode = () => modes.find((mode) => mode.id === workspace());
  return <section class="overflow-hidden rounded border border-emerald-900 bg-emerald-950/10">
    <div class="grid border-b border-emerald-900 bg-black/20 sm:grid-cols-3">
      <For each={modes}>{(mode) => <button onClick={() => props.setView(mode.defaultView)} class={`border-b border-emerald-900 px-4 py-3 text-left sm:border-b-0 sm:border-r ${workspace() === mode.id ? "bg-lime-950/40" : "hover:bg-emerald-950/30"}`}><span class={`block font-mono text-xs tracking-[.14em] ${workspace() === mode.id ? "text-lime-300" : "text-emerald-600"}`}>{mode.label}</span><span class="mt-1 block text-[11px] text-emerald-800">{mode.detail}</span></button>}</For>
    </div>
    <div class="flex flex-wrap items-center gap-1 border-b border-emerald-900 bg-black/10 px-3 py-2">
      <For each={activeMode().views}>{(lens) => <button onClick={() => props.setView(lens)} class={`rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider ${props.view === lens ? "bg-lime-300 text-black" : "text-emerald-700 hover:bg-emerald-950 hover:text-emerald-300"}`}>{lens === "list" ? "notes" : lens}</button>}</For>
      <span class="ml-auto font-mono text-[10px] text-emerald-800">{props.events.length} visible nodes</span>
    </div>
    <Show when={props.view === "list"}><SearchView {...props}/></Show>
    <Show when={props.view === "table"}><ResearchTable {...props}/></Show>
    <Show when={props.view === "map"}><CorpusMap {...props}/></Show>
    <Show when={props.view === "thread"}><ThreadLens {...props}/></Show>
    <Show when={props.view === "timeline"}><TimelineLens {...props}/></Show>
    <Show when={props.view === "graph"}><GraphLens {...props}/></Show>
    <Show when={props.view === "matrix"}><MatrixLens {...props}/></Show>
    <Show when={props.canLoadMore}><div class="border-t border-emerald-900 bg-black/10 p-4 text-center"><button disabled={props.paging || !props.hasMore} onClick={props.onLoadMore} class="rounded border border-lime-800 px-6 py-2 font-mono text-xs text-lime-300 hover:bg-lime-300 hover:text-black disabled:cursor-not-allowed disabled:border-emerald-950 disabled:text-emerald-800">{props.paging ? "CHECKING RELAYS…" : props.hasMore ? "LOAD OLDER RESULTS" : "END OF RELAY RESULTS"}</button><Show when={props.pageMessage}><p class="mt-2 font-mono text-[10px] text-emerald-700">{props.pageMessage}</p></Show></div></Show>
  </section>;
}

function ResearchTable(props) {
  const [sortKey, setSortKey] = createSignal("date");
  const [sortDirection, setSortDirection] = createSignal("desc");
  const [localQuery, setLocalQuery] = createSignal("");
  const mediaCount = (event) => (event.content?.match(/https?:\/\/[^\s<>]+/gi) ?? []).map(cleanUrl).filter((url) => IMAGE_URL.test(url) || VIDEO_URL.test(url) || AUDIO_URL.test(url)).length;
  const referenceCount = (event) => ["e", "E", "a", "A", "q", "p"].reduce((count, type) => count + tags(event, type).length, 0);
  const valueFor = (event, key) => ({ date: event.created_at, author: props.profileFor(event.pubkey).name.toLowerCase(), kind: event.kind, topics: tags(event, "t").length, references: referenceCount(event), relays: (sourceIndex.get(event.id) ?? []).length, domains: eventDomains(event).length, media: mediaCount(event) }[key]);
  const matchingEvents = createMemo(() => { const needle = localQuery().trim().toLowerCase(); return needle ? props.events.filter((event) => [event.content, props.profileFor(event.pubkey).name, event.pubkey, ...tags(event, "t"), ...eventDomains(event), kindName(event.kind), String(event.kind)].join(" ").toLowerCase().includes(needle)) : props.events; });
  const rows = createMemo(() => [...matchingEvents()].sort((left, right) => {
    const a = valueFor(left, sortKey()); const b = valueFor(right, sortKey());
    const order = typeof a === "string" ? a.localeCompare(b) : a - b;
    return sortDirection() === "asc" ? order : -order;
  }));
  const sortBy = (key) => { if (sortKey() === key) setSortDirection((direction) => direction === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDirection(key === "author" ? "asc" : "desc"); } };
  const heading = (label, key) => <button onClick={() => sortBy(key)} class={`whitespace-nowrap text-left hover:text-lime-200 ${sortKey() === key ? "text-lime-300" : "text-emerald-700"}`}>{label}{sortKey() === key ? (sortDirection() === "asc" ? " ↑" : " ↓") : ""}</button>;
  return <div><LensHeader title="RESEARCH TABLE" detail={`${rows().length}/${props.events.length} events · sortable evidence inventory`}/><div class="border-b border-emerald-950 p-3"><input aria-label="Search within current corpus" value={localQuery()} onInput={(event) => setLocalQuery(event.currentTarget.value)} placeholder="Search inside this corpus: text, account, topic, domain, or kind…" class="w-full rounded border border-emerald-900 bg-black/30 px-3 py-2 font-mono text-xs text-emerald-200 outline-none placeholder:text-emerald-900 focus:border-lime-700"/></div><Show when={rows().length} fallback={<EmptyLens text="No events match this local corpus search."/>}>
    <div class="max-h-[72vh] overflow-auto"><table class="min-w-[1280px] border-collapse text-xs"><thead class="sticky top-0 z-10 bg-[#07110c] font-mono text-[10px] uppercase tracking-wider"><tr class="border-b border-emerald-800"><th class="p-2 text-emerald-800">#</th><th class="p-2">{heading("date", "date")}</th><th class="p-2">{heading("author", "author")}</th><th class="p-2">{heading("type", "kind")}</th><th class="p-2">{heading("topics", "topics")}</th><th class="p-2">{heading("edges", "references")}</th><th class="p-2">{heading("media", "media")}</th><th class="p-2">{heading("domains", "domains")}</th><th class="p-2">{heading("relays", "relays")}</th><th class="p-2 text-left text-emerald-700">why here / content</th><th class="p-2 text-emerald-700">actions</th></tr></thead>
    <tbody><For each={rows()}>{(event, index) => { const topics = () => tags(event, "t"); const domains = () => eventDomains(event); const relayCount = () => (sourceIndex.get(event.id) ?? []).length; return <tr class={`border-b border-emerald-950 align-top hover:bg-emerald-950/30 ${props.selectedId === event.id ? "bg-lime-950/20" : ""}`}><td class="p-2 font-mono text-emerald-900">{index() + 1}</td><td class="whitespace-nowrap p-2 font-mono text-emerald-600">{new Date(event.created_at * 1000).toISOString().slice(0, 10)}</td><td class="max-w-40 p-2"><button onClick={() => props.openRoute(`#/account/${event.pubkey}`)} class="block max-w-40 truncate text-emerald-300 hover:text-lime-300">{props.profileFor(event.pubkey).name}</button><span class="font-mono text-[9px] text-emerald-900">{short(event.pubkey)}</span></td><td class="whitespace-nowrap p-2"><span class="text-emerald-300">{kindName(event.kind)}</span><span class="ml-1 font-mono text-emerald-800">{event.kind}</span></td><td class="max-w-44 p-2"><div class="flex max-w-44 flex-wrap gap-1"><For each={topics().slice(0, 3)}>{(topic) => <button onClick={() => props.onFacet("topic", topic.toLowerCase())} class="rounded bg-emerald-950 px-1 text-lime-400">#{topic}</button>}</For><Show when={topics().length > 3}><span class="text-emerald-800">+{topics().length - 3}</span></Show></div></td><td class="p-2 text-center font-mono text-emerald-400">{referenceCount(event) || "·"}</td><td class="p-2 text-center font-mono text-emerald-400">{mediaCount(event) || "·"}</td><td class="max-w-32 p-2"><span class="block truncate text-emerald-500" title={domains().join(", ")}>{domains().join(", ") || "·"}</span></td><td class="p-2 text-center font-mono text-emerald-400" title={(sourceIndex.get(event.id) ?? []).join("\n")}>{relayCount() || "cache"}</td><td class="max-w-md p-2"><Show when={props.entryReasons[event.id]}><span class="mb-1 block font-mono text-[9px] text-amber-500">↳ {props.entryReasons[event.id]}</span></Show><span class="line-clamp-2 text-emerald-200">{compact(event.content, 180)}</span><Show when={event.duplicateCount > 1}><span class="mt-1 block text-[9px] text-amber-700">{event.duplicateCount} similar events</span></Show></td><td class="p-2"><div class="flex gap-1"><button title="Research from here" onClick={() => props.onSelect(event.id)} class="rounded border border-emerald-900 px-2 py-1 text-lime-300 hover:border-lime-600">→</button><button title="Read note" onClick={() => props.openRoute(`#/event/${event.id}`)} class="rounded border border-emerald-900 px-2 py-1 text-emerald-500 hover:text-lime-300">↗</button><button title="Pin evidence" onClick={() => props.onPin(event.id)} class={`rounded border px-2 py-1 ${props.pinned.has(event.id) ? "border-lime-500 bg-lime-300 text-black" : "border-emerald-900 text-emerald-500"}`}>◆</button></div></td></tr>; }}</For></tbody></table></div>
    <p class="border-t border-emerald-950 px-4 py-2 font-mono text-[9px] text-emerald-900">edges count event, address, quote, and account references · relay count reflects this session; “cache” means provenance was not restored</p>
  </Show></div>;
}

function CorpusMap(props) {
  const model = createMemo(() => {
    const events = props.events;
    const referenced = events.filter((event) => ["e", "E", "a", "A", "q"].some((type) => tags(event, type).length));
    return {
      topics: ranked(events.flatMap((event) => tags(event, "t").map((topic) => topic.toLowerCase())), 16),
      authors: ranked(events.map((event) => event.pubkey), 12),
      domains: ranked(events.flatMap(eventDomains), 12),
      relays: ranked(events.flatMap((event) => sourceIndex.get(event.id) ?? []), 8),
      kinds: ranked(events.map((event) => event.kind), 10),
      days: ranked(events.map((event) => new Date(event.created_at * 1000).toISOString().slice(0, 10)), 10),
      referenced: referenced.length,
      rootLike: events.filter((event) => !tags(event, "e").length && !tags(event, "E").length && !tags(event, "a").length && !tags(event, "A").length).length,
    };
  });
  return <div><LensHeader title="CORPUS MAP" detail={`${props.events.length} nodes · click anything to filter the corpus`}/>
    <Show when={props.events.length} fallback={<EmptyLens text="No visible events to map."/>}><div class="grid gap-px bg-emerald-950 lg:grid-cols-2">
      <MapSection title="TOPIC CLUSTERS" detail="Tags that organize this corpus"><For each={model().topics}>{([topic, count]) => <MapItem label={`#${topic}`} count={count} active={props.activeFacets.topic === topic} onClick={() => props.onFacet("topic", topic)}/>}</For></MapSection>
      <MapSection title="PARTICIPATING ACCOUNTS" detail="Who contributes most here"><For each={model().authors}>{([pubkey, count]) => <MapItem label={props.profileFor(pubkey).name} count={count} active={props.activeFacets.author === pubkey} onClick={() => props.onFacet("author", pubkey)} secondary="open" onSecondary={() => props.openRoute(`#/account/${pubkey}`)}/>}</For></MapSection>
      <MapSection title="EXTERNAL SOURCES" detail="Domains referenced in event content"><Show when={model().domains.length} fallback={<p class="text-emerald-900">No external domains in this corpus.</p>}><For each={model().domains}>{([domain, count]) => <MapItem label={domain} count={count} active={props.activeFacets.domain === domain} onClick={() => props.onFacet("domain", domain)}/>}</For></Show></MapSection>
      <MapSection title="DATA SHAPE" detail="Protocol types and conversation structure"><For each={model().kinds}>{([kind, count]) => <MapItem label={`${kindName(kind)} · ${kind}`} count={count} active={props.activeFacets.kind === kind} onClick={() => props.onFacet("kind", kind)}/>}</For><div class="mt-3 grid grid-cols-2 gap-2"><MapStat label="with references" value={model().referenced}/><MapStat label="root-like" value={model().rootLike}/></div></MapSection>
      <MapSection title="RELAY DISTRIBUTION" detail="Where visible events were observed"><Show when={model().relays.length} fallback={<p class="text-emerald-900">Relay provenance is unavailable for restored cached events.</p>}><For each={model().relays}>{([relay, count]) => <MapItem label={new URL(relay).hostname} count={count} active={props.activeFacets.relay === relay} onClick={() => props.onFacet("relay", relay)}/>}</For></Show></MapSection>
      <MapSection title="ACTIVITY WINDOWS" detail="Days represented in this corpus"><For each={model().days}>{([day, count]) => <MapItem label={day} count={count} active={props.activeFacets.day === day} onClick={() => props.onFacet("day", day)}/>}</For></MapSection>
    </div></Show>
  </div>;
}

function MapSection(props) { return <section class="bg-[#050b08] p-4"><div class="mb-3"><h3 class="font-mono text-[10px] tracking-[.14em] text-lime-300">{props.title}</h3><p class="mt-1 text-xs text-emerald-800">{props.detail}</p></div><div class="space-y-1">{props.children}</div></section>; }
function MapItem(props) { return <div class={`flex items-center rounded border ${props.active ? "border-lime-600 bg-lime-950/30" : "border-emerald-950 hover:border-emerald-800"}`}><button onClick={props.onClick} class="flex min-w-0 flex-1 items-center justify-between px-2 py-1.5 text-left text-sm text-emerald-400"><span class="truncate">{props.active ? "× " : ""}{props.label}</span><span class="ml-2 font-mono text-[10px] text-emerald-800">{props.count}</span></button><Show when={props.secondary}><button onClick={props.onSecondary} class="border-l border-emerald-950 px-2 py-1.5 font-mono text-[9px] text-emerald-700 hover:text-lime-300">{props.secondary} ↗</button></Show></div>; }
function MapStat(props) { return <div class="rounded border border-emerald-950 p-2"><span class="block font-mono text-lg text-emerald-300">{props.value}</span><span class="text-[10px] text-emerald-800">{props.label}</span></div>; }

function SearchView(props) {
  return <section>
    <Show when={props.events.length} fallback={<div class="p-8 text-sm text-emerald-800">{props.query ? (props.loading ? "Waiting for the first relay response…" : "No events returned.") : "No default feed. Start with a question, account, note, or topic."}</div>}>
      <For each={props.events}>{(event, index) => <EventRow event={event} index={index() + 1} profile={props.profileFor(event.pubkey)} pinned={props.pinned.has(event.id)} selected={props.selectedId === event.id} openRoute={props.openRoute} onSelect={props.onSelect} onNavigate={props.onNavigate} onPin={props.onPin}/>}</For>
    </Show>
  </section>;
}

function ThreadLens(props) {
  const groups = createMemo(() => {
    const map = new Map();
    for (const event of props.events) {
      const markedRoot = event.tags.find((tag) => tag[0] === "e" && tag[3] === "root")?.[1];
      const root = markedRoot ?? tags(event, "E")[0] ?? tags(event, "A")[0] ?? (tags(event, "e").length ? tags(event, "e")[0] : event.id);
      map.set(root, [...(map.get(root) ?? []), event]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  });
  return <div><LensHeader title="THREAD STRUCTURE" detail={`${groups().length} roots`}/><Show when={groups().length} fallback={<EmptyLens text="No thread references in the current corpus."/>}><For each={groups()}>{([root, events]) => <section class="border-b border-emerald-950 p-4"><div class="mb-3 flex items-center gap-3 font-mono text-[10px]"><span class="text-lime-400">ROOT {short(root)}</span><span class="text-emerald-800">{events.length} nodes</span></div><div class="ml-2 border-l border-emerald-800 pl-3"><For each={events.sort((a, b) => a.created_at - b.created_at)}>{(event) => <button onClick={() => props.onSelect(event.id)} class={`mb-2 block w-full rounded border p-3 text-left ${props.selectedId === event.id ? "border-lime-500 bg-emerald-950/50" : "border-emerald-950 hover:border-emerald-800"}`}><span class="font-mono text-[10px] text-emerald-700">{props.profileFor(event.pubkey).name} · {kindName(event.kind)}</span><span class="mt-1 block text-sm text-emerald-200">{compact(event.content, 180)}</span></button>}</For></div></section>}</For></Show></div>;
}

function TimelineLens(props) {
  const days = createMemo(() => {
    const map = new Map();
    for (const event of props.events) {
      const day = new Date(event.created_at * 1000).toISOString().slice(0, 10);
      map.set(day, [...(map.get(day) ?? []), event]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  });
  const maximum = createMemo(() => Math.max(1, ...days().map(([, events]) => events.length)));
  return <div><LensHeader title="ACTIVITY TIMELINE" detail={`${days().length} active days`}/><Show when={days().length} fallback={<EmptyLens text="No dated events in the current corpus."/>}><div class="space-y-1 p-4"><For each={days()}>{([day, events]) => <div class="grid grid-cols-[90px_1fr_38px] items-center gap-3"><span class="font-mono text-[10px] text-emerald-700">{day}</span><button onClick={() => props.onSelect(events[0].id)} class="h-7 rounded-sm bg-emerald-950 text-left transition hover:bg-emerald-800" style={{ width: `${Math.max(5, events.length / maximum() * 100)}%` }}><span class="pl-2 font-mono text-[9px] text-lime-300">{[...new Set(events.map((event) => event.kind))].slice(0, 4).join(" · ")}</span></button><span class="font-mono text-[10px] text-emerald-600">{events.length}</span></div>}</For></div></Show></div>;
}

function GraphLens(props) {
  const graph = createMemo(() => {
    const events = props.events.slice(0, 18);
    const authors = [...new Set(events.map((event) => event.pubkey))].slice(0, 10);
    const topics = [...new Set(events.flatMap((event) => tags(event, "t")))].slice(0, 8);
    return { events, authors, topics };
  });
  const height = createMemo(() => Math.max(420, graph().events.length * 34 + 50));
  const authorY = (pubkey) => 38 + graph().authors.indexOf(pubkey) * 52;
  const eventY = (id) => 35 + graph().events.findIndex((event) => event.id === id) * 34;
  const topicY = (topic) => 45 + graph().topics.indexOf(topic) * 58;
  return <div><LensHeader title="RELATION MAP" detail={`${graph().authors.length} accounts · ${graph().events.length} events · ${graph().topics.length} topics`}/><Show when={graph().events.length} fallback={<EmptyLens text="Add nodes to the corpus before opening the graph."/>}><div class="overflow-auto bg-[radial-gradient(circle_at_center,rgba(16,185,129,.05),transparent_65%)]"><svg viewBox={`0 0 900 ${height()}`} class="min-w-[760px]" style={{ height: `${height()}px` }}>
    <For each={graph().events}>{(event) => <line x1="155" y1={authorY(event.pubkey)} x2="410" y2={eventY(event.id)} stroke="#123c29" stroke-width="1"/>}</For>
    <For each={graph().events}>{(event) => <For each={tags(event, "t").filter((topic) => graph().topics.includes(topic))}>{(topic) => <line x1="510" y1={eventY(event.id)} x2="740" y2={topicY(topic)} stroke="#183c25" stroke-width="1"/>}</For>}</For>
    <For each={graph().authors}>{(pubkey) => <g onClick={() => props.openRoute(`#/account/${pubkey}`)} class="cursor-pointer"><rect x="20" y={authorY(pubkey) - 15} width="135" height="30" rx="4" fill="#07170e" stroke="#1c5433"/><text x="30" y={authorY(pubkey) + 4} fill="#74a77e" font-size="11">{compact(props.profileFor(pubkey).name, 18)}</text></g>}</For>
    <For each={graph().events}>{(event) => <g onClick={() => props.onSelect(event.id)} class="cursor-pointer"><circle cx="460" cy={eventY(event.id)} r={props.selectedId === event.id ? 9 : 6} fill={props.selectedId === event.id ? "#bef264" : "#34d399"}/><text x="476" y={eventY(event.id) + 4} fill="#9bc5a3" font-size="10">{kindName(event.kind)} · {short(event.id)}</text></g>}</For>
    <For each={graph().topics}>{(topic) => <g><rect x="740" y={topicY(topic) - 14} width="135" height="28" rx="14" fill="#101b0a" stroke="#52791d"/><text x="754" y={topicY(topic) + 4} fill="#bef264" font-size="11">#{compact(topic, 16)}</text></g>}</For>
  </svg></div><p class="border-t border-emerald-950 px-4 py-2 font-mono text-[9px] text-emerald-900">bounded to the first 18 visible events · click a node to research from it</p></Show></div>;
}

function MatrixLens(props) {
  const model = createMemo(() => {
    const authorCounts = new Map();
    const kinds = [...new Set(props.events.map((event) => event.kind))].slice(0, 8);
    for (const event of props.events) authorCounts.set(event.pubkey, (authorCounts.get(event.pubkey) ?? 0) + 1);
    const authors = [...authorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([pubkey]) => pubkey);
    return { authors, kinds };
  });
  const count = (pubkey, kind) => props.events.filter((event) => event.pubkey === pubkey && event.kind === kind).length;
  return <div><LensHeader title="ACCOUNT × DATA TYPE" detail="click a count to research from a matching note"/><Show when={model().authors.length} fallback={<EmptyLens text="No accounts available for comparison."/>}><div class="overflow-auto p-4"><table class="min-w-full border-collapse font-mono text-[10px]"><thead><tr><th class="p-2 text-left text-emerald-800">account</th><For each={model().kinds}>{(kind) => <th class="p-2 text-emerald-700">{kind}</th>}</For></tr></thead><tbody><For each={model().authors}>{(pubkey) => <tr class="border-t border-emerald-950"><th class="max-w-36 truncate p-2 text-left font-normal text-emerald-400">{props.profileFor(pubkey).name}</th><For each={model().kinds}>{(kind) => { const value = count(pubkey, kind); const match = () => props.events.find((event) => event.pubkey === pubkey && event.kind === kind); return <td class="p-1 text-center"><button disabled={!value} onClick={() => props.onSelect(match()?.id)} class={`h-8 w-10 rounded ${value ? "bg-emerald-950 text-lime-300 hover:bg-emerald-800" : "text-emerald-950"}`}>{value || "·"}</button></td>; }}</For></tr>}</For></tbody></table></div></Show></div>;
}

function LensHeader(props) { return <div class="flex justify-between border-b border-emerald-950 px-4 py-3 font-mono text-[10px] tracking-[.12em]"><span class="text-lime-300">{props.title}</span><span class="text-emerald-800">{props.detail}</span></div>; }
function EmptyLens(props) { return <div class="p-10 text-center text-sm text-emerald-800">{props.text}</div>; }

function EventRow(props) {
  return <article class={`group border-b px-4 py-4 transition hover:bg-emerald-950/30 ${props.selected ? "border-l-2 border-l-lime-300 border-b-emerald-950 bg-emerald-950/30" : "border-emerald-950"}`}>
    <div class="flex flex-wrap items-center gap-2 font-mono text-[10px] text-emerald-800"><span class="text-lime-500">[{props.index}]</span><span>{kindName(props.event.kind)} · {props.event.kind}</span><span>{new Date(props.event.created_at * 1000).toLocaleDateString()}</span><span>{short(props.event.id)}</span><Show when={props.event.duplicateCount > 1}><span class="rounded bg-amber-950/40 px-1.5 py-0.5 text-amber-400">{props.event.duplicateCount} similar notes · {props.event.duplicateAuthors.length} accounts</span></Show></div>
    <div class="mt-2 text-[15px] leading-6 text-emerald-50"><RichContent value={props.event.content} openRoute={props.openRoute} preview/></div>
    <button onClick={() => props.openRoute(`#/account/${props.event.pubkey}`)} class="mt-1 font-mono text-xs text-emerald-600 hover:text-emerald-300">{props.profile.name} <span class="text-emerald-900">{props.profile.handle}</span></button>
    <div class="mt-3 flex flex-wrap gap-2 font-mono text-[11px]"><Action active={props.selected} onClick={() => props.onSelect?.(props.event.id)}>research from here</Action><Action onClick={() => props.openRoute(`#/event/${props.event.id}`)}>read</Action><Show when={props.onNavigate}><Action onClick={() => props.onNavigate(props.event.id, "replies")}>conversation</Action><Show when={[...tags(props.event, "e"), ...tags(props.event, "q")].length}><Action onClick={() => props.onNavigate(props.event.id, "references")}>references · {[...tags(props.event, "e"), ...tags(props.event, "q")].length}</Action></Show><Action onClick={() => props.onNavigate(props.event.id, "author")}>more by author</Action></Show><Action onClick={() => props.openRoute(`#/raw/${props.event.id}`)}>raw</Action><Action active={props.pinned} onClick={() => props.onPin(props.event.id)}>pin</Action></div>
  </article>;
}

function Action(props) { return <button onClick={props.onClick} class={`rounded border px-2 py-1 transition ${props.active ? "border-lime-400 bg-lime-300 text-black" : "border-emerald-900 text-emerald-500 hover:border-emerald-600 hover:text-emerald-200"}`}>{props.children}</button>; }

function RouteView(props) {
  return <Show when={props.data} fallback={<LoadingPanel label="assembling node"/>}>
    <Show when={props.route.kind === "account" || props.route.kind === "follows"} fallback={<EventView route={props.route} data={props.data} profileFor={props.profileFor} openRoute={props.openRoute}/> }>
      <AccountView route={props.route} data={props.data} profileFor={props.profileFor} openRoute={props.openRoute}/>
    </Show>
  </Show>;
}

function EventView(props) {
  const event = () => props.data.event;
  return <section class="rounded border border-emerald-900 bg-emerald-950/10 p-4">
    <div class="mb-4 flex flex-wrap gap-2"><Action onClick={() => props.openRoute("#/search")}>← search</Action><Action onClick={() => props.openRoute(`#/account/${event().pubkey}`)}>author</Action><Action onClick={() => props.openRoute(`#/raw/${event().id}`)}>raw</Action></div>
    <Show when={props.route.kind === "raw"} fallback={<>
      <div class="border-y border-emerald-900 py-3 font-mono text-xs text-emerald-700"><div>kind <span class="text-lime-300">{event().kind} · {kindName(event().kind)}</span></div><div class="mt-1 break-all">event {event().id}</div><button onClick={() => props.openRoute(`#/account/${event().pubkey}`)} class="mt-1 break-all text-left hover:text-emerald-300">author {event().pubkey}</button></div>
      <div class="py-6 text-emerald-50"><RichContent value={event().content} openRoute={props.openRoute}/></div>
      <TagList event={event()} openRoute={props.openRoute}/>
      <div class="mt-6 border-t border-emerald-900 pt-4"><h3 class="mb-3 font-mono text-[11px] tracking-[.12em] text-lime-300">RELATED / REPLIES · {props.data.replies.length}</h3><For each={props.data.replies}>{(reply, index) => <EventRow event={reply} index={index() + 1} profile={props.profileFor(reply.pubkey)} openRoute={props.openRoute} onPin={() => {}}/>}</For></div>
    </>}>
      <pre class="overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-emerald-300">{JSON.stringify(event(), null, 2)}</pre>
    </Show>
  </section>;
}

const IMAGE_URL = /\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s]*)?$/i;
const VIDEO_URL = /\.(?:mp4|webm|mov|m4v)(?:\?[^\s]*)?$/i;
const AUDIO_URL = /\.(?:mp3|m4a|ogg|wav|flac)(?:\?[^\s]*)?$/i;
const URL_TOKEN = /(https?:\/\/[^\s<>]+|nostr:(?:npub|nprofile|note|nevent|naddr)1[023456789acdefghjklmnpqrstuvwxyz]+)/gi;
const cleanUrl = (value) => value.replace(/[),.;!?]+$/, "");

function InlineContent(props) {
  const pieces = () => props.value.split(URL_TOKEN);
  return <For each={pieces()}>{(piece) => {
    if (/^nostr:/i.test(piece)) {
      const target = routeForNip19(piece.slice(6));
      return target ? <button onClick={() => props.openRoute(target)} class="font-mono text-lime-300 underline decoration-emerald-700 underline-offset-2">{short(piece.slice(6))}</button> : piece;
    }
    if (/^https?:\/\//i.test(piece)) {
      const href = cleanUrl(piece);
      if (IMAGE_URL.test(href) || VIDEO_URL.test(href) || AUDIO_URL.test(href)) return piece.slice(href.length);
      return <><a href={href} target="_blank" rel="noreferrer" class="break-all text-lime-300 underline decoration-emerald-700 underline-offset-2">{compact(href, 70)}</a>{piece.slice(href.length)}</>;
    }
    const fragments = piece.split(/(\*\*[^*]+\*\*|`[^`]+`|#[\p{L}\p{N}_-]+)/gu);
    return <For each={fragments}>{(fragment) => fragment.startsWith("**") ? <strong class="font-semibold text-lime-100">{fragment.slice(2,-2)}</strong> : fragment.startsWith("`") ? <code class="rounded bg-black/40 px-1 py-0.5 font-mono text-emerald-300">{fragment.slice(1,-1)}</code> : fragment.startsWith("#") ? <button onClick={() => props.openRoute(`#/topic/${fragment.slice(1)}`)} class="text-lime-300 hover:underline">{fragment}</button> : fragment}</For>;
  }}</For>;
}

function RichContent(props) {
  const value = () => props.value?.trim() || "Empty content";
  const media = createMemo(() => [...new Set((value().match(/https?:\/\/[^\s<>]+/gi) ?? []).map(cleanUrl).filter((url) => IMAGE_URL.test(url) || VIDEO_URL.test(url) || AUDIO_URL.test(url)))].slice(0, props.preview ? 2 : 8));
  const text = () => props.preview ? compact(value(), 280) : value();
  return <div class="space-y-3"><div class={`whitespace-pre-wrap break-words ${props.preview ? "line-clamp-5" : "leading-7"}`}><InlineContent value={text()} openRoute={props.openRoute}/></div><Show when={media().length}><div class={`grid gap-2 ${media().length > 1 && !props.compactMedia ? "sm:grid-cols-2" : ""}`}><For each={media()}>{(url) => <Show when={IMAGE_URL.test(url)} fallback={<Show when={VIDEO_URL.test(url)} fallback={<audio src={url} controls preload="none" class="w-full"/>}><video src={url} controls preload="metadata" playsinline class={`${props.compactMedia ? "max-h-40" : "max-h-[520px]"} w-full rounded border border-emerald-900 bg-black object-contain`}/></Show>}><a href={url} target="_blank" rel="noreferrer"><img src={url} loading="lazy" decoding="async" class={`${props.compactMedia ? "max-h-40" : "max-h-[520px]"} w-full rounded border border-emerald-900 bg-black object-contain`} alt="Media attached to note"/></a></Show>}</For></div></Show></div>;
}

function TagList(props) {
  const destination = (tag) => tag[0] === "p" ? `#/account/${tag[1]}` : ["e", "q"].includes(tag[0]) ? `#/event/${tag[1]}` : tag[0] === "a" ? `#/address/${tag[1]}` : tag[0] === "t" ? `#/topic/${tag[1]}` : "";
  return <div class="border-t border-emerald-900 pt-4"><h3 class="mb-3 font-mono text-[11px] tracking-[.12em] text-lime-300">TAGS / OUTBOUND EDGES · {props.event.tags.length}</h3><div class="space-y-1 font-mono text-xs"><For each={props.event.tags}>{(tag, index) => <div class="grid gap-2 border-b border-emerald-950 py-2 sm:grid-cols-[110px_1fr]"><span class="text-emerald-800">[{index()}] {tag[0]}</span><Show when={destination(tag)} fallback={<span class="break-all text-emerald-500">{tag.slice(1).join(" · ")}</span>}><button onClick={() => props.openRoute(destination(tag))} class="break-all text-left text-lime-300 hover:underline">{tag.slice(1).join(" · ")}</button></Show></div>}</For></div></div>;
}

function AccountView(props) {
  const profile = () => props.profileFor(props.data.pubkey);
  const page = () => Math.max(1, Number(props.route.params.get("page")) || 1);
  const kind = () => props.route.params.get("kind");
  const authored = () => kind() === null ? props.data.authored : props.data.authored.filter((event) => String(event.kind) === kind());
  const follows = () => props.data.follows.slice((page() - 1) * 100, page() * 100);
  const visible = () => authored().slice((page() - 1) * PAGE_SIZE, page() * PAGE_SIZE);
  const counts = createMemo(() => [...props.data.authored.reduce((map, event) => map.set(event.kind, (map.get(event.kind) ?? 0) + 1), new Map()).entries()].sort((a, b) => a[0] - b[0]));
  return <section class="overflow-hidden rounded border border-emerald-900 bg-emerald-950/10">
    <div class="flex flex-wrap gap-2 border-b border-emerald-900 p-4"><Action onClick={() => props.openRoute("#/search")}>← search</Action><Action onClick={() => props.openRoute(`#/account/${props.data.pubkey}`)}>account</Action><Action onClick={() => props.openRoute(`#/follows/${props.data.pubkey}`)}>follows · {props.data.follows.length}</Action></div>
    <div class="p-5"><h1 class="text-xl text-lime-100">{profile().name}</h1><div class="mt-1 break-all font-mono text-xs text-emerald-800">{props.data.pubkey}</div><div class="mt-1 font-mono text-xs text-emerald-500">{profile().handle}</div><p class="mt-4 max-w-3xl whitespace-pre-wrap leading-7 text-emerald-300">{profile().about || "No profile description returned."}</p></div>
    <Show when={props.route.kind === "follows"} fallback={<>
      <div class="border-y border-emerald-900 p-4"><h2 class="mb-3 font-mono text-[11px] tracking-[.12em] text-lime-300">AUTHORED DATA TYPES</h2><div class="flex flex-wrap gap-2"><For each={counts()}>{([eventKind, count]) => <Action active={String(eventKind) === kind()} onClick={() => props.openRoute(`#/account/${props.data.pubkey}?kind=${eventKind}`)}>{kindName(eventKind)} · {eventKind} ({count})</Action>}</For></div></div>
      <CollectionHeader title="AUTHORED NODES" count={authored().length} page={page()} size={PAGE_SIZE} base={`#/account/${props.data.pubkey}${kind() === null ? "" : `?kind=${kind()}`}`} openRoute={props.openRoute}/>
      <For each={visible()}>{(event, index) => <EventRow event={event} index={(page() - 1) * PAGE_SIZE + index() + 1} profile={props.profileFor(event.pubkey)} openRoute={props.openRoute} onPin={() => {}}/>}</For>
      <div class="border-t border-emerald-900 p-4"><h2 class="mb-3 font-mono text-[11px] tracking-[.12em] text-lime-300">INBOUND MENTIONS · {props.data.mentions.length}</h2><For each={props.data.mentions.slice(0, 30)}>{(event, index) => <EventRow event={event} index={index() + 1} profile={props.profileFor(event.pubkey)} openRoute={props.openRoute} onPin={() => {}}/>}</For></div>
    </>}>
      <CollectionHeader title="FOLLOW GRAPH" count={props.data.follows.length} page={page()} size={100} base={`#/follows/${props.data.pubkey}`} openRoute={props.openRoute}/>
      <div class="grid sm:grid-cols-2 xl:grid-cols-3"><For each={follows()}>{(pubkey, index) => <button onClick={() => props.openRoute(`#/account/${pubkey}`)} class="border-b border-r border-emerald-950 p-3 text-left font-mono text-xs text-emerald-500 hover:bg-emerald-950/40 hover:text-lime-300"><span class="mr-2 text-emerald-900">[{(page() - 1) * 100 + index() + 1}]</span>{short(pubkey)}</button>}</For></div>
    </Show>
  </section>;
}

function CollectionHeader(props) {
  const pages = () => Math.max(1, Math.ceil(props.count / props.size));
  const target = (page) => `${props.base}${props.base.includes("?") ? "&" : "?"}page=${page}`;
  return <div class="flex items-center gap-3 border-y border-emerald-900 px-4 py-3 font-mono text-[11px]"><span class="tracking-[.12em] text-lime-300">{props.title} · {props.count}</span><div class="ml-auto flex items-center gap-2 text-emerald-700"><Show when={props.page > 1}><button onClick={() => props.openRoute(target(props.page - 1))}>←</button></Show><span>{props.page}/{pages()}</span><Show when={props.page < pages()}><button onClick={() => props.openRoute(target(props.page + 1))}>→</button></Show></div></div>;
}

render(() => <App/>, document.getElementById("app"));
