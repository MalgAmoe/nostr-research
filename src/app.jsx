import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { render } from "solid-js/web";
import { nip19 } from "nostr-tools";
import { buildGraphModel, cleanEventUrl, eventDomains, eventMedia, kindName, mediaTypeForUrl, parseKindList, ranked, tags } from "./event-analysis.js";
import { normalizeNamePattern } from "./block-rules.js";
import { constraintChips, emptyQueryConstraints, removeConstraint } from "./query-spec.js";
import { deleteEventsByAuthors, latestRun, listCollections, listRecipes, loadEvents, saveCollection, saveRecipe, saveRun, searchStoredEvents, storeEvents } from "./research-store.js";
import { loadRelayInformationSet } from "./relay-info.js";
import { PULSE_DEPTHS, PULSE_SCOPES, PULSE_WINDOWS } from "./pulse-analysis.js";
import { describeTag, parseEventSemantics, reconcileEventState } from "./protocol-semantics.js";
import { planEntityRelays, relayListFromEvent, relayQueryLimit } from "./relay-planner.js";
import { createResearchManifest, muteEventDraft, muteRulesFromEvent } from "./research-portability.js";
import { createNostrRuntime } from "./nostr-runtime.js";
import { createResearchSession } from "./research-session.js";
import { createRelayExplorer, emptyScanDirection } from "./relay-explorer.js";
import { SettingsPage } from "./ui/settings-page.jsx";
import { EntityActions } from "./ui/entity-actions.jsx";
import { createModerationPolicy } from "./moderation.js";
import "./styles.css";

const SEARCH_RELAYS_KEY = "nostr-research-relays-v2";
const SESSION_KEY = "nostr-research-session-v2";
const PULSE_SETTINGS_KEY = "nostr-research-pulse-v3";
const BLOCKED_ACCOUNTS_KEY = "nostr-research-blocked-accounts-v1";
const BLOCKED_NAMES_KEY = "nostr-research-blocked-names-v1";
const SEED_ACCOUNTS_KEY = "nostr-research-seed-accounts-v1";
const MUTE_RULES_KEY = "nostr-research-mute-rules-v1";
const SCAN_DIRECTION_KEY = "nostr-research-scan-direction-v1";
const SCAN_STRATEGY_KEY = "nostr-research-scan-strategy-v1";
const PULSE_SESSION_KEY = "nostr-research-pulse-session-v2";
const OBSOLETE_LOCAL_STATE_KEYS = [
  "nostr-research-session-v1",
  "nostr-research-pulse-session-v1",
  "nostr-research-follow-draft-v1",
  "nostr-research-workspaces-v1",
  "nostr-research-active-workspace-v1",
];
const DEFAULT_SEARCH_RELAYS = ["wss://search.nos.today"];
const READ_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net", "wss://nostr.mom"];
const INDEXER_RELAYS = ["wss://purplepag.es"];
const OPTIONAL_READ_RELAYS = ["wss://relay.snort.social"];
const FALLBACK_READ_RELAYS = OPTIONAL_READ_RELAYS;
const PAGE_SIZE = 40;
const SESSION_EVENT_LIMIT = 1000;
const PULSE_QUERY_LIMIT = 500;
const KIND_PRESETS = [[1, "Short notes"], [30023, "Long articles"], [20, "Pictures"], [21, "Videos"], [22, "Short videos"], [1111, "Comments"], [6, "Reposts"], [7, "Reactions"], [0, "Profiles"], [3, "Follow lists"], [9735, "Zap receipts"]];
const TAG_PRESETS = [["t", "Topic"], ["p", "Mentions person"], ["e", "Replies / references event"], ["q", "Quotes event"], ["d", "Address identifier"], ["a", "Addressable event"], ["r", "URL / resource"]];

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
for (const key of OBSOLETE_LOCAL_STATE_KEYS) localStorage.removeItem(key);
const initialBlockedAccounts = load(BLOCKED_ACCOUNTS_KEY, []).map((entry) => typeof entry === "string" ? { pubkey: entry, name: "", blockedAt: 0 } : entry).filter((entry) => /^[0-9a-f]{64}$/i.test(entry.pubkey));
const initialBlockedNames = load(BLOCKED_NAMES_KEY, []).map(normalizeNamePattern).filter(Boolean);
const initialSeedAccounts = load(SEED_ACCOUNTS_KEY, []).map((entry) => typeof entry === "string" ? { pubkey: entry, name: "", addedAt: 0 } : entry).filter((entry) => /^[0-9a-f]{64}$/i.test(entry.pubkey));
const initialMuteRules = load(MUTE_RULES_KEY, { topics: [], words: [], events: [], relays: [] });
const moderation = createModerationPolicy({ accounts: initialBlockedAccounts.map((entry) => entry.pubkey), names: initialBlockedNames, muteRules: initialMuteRules });
let runtime;
const allowedEvents = (events) => moderation.allowedEvents(events, (event) => runtime?.sourcesFor(event.id) ?? []);
runtime = createNostrRuntime({
  defaultRelays: READ_RELAYS,
  isEventAllowed: (event) => allowedEvents([event]).length === 1,
  isRelayAllowed: moderation.allowsRelay,
  persistEvents: storeEvents,
  logUsage,
});
const { queryRelay, readEvents, sourcesFor } = runtime;
const unique = (events) => [...new Map(events.filter((event) => event?.id).map((event) => [event.id, event])).values()];
const short = (value = "") => value.length > 18 ? `${value.slice(0, 9)}…${value.slice(-7)}` : value;
const compact = (value = "", length = 150) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text || "Untitled event";
};
const emptyFacets = () => ({ topic: "", author: "", kind: null, day: "", domain: "", relay: "", media: "" });

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

async function resolveNip05Identifier(value) {
  const [name, domain] = value.split("@");
  const response = await fetch(`https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`);
  return (await response.json()).names?.[name] ?? "";
}

function decodeAccountIdentifier(value) {
  if (/^[0-9a-f]{64}$/i.test(value)) return value;
  if (!/^(npub|nprofile)1/i.test(value)) return "";
  const decoded = nip19.decode(value);
  return typeof decoded.data === "string" ? decoded.data : decoded.data.pubkey;
}

function App() {
  const restored = load(SESSION_KEY, {});
  const [route, setRoute] = createSignal(parseRoute());
  const [profiles, setProfiles] = createSignal(new Map());
  const [routeLoading, setRouteLoading] = createSignal(false);
  const [routeData, setRouteData] = createSignal(null);
  const [searchRelays, setSearchRelays] = createSignal(load(SEARCH_RELAYS_KEY, DEFAULT_SEARCH_RELAYS));
  const [relayDraft, setRelayDraft] = createSignal(searchRelays().join("\n"));
  const [pulsePersistenceReady, setPulsePersistenceReady] = createSignal(false);
  const [relayInformation, setRelayInformation] = createSignal(new Map());
  const [blockedAccounts, setBlockedAccounts] = createSignal(initialBlockedAccounts);
  const [blockDraft, setBlockDraft] = createSignal("");
  const [blockedNames, setBlockedNames] = createSignal(initialBlockedNames);
  const [nameBlockDraft, setNameBlockDraft] = createSignal("");
  const [nameBlockRevision, setNameBlockRevision] = createSignal(0);
  const [seedAccounts, setSeedAccounts] = createSignal(initialSeedAccounts);
  const [seedAccountInput, setSeedAccountInput] = createSignal("");
  const [muteRules, setMuteRules] = createSignal(initialMuteRules);
  const [muteImportDraft, setMuteImportDraft] = createSignal("");
  const [blockNotice, setBlockNotice] = createSignal("");
  const [paths, setPaths] = createSignal([]);
  const [activeRecipeId, setActiveRecipeId] = createSignal("");
  const [collections, setCollections] = createSignal([]);
  const [collectionDraft, setCollectionDraft] = createSignal("");
  const [lastRunDelta, setLastRunDelta] = createSignal(null);
  const [comparisonTarget, setComparisonTarget] = createSignal({ dimension: "account", values: [] });
  const [researchDecisions, setResearchDecisions] = createSignal(restored.researchDecisions ?? []);
  const recordDecision = (type, label, detail = "") => setResearchDecisions((current) => [
    ...current,
    { id: crypto.randomUUID(), at: Date.now(), type, label, detail },
  ].slice(-30));
  let routeToken = 0;
  const knownEvents = new Map();
  const rememberEvents = (events) => { const allowed = allowedEvents(events); for (const event of allowed) knownEvents.set(event.id, event); return allowed; };
  const research = createResearchSession({
    runtime,
    readRelays: READ_RELAYS,
    searchRelays,
    relayInformation,
    relayQueryLimit,
    inspectRelays: (relays) => inspectRelays(relays),
    allowedEvents,
    rememberEvents,
    eventFor: (id) => knownEvents.get(id),
    allEvents: () => knownEvents.values(),
    short,
    hydrateProfiles: (events, isCurrent) => hydrateProfiles(events, isCurrent),
    recordDecision: (...args) => recordDecision(...args),
    recordResearchRun: (...args) => recordResearchRun(...args),
    logUsage,
    notice: setBlockNotice,
    openSearchRoute: () => { if (route().kind !== "search") location.hash = "#/search"; },
    focusComposer: (select = true) => queueMicrotask(() => {
      const input = document.getElementById("research-query-input");
      if (select) input?.select();
      else {
        document.getElementById("research-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
        input?.focus();
      }
    }),
    loadEvents,
    searchStoredEvents,
    storeEvents,
    sessionEventLimit: SESSION_EVENT_LIMIT,
  }, restored);
  const {
    draft: researchDraft, setDraft: setResearchDraft, updateDraft: updateResearchDraft,
    corpus, setCorpus, loading, setLoading, error, setError, relayStates, setRelayStates,
    kindFilter, setKindFilter, sinceDays, setSinceDays, view, setView, pinned, setPinned,
    selectedId, setSelectedId, constraintEditor, setConstraintEditor, executedQuery, setExecutedQuery,
    entryReasons, setEntryReasons, expansionStatus, setExpansionStatus, expansionOperation, setExpansionOperation,
    dedupeEnabled, setDedupeEnabled, lastQueryPlan, setLastQueryPlan, paging, hasMore, setHasMore,
    pageMessage, setPageMessage, activeFacets, setActiveFacets, corpusHistory, setCorpusHistory,
    selectedEvent, visibleCorpus, corpusFacets, composerChips, activeFacetCount,
  } = research;
  const restoreCorpusCheckpoint = research.restoreCheckpoint;
  const startRelaySearch = research.startRelaySearch;
  const searchSeedAccounts = research.searchAuthors;
  const loadMoreResults = research.loadMore;
  const resolvePubkey = research.resolvePubkey;
  const toggleFacet = research.toggleFacet;
  const compileActiveFacets = research.compileFacets;
  const prepareFacetSearch = research.prepareFacetSearch;
  const searchLocalArchive = research.searchLocalArchive;
  const expandSelection = research.expandSelection;
  const relayExplorer = createRelayExplorer({
    runtime,
    defaultRelays: READ_RELAYS,
    searchRelays,
    queryLimit: PULSE_QUERY_LIMIT,
    hydrateProfiles: (events) => hydrateProfiles(events),
    needsAllProfiles: () => blockedNames().length > 0,
    notice: setBlockNotice,
    short,
    logUsage,
    persistSettings: (value) => save(PULSE_SETTINGS_KEY, value),
    persistDirection: (value) => save(SCAN_DIRECTION_KEY, value),
    persistStrategy: (value) => save(SCAN_STRATEGY_KEY, value),
  }, {
    settings: load(PULSE_SETTINGS_KEY, undefined),
    direction: load(SCAN_DIRECTION_KEY, emptyScanDirection()),
    strategy: load(SCAN_STRATEGY_KEY, "adjacent"),
  });
  const {
    events: pulseEvents, setEvents: setPulseEvents, previousEvents: pulsePreviousEvents, setPreviousEvents: setPulsePreviousEvents,
    loading: pulseLoading, settings: pulseSettings, meta: pulseMeta, setMeta: setPulseMeta, progress: pulseProgress,
    view: pulseView, setView: setPulseView, direction: scanDirection, strategy: scanStrategy, round: scanRound,
    reasons: scanReasons, analysis: pulseAnalysis, neighborhood: neighborhoodCandidates, directionCount, updateSettings: updatePulseSettings,
    updateStrategy: updateScanStrategy, pursue: pursueDirection, addAuthors: addDirectionAuthors, removeDirection, clearDirection,
    scan: loadRelayPulse, continueScan: continueDirectedScan, cancel: cancelRelayPulse,
  } = relayExplorer;
  rememberEvents(corpus());
  const eventStates = createMemo(() => { corpus(); routeData(); return reconcileEventState([...knownEvents.values()]); });
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
    const discovered = [];
    setProfiles((previous) => {
      const next = new Map(previous);
      for (const event of events.sort((a, b) => a.created_at - b.created_at)) {
        try {
          const metadata = JSON.parse(event.content);
          moderation.recordProfile(event.pubkey, [metadata.display_name, metadata.name]);
          discovered.push(event.pubkey.toLowerCase());
          next.set(event.pubkey, { name: metadata.display_name || metadata.name || short(event.pubkey), handle: metadata.nip05 || short(event.pubkey), about: metadata.about || "" });
        } catch {}
      }
      return next;
    });
    queueMicrotask(() => reconcileNameBlocks(discovered));
  };
  const hydrateProfiles = async (events, isCurrent = () => true) => {
    const authors = [...new Set(events.map((event) => event.pubkey).filter((pubkey) => !profiles().has(pubkey)))];
    if (!authors.length) return;
    const visibleAuthors = authors.slice(0, 100);
    const metadata = await readEvents({ authors: visibleAuthors, kinds: [0], limit: visibleAuthors.length }, "profiles", [...READ_RELAYS, ...INDEXER_RELAYS]);
    if (isCurrent()) rememberProfiles(metadata);
    if (blockedNames().length && authors.length > visibleAuthors.length) {
      const remaining = authors.slice(visibleAuthors.length);
      for (let index = 0; index < remaining.length; index += 500) {
        const batch = remaining.slice(index, index + 500);
        const indexed = await readEvents({ authors: batch, kinds: [0], limit: batch.length }, `profiles-for-name-rules-${index / 500 + 1}`, INDEXER_RELAYS);
        if (!isCurrent()) return;
        rememberProfiles(indexed);
      }
    }
  };

  async function loadRoute(next = parseRoute()) {
    if (next.kind === "search" || next.kind === "relays" || next.kind === "settings") { setRoute(next); setRouteLoading(false); setRouteData(null); return; }
    const token = ++routeToken;
    const started = performance.now();
    setRouteLoading(true); setError(""); setRouteData(null); setRoute(next);
    try {
      if (next.kind === "topic") {
        const text = `#${next.value}`;
        location.hash = "#/search";
        startRelaySearch({ text, mode: "topic", operation: "replace" });
        return;
      }
      if (next.kind === "event" || next.kind === "raw") {
        const cachedEvent = knownEvents.get(next.value);
        const hintedRelays = planEntityRelays({ hints: [next.params.get("relay")], fallback: READ_RELAYS });
        const event = cachedEvent ?? (await readEvents({ ids: [next.value] }, "event", hintedRelays))[0] ?? (await readEvents({ ids: [next.value] }, "event-fallback", FALLBACK_READ_RELAYS))[0];
        if (!event) throw new Error("Event was not returned by the read relays");
        rememberEvents([event]);
        setRouteData({ event, replies: [], claims: [] });
        setRouteLoading(false);
        hydrateProfiles([event], () => token === routeToken);
        const [replies, claims] = await Promise.all([Promise.all([
          readEvents({ "#e": [event.id], kinds: [1, 1111], limit: researchDraft.limit }, "event-context-parent"),
          readEvents({ "#E": [event.id], kinds: [1111], limit: researchDraft.limit }, "event-context-root"),
        ]).then((batches) => unique(batches.flat())), readEvents({ "#e": [event.id], kinds: [1984, 1985], limit: Math.min(100, researchDraft.limit) }, "event-claims")]);
        if (token !== routeToken) return;
        rememberEvents([...replies, ...claims]);
        setRouteData({ event, replies, claims });
        hydrateProfiles([...replies, ...claims], () => token === routeToken);
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
        const discoveryRelays = planEntityRelays({ hints: [next.params.get("relay")], fallback: [...READ_RELAYS, ...INDEXER_RELAYS] });
        const [metadata, relayEvents] = await Promise.all([
          readEvents({ authors: [pubkey], kinds: [0], limit: 1 }, "account-metadata", discoveryRelays),
          readEvents({ authors: [pubkey], kinds: [10002], limit: 1 }, "account-relay-list", discoveryRelays),
        ]);
        const relayList = relayListFromEvent(relayEvents.sort((left, right) => right.created_at - left.created_at)[0]);
        const authoredRelays = planEntityRelays({ purpose: "authored", hints: [next.params.get("relay")], relayList, fallback: READ_RELAYS });
        const mentionRelays = planEntityRelays({ purpose: "mentions", relayList, fallback: READ_RELAYS });
        const [contacts, authored, mentions] = await Promise.all([
          readEvents({ authors: [pubkey], kinds: [3], limit: 1 }, "account-follows", authoredRelays),
          followOnly ? [] : readEvents({ authors: [pubkey], limit: researchDraft.limit }, "account-events", authoredRelays),
          followOnly ? [] : readEvents({ "#p": [pubkey], limit: researchDraft.limit }, "account-mentions", mentionRelays)
        ]);
        if (token !== routeToken) return;
        rememberEvents([...metadata, ...relayEvents, ...contacts, ...authored, ...mentions]);
        rememberProfiles(metadata);
        const contact = contacts.sort((a, b) => b.created_at - a.created_at)[0];
        setRouteData({ pubkey, relayList, relayPlan: { authored: authoredRelays, mentions: mentionRelays }, follows: tags(contact, "p"), authored: unique(authored).sort((a, b) => b.created_at - a.created_at), mentions: unique(mentions).filter((event) => event.pubkey !== pubkey).sort((a, b) => b.created_at - a.created_at) });
        hydrateProfiles([...authored, ...mentions], () => token === routeToken);
      } else throw new Error("Unknown location");
      logUsage("navigation", { destination: next.kind, durationMs: Math.round(performance.now() - started) });
    } catch (cause) { if (token === routeToken) setError(cause.message); }
    finally { if (token === routeToken) setRouteLoading(false); }
  }

  const openScanInSearch = () => {
    const events = pulseEvents();
    if (!events.length) { setBlockNotice("Run a scan before opening its corpus in Search."); return; }
    research.openFixedCorpus({
      events,
      label: `${directionCount()} direction signals · round ${scanRound()}`,
      mode: "directed scan",
      nextView: "table",
      draftPatch: { text: "", operation: "replace" },
      entryReasons: Object.fromEntries(events.map((event) => [event.id, scanReasons()[event.id] ?? `Relay Explorer round ${scanRound()}`])),
      pageMessage: "Directed scans are fixed corpora. Continue scanning in Relay Explorer or start a relay search.",
    });
    recordDecision("scan", `Opened Relay Explorer round ${scanRound()}`, `${scanStrategy()} · ${events.length} events · ${directionCount()} direction signals`);
    openRoute("#/search");
    logUsage("scan_opened_in_search", { round: scanRound(), events: events.length, directions: directionCount() });
  };
  const parseAccountKey = (value) => {
    const text = value.trim();
    if (/^[0-9a-f]{64}$/i.test(text)) return text.toLowerCase();
    try {
      const decoded = nip19.decode(text);
      if (decoded.type === "npub") return decoded.data.toLowerCase();
      if (decoded.type === "nprofile") return decoded.data.pubkey.toLowerCase();
    } catch {}
    return "";
  };
  const removeAuthorsFromResearch = async (pubkeys) => {
    const authors = new Set(pubkeys.map((value) => value.toLowerCase()));
    runtime.clearCache();
    const blockedIds = new Set([...knownEvents.values()].filter((event) => authors.has(event.pubkey?.toLowerCase())).map((event) => event.id));
    for (const id of blockedIds) knownEvents.delete(id);
    runtime.removeSources(blockedIds);
    setCorpus((events) => allowedEvents(events));
    setPulseEvents((events) => allowedEvents(events)); setPulsePreviousEvents((events) => allowedEvents(events));
    setPinned((ids) => new Set([...ids].filter((id) => !blockedIds.has(id))));
    if (blockedIds.has(selectedId())) setSelectedId("");
    setRouteData((data) => data?.pubkey && authors.has(data.pubkey.toLowerCase()) ? { ...data, follows: [], authored: [], mentions: [] } : data?.event && authors.has(data.event.pubkey?.toLowerCase()) ? null : data);
    return deleteEventsByAuthors([...authors]);
  };
  const matchingNamePattern = (pubkey) => {
    nameBlockRevision();
    return moderation.matchingName(pubkey);
  };
  const reconcileNameBlocks = (pubkeys = moderation.knownProfilePubkeys()) => {
    const newlyBlocked = moderation.reconcileNames(pubkeys);
    setNameBlockRevision((value) => value + 1);
    if (newlyBlocked.length) void removeAuthorsFromResearch(newlyBlocked).then((deleted) => logUsage("name_rule_matched", { accounts: newlyBlocked.length, deleted }));
  };
  const blockAccount = async (value, name = "") => {
    const pubkey = parseAccountKey(value);
    if (!pubkey) { setBlockNotice("Could not recognize that account key."); return false; }
    if (moderation.hasAccount(pubkey)) { setBlockNotice("This account is already blocked globally."); return false; }
    const entry = { pubkey, name: name || profileFor(pubkey).name, blockedAt: Date.now() };
    moderation.addAccount(pubkey);
    const next = [entry, ...blockedAccounts()];
    setBlockedAccounts(next); save(BLOCKED_ACCOUNTS_KEY, next); setBlockDraft("");
    const deleted = await removeAuthorsFromResearch([pubkey]);
    setBlockNotice(`${entry.name || short(pubkey)} is now blocked globally. ${deleted} locally stored event${deleted === 1 ? "" : "s"} removed.`);
    logUsage("account_blocked", { pubkey, deleted });
    return true;
  };
  const unblockAccount = (pubkey) => {
    moderation.removeAccount(pubkey);
    const next = blockedAccounts().filter((entry) => entry.pubkey !== pubkey);
    setBlockedAccounts(next); save(BLOCKED_ACCOUNTS_KEY, next); runtime.clearCache();
    setBlockNotice(`${short(pubkey)} is no longer blocked.`);
    logUsage("account_unblocked", { pubkey });
  };
  const addBlockedName = () => {
    const pattern = normalizeNamePattern(nameBlockDraft());
    if (!pattern || blockedNames().includes(pattern)) { setBlockNotice(pattern ? "That name pattern is already blocked." : "Enter text to block in account names."); return; }
    const nextPatterns = [...blockedNames(), pattern];
    moderation.setNamePatterns(nextPatterns);
    setBlockedNames(nextPatterns); save(BLOCKED_NAMES_KEY, nextPatterns); setNameBlockDraft("");
    reconcileNameBlocks();
    setBlockNotice(`Account names containing “${pattern}” are now blocked.`);
    logUsage("name_rule_added", { pattern });
  };
  const removeBlockedName = (pattern) => {
    const nextPatterns = blockedNames().filter((value) => value !== pattern);
    moderation.setNamePatterns(nextPatterns);
    setBlockedNames(nextPatterns); save(BLOCKED_NAMES_KEY, nextPatterns); reconcileNameBlocks(); runtime.clearCache();
    setBlockNotice(`Name rule “${pattern}” removed. Rerun research to retrieve previously filtered accounts.`);
    logUsage("name_rule_removed", { pattern });
  };
  const blockReason = (pubkey) => blockedAccounts().some((entry) => entry.pubkey === pubkey?.toLowerCase()) ? { type: "key", label: "public key" } : matchingNamePattern(pubkey) ? { type: "name", label: matchingNamePattern(pubkey) } : null;
  const isAccountBlocked = (pubkey) => Boolean(blockReason(pubkey));
  const addSeedAccount = (value, name = "") => {
    const pubkey = parseAccountKey(value);
    if (!pubkey) { setBlockNotice("Could not recognize that account key."); return false; }
    if (seedAccounts().some((entry) => entry.pubkey === pubkey)) { setBlockNotice("This account is already a seed."); return false; }
    const entry = { pubkey, name: name || profileFor(pubkey).name, addedAt: Date.now() };
    const next = [entry, ...seedAccounts()];
    setSeedAccounts(next); save(SEED_ACCOUNTS_KEY, next); setSeedAccountInput("");
    setBlockNotice(`${entry.name || short(pubkey)} added to Seed Accounts.`);
    logUsage("seed_account_added", { pubkey });
    return true;
  };
  const removeSeedAccount = (pubkey) => {
    const next = seedAccounts().filter((entry) => entry.pubkey !== pubkey);
    setSeedAccounts(next); save(SEED_ACCOUNTS_KEY, next);
    setBlockNotice(`${short(pubkey)} removed from Seed Accounts.`);
    logUsage("seed_account_removed", { pubkey });
  };
  const isSeedAccount = (pubkey) => seedAccounts().some((entry) => entry.pubkey === pubkey?.toLowerCase());
  const applyMuteRules = (next) => {
    const normalized = {
      topics: [...new Set((next.topics ?? []).map((value) => String(value).trim().toLowerCase().replace(/^#/, "")).filter(Boolean))],
      words: [...new Set((next.words ?? []).map((value) => String(value).trim().toLowerCase()).filter(Boolean))],
      events: [...new Set((next.events ?? []).map((value) => String(value).trim().toLowerCase()).filter((value) => /^[0-9a-f]{64}$/.test(value)))],
      relays: [...new Set((next.relays ?? []).map((value) => String(value).trim().replace(/\/$/, "")).filter((value) => value.startsWith("wss://")))],
    };
    moderation.setRules(normalized);
    setMuteRules(normalized); save(MUTE_RULES_KEY, normalized); runtime.clearCache();
    setCorpus((events) => allowedEvents(events)); setPulseEvents((events) => allowedEvents(events)); setPulsePreviousEvents((events) => allowedEvents(events));
    return normalized;
  };
  const addEntityToDirection = (type, value) => {
    const directionType = type === "account" ? "author" : type;
    if (!["author", "topic", "domain", "event"].includes(directionType)) return;
    const added = pursueDirection(directionType, value);
    setBlockNotice(added ? "Added to the Relay Explorer direction." : "Already in the direction, or that direction has reached its limit.");
  };
  const excludeEntity = async (type, value, label = "") => {
    if (type === "account") { await blockAccount(value, label); return; }
    const key = type === "topic" ? "topics" : type === "event" ? "events" : type === "relay" ? "relays" : "";
    if (!key) return;
    const next = [...new Set([...(muteRules()[key] ?? []), value])];
    applyMuteRules({ ...muteRules(), [key]: next });
    setBlockNotice(`${label || value} excluded globally.`);
    logUsage("entity_excluded", { entityType: type, value });
  };
  const compareEntity = (type, value) => {
    const dimension = type === "account" ? "account" : type;
    if (!["account", "topic", "relay"].includes(dimension)) return;
    setComparisonTarget((current) => ({
      dimension,
      values: current.dimension === dimension ? [...new Set([...current.values, value])].slice(-2) : [value],
    }));
    setView("compare");
    openRoute("#/search");
  };
  const prepareEntitySearch = (type, value) => {
    if (type === "event") {
      updateResearchDraft({ text: value, mode: "note", constraints: emptyQueryConstraints(), operation: "replace" });
      openRoute("#/search");
      queueMicrotask(() => document.getElementById("research-composer")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }
    prepareFacetSearch(type === "account" ? "author" : type, value);
  };
  const entityActionsFor = (type, value, label, capabilities = {}) => {
    const facetType = type === "account" ? "author" : type;
    const enabled = (name, fallback = true) => capabilities[name] ?? fallback;
    return {
      label,
      onFilter: enabled("filter") && ["account", "topic", "domain", "relay"].includes(type) ? () => toggleFacet(facetType, value) : undefined,
      onSearch: enabled("search") ? () => prepareEntitySearch(type, value) : undefined,
      onDirection: enabled("direction") && ["account", "topic", "domain", "event"].includes(type) ? () => addEntityToDirection(type, value) : undefined,
      onOpen: enabled("open") && ["account", "event"].includes(type) ? () => openRoute(`#/${type}/${value}`) : undefined,
      onCompare: enabled("compare") && ["account", "topic", "relay"].includes(type) ? () => compareEntity(type, value) : undefined,
      onExclude: enabled("exclude") && ["account", "topic", "relay", "event"].includes(type) ? () => void excludeEntity(type, value, label) : undefined,
      onExcludeLabel: type === "account" ? "block globally" : "mute globally",
    };
  };
  const importMuteList = () => {
    try {
      const event = JSON.parse(muteImportDraft());
      const imported = muteRulesFromEvent(event);
      for (const pubkey of imported.accounts) if (!moderation.hasAccount(pubkey)) void blockAccount(pubkey);
      const normalized = applyMuteRules({ topics: [...muteRules().topics, ...imported.topics], words: [...muteRules().words, ...imported.words], events: [...muteRules().events, ...imported.events], relays: [...muteRules().relays, ...imported.relays] });
      setMuteImportDraft(""); setBlockNotice(`Imported NIP-51 mute rules: ${imported.accounts.length} accounts and ${Object.values(normalized).flat().length} local rules.`);
      logUsage("mute_list_imported", { accounts: imported.accounts.length, topics: imported.topics.length, words: imported.words.length, events: imported.events.length, relays: imported.relays.length });
    } catch { setBlockNotice("That is not a valid public kind 10000 mute-list event."); }
  };
  const downloadJson = (name, value) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    link.download = name; link.click(); URL.revokeObjectURL(link.href);
  };
  const currentManifest = () => createResearchManifest({
    query: researchDraft.text,
    constraints: researchDraft.constraints,
    strategy: pulseMeta()?.strategy ?? "search",
    relays: [...new Set([...READ_RELAYS, ...searchRelays()])],
    relayStates: relayStates(),
    events: corpus(),
    blocked: { accounts: blockedAccounts().map((item) => item.pubkey), names: blockedNames(), ...muteRules() },
  });
  const exportMuteList = () => downloadJson("nostr-mute-list-draft.json", muteEventDraft({ ...muteRules(), accounts: moderation.accountsList() }));
  const exportManifest = () => downloadJson("nostr-research-manifest.json", currentManifest());
  const exportResearchPackage = () => {
    const manifest = currentManifest();
    downloadJson("nostr-research-package.json", { format: "nostr-research-package-v1", manifest, evidence: [...pinned()].map((id) => knownEvents.get(id)).filter(Boolean), seedAccounts: seedAccounts(), muteListDraft: muteEventDraft({ ...muteRules(), accounts: moderation.accountsList() }), direction: scanDirection(), decisions: researchDecisions() });
  };
  const researchPulseRelay = (relay, topic = "") => {
    updateResearchDraft({
      text: topic ? `#${topic}` : "",
      mode: "topic",
      constraints: { ...researchDraft.constraints, relay, promotedTopic: topic },
    });
    openRoute("#/search");
    queueMicrotask(() => document.getElementById("research-composer")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const savePath = async () => {
    const existing = paths().find((path) => path.id === activeRecipeId());
    const id = existing?.id ?? crypto.randomUUID();
    const now = Date.now();
    const recipe = {
      id,
      title: researchDraft.text || constraintChips(researchDraft.constraints).map((chip) => chip.label).join(" · ") || "Untitled investigation",
      query: researchDraft.text,
      queryDraft: { mode: researchDraft.mode, value: researchDraft.text, constraints: researchDraft.constraints },
      plan: lastQueryPlan(),
      operation: researchDraft.operation,
      eventIds: corpus().map((event) => event.id),
      settings: { view: view(), kindFilter: kindFilter(), sinceDays: sinceDays(), dedupeEnabled: dedupeEnabled(), queryLimit: researchDraft.limit },
      pinned: [...pinned()],
      manifest: currentManifest(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await storeEvents(corpus(), sourcesFor);
    await saveRecipe(recipe);
    setActiveRecipeId(id);
    setPaths((current) => [recipe, ...current.filter((path) => path.id !== id)].sort((a, b) => b.updatedAt - a.updatedAt));
    if (!(await latestRun(id))) await saveRun({ id: crypto.randomUUID(), recipeId: id, completedAt: now, eventIds: recipe.eventIds, details: { baseline: true, query: recipe.query }, relayStates: Object.fromEntries(relayStates()) });
    setLastRunDelta({ previous: false, added: 0, missing: 0, overlap: null });
    logUsage("recipe_saved", { recipeId: id, resultCount: recipe.eventIds.length });
  };
  const restorePath = async (path) => {
    const operation = research.invalidate();
    const storedEvents = allowedEvents(await loadEvents(path.eventIds ?? [], runtime.recordSources));
    if (!research.isCurrentOperation(operation)) return;
    void storeEvents(storedEvents, sourcesFor).catch((cause) => logUsage("local_storage_failed", { operation: "refresh saved search events", detail: cause.message }));
    setActiveRecipeId(path.id); setLastRunDelta(null);
    const draft = path.queryDraft ?? { mode: "words", value: path.query ?? "", constraints: emptyQueryConstraints() };
    updateResearchDraft({
      text: draft.value,
      mode: draft.mode,
      constraints: draft.constraints ?? emptyQueryConstraints(),
      limit: path.settings?.queryLimit ?? researchDraft.limit,
    });
    setCorpus(storedEvents); rememberEvents(storedEvents);
    const restoredIds = new Set(storedEvents.map((event) => event.id));
    setPinned(new Set((path.pinned ?? []).filter((id) => restoredIds.has(id)))); setView(path.settings?.view ?? "list");
    setKindFilter(path.settings?.kindFilter ?? "all"); setSinceDays(path.settings?.sinceDays ?? 0);
    setDedupeEnabled(path.settings?.dedupeEnabled ?? true); setLastQueryPlan(path.plan ?? null);
    history.replaceState(null, "", "#/search"); setRoute(parseRoute());
    logUsage("recipe_opened", { recipeId: path.id, cachedEvents: storedEvents.length });
  };
  const rerunRecipe = () => {
    const recipe = paths().find((path) => path.id === activeRecipeId());
    if (!recipe) return;
    const draft = recipe.queryDraft ?? { mode: "words", value: recipe.query, constraints: emptyQueryConstraints() };
    startRelaySearch(
      { text: draft.value, mode: draft.mode, constraints: draft.constraints ?? emptyQueryConstraints(), operation: "replace" },
      () => setBlockNotice("This saved recipe has neither text nor relay constraints to rerun."),
    );
  };
  const newExploration = () => {
    if (corpus().length && !window.confirm("Start a new exploration? The current corpus will be cleared. Saved recipes and collections will remain.")) return;
    routeToken += 1;
    research.invalidate();
    localStorage.removeItem(SESSION_KEY);
    knownEvents.clear();
    updateResearchDraft({ text: "", constraints: emptyQueryConstraints(), mode: "topic", operation: "replace" });
    setExecutedQuery(null); setCorpus([]); setProfiles(new Map()); setSelectedId(""); setPinned(new Set());
    setEntryReasons({}); setExpansionStatus(null); setKindFilter("all"); setSinceDays(0); setView("list");
    setRelayStates(new Map()); setError(""); setRouteData(null); setLastQueryPlan(null); setHasMore(true); setPageMessage(""); setActiveRecipeId(""); setLastRunDelta(null); setActiveFacets(emptyFacets()); setCorpusHistory([]);
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
    await storeEvents(eventIds.map((id) => knownEvents.get(id)).filter(Boolean), sourcesFor);
    await saveCollection(collection);
    setCollections((current) => [collection, ...current]); setCollectionDraft("");
    logUsage("collection_saved", { collectionId: collection.id, eventCount: eventIds.length });
  };
  const openCollection = async (collection) => {
    const operation = research.invalidate();
    const events = allowedEvents(await loadEvents(collection.eventIds, runtime.recordSources));
    if (!research.isCurrentOperation(operation)) return;
    research.openFixedCorpus({
      events: events.sort((a, b) => b.created_at - a.created_at),
      label: collection.title,
      mode: "collection",
      nextView: "table",
      draftPatch: { text: collection.title },
      pinnedIds: events.map((event) => event.id),
      pageMessage: "Collections are fixed corpora. Run a relay search to retrieve more.",
    });
    history.replaceState(null, "", "#/search"); setRoute(parseRoute());
    logUsage("collection_opened", { collectionId: collection.id, cachedEvents: events.length });
  };
  const toggleSet = (setter, id) => setter((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });

  createEffect(() => save(SESSION_KEY, {
    query: researchDraft.text, queryConstraints: researchDraft.constraints, startMode: researchDraft.mode, executedQuery: executedQuery(), eventIds: corpus().slice(0, SESSION_EVENT_LIMIT).map((event) => event.id), pinned: [...pinned()].slice(0, 150), selectedId: selectedId(), view: view(), kindFilter: kindFilter(), sinceDays: sinceDays(), entryReasons: Object.fromEntries(Object.entries(entryReasons()).slice(-150)), dedupeEnabled: dedupeEnabled(), activeRecipeId: activeRecipeId(), corpusHistory: corpusHistory(), queryLimit: researchDraft.limit, researchDecisions: researchDecisions(), lastQueryPlan: lastQueryPlan(), hasMore: hasMore(), pageMessage: pageMessage(), activeFacets: activeFacets()
  }));
  createEffect(() => {
    if (!pulsePersistenceReady()) return;
    const events = pulseEvents(); const previous = pulsePreviousEvents();
    save(PULSE_SESSION_KEY, { eventIds: events.slice(0, SESSION_EVENT_LIMIT).map((event) => event.id), previousIds: previous.slice(0, SESSION_EVENT_LIMIT).map((event) => event.id), meta: pulseMeta(), round: scanRound(), reasons: scanReasons() });
    void storeEvents([...events, ...previous], sourcesFor).catch((cause) => logUsage("local_storage_failed", { operation: "store Relay Explorer session", detail: cause.message }));
  });

  onMount(async () => {
    const handler = () => loadRoute(parseRoute());
    window.addEventListener("hashchange", handler);
    onCleanup(() => { window.removeEventListener("hashchange", handler); runtime.destroy(); });
    logUsage("client_opened", { framework: "solid", searchRelays: searchRelays() });
    const [recipes, storedCollections] = await Promise.all([listRecipes(), listCollections()]);
    if (storedCollections.length) setCollections(storedCollections);
    if (recipes.length) setPaths(recipes);
    if (restored.eventIds?.length) {
      const stored = allowedEvents(await loadEvents(restored.eventIds, runtime.recordSources));
      if (stored.length) {
        void storeEvents(stored, sourcesFor).catch((cause) => logUsage("local_storage_failed", { operation: "refresh restored session events", detail: cause.message }));
        setCorpus(stored); rememberEvents(stored);
        const restoredIds = new Set(stored.map((event) => event.id));
        setPinned(new Set((restored.pinned ?? []).filter((id) => restoredIds.has(id))));
      }
    }
    if (restored.activeRecipeId) setActiveRecipeId(restored.activeRecipeId);
    const pulseRestored = load(PULSE_SESSION_KEY, null);
    if (pulseRestored?.eventIds?.length) {
      const [current, previous] = await Promise.all([loadEvents(pulseRestored.eventIds, runtime.recordSources), loadEvents(pulseRestored.previousIds ?? [], runtime.recordSources)]);
      relayExplorer.restore({ events: allowedEvents(current), previous: allowedEvents(previous), meta: pulseRestored.meta ?? null, round: pulseRestored.round ?? 0, reasons: pulseRestored.reasons ?? {} });
      setPulsePersistenceReady(true);
    } else setPulsePersistenceReady(true);
    loadRoute();
  });

  const openRoute = (target) => {
    history.pushState(null, "", target);
    const next = parseRoute();
    queueMicrotask(() => loadRoute(next));
  };

  const selectEvent = (id) => {
    setSelectedId(id); setExpansionStatus(null);
  };
  const composeAuthorSearch = (pubkey) => {
    setResearchDraft("constraints", (current) => ({ ...current, author: pubkey }));
    openRoute("#/search");
    queueMicrotask(() => document.getElementById("research-composer")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const usableSeedPubkeys = () => seedAccounts().map((account) => account.pubkey).filter((pubkey) => !isAccountBlocked(pubkey));
  const searchAllSeeds = () => void searchSeedAccounts(usableSeedPubkeys());
  const searchOneSeed = (pubkey) => prepareFacetSearch("author", pubkey);
  const directAllSeeds = () => {
    const added = addDirectionAuthors(usableSeedPubkeys());
    setBlockNotice(added ? `${added} seed account${added === 1 ? "" : "s"} added to the Relay Explorer direction.` : "Those seed accounts are already in the direction, or its eight-account limit is full.");
  };
  const directOneSeed = (pubkey) => {
    const added = pursueDirection("author", pubkey);
    setBlockNotice(added ? "Seed account added to the Relay Explorer direction." : "That account is already in the direction, or its eight-account limit is full.");
  };
  const navigateFromEvent = (id, relation) => {
    setSelectedId(id); setExpansionStatus(null);
    if (relation === "author") {
      const event = knownEvents.get(id);
      if (event) {
        composeAuthorSearch(event.pubkey);
      }
      return;
    }
    void expandSelection(relation);
  };

  return <div class="min-h-screen bg-[#050b08] text-emerald-100 selection:bg-lime-300 selection:text-black">
    <header class="sticky top-0 z-30 border-b border-emerald-900/80 bg-[#050b08]/95 backdrop-blur">
      <div class="relative mx-auto flex max-w-[1600px] items-center gap-5 px-4 py-3 lg:px-7">
        <button onClick={() => openRoute("#/search")} class="font-mono text-sm font-bold tracking-[.14em] text-lime-200">NOSTR_RESEARCH<span class="text-emerald-700">://LIVE</span></button>
        <nav class="absolute left-1/2 flex -translate-x-1/2 items-center gap-1 font-mono text-[11px]"><button onClick={() => openRoute("#/search")} class={`rounded px-3 py-1.5 ${route().kind === "search" ? "bg-lime-300 text-black" : "text-emerald-500 hover:text-lime-300"}`}>SEARCH</button><button onClick={() => openRoute("#/relays")} class={`rounded px-3 py-1.5 ${route().kind === "relays" ? "bg-lime-300 text-black" : "text-emerald-500 hover:text-lime-300"}`}>RELAY EXPLORER</button></nav>
        <div class="ml-auto flex items-center gap-2"><button aria-label="Settings" title="Settings" onClick={() => openRoute("#/settings")} class={`flex h-8 w-8 items-center justify-center rounded-full border font-mono text-sm ${route().kind === "settings" ? "border-lime-400 bg-lime-300 text-black" : "border-emerald-800 text-emerald-400 hover:border-lime-500 hover:text-lime-300"}`}>⚙</button><button onClick={newExploration} class="rounded border border-lime-800 px-3 py-1.5 font-mono text-[11px] text-lime-300 hover:bg-lime-300 hover:text-black">＋ NEW</button><div class="hidden items-center gap-2 text-[11px] text-emerald-700 sm:flex"><span class="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-300"/>LIVE RELAYS</div></div>
      </div>
    </header>
    <Show when={blockNotice()}><div class="fixed bottom-5 left-1/2 z-50 flex w-[min(92vw,42rem)] -translate-x-1/2 items-center gap-3 rounded border border-lime-700 bg-[#07110c] px-4 py-3 shadow-2xl"><span class="font-mono text-xs text-lime-200">{blockNotice()}</span><button onClick={() => setBlockNotice("")} class="ml-auto font-mono text-emerald-600 hover:text-lime-300">×</button></div></Show>

    <div class={`mx-auto grid gap-4 px-4 py-5 lg:px-6 ${route().kind === "settings" ? "max-w-[1100px]" : route().kind === "relays" ? "max-w-[1600px]" : "max-w-[1800px] xl:grid-cols-[250px_minmax(0,1fr)_310px]"}`}>
      <Show when={!['settings', 'relays'].includes(route().kind)}><aside class="hidden space-y-4 xl:sticky xl:top-20 xl:block xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
        <Show when={corpus().length}><FacetPanel facets={corpusFacets()} active={activeFacets()} profileFor={profileFor} onFacet={toggleFacet} onSearchFacet={prepareFacetSearch} actionsFor={entityActionsFor} onClear={() => setActiveFacets(emptyFacets())} onCompile={compileActiveFacets}/></Show>
        <Panel title="SAVED SEARCHES"><Show when={paths().length} fallback={<p class="text-emerald-900">Save a search to run it again later.</p>}><For each={paths().slice(0, 8)}>{(path) => <button onClick={() => void restorePath(path)} class={`block w-full border-b border-emerald-950 py-2 text-left hover:text-lime-300 ${activeRecipeId() === path.id ? "text-lime-300" : "text-emerald-500"}`}><span class="block truncate">{activeRecipeId() === path.id ? "› " : ""}{path.title}</span><span class="mt-0.5 block text-[9px] text-emerald-900">{path.eventIds?.length ?? 0} cached nodes</span></button>}</For></Show></Panel>
        <Show when={collections().length}><Panel title="EVIDENCE COLLECTIONS"><For each={collections().slice(0, 8)}>{(collection) => <button onClick={() => void openCollection(collection)} class="block w-full border-b border-emerald-950 py-2 text-left text-emerald-500 hover:text-lime-300"><span class="block truncate">{collection.title}</span><span class="mt-0.5 block text-[9px] text-emerald-900">{collection.eventIds.length} evidence items</span></button>}</For></Panel></Show>
        <Show when={corpusHistory().length}><details class="rounded border border-emerald-900 bg-emerald-950/10 p-3 font-mono text-xs"><summary class="cursor-pointer text-[10px] tracking-[.16em] text-emerald-600">RECENT HISTORY · {corpusHistory().length}</summary><div class="mt-3"><For each={corpusHistory()}>{(checkpoint) => <button onClick={() => void restoreCorpusCheckpoint(checkpoint)} class="block w-full border-b border-emerald-950 py-2 text-left text-emerald-500 hover:text-lime-300"><span class="block truncate">↶ {checkpoint.label}</span><span class="mt-0.5 block text-[9px] text-emerald-900">{checkpoint.eventIds.length} events · {new Date(checkpoint.at).toLocaleTimeString()}</span></button>}</For></div></details></Show>
        <Show when={corpus().length}><Panel title="CURRENT INVESTIGATION"><Stat label="retrieved" value={corpus().length}/><Stat label="visible" value={visibleCorpus().length}/><Stat label="active facets" value={activeFacetCount()}/><Stat label="evidence" value={pinned().size}/></Panel></Show>
      </aside></Show>

      <main class="min-w-0">
        <Show when={route().kind === "search"}><Show when={corpus().length}><details class="mb-4 rounded border border-emerald-900 bg-emerald-950/10 p-3 font-mono text-xs xl:hidden"><summary class="text-lime-300">filter this corpus · {visibleCorpus().length}/{corpus().length} items</summary><div class="mt-3 border-t border-emerald-900 pt-3"><div class="flex flex-wrap gap-2"><For each={corpusFacets().topics.slice(0, 10)}>{([topic, count]) => <button onClick={() => toggleFacet("topic", topic)} class={`rounded border px-2 py-1 ${activeFacets().topic === topic ? "border-lime-400 bg-lime-300 text-black" : "border-emerald-900 text-emerald-500"}`}>#{topic} {count}</button>}</For><Show when={activeFacetCount()}><button onClick={compileActiveFacets} class="rounded border border-lime-700 px-2 py-1 text-lime-300">use in a new search ↗</button><button onClick={() => setActiveFacets(emptyFacets())} class="text-emerald-600">clear</button></Show></div></div></details></Show>
        <section id="research-composer" class="mb-4 scroll-mt-20 rounded border border-emerald-900 bg-emerald-950/20 p-3 shadow-[0_0_40px_rgba(16,185,129,.04)]">
          <div class="mb-3 flex flex-wrap gap-2 font-mono text-xs"><span class="mr-1 self-center text-emerald-700">START FROM</span><For each={[['topic','a topic'],['person','a person'],['note','a note'],['words','keywords']]}>{([mode,label]) => <button type="button" onClick={() => setResearchDraft("mode", mode)} class={`rounded px-3 py-1.5 ${researchDraft.mode === mode ? "bg-lime-300 text-black" : "border border-emerald-900 text-emerald-500"}`}>{label}</button>}</For></div>
          <form class="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); startRelaySearch(); }}>
            <span class="font-mono text-lime-300">→</span>
            <input id="research-query-input" value={researchDraft.text} onInput={(event) => setResearchDraft("text", event.currentTarget.value)} class="min-w-0 flex-1 bg-transparent px-1 py-2 font-mono text-sm text-emerald-50 outline-none placeholder:text-emerald-900" placeholder={{topic:"topic, for example bitcoin",person:"name@domain, npub, or public key",note:"note, nevent, or event ID",words:"words contained in notes"}[researchDraft.mode]} autofocus />
            <button disabled={loading()} class="rounded border border-lime-700 px-4 py-2 font-mono text-xs text-lime-200 transition hover:bg-lime-300 hover:text-black disabled:opacity-40">{loading() ? "SEARCHING…" : "SEARCH RELAYS"}</button><button type="button" disabled={loading()} onClick={() => void searchLocalArchive()} class="rounded border border-emerald-800 px-3 py-2 font-mono text-[10px] text-emerald-400 hover:text-lime-300">SEARCH DOWNLOADED DATA</button>
          </form>
          <Show when={composerChips().length}><div class="mt-3 flex flex-wrap gap-2 font-mono text-[10px]"><For each={composerChips()}>{(chip) => <button type="button" title="Remove constraint" onClick={() => setResearchDraft("constraints", (current) => removeConstraint(current, chip.key))} class={`rounded border px-2 py-1 ${chip.scope === "relay" ? "border-lime-800 text-lime-300" : "border-cyan-900 text-cyan-400"}`}>{chip.label} <span class="ml-1 opacity-50">{chip.scope.toUpperCase()} ×</span></button>}</For></div></Show>
          <Show when={executedQuery()}>{(run) => { const labels = () => constraintChips(run().constraints ?? {}).map((chip) => chip.label); return <div class="mt-2 font-mono text-[9px] text-emerald-800">CURRENT CORPUS ← {run().mode}{run().value ? `: ${run().value}` : ""}<Show when={labels().length}> · {labels().join(" · ")}</Show> · {run().operation}</div>; }}</Show>
          <div class="mt-2 flex flex-wrap items-center gap-2 border-t border-emerald-900/70 pt-3 text-xs">
            <Show when={corpus().length}><span class="font-mono text-[9px] tracking-wider text-emerald-700">USE NEXT RESULTS</span><For each={[["replace","replace"],["union","add"],["intersect","keep matches"]]}>{([operation,label]) => <button type="button" onClick={() => setResearchDraft("operation", operation)} class={`rounded border px-2 py-1.5 ${researchDraft.operation === operation ? "border-lime-600 bg-lime-950/30 text-lime-300" : "border-emerald-900 text-emerald-600"}`}>{label}</button>}</For><span class="text-[9px] text-emerald-800">resets to replace after one search</span></Show>
            <button type="button" onClick={() => void savePath().catch((cause) => { setBlockNotice(`Could not save this search locally: ${cause.message}`); logUsage("local_storage_failed", { operation: "save search", detail: cause.message }); })} class="rounded border border-emerald-900 px-2 py-1.5 text-emerald-500 hover:text-emerald-200">{activeRecipeId() ? "update saved search" : "save search"}</button><details class="relative"><summary class="cursor-pointer rounded border border-emerald-900 px-2 py-1.5 text-emerald-500">export</summary><div class="absolute right-0 top-9 z-40 w-64 rounded border border-emerald-800 bg-[#07110c] p-2 shadow-2xl"><button type="button" disabled={!corpus().length} onClick={exportManifest} class="block w-full rounded px-2 py-2 text-left text-emerald-400 hover:bg-emerald-950 disabled:opacity-30">corpus manifest<span class="mt-1 block text-[9px] text-emerald-800">query, coverage, exclusions, fingerprint</span></button><button type="button" disabled={!corpus().length} onClick={exportResearchPackage} class="mt-1 block w-full rounded px-2 py-2 text-left text-cyan-400 hover:bg-cyan-950 disabled:opacity-30">complete research package<span class="mt-1 block text-[9px] text-emerald-800">manifest, evidence, lists, direction, decisions</span></button></div></details>
            <Show when={activeRecipeId()}><button type="button" disabled={loading()} onClick={rerunRecipe} class="rounded border border-lime-800 px-2 py-1.5 text-lime-300 disabled:opacity-40">rerun saved search</button></Show>
            <details class="relative"><summary class="cursor-pointer rounded border border-emerald-900 px-2 py-1.5 text-emerald-500">depth · {researchDraft.limit}/relay</summary><div class="absolute right-0 top-9 z-40 w-72 rounded border border-emerald-800 bg-[#07110c] p-3 shadow-2xl"><div class="text-[10px] tracking-wider text-lime-300">RESEARCH DEPTH · PER RELAY</div><div class="mt-3 grid grid-cols-2 gap-1"><For each={[[50,"quick"],[100,"standard"],[250,"deep"],[500,"exhaustive"]]}>{([limit,label]) => <button type="button" onClick={() => setResearchDraft("limit", limit)} class={`rounded border px-2 py-2 text-left ${researchDraft.limit === limit ? "border-lime-500 bg-lime-950/40 text-lime-300" : "border-emerald-900 text-emerald-600"}`}><span class="block">{label}</span><span class="font-mono text-[9px] text-emerald-800">{limit} events</span></button>}</For></div><label class="mt-3 block text-[10px] text-emerald-700">CUSTOM · 10–1000<input aria-label="Custom events per relay" type="number" min="10" max="1000" value={researchDraft.limit} onChange={(event) => setResearchDraft("limit", Math.min(1000, Math.max(10, Number(event.currentTarget.value) || 100)))} class="mt-1 w-full rounded border border-emerald-900 bg-black/30 px-2 py-2 font-mono text-emerald-300 outline-none"/></label><p class="mt-2 text-[9px] leading-4 text-emerald-800">This is a requested maximum. Relays may return fewer. Exact note and profile lookups ignore this setting.</p></div></details>
            <details class="relative"><summary class="cursor-pointer rounded border border-emerald-900 px-2 py-1.5 text-emerald-500">relays · {new Set([...READ_RELAYS, ...INDEXER_RELAYS, ...OPTIONAL_READ_RELAYS, ...searchRelays()]).size}</summary><div class="absolute right-0 top-9 z-40 w-80 rounded border border-emerald-800 bg-[#07110c] p-3 shadow-2xl"><div class="mb-3 text-[10px] tracking-wider text-lime-300">GENERAL RESEARCH · ACTIVE</div><For each={READ_RELAYS}>{(relay) => <div class="mb-1 flex items-center gap-2 text-emerald-500"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"/>{new URL(relay).hostname}</div>}</For><div class="mb-2 mt-4 text-[10px] tracking-wider text-lime-300">ACCOUNT INDEXER</div><For each={INDEXER_RELAYS}>{(relay) => <div class="mb-1 text-emerald-500">{new URL(relay).hostname}</div>}</For><div class="mb-2 mt-4 text-[10px] tracking-wider text-lime-300">OPTIONAL GENERAL RELAY</div><For each={OPTIONAL_READ_RELAYS}>{(relay) => <div class="mb-1 text-emerald-700">{new URL(relay).hostname}</div>}</For><div class="mb-2 mt-4 text-[10px] tracking-wider text-lime-300">KEYWORD SEARCH RELAYS</div><textarea aria-label="Keyword search relays" value={relayDraft()} onInput={(event) => setRelayDraft(event.currentTarget.value)} class="h-24 w-full resize-none bg-black/30 p-2 font-mono text-xs outline-none"/><button type="button" onClick={applyRelays} class="mt-2 border border-lime-700 px-3 py-1 text-lime-300">apply search relays</button><p class="mt-2 text-[10px] text-emerald-800">General queries use the four active relays. Purple Pages is reserved for account indexing. Keyword searches use the editable NIP-50 list. Optional relays can be selected in Relay Explorer.</p></div></details>
            <ConstraintPicker constraints={researchDraft.constraints} setConstraints={(update) => setResearchDraft("constraints", update)} editor={constraintEditor()} setEditor={setConstraintEditor} readRelays={READ_RELAYS}/>
          </div>
        </section></Show>

        <Show when={!routeLoading()} fallback={<LoadingPanel label="reading relay graph"/>}>
          <Show when={!error()} fallback={<ErrorPanel message={error()}/>}>
            <Show keyed when={route()}>{(currentRoute) => <Show when={currentRoute.kind === "settings"} fallback={<Show when={currentRoute.kind === "relays"} fallback={<Show when={currentRoute.kind === "search"} fallback={<RouteView route={currentRoute} data={routeData()} eventStates={eventStates()} profileFor={profileFor} openRoute={openRoute} onComposeAuthor={composeAuthorSearch} onBlock={blockAccount} onUnblock={unblockAccount} isBlocked={isAccountBlocked} blockReason={blockReason} onFollow={addSeedAccount} onUnfollow={removeSeedAccount} isFollowed={isSeedAccount} actionsFor={entityActionsFor}/> }><CorpusViewControls total={corpus().length} visible={visibleCorpus().length} kind={kindFilter()} onKind={setKindFilter} days={sinceDays()} onDays={setSinceDays} dedupe={dedupeEnabled()} onDedupe={setDedupeEnabled}/><ResearchWorkspace view={view()} setView={setView} events={visibleCorpus()} loading={loading()} query={researchDraft.text} profileFor={profileFor} pinned={pinned()} selectedId={selectedId()} openRoute={openRoute} onSelect={selectEvent} onNavigate={navigateFromEvent} onPin={(id) => toggleSet(setPinned, id)} onLoadMore={loadMoreResults} paging={paging()} hasMore={hasMore()} pageMessage={pageMessage()} canLoadMore={corpus().length > 0} activeFacets={activeFacets()} onFacet={toggleFacet} onSearchFacet={prepareFacetSearch} actionsFor={entityActionsFor} comparisonTarget={comparisonTarget()} entryReasons={entryReasons()}/></Show>}><HomeDiscovery analysis={pulseAnalysis()} neighborhood={neighborhoodCandidates()} events={pulseEvents()} loading={pulseLoading()} progress={pulseProgress()} settings={pulseSettings()} meta={pulseMeta()} view={pulseView()} setView={setPulseView} availableRelays={[...new Set([...READ_RELAYS, ...OPTIONAL_READ_RELAYS])]} profileFor={profileFor} direction={scanDirection()} directionCount={directionCount()} strategy={scanStrategy()} onStrategy={updateScanStrategy} round={scanRound()} actionsFor={entityActionsFor} onRemoveDirection={removeDirection} onClearDirection={clearDirection} onContinueScan={continueDirectedScan} onOpenInSearch={openScanInSearch} onSettings={updatePulseSettings} onAuthor={(pubkey) => openRoute(`#/account/${pubkey}`)} onRelay={researchPulseRelay} onRefresh={loadRelayPulse} onCancel={cancelRelayPulse}/></Show>}><SettingsPage accounts={blockedAccounts()} draft={blockDraft()} setDraft={setBlockDraft} onAdd={() => void blockAccount(blockDraft())} onUnblock={unblockAccount} names={blockedNames()} nameDraft={nameBlockDraft()} setNameDraft={setNameBlockDraft} onAddName={addBlockedName} onRemoveName={removeBlockedName} seeds={seedAccounts()} seedInput={seedAccountInput()} setSeedInput={setSeedAccountInput} onAddSeed={() => addSeedAccount(seedAccountInput())} onRemoveSeed={removeSeedAccount} onOpenSeed={(pubkey) => openRoute(`#/account/${pubkey}`)} onSearchSeed={searchOneSeed} onSearchSeeds={searchAllSeeds} onDirectSeed={directOneSeed} onDirectSeeds={directAllSeeds} muteRules={muteRules()} onMuteRules={applyMuteRules} muteImport={muteImportDraft()} setMuteImport={setMuteImportDraft} onImportMute={importMuteList} onExportMute={exportMuteList}/></Show>}</Show>
          </Show>
        </Show>
      </main>

      <Show when={corpus().length && !["settings", "relays"].includes(route().kind)}><aside class="space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:pl-1">
        <Show when={selectedEvent()}>{(event) => <ExploreFromNode compact event={event()} corpus={corpus()} profile={profileFor(event().pubkey)} profileFor={profileFor} onSelect={selectEvent} onExpand={expandSelection} operation={expansionOperation()} onOperation={setExpansionOperation} openRoute={openRoute} loading={loading()} status={expansionStatus()} reason={entryReasons()[event().id]}/>}</Show>
        <Panel title="EVIDENCE"><Show when={pinned().size} fallback={<p class="text-emerald-900">Pin nodes to build a lightweight evidence collection.</p>}><For each={[...pinned()].map((id) => knownEvents.get(id)).filter(Boolean)}>{(event) => <button onClick={() => setSelectedId(event.id)} class="block w-full border-b border-emerald-950 py-2 text-left"><span class="text-lime-500">{kindName(event.kind)}</span><span class="mt-1 block truncate text-emerald-600">{compact(event.content, 60)}</span></button>}</For><div class="flex gap-1 pt-2"><input aria-label="Collection name" value={collectionDraft()} onInput={(event) => setCollectionDraft(event.currentTarget.value)} placeholder="collection name" class="min-w-0 flex-1 rounded border border-emerald-900 bg-black/20 px-2 py-1 text-emerald-300 outline-none"/><button onClick={() => void savePinnedAsCollection().catch((cause) => { setBlockNotice(`Could not save this evidence collection locally: ${cause.message}`); logUsage("local_storage_failed", { operation: "save evidence collection", detail: cause.message }); })} class="rounded border border-lime-800 px-2 text-lime-300">save</button></div></Show></Panel>
        <Show when={lastRunDelta()}>{(delta) => <Panel title="RUN COMPARISON"><Show when={delta().previous} fallback={<p class="text-emerald-700">Baseline saved. Rerun this recipe later to measure change.</p>}><Stat label="new" value={`+${delta().added}`}/><Stat label="not returned" value={`−${delta().missing}`}/><Stat label="set overlap" value={`${Math.round((delta().overlap ?? 0) * 100)}%`}/></Show></Panel>}</Show>
        <CoveragePanel states={relayStates()} information={relayInformation()} requestedLimit={researchDraft.limit} uniqueCount={corpus().length} visibleCount={visibleCorpus().length}/>
      </aside></Show>
    </div>
  </div>;
}

function CorpusViewControls(props) {
  return <Show when={props.total}><section class="mb-3 flex flex-wrap items-center gap-2 rounded border border-cyan-950 bg-cyan-950/5 px-3 py-2 text-xs"><span class="font-mono text-[9px] tracking-wider text-cyan-500">FILTER CURRENT INVESTIGATION</span><span class="mr-auto font-mono text-[9px] text-emerald-800">{props.visible}/{props.total} visible</span><select aria-label="Filter current investigation by content type" value={props.kind} onChange={(event) => props.onKind(event.currentTarget.value)} class="rounded border border-emerald-900 bg-[#07110c] px-2 py-1.5 text-emerald-300"><option value="all">all content</option><option value="notes">short notes</option><option value="profiles">profiles</option><option value="follows">follow lists</option><option value="articles">long articles</option><option value="other">other data</option></select><select aria-label="Filter current investigation by age" value={props.days} onChange={(event) => props.onDays(Number(event.currentTarget.value))} class="rounded border border-emerald-900 bg-[#07110c] px-2 py-1.5 text-emerald-300"><option value="0">all time</option><option value="1">last day</option><option value="7">last 7 days</option><option value="30">last 30 days</option><option value="90">last 90 days</option><option value="365">last year</option></select><button type="button" aria-pressed={props.dedupe} onClick={() => props.onDedupe((value) => !value)} class={`rounded border px-2 py-1.5 ${props.dedupe ? "border-cyan-800 bg-cyan-950/30 text-cyan-300" : "border-emerald-900 text-emerald-600"}`}>{props.dedupe ? "duplicates collapsed" : "show duplicates"}</button></section></Show>;
}

function ConstraintPicker(props) {
  const update = (patch) => props.setConstraints((current) => ({ ...current, ...patch }));
  const toggleKind = (kind) => props.setConstraints((current) => ({ ...current, kinds: current.kinds.includes(kind) ? current.kinds.filter((value) => value !== kind) : [...current.kinds, kind] }));
  const category = (title, entries) => <div><div class="mb-1 text-[9px] tracking-[.12em] text-emerald-800">{title}</div><div class="flex flex-wrap gap-1"><For each={entries}>{([key, label, detail]) => <button type="button" onClick={() => props.setEditor(key)} class={`rounded border px-2 py-1.5 text-left ${props.editor === key ? "border-lime-500 bg-lime-950/40 text-lime-200" : "border-emerald-900 text-emerald-500 hover:text-emerald-200"}`}><span class="block">{label}</span><Show when={detail}><span class="block text-[8px] text-emerald-800">{detail}</span></Show></button>}</For></div></div>;
  return <details class="relative"><summary class="cursor-pointer rounded border border-lime-900 px-2 py-1.5 text-lime-400">＋ add constraints</summary><div class="absolute right-0 top-9 z-40 w-[min(42rem,92vw)] rounded border border-emerald-800 bg-[#07110c] p-3 shadow-2xl">
    <div class="mb-3"><div class="text-[10px] tracking-[.14em] text-lime-300">ADD A CONSTRAINT</div><p class="mt-1 text-[9px] text-emerald-700">Choose a known concept. The resulting chip still shows whether it runs on relays or locally.</p></div>
    <div class="grid gap-3 sm:grid-cols-2">
      {category("COMMON", [["person", "Person", "author / npub"], ["kind", "Content type", "named event kinds"], ["topic", "Topic", "broad discovery"], ["time", "Time", "recent activity"]])}
      {category("CONTENT", [["media", "Media", "image, video, audio, link"], ["domain", "Linked domain", "local content check"]])}
      {category("RELATIONSHIPS", [["p", "Mentions person", "#p tag"], ["e", "Replies / references", "#e tag"], ["q", "Quotes event", "#q tag"]])}
      {category("INFRASTRUCTURE + PROTOCOL", [["relay", "Relay", "known or custom"], ["tag", "Advanced tag", "t, p, e, q, d, a, r…"], ["raw-kind", "Raw event kind", "any numeric kind"]])}
    </div>
    <Show when={props.editor}><div class="mt-4 border-t border-emerald-900 pt-3">
      <Show when={props.editor === "person"}><label class="block text-[9px] text-emerald-700">PERSON · resolves before searching<input autofocus aria-label="Person constraint" value={props.constraints.author} onInput={(event) => update({ author: event.currentTarget.value })} class="mt-1 w-full rounded border border-emerald-900 bg-black/30 px-3 py-2 text-emerald-200 outline-none" placeholder="name@domain, npub, nprofile, or hex key"/></label></Show>
      <Show when={props.editor === "kind" || props.editor === "raw-kind"}><div><div class="mb-2 text-[9px] text-emerald-700">CONTENT TYPES · underlying Nostr kind remains visible</div><div class="grid gap-1 sm:grid-cols-2"><For each={KIND_PRESETS}>{([kind, label]) => <button type="button" onClick={() => toggleKind(kind)} class={`rounded border px-2 py-2 text-left ${props.constraints.kinds.includes(kind) ? "border-lime-500 bg-lime-950/30 text-lime-200" : "border-emerald-900 text-emerald-500"}`}><span>{label}</span><span class="ml-2 text-[8px] text-emerald-800">kind {kind}</span></button>}</For></div><label class="mt-2 block text-[9px] text-emerald-700">OTHER KINDS<input aria-label="Raw event kinds" value={props.constraints.kinds.join(",")} onChange={(event) => update({ kinds: parseKindList(event.currentTarget.value) })} class="mt-1 w-full rounded border border-emerald-900 bg-black/30 px-3 py-2 text-emerald-200 outline-none" placeholder="for example 4, 40, 30078"/></label></div></Show>
      <Show when={props.editor === "topic"}><label class="block text-[9px] text-emerald-700">TOPIC · broad NIP-50 discovery<input autofocus aria-label="Topic constraint" value={props.constraints.promotedTopic ?? ""} onInput={(event) => update({ promotedTopic: event.currentTarget.value.replace(/^#/, "") })} class="mt-1 w-full rounded border border-emerald-900 bg-black/30 px-3 py-2 text-emerald-200 outline-none" placeholder="nostr"/></label></Show>
      <Show when={props.editor === "time"}><div><div class="mb-2 text-[9px] text-emerald-700">RECENT ACTIVITY · relay time filter</div><div class="flex flex-wrap gap-1"><For each={[[1,"Today"],[7,"Last 7 days"],[30,"Last 30 days"],[90,"Last 90 days"]]}>{([days,label]) => <button type="button" onClick={() => update({ days, facetDay: "" })} class={`rounded border px-2 py-2 ${props.constraints.days === days ? "border-lime-500 text-lime-200" : "border-emerald-900 text-emerald-500"}`}>{label}</button>}</For></div><input aria-label="Custom recent days" value={props.constraints.days || ""} onInput={(event) => update({ days: Math.max(0, Number(event.currentTarget.value) || 0), facetDay: "" })} type="number" min="1" class="mt-2 w-full rounded border border-emerald-900 bg-black/30 px-3 py-2 text-emerald-200 outline-none" placeholder="Custom number of days"/></div></Show>
      <Show when={props.editor === "media"}><div class="grid grid-cols-2 gap-1"><For each={[["image","Has image"],["video","Has video"],["audio","Has audio"],["link","Has link"]]}>{([media,label]) => <button type="button" onClick={() => update({ media })} class={`rounded border px-2 py-2 text-left ${props.constraints.media === media ? "border-cyan-600 bg-cyan-950/20 text-cyan-300" : "border-emerald-900 text-emerald-500"}`}>{label}<span class="ml-2 text-[8px] text-emerald-800">LOCAL</span></button>}</For></div></Show>
      <Show when={props.editor === "domain"}><label class="block text-[9px] text-cyan-700">LINKED DOMAIN · checked locally after retrieval<input autofocus aria-label="Linked domain constraint" value={props.constraints.domain} onInput={(event) => update({ domain: event.currentTarget.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "") })} class="mt-1 w-full rounded border border-cyan-950 bg-black/30 px-3 py-2 text-cyan-200 outline-none" placeholder="example.com"/></label></Show>
      <Show when={["p","e","q","tag"].includes(props.editor)}><div><div class="mb-2 flex flex-wrap gap-1"><For each={TAG_PRESETS}>{([tag,label]) => <button type="button" onClick={() => update({ tag })} class={`rounded border px-2 py-1.5 ${props.constraints.tag === tag ? "border-lime-500 text-lime-200" : "border-emerald-900 text-emerald-500"}`}>{label} <span class="text-[8px] text-emerald-800">#{tag}</span></button>}</For></div><div class="grid gap-2 sm:grid-cols-[8rem_1fr]"><input aria-label="Raw tag name" value={props.editor === "tag" ? props.constraints.tag : props.editor} onInput={(event) => update({ tag: event.currentTarget.value.replace(/^#/, "").slice(0, 1) })} class="rounded border border-emerald-900 bg-black/30 px-3 py-2 outline-none" placeholder="tag name"/><input autofocus aria-label="Tag value" value={props.constraints.tagValue} onInput={(event) => update({ tag: props.editor === "tag" ? props.constraints.tag : props.editor, tagValue: event.currentTarget.value })} class="rounded border border-emerald-900 bg-black/30 px-3 py-2 outline-none" placeholder={props.editor === "p" ? "hex public key" : props.editor === "e" || props.editor === "q" ? "hex event ID" : "tag value"}/></div></div></Show>
      <Show when={props.editor === "relay"}><div><div class="mb-2 flex flex-wrap gap-1"><For each={props.readRelays}>{(relay) => <button type="button" onClick={() => update({ relay })} class={`rounded border px-2 py-2 ${props.constraints.relay === relay ? "border-lime-500 text-lime-200" : "border-emerald-900 text-emerald-500"}`}>{new URL(relay).hostname}</button>}</For></div><input aria-label="Custom relay constraint" value={props.constraints.relay} onInput={(event) => update({ relay: event.currentTarget.value.trim().replace(/\/$/, "") })} class="w-full rounded border border-emerald-900 bg-black/30 px-3 py-2 outline-none" placeholder="wss://relay.example.com"/></div></Show>
    </div></Show>
  </div></details>;
}

function Panel(props) { return <section class="rounded border border-emerald-900 bg-emerald-950/10 p-3 font-mono text-xs"><h2 class="mb-3 border-b border-emerald-900 pb-2 text-[10px] tracking-[.16em] text-lime-300">{props.title}</h2><div class="space-y-2">{props.children}</div></section>; }
function Stat(props) { return <div class="flex justify-between text-emerald-700"><span>{props.label}</span><span class="text-emerald-300">{props.value}</span></div>; }
function CoveragePanel(props) {
  const rows = () => [...props.states.entries()].map(([relay, state]) => {
    const ids = state.ids ?? [];
    const exclusive = ids.filter((id) => (sourcesFor(id)).length === 1).length;
    return { relay, state, exclusive, information: props.information.get(relay) };
  });
  const responding = () => rows().filter((row) => row.state.state === "ok").length;
  const returned = () => rows().reduce((total, row) => total + (row.state.count ?? 0), 0);
  return <Panel title="SEARCH COVERAGE"><Show when={rows().length} fallback={<p class="text-emerald-900">Run a search to see which relays contributed and what they support.</p>}>
    <div class="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 border-b border-emerald-950 pb-3"><Stat label="requested" value={`${props.requestedLimit} × ${rows().length}`}/><Stat label="responses" value={returned()}/><Stat label="unique corpus" value={props.uniqueCount}/><Stat label="visible" value={props.visibleCount}/><Stat label="responded" value={`${responding()}/${rows().length}`}/></div>
    <For each={rows()}>{(row) => <details class="border-b border-emerald-950 py-2">
      <summary class="flex items-center gap-2"><span class={`h-1.5 w-1.5 rounded-full ${row.state.state === "ok" ? "bg-emerald-400" : row.state.state === "searching" ? "animate-pulse bg-lime-300" : row.state.state === "muted" ? "bg-amber-500" : "bg-red-500"}`}/><span class="min-w-0 flex-1 truncate text-emerald-400">{new URL(row.relay).hostname}</span><span class="text-emerald-800">{row.state.state === "searching" ? "…" : row.state.state === "ok" ? row.state.count : row.state.state}</span></summary>
      <div class="mt-2 space-y-1 pl-3 text-[10px] text-emerald-800">
        <Show when={row.state.state === "ok"}><div>{row.exclusive} unique here · {row.state.duration}ms</div></Show>
        <Show when={!["ok", "searching"].includes(row.state.state)}><div>{row.state.detail || `Relay ${row.state.state}; its empty result is not counted as a successful response.`}</div></Show>
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
    <Show when={hasActive()}><div class="mb-2 rounded border border-lime-900/70 bg-lime-950/10 p-2"><div class="mb-2 text-[9px] leading-4 text-emerald-600">These selections only filter the current corpus.</div><button onClick={props.onCompile} class="w-full rounded bg-lime-300 px-2 py-2 text-left font-bold text-black hover:bg-lime-200">USE IN A NEW SEARCH ↗</button><p class="mt-2 text-[9px] leading-4 text-emerald-700">Copy them into the search composer, review or edit them, then choose when to search.</p><button onClick={props.onClear} class="mt-1 text-[9px] text-emerald-600 hover:text-emerald-300">clear active filters</button></div></Show>
    <Show when={props.facets.topics.length}><FacetGroup title="TOPICS"><For each={props.facets.topics}>{([topic, count]) => <Facet active={props.active.topic === topic} label={`#${topic}`} count={count} onClick={() => props.onFacet("topic", topic)} actions={props.actionsFor("topic", topic, `#${topic}`)}/>}</For></FacetGroup></Show>
    <Show when={props.facets.authors.length}><FacetGroup title="ACTIVE ACCOUNTS"><For each={props.facets.authors}>{([pubkey, count]) => <Facet active={props.active.author === pubkey} label={props.profileFor(pubkey).name} count={count} onClick={() => props.onFacet("author", pubkey)} actions={props.actionsFor("account", pubkey, props.profileFor(pubkey).name)}/>}</For></FacetGroup></Show>
    <Show when={props.facets.kinds.length}><FacetGroup title="CONTENT TYPES"><For each={props.facets.kinds}>{([kind, count]) => <Facet active={props.active.kind === kind} label={`${kindName(kind)} · ${kind}`} count={count} onClick={() => props.onFacet("kind", kind)} onSearch={() => props.onSearchFacet("kind", kind)}/>}</For></FacetGroup></Show>
    <Show when={props.facets.domains.length}><FacetGroup title="SOURCES / DOMAINS"><For each={props.facets.domains}>{([domain, count]) => <Facet active={props.active.domain === domain} label={domain} count={count} onClick={() => props.onFacet("domain", domain)} actions={props.actionsFor("domain", domain, domain)}/>}</For></FacetGroup></Show>
    <Show when={props.facets.relays.length}><FacetGroup title="FOUND ON RELAYS"><For each={props.facets.relays}>{([relay, count]) => <Facet active={props.active.relay === relay} label={new URL(relay).hostname} count={count} onClick={() => props.onFacet("relay", relay)} actions={props.actionsFor("relay", relay, new URL(relay).hostname)}/>}</For></FacetGroup></Show>
    <Show when={props.facets.days.length}><FacetGroup title="ACTIVE DAYS"><For each={props.facets.days}>{([day, count]) => <Facet active={props.active.day === day} label={day} count={count} onClick={() => props.onFacet("day", day)} onSearch={() => props.onSearchFacet("day", day)}/>}</For></FacetGroup></Show>
  </Show></Panel>;
}
function FacetGroup(props) { return <div class="border-b border-emerald-950 pb-2"><div class="mb-1 text-[9px] tracking-[.14em] text-emerald-800">{props.title}</div><div class="space-y-0.5">{props.children}</div></div>; }
function Facet(props) { return <div class="flex min-w-0 flex-1 items-center gap-1"><button title="Filter this investigation" onClick={props.onClick} class={`flex min-w-0 flex-1 items-center justify-between rounded px-1 py-1 text-left hover:bg-emerald-950 hover:text-lime-300 ${props.active ? "bg-lime-950/40 text-lime-300" : "text-emerald-500"}`}><span class="truncate">{props.active ? "× " : ""}{props.label}</span><span class="ml-2 text-emerald-800">{props.count}</span></button><Show when={props.actions} fallback={<button title="Prepare a wider relay search" onClick={props.onSearch} class="px-1 font-mono text-[8px] text-cyan-800 hover:text-cyan-300">search ↗</button>}><EntityActions {...props.actions}/></Show></div>; }

function HomeDiscovery(props) {
  const [accountLens, setAccountLens] = createSignal("balanced");
  const accountRows = createMemo(() => [...props.analysis.accountSignals].sort((left, right) => {
    const score = (item) => accountLens() === "conversation" ? item.conversations : accountLens() === "cross-relay" ? item.relays : accountLens() === "specialist" ? (item.topics > 0 && item.topics <= 4 ? item.days + item.count / 100 : 0) : accountLens() === "originality" ? item.originality : item.score;
    return score(right) - score(left);
  }));
  const toggleRelay = (relay) => {
    const selected = props.settings.relays;
    if (selected.includes(relay)) { if (selected.length > 1) props.onSettings({ relays: selected.filter((item) => item !== relay) }); }
    else if (selected.length < 4) props.onSettings({ relays: [...selected, relay] });
  };
  const windowLabel = () => PULSE_WINDOWS.find(([hours]) => hours === props.settings.windowHours)?.[1] ?? `${props.settings.windowHours} hours`;
  return <section class="mb-4 rounded border border-emerald-900 bg-emerald-950/10">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-900 px-4 py-3"><div><h1 class="font-mono text-sm text-lime-200">RELAY EXPLORER</h1><p class="mt-1 text-xs text-emerald-700">Scan broadly, add useful signals to a direction, then continue without losing unexpected discovery.</p></div><div class="flex gap-2"><details class="relative"><summary class="cursor-pointer rounded border border-emerald-900 px-3 py-1.5 font-mono text-xs text-emerald-400 hover:text-lime-300">configure</summary><div class="pulse-settings-popover fixed left-4 right-4 top-20 z-40 max-h-[calc(100vh-6rem)] w-auto overflow-y-auto rounded border border-emerald-800 bg-[#07110c] p-4 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-9 sm:max-h-none sm:w-[min(90vw,28rem)] sm:overflow-visible"><div class="text-[10px] tracking-[.14em] text-lime-300">SCAN SETTINGS</div><PulseChoice title="TIME WINDOW" options={PULSE_WINDOWS} value={props.settings.windowHours} onChange={(windowHours) => props.onSettings({ windowHours })}/><PulseChoice title="TARGET EVENTS · PER RELAY / WINDOW" options={PULSE_DEPTHS} value={props.settings.depth} onChange={(depth) => props.onSettings({ depth })}/><PulseChoice title="CONTENT" options={PULSE_SCOPES.map(([value,label]) => [value,label])} value={props.settings.scope} onChange={(scope) => props.onSettings({ scope })}/><div class="mt-4 text-[9px] tracking-wider text-emerald-700">RELAYS · SELECT 1–4</div><div class="mt-2 space-y-1"><For each={props.availableRelays}>{(relay) => <button type="button" onClick={() => toggleRelay(relay)} class={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left font-mono text-[10px] ${props.settings.relays.includes(relay) ? "border-lime-800 text-lime-300" : "border-emerald-950 text-emerald-700"}`}><span>{props.settings.relays.includes(relay) ? "●" : "○"}</span><span class="truncate">{new URL(relay).hostname}</span></button>}</For></div><div class="mt-3 rounded border border-emerald-950 bg-black/20 p-2 font-mono text-[10px] text-emerald-600">ESTIMATED MAXIMUM · {props.settings.relays.length} relays × {props.settings.depth} = {props.settings.relays.length * props.settings.depth} deliveries per window<br/><span class="text-emerald-800">Broad scans compare two periods. Directed rounds spend most requests on direction signals and retain a smaller broad sample.</span></div></div></details><Show when={props.loading} fallback={<button onClick={props.onRefresh} class="rounded border border-lime-800 px-3 py-1.5 font-mono text-xs text-lime-300 hover:bg-lime-300 hover:text-black">new broad scan</button>}><button onClick={props.onCancel} class="rounded border border-amber-800 px-3 py-1.5 font-mono text-xs text-amber-400 hover:bg-amber-950">cancel · {props.progress?.completed ?? 0}/{props.progress?.total ?? "?"}</button></Show></div></div>
    <Show when={props.progress && props.progress.state !== "complete"}><div class="border-b border-emerald-900 px-4 py-2"><div class="flex justify-between font-mono text-[9px] text-emerald-600"><span>{props.progress.state === "cancelled" ? "COLLECTION CANCELLED · PARTIAL RESULTS KEPT" : `COLLECTING TIME SLICE ${props.progress.completed + 1} OF ${props.progress.total}`}</span><span>{props.progress.unique.toLocaleString()} current-window events</span></div><div class="mt-2 h-1 overflow-hidden rounded bg-emerald-950"><div class={`h-full ${props.progress.state === "cancelled" ? "bg-amber-700" : "bg-lime-400"}`} style={{ width: `${Math.round(props.progress.completed / props.progress.total * 100)}%` }}/></div></div></Show>
    <ScanDirectionPanel direction={props.direction} count={props.directionCount} strategy={props.strategy} onStrategy={props.onStrategy} round={props.round} loading={props.loading} profileFor={props.profileFor} onRemove={props.onRemoveDirection} onClear={props.onClearDirection} onContinue={props.onContinueScan} onOpen={props.onOpenInSearch}/>
    <div class="flex gap-1 border-b border-emerald-900 px-4 pt-3"><For each={[["overview","Signals"],["neighborhood","Neighborhood"],["relays","Relays"],["data","Data"]]}>{([value,label]) => <button onClick={() => props.setView(value)} class={`border-b-2 px-3 py-2 font-mono text-[10px] ${props.view === value ? "border-lime-300 text-lime-300" : "border-transparent text-emerald-700"}`}>{label}</button>}</For><Show when={props.meta}><span class="ml-auto self-center pb-1 font-mono text-[9px] text-emerald-900">{props.meta.mode === "directed" ? `round ${props.meta.round}` : windowLabel()} · {props.analysis.unique} unique · {(props.meta.durationMs / 1000).toFixed(1)}s</span></Show></div>
    <Show when={!props.loading || props.events.length} fallback={<div class="p-8 text-sm text-emerald-700">Sampling two comparable windows across {props.settings.relays.length} relays…</div>}>
      <Show when={props.view === "overview"}><div class="grid lg:grid-cols-2">
        <PulseBlock title="TOPIC SIGNALS" detail="Independent contributors, persistence, relay breadth, and low dominance"><Show when={props.analysis.topicSignals.length} fallback={<PulseEmpty>No topic has enough independent participation yet.</PulseEmpty>}><div class="space-y-2"><For each={props.analysis.topicSignals}>{(item) => <SignalCard title={`#${item.topic}`} state={item.signal} pursued={props.direction.topics.includes(item.topic)} actions={props.actionsFor("topic", item.topic, `#${item.topic}`, { filter: false })}><span>{item.authors} accounts</span><span>{item.days} active days</span><span>{item.relays} relays</span><span>{Math.round(item.dominance * 100)}% largest contributor</span><Show when={props.meta?.mode === "directed"}><span class={item.deltaAuthors >= 0 ? "text-cyan-500" : "text-amber-600"}>{item.deltaAuthors >= 0 ? "+" : ""}{item.deltaAuthors} accounts vs prior round</span></Show></SignalCard>}</For></div></Show></PulseBlock>
        <PulseBlock title="CONTRIBUTORS TO EXPLORE" detail="Choose a transparent lens; there is deliberately no universal account score"><div class="mb-3 flex flex-wrap gap-1"><For each={[["balanced","balanced"],["conversation","conversation"],["cross-relay","cross-relay"],["specialist","specialists"],["originality","originality"]]}>{([value,label]) => <button onClick={() => setAccountLens(value)} class={`rounded border px-2 py-1 font-mono text-[9px] ${accountLens() === value ? "border-cyan-500 text-cyan-300" : "border-emerald-950 text-emerald-700"}`}>{label}</button>}</For></div><Show when={accountRows().length} fallback={<PulseEmpty>No account passed the current discovery signals.</PulseEmpty>}><div class="grid gap-2 sm:grid-cols-2"><For each={accountRows()}>{(account) => <SignalCard title={props.profileFor(account.pubkey).name} state={account.role} pursued={props.direction.authors.includes(account.pubkey)} actions={props.actionsFor("account", account.pubkey, props.profileFor(account.pubkey).name, { filter: false })}><span>{account.count} events / {account.days} days</span><span>{Math.round(account.originality * 100)}% distinct content</span><span>{account.conversations} thread replies or comments</span><span>{account.relays} relays</span><span>{account.topics} topics</span></SignalCard>}</For></div></Show><Show when={props.analysis.noiseAccounts.length}><details class="mt-4 rounded border border-amber-950 p-2"><summary class="cursor-pointer font-mono text-[10px] text-amber-700">HIGH-VOLUME / REPETITIVE · {props.analysis.noiseAccounts.length}</summary><div class="mt-2 space-y-1"><For each={props.analysis.noiseAccounts}>{(account) => <button onClick={() => props.onAuthor(account.pubkey)} class="flex w-full justify-between text-left text-[10px] text-amber-800 hover:text-amber-500"><span class="truncate">{props.profileFor(account.pubkey).name}</span><span>{account.count} events · {Math.round(account.originality * 100)}% distinct</span></button>}</For></div></details></Show></PulseBlock>
        <PulseBlock title="CONVERSATION FRONTS" detail="Thread roots receiving comments from several independent accounts"><Show when={props.analysis.conversations.length} fallback={<PulseEmpty>No multi-account conversation front found in this sample.</PulseEmpty>}><div class="space-y-2"><For each={props.analysis.conversations}>{(item) => <SignalCard title={short(item.id)} state={`${item.authors} participating accounts`} pursued={props.direction.events.includes(item.id)} actions={props.actionsFor("event", item.id, short(item.id), { filter: false, compare: false })}><span>{item.events} thread replies or comments</span><span>{item.authors} independent accounts</span></SignalCard>}</For></div></Show></PulseBlock>
        <PulseBlock title="LINKED DOMAINS" detail="External domains circulating in the sample"><div class="space-y-2"><For each={props.analysis.domains}>{([domain,count]) => <SignalCard title={domain} state={`${count} linked events`} pursued={props.direction.domains.includes(domain)} actions={props.actionsFor("domain", domain, domain, { filter: false })}><span>{count} references in this sample</span></SignalCard>}</For></div></PulseBlock>
      </div></Show>
      <Show when={props.view === "neighborhood"}><NeighborhoodView {...props}/></Show><Show when={props.view === "relays"}><div class="p-4"><p class="mb-4 max-w-4xl text-xs leading-5 text-emerald-700">Relay figures describe this sample, not permanent relay quality. Unique contribution, overlap, and noise concentration make different relay roles visible without collapsing them into one score.</p><div class="grid gap-3 lg:grid-cols-2"><For each={props.analysis.relayRows}>{(row) => <div class="rounded border border-emerald-900 p-3"><div class="flex items-center gap-2"><button onClick={() => props.onRelay(row.relay)} class="flex min-w-0 flex-1 items-center justify-between text-left"><span class="font-mono text-sm text-lime-200">{new URL(row.relay).hostname}</span><span class="font-mono text-[10px] text-emerald-700">{row.count} events · {row.authors} accounts</span></button><EntityActions {...props.actionsFor("relay", row.relay, new URL(row.relay).hostname, { filter: false, direction: false, open: false })}/></div><div class="mt-2 grid grid-cols-3 gap-2 font-mono text-[9px]"><span class="text-cyan-500">{Math.round(row.uniqueShare * 100)}% unique here</span><span class="text-amber-600">{Math.round(row.noisyShare * 100)}% noisy-account events</span><span class="text-emerald-700">{row.overlap[0]?.shared ?? 0} shared with closest relay</span></div><div class="mt-3 flex flex-wrap gap-1"><For each={row.topics}>{([topic,count]) => <button onClick={() => props.onRelay(row.relay, topic)} class="rounded border border-emerald-950 px-2 py-1 text-[10px] text-emerald-500 hover:text-lime-300">#{topic} {count}</button>}</For></div><div class="mt-2 text-[9px] text-emerald-800">kinds · {row.kinds.map(([kind,count]) => `${kind} ${count}`).join(" · ") || "none"}</div><Show when={row.overlap.length}><div class="mt-2 text-[9px] text-emerald-900">overlap · {row.overlap.slice(0, 3).map((item) => `${new URL(item.relay).hostname} ${Math.round(item.share * 100)}%`).join(" · ")}</div></Show></div>}</For></div><div class="mt-4 grid gap-3 sm:grid-cols-3"><PulseStat label="events on 2+ relays" value={props.analysis.overlapCount}/><PulseStat label="duplicate deliveries" value={props.analysis.duplicates}/><PulseStat label="cross-relay accounts" value={props.analysis.authors.filter((item) => item.relays > 1).length}/></div><div class="mt-5 text-[9px] tracking-wider text-emerald-700">ACCOUNTS VISIBLE ACROSS RELAYS</div><div class="mt-2 flex flex-wrap gap-2"><For each={props.analysis.authors.filter((item) => item.relays > 1)}>{(author) => <button onClick={() => props.onAuthor(author.pubkey)} class="rounded border border-emerald-900 px-2 py-1 text-emerald-400">{props.profileFor(author.pubkey).name} <span class="text-emerald-800">{author.relays} relays</span></button>}</For></div></div></Show>
      <Show when={props.view === "data"}><div class="p-4"><div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><PulseStat label={props.meta?.mode === "directed" ? "planned relay requests" : "requested / window"} value={props.meta?.requested ?? props.settings.depth * props.settings.relays.length}/><PulseStat label="relay deliveries" value={props.analysis.received}/><PulseStat label="unique events" value={props.analysis.unique}/><PulseStat label="duplicates merged" value={props.analysis.duplicates}/></div><div class="mt-5 grid gap-5 lg:grid-cols-2"><div><div class="text-[9px] tracking-wider text-emerald-700">EVENT KINDS</div><div class="mt-2 space-y-1"><For each={props.analysis.kinds}>{([kind,count]) => <div class="flex justify-between border-b border-emerald-950 py-1 text-emerald-400"><span>{kind}</span><span class="text-emerald-800">{count}</span></div>}</For></div></div><div><div class="text-[9px] tracking-wider text-emerald-700">COLLECTION DETAILS</div><div class="mt-2 space-y-2 font-mono text-[10px] text-emerald-600"><div>mode · {props.meta?.mode === "directed" ? `directed round ${props.meta.round}` : "broad time comparison"}</div><div>window · {windowLabel()}</div><div>comparison · {props.meta?.mode === "directed" ? "preceding scan round" : `preceding ${windowLabel()}`}</div><div>scope · {PULSE_SCOPES.find(([value]) => value === props.settings.scope)?.[1]}</div><div>relays · {props.settings.relays.length}</div><div>elapsed · {props.meta ? `${(props.meta.durationMs / 1000).toFixed(1)} seconds` : "not collected"}</div><div>collected · {props.meta ? new Date(props.meta.collectedAt).toLocaleString() : "not collected"}</div><p class="pt-2 leading-4 text-emerald-800">Scores are discovery signals, not reputation. Raw relay counts remain available here; relay policies, timeouts, and uneven replication shape every sample.</p></div></div></div></div></Show>
    </Show>
  </section>;
}

function NeighborhoodView(props) {
  return <div class="p-4">
    <div class="mb-4 max-w-4xl">
      <h2 class="font-mono text-sm text-lime-200">EXPLAINABLE ACCOUNT NEIGHBORHOOD</h2>
      <p class="mt-2 text-xs leading-5 text-emerald-700">Candidates come only from the retrieved sample and current direction. Scores organize evidence; they are not reputation. Add direction signals and run a directed scan to retrieve connecting evidence.</p>
    </div>
    <Show when={props.directionCount} fallback={<div class="rounded border border-dashed border-emerald-900 p-8 text-center text-sm text-emerald-800">Add at least one account, topic, conversation, or domain to the direction first.</div>}>
      <Show when={props.neighborhood.length} fallback={<div class="rounded border border-dashed border-emerald-900 p-8 text-center text-sm text-emerald-800">No explainable candidates in this sample. Continue with Network or Adjacent strategy to retrieve more connections.</div>}>
        <div class="grid gap-3 lg:grid-cols-2"><For each={props.neighborhood}>{(candidate, index) => <article class="rounded border border-emerald-900 bg-black/10 p-3">
          <div class="flex items-start gap-3"><span class="font-mono text-[10px] text-emerald-800">#{index() + 1}</span><div class="min-w-0 flex-1"><div class="truncate text-sm text-lime-200">{props.profileFor(candidate.pubkey).name}</div><div class="mt-1 font-mono text-[9px] text-cyan-700">evidence score {candidate.score} · {candidate.events} sampled events</div></div><EntityActions {...props.actionsFor("account", candidate.pubkey, props.profileFor(candidate.pubkey).name, { filter: false })}/></div>
          <div class="mt-3 space-y-1"><For each={candidate.reasons}>{(reason) => <div class="flex gap-2 text-[10px] text-emerald-500"><span class="text-cyan-700">↳</span><span>{reason}</span></div>}</For></div>
          <button onClick={() => props.onAuthor(candidate.pubkey)} class="mt-3 font-mono text-[9px] text-emerald-700 hover:text-lime-300">open account evidence ↗</button>
        </article>}</For></div>
      </Show>
    </Show>
  </div>;
}

function ScanDirectionPanel(props) {
  const groups = () => [
    ["topics", "TOPICS", props.direction.topics.map((value) => [value, `#${value}`])],
    ["authors", "ACCOUNTS", props.direction.authors.map((value) => [value, props.profileFor(value).name])],
    ["domains", "DOMAINS", props.direction.domains.map((value) => [value, value])],
    ["events", "CONVERSATIONS", props.direction.events.map((value) => [value, short(value)])],
  ].filter(([, , values]) => values.length);
  const strategies = [["closer","Closer","threads + selected accounts"],["adjacent","Adjacent","co-topics + domains"],["network","Network","follow neighborhoods"],["broader","Broader","larger open sample"],["skeptical","Skeptical","reports + labels"],["crosscheck","Cross-check","same direction per relay"]];
  return <div class="border-b border-emerald-900 bg-black/15 p-4"><div class="flex flex-wrap items-center gap-2"><div><div class="font-mono text-[10px] tracking-[.14em] text-cyan-300">CURRENT DIRECTION · {props.count} SIGNAL{props.count === 1 ? "" : "S"}</div><div class="mt-1 text-[10px] text-emerald-800">Direction items shape the next round; choose how the explorer moves from them.</div></div><div class="ml-auto flex gap-2"><Show when={props.count}><button disabled={props.loading} onClick={props.onContinue} class="rounded bg-cyan-300 px-3 py-2 font-mono text-[10px] font-bold text-black disabled:opacity-40">CONTINUE SCAN →</button><button disabled={props.loading} onClick={props.onOpen} class="rounded border border-lime-800 px-3 py-2 font-mono text-[10px] text-lime-300 disabled:opacity-40">OPEN CORPUS IN SEARCH</button><button onClick={props.onClear} class="px-2 font-mono text-[9px] text-emerald-700 hover:text-red-400">clear</button></Show></div></div><Show when={props.count}><div class="mt-3 grid gap-1 sm:grid-cols-3 lg:grid-cols-6"><For each={strategies}>{([value,label,detail]) => <button onClick={() => props.onStrategy(value)} class={`rounded border p-2 text-left ${props.strategy === value ? "border-cyan-600 bg-cyan-950/20" : "border-emerald-950"}`}><span class={`block font-mono text-[9px] ${props.strategy === value ? "text-cyan-300" : "text-emerald-500"}`}>{label}</span><span class="mt-1 block text-[8px] text-emerald-800">{detail}</span></button>}</For></div></Show><Show when={groups().length} fallback={<div class="mt-3 rounded border border-dashed border-emerald-900 px-3 py-4 text-center text-xs text-emerald-800">Use Add to direction on a useful topic, contributor, conversation, or domain to build the next scan.</div>}><div class="mt-3 space-y-2"><For each={groups()}>{([key,label,values]) => <div class="flex flex-wrap items-center gap-1.5"><span class="mr-1 font-mono text-[8px] tracking-wider text-emerald-800">{label}</span><For each={values}>{([value,text]) => <button title="Remove from direction" onClick={() => props.onRemove(key, value)} class="rounded border border-cyan-950 bg-cyan-950/10 px-2 py-1 font-mono text-[10px] text-cyan-400">{text} <span class="opacity-50">×</span></button>}</For></div>}</For></div></Show><Show when={props.round}><div class="mt-3 font-mono text-[9px] text-emerald-800">DIRECTED ROUND {props.round} · {props.strategy} · signals compare with the preceding scan round</div></Show></div>;
}

function SignalCard(props) {
  return <div class={`rounded border p-2.5 ${props.pursued ? "border-cyan-700 bg-cyan-950/15" : "border-emerald-950"}`}><div class="flex min-w-0 items-start gap-2"><div class="min-w-0 flex-1"><span class="block truncate text-sm text-emerald-200">{props.title}</span><span class="mt-1 block font-mono text-[9px] text-cyan-700">{props.state}</span></div><Show when={props.pursued}><span class="rounded border border-cyan-900 px-2 py-1 font-mono text-[8px] text-cyan-600">IN DIRECTION</span></Show><EntityActions {...props.actions}/></div><div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[8px] text-emerald-800">{props.children}</div></div>;
}

function PulseChoice(props) { return <div class="mt-4"><div class="mb-2 text-[9px] tracking-wider text-emerald-700">{props.title}</div><div class="grid grid-cols-2 gap-1"><For each={props.options}>{([value,label]) => <button type="button" onClick={() => props.onChange(value)} class={`rounded border px-2 py-1.5 text-left text-[10px] ${props.value === value ? "border-lime-700 bg-lime-950/30 text-lime-300" : "border-emerald-950 text-emerald-600"}`}>{label}</button>}</For></div></div>; }
function PulseBlock(props) { return <div class="border-b border-emerald-900 p-4 lg:border-r"><div class="font-mono text-[10px] tracking-[.14em] text-emerald-600">{props.title}</div><div class="mb-3 mt-1 text-[10px] text-emerald-800">{props.detail}</div>{props.children}</div>; }
function PulseStat(props) { return <div class="rounded border border-emerald-950 bg-black/20 p-3"><div class="font-mono text-lg text-lime-200">{props.value}</div><div class="mt-1 text-[9px] uppercase tracking-wider text-emerald-700">{props.label}</div></div>; }
function PulseEmpty(props) { return <div class="py-4 text-xs text-emerald-800">{props.children}</div>; }

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
  const related = createMemo(() => {
    const selectedTopics = new Set(tags(props.event, "t").map((topic) => topic.toLowerCase()));
    const selectedDomains = new Set(eventDomains(props.event));
    const selectedWords = new Set((props.event.content?.toLowerCase().match(/[\p{L}\p{N}_-]{5,}/gu) ?? []).slice(0, 80));
    return (props.corpus ?? []).filter((event) => event.id !== props.event.id).map((event) => {
      const sharedTopics = [...new Set(tags(event, "t").map((topic) => topic.toLowerCase()))].filter((topic) => selectedTopics.has(topic));
      const sharedDomains = eventDomains(event).filter((domain) => selectedDomains.has(domain));
      const sharedWords = [...new Set(event.content?.toLowerCase().match(/[\p{L}\p{N}_-]{5,}/gu) ?? [])].filter((word) => selectedWords.has(word)).slice(0, 5);
      const sameAuthor = event.pubkey === props.event.pubkey;
      return { event, sharedTopics, sharedDomains, sharedWords, sameAuthor, score: sharedTopics.length * 5 + sharedDomains.length * 4 + sharedWords.length + (sameAuthor ? 2 : 0) };
    }).filter((match) => match.score >= 3).sort((a, b) => b.score - a.score || b.event.created_at - a.event.created_at).slice(0, 5);
  });
  return <section id="selected-note-navigation" class={`${props.compact ? "" : "mb-4 scroll-mt-20"} rounded border border-lime-800/70 bg-lime-950/10 p-4`}>
    <div class="flex flex-wrap items-start gap-3"><div class="min-w-0 flex-1"><div class="font-mono text-[10px] tracking-[.14em] text-lime-300">RESEARCH FROM THIS NOTE</div><div class="mt-1 text-xs text-emerald-600">by {props.profile.name}<Show when={props.reason}> · found via {props.reason}</Show></div><div class="mt-1 font-mono text-[9px] text-emerald-800">seen on {(sourcesFor(props.event.id)).map((relay) => new URL(relay).hostname).join(", ") || "restored cache"}</div><p class="mt-2 text-sm text-emerald-100">{compact(props.event.content, 220)}</p></div><div class="flex gap-2"><Action onClick={() => props.openRoute(`#/event/${props.event.id}`)}>read note</Action><Action onClick={() => props.openRoute(`#/raw/${props.event.id}`)}>raw event</Action></div></div>
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
    <Show when={related().length}><div class="mt-4 border-t border-emerald-900 pt-3"><div class="mb-2 font-mono text-[10px] tracking-[.12em] text-lime-300">RELATED IN THIS CORPUS</div><div class="space-y-2"><For each={related()}>{(match) => <button onClick={() => props.onSelect(match.event.id)} class="block w-full rounded border border-emerald-950 p-2 text-left hover:border-emerald-700"><span class="block truncate text-xs text-emerald-200">{compact(match.event.content, 80)}</span><span class="mt-1 block font-mono text-[9px] text-emerald-700">{props.profileFor(match.event.pubkey).name} · {[match.sharedTopics.length ? `${match.sharedTopics.length} shared topics` : "", match.sharedDomains.length ? `${match.sharedDomains.length} shared domains` : "", match.sharedWords.length ? `${match.sharedWords.length} shared terms` : "", match.sameAuthor ? "same author" : ""].filter(Boolean).join(" · ")}</span></button>}</For></div></div></Show>
  </section>;
}

function Direction(props) { return <button disabled={props.loading} onClick={props.onClick} class="rounded border border-emerald-900 bg-black/10 p-3 text-left hover:border-lime-700 hover:bg-emerald-950/50 disabled:cursor-wait disabled:opacity-40"><span class="block text-sm text-lime-200">{props.title} →</span><span class="mt-1 block text-[11px] text-emerald-700">{props.loading ? "Checking relays…" : props.detail}</span></button>; }

function ResearchWorkspace(props) {
  const primaryViews = [["list", "notes"], ["table", "table"], ["thread", "thread"]];
  const secondaryViews = [["timeline", "timeline"], ["map", "map"], ["graph", "graph"], ["compare", "compare"]];
  const secondaryActive = () => secondaryViews.some(([value]) => value === props.view);
  return <section class="rounded border border-emerald-900 bg-emerald-950/10">
    <div class="flex flex-wrap items-center gap-1 border-b border-emerald-900 bg-black/10 px-3 py-2">
      <span class="mr-2 font-mono text-[9px] tracking-wider text-emerald-800">INVESTIGATION VIEW</span>
      <For each={primaryViews}>{([value, label]) => <button onClick={() => props.setView(value)} class={`rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider ${props.view === value ? "bg-lime-300 text-black" : "text-emerald-600 hover:bg-emerald-950 hover:text-emerald-300"}`}>{label}</button>}</For>
      <details class="relative"><summary class={`cursor-pointer rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider ${secondaryActive() ? "bg-cyan-950 text-cyan-300" : "text-emerald-700 hover:bg-emerald-950 hover:text-emerald-300"}`}>more views</summary><div class="absolute left-0 top-8 z-30 w-40 rounded border border-emerald-800 bg-[#07110c] p-1 shadow-2xl"><For each={secondaryViews}>{([value, label]) => <button onClick={() => props.setView(value)} class={`block w-full rounded px-3 py-2 text-left font-mono text-[10px] uppercase ${props.view === value ? "bg-cyan-950 text-cyan-300" : "text-emerald-600 hover:bg-emerald-950"}`}>{label}</button>}</For></div></details>
      <span class="ml-auto font-mono text-[10px] text-emerald-800">{props.events.length} visible nodes</span>
    </div>
    <Show when={props.view === "list"}><SearchView {...props}/></Show>
    <Show when={props.view === "table"}><ResearchTable {...props}/></Show>
    <Show when={props.view === "map"}><CorpusMap {...props}/></Show>
    <Show when={props.view === "thread"}><ThreadLens {...props}/></Show>
    <Show when={props.view === "timeline"}><TimelineLens {...props}/></Show>
    <Show when={props.view === "graph"}><GraphLens {...props}/></Show>
    <Show when={props.view === "compare"}><ComparisonLens {...props} target={props.comparisonTarget}/></Show>
    <Show when={props.canLoadMore}><div class="border-t border-emerald-900 bg-black/10 p-4 text-center"><button disabled={props.paging || !props.hasMore} onClick={props.onLoadMore} class="rounded border border-lime-800 px-6 py-2 font-mono text-xs text-lime-300 hover:bg-lime-300 hover:text-black disabled:cursor-not-allowed disabled:border-emerald-950 disabled:text-emerald-800">{props.paging ? "CHECKING RELAYS…" : props.hasMore ? "LOAD OLDER RESULTS" : "END OF RELAY RESULTS"}</button><Show when={props.pageMessage}><p class="mt-2 font-mono text-[10px] text-emerald-700">{props.pageMessage}</p></Show></div></Show>
  </section>;
}

function ResearchTable(props) {
  const [sortKey, setSortKey] = createSignal("date");
  const [sortDirection, setSortDirection] = createSignal("desc");
  const [localQuery, setLocalQuery] = createSignal("");
  const mediaCount = (event) => eventMedia(event).length;
  const referenceCount = (event) => ["e", "E", "a", "A", "q", "p"].reduce((count, type) => count + tags(event, type).length, 0);
  const valueFor = (event, key) => ({ date: event.created_at, author: props.profileFor(event.pubkey).name.toLowerCase(), kind: event.kind, topics: tags(event, "t").length, references: referenceCount(event), relays: (sourcesFor(event.id)).length, domains: eventDomains(event).length, media: mediaCount(event) }[key]);
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
    <tbody><For each={rows()}>{(event, index) => { const topics = () => tags(event, "t"); const domains = () => eventDomains(event); const relayCount = () => (sourcesFor(event.id)).length; return <tr class={`border-b border-emerald-950 align-top hover:bg-emerald-950/30 ${props.selectedId === event.id ? "bg-lime-950/20" : ""}`}><td class="p-2 font-mono text-emerald-900">{index() + 1}</td><td class="whitespace-nowrap p-2 font-mono text-emerald-600">{new Date(event.created_at * 1000).toISOString().slice(0, 10)}</td><td class="max-w-40 p-2"><button onClick={() => props.openRoute(`#/account/${event.pubkey}`)} class="block max-w-40 truncate text-emerald-300 hover:text-lime-300">{props.profileFor(event.pubkey).name}</button><span class="font-mono text-[9px] text-emerald-900">{short(event.pubkey)}</span></td><td class="whitespace-nowrap p-2"><span class="text-emerald-300">{kindName(event.kind)}</span><span class="ml-1 font-mono text-emerald-800">{event.kind}</span></td><td class="max-w-44 p-2"><div class="flex max-w-44 flex-wrap gap-1"><For each={topics().slice(0, 3)}>{(topic) => <button onClick={() => props.onFacet("topic", topic.toLowerCase())} class="rounded bg-emerald-950 px-1 text-lime-400">#{topic}</button>}</For><Show when={topics().length > 3}><span class="text-emerald-800">+{topics().length - 3}</span></Show></div></td><td class="p-2 text-center font-mono text-emerald-400">{referenceCount(event) || "·"}</td><td class="p-2 text-center font-mono text-emerald-400">{mediaCount(event) || "·"}</td><td class="max-w-32 p-2"><span class="block truncate text-emerald-500" title={domains().join(", ")}>{domains().join(", ") || "·"}</span></td><td class="p-2 text-center font-mono text-emerald-400" title={(sourcesFor(event.id)).join("\n")}>{relayCount() || "cache"}</td><td class="max-w-md p-2"><Show when={props.entryReasons[event.id]}><span class="mb-1 block font-mono text-[9px] text-amber-500">↳ {props.entryReasons[event.id]}</span></Show><span class="line-clamp-2 text-emerald-200">{compact(event.content, 180)}</span><Show when={event.duplicateCount > 1}><span class="mt-1 block text-[9px] text-amber-700">{event.duplicateCount} similar events</span></Show></td><td class="p-2"><div class="flex gap-1"><button title="Research from here" onClick={() => props.onSelect(event.id)} class="rounded border border-emerald-900 px-2 py-1 text-lime-300 hover:border-lime-600">→</button><button title="Pin evidence" onClick={() => props.onPin(event.id)} class={`rounded border px-2 py-1 ${props.pinned.has(event.id) ? "border-lime-500 bg-lime-300 text-black" : "border-emerald-900 text-emerald-500"}`}>◆</button><EntityActions {...props.actionsFor("event", event.id, short(event.id), { filter: false, compare: false })}/></div></td></tr>; }}</For></tbody></table></div>
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
      relays: ranked(events.flatMap((event) => sourcesFor(event.id)), 8),
      kinds: ranked(events.map((event) => event.kind), 10),
      days: ranked(events.map((event) => new Date(event.created_at * 1000).toISOString().slice(0, 10)), 10),
      referenced: referenced.length,
      rootLike: events.filter((event) => !tags(event, "e").length && !tags(event, "E").length && !tags(event, "a").length && !tags(event, "A").length).length,
    };
  });
  return <div><LensHeader title="CORPUS MAP" detail={`${props.events.length} nodes · click anything to filter the corpus`}/>
    <Show when={props.events.length} fallback={<EmptyLens text="No visible events to map."/>}><div class="grid gap-px bg-emerald-950 lg:grid-cols-2">
      <MapSection title="TOPIC CLUSTERS" detail="Tags that organize this corpus"><For each={model().topics}>{([topic, count]) => <MapItem label={`#${topic}`} count={count} active={props.activeFacets.topic === topic} onClick={() => props.onFacet("topic", topic)} actions={props.actionsFor("topic", topic, `#${topic}`)}/>}</For></MapSection>
      <MapSection title="PARTICIPATING ACCOUNTS" detail="Who contributes most here"><For each={model().authors}>{([pubkey, count]) => <MapItem label={props.profileFor(pubkey).name} count={count} active={props.activeFacets.author === pubkey} onClick={() => props.onFacet("author", pubkey)} actions={props.actionsFor("account", pubkey, props.profileFor(pubkey).name)}/>}</For></MapSection>
      <MapSection title="EXTERNAL SOURCES" detail="Domains referenced in event content"><Show when={model().domains.length} fallback={<p class="text-emerald-900">No external domains in this corpus.</p>}><For each={model().domains}>{([domain, count]) => <MapItem label={domain} count={count} active={props.activeFacets.domain === domain} onClick={() => props.onFacet("domain", domain)} actions={props.actionsFor("domain", domain, domain)}/>}</For></Show></MapSection>
      <MapSection title="DATA SHAPE" detail="Protocol types and conversation structure"><For each={model().kinds}>{([kind, count]) => <MapItem label={`${kindName(kind)} · ${kind}`} count={count} active={props.activeFacets.kind === kind} onClick={() => props.onFacet("kind", kind)}/>}</For><div class="mt-3 grid grid-cols-2 gap-2"><MapStat label="with references" value={model().referenced}/><MapStat label="root-like" value={model().rootLike}/></div></MapSection>
      <MapSection title="RELAY DISTRIBUTION" detail="Where visible events were observed"><Show when={model().relays.length} fallback={<p class="text-emerald-900">Relay provenance is unavailable for restored cached events.</p>}><For each={model().relays}>{([relay, count]) => <MapItem label={new URL(relay).hostname} count={count} active={props.activeFacets.relay === relay} onClick={() => props.onFacet("relay", relay)} actions={props.actionsFor("relay", relay, new URL(relay).hostname)}/>}</For></Show></MapSection>
      <MapSection title="ACTIVITY WINDOWS" detail="Days represented in this corpus"><For each={model().days}>{([day, count]) => <MapItem label={day} count={count} active={props.activeFacets.day === day} onClick={() => props.onFacet("day", day)}/>}</For></MapSection>
    </div></Show>
  </div>;
}

function MapSection(props) { return <section class="bg-[#050b08] p-4"><div class="mb-3"><h3 class="font-mono text-[10px] tracking-[.14em] text-lime-300">{props.title}</h3><p class="mt-1 text-xs text-emerald-800">{props.detail}</p></div><div class="space-y-1">{props.children}</div></section>; }
function MapItem(props) {
  const content = <><span class="truncate">{props.active ? "× " : ""}{props.label}</span><span class="ml-2 font-mono text-[10px] text-emerald-800">{props.count}</span></>;
  return <div class={`flex items-center gap-1 rounded border pr-1 ${props.active ? "border-lime-600 bg-lime-950/30" : "border-emerald-950 hover:border-emerald-800"}`}><Show when={props.onClick} fallback={<span class="flex min-w-0 flex-1 items-center justify-between px-2 py-1.5 text-sm text-emerald-400">{content}</span>}><button onClick={props.onClick} class="flex min-w-0 flex-1 items-center justify-between px-2 py-1.5 text-left text-sm text-emerald-400">{content}</button></Show><Show when={props.actions}><EntityActions {...props.actions}/></Show></div>;
}
function MapStat(props) { return <div class="rounded border border-emerald-950 p-2"><span class="block font-mono text-lg text-emerald-300">{props.value}</span><span class="text-[10px] text-emerald-800">{props.label}</span></div>; }

function SearchView(props) {
  return <section>
    <Show when={props.events.length} fallback={<div class="p-8 text-sm text-emerald-800">{props.query ? (props.loading ? "Waiting for the first relay response…" : "No events returned.") : "No default feed. Start with a question, account, note, or topic."}</div>}>
      <For each={props.events}>{(event, index) => <EventRow event={event} index={index() + 1} profile={props.profileFor(event.pubkey)} pinned={props.pinned.has(event.id)} selected={props.selectedId === event.id} openRoute={props.openRoute} onSelect={props.onSelect} onNavigate={props.onNavigate} onPin={props.onPin} actions={props.actionsFor("event", event.id, short(event.id), { filter: false, compare: false })}/>}</For>
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
  const [focus, setFocus] = createSignal(null);
  const graph = createMemo(() => buildGraphModel(props.events, { selectedId: props.selectedId, sourcesFor: (event) => sourcesFor(event.id) }));
  const height = createMemo(() => Math.max(500, graph().events.length * 32 + 70));
  const spacedY = (items, value, available = height() - 80) => 55 + Math.max(0, items.findIndex((item) => (item.value ?? item.id) === value)) * (available / Math.max(1, items.length - 1));
  const authorY = (value) => spacedY(graph().authors, value);
  const eventY = (value) => spacedY(graph().events, value);
  const topicY = (value) => spacedY(graph().topics, value);
  const domainY = (value) => spacedY(graph().domains, value);
  const relayY = (value) => spacedY(graph().relays, value);
  const focusEntity = (type, value, label) => setFocus({ type, value, label });
  return <div><LensHeader title="RESEARCH MAP" detail={`${graph().authors.length} accounts · ${graph().events.length} events · ${graph().topics.length} topics · ${graph().domains.length} domains · ${graph().relays.length} relays`}/><Show when={graph().events.length} fallback={<EmptyLens text="Add nodes to the corpus before opening the graph."/>}>
    <div class="flex flex-wrap gap-4 border-b border-emerald-950 px-4 py-2 font-mono text-[9px] text-emerald-700"><span><b class="text-emerald-400">—</b> authored</span><span><b class="text-lime-500">—</b> tagged</span><span><b class="text-cyan-600">—</b> links / relay provenance</span><span><b class="text-amber-500">↝</b> reply, thread, quote, or reference</span><Show when={graph().omitted}><span class="ml-auto text-emerald-800">{graph().omitted} lower-signal events omitted for readability</span></Show></div>
    <Show when={focus()}>{(entity) => <div class="flex flex-wrap items-center gap-2 border-b border-cyan-950 bg-cyan-950/10 px-4 py-3"><div class="min-w-0 flex-1"><span class="font-mono text-[9px] uppercase tracking-wider text-cyan-600">focused {entity().type}</span><span class="ml-3 text-sm text-cyan-200">{entity().label}</span></div><EntityActions {...props.actionsFor(entity().type, entity().value, entity().label)}/><button onClick={() => setFocus(null)} class="px-2 text-emerald-700">×</button></div>}</Show>
    <div class="overflow-auto bg-[radial-gradient(circle_at_center,rgba(16,185,129,.05),transparent_65%)]"><svg viewBox={`0 0 1390 ${height()}`} class="min-w-[1180px]" style={{ height: `${height()}px` }}>
      <text x="20" y="22" fill="#31644a" font-size="10">ACCOUNTS</text><text x="285" y="22" fill="#31644a" font-size="10">EVENTS</text><text x="755" y="22" fill="#52791d" font-size="10">TOPICS</text><text x="980" y="22" fill="#166978" font-size="10">DOMAINS</text><text x="1190" y="22" fill="#166978" font-size="10">RELAYS</text>
      <For each={graph().edges.filter((edge) => edge.type === "authored")}>{(edge) => <line x1="175" y1={authorY(edge.from)} x2="285" y2={eventY(edge.to)} stroke="#123c29"/>}</For>
      <For each={graph().edges.filter((edge) => edge.type === "topic")}>{(edge) => <line x1="630" y1={eventY(edge.from)} x2="755" y2={topicY(edge.to)} stroke="#365314"/>}</For>
      <For each={graph().edges.filter((edge) => edge.type === "domain")}>{(edge) => <line x1="630" y1={eventY(edge.from)} x2="980" y2={domainY(edge.to)} stroke="#155e75" stroke-opacity=".45"/>}</For>
      <For each={graph().edges.filter((edge) => edge.type === "relay")}>{(edge) => <line x1="630" y1={eventY(edge.from)} x2="1190" y2={relayY(edge.to)} stroke="#0e7490" stroke-opacity=".2"/>}</For>
      <For each={graph().edges.filter((edge) => ["reply", "thread", "quote", "reference"].includes(edge.type))}>{(edge) => <path d={`M 303 ${eventY(edge.from)} C 245 ${eventY(edge.from)}, 245 ${eventY(edge.to)}, 303 ${eventY(edge.to)}`} fill="none" stroke={edge.type === "reply" ? "#bef264" : edge.type === "quote" ? "#22d3ee" : "#b45309"} stroke-width="1.5" stroke-dasharray={edge.type === "reply" ? "" : "3 3"}/>}</For>
      <For each={graph().authors}>{(item) => <g onClick={() => focusEntity("account", item.value, props.profileFor(item.value).name)} class="cursor-pointer"><rect x="20" y={authorY(item.value) - 14} width="155" height="28" rx="4" fill="#07170e" stroke="#1c5433"/><text x="29" y={authorY(item.value) + 4} fill="#74a77e" font-size="10">{compact(props.profileFor(item.value).name, 18)} · {item.count}</text></g>}</For>
      <For each={graph().events}>{(event) => <g onClick={() => { props.onSelect(event.id); focusEntity("event", event.id, `${kindName(event.kind)} · ${short(event.id)}`); }} class="cursor-pointer"><rect x="285" y={eventY(event.id) - 12} width="345" height="24" rx="4" fill={props.selectedId === event.id ? "#20370f" : "#07170e"} stroke={props.selectedId === event.id ? "#bef264" : "#166534"}/><text x="296" y={eventY(event.id) + 4} fill={props.selectedId === event.id ? "#d9f99d" : "#9bc5a3"} font-size="10">{kindName(event.kind)} · {compact(event.content, 38)}</text></g>}</For>
      <For each={graph().topics}>{(item) => <g onClick={() => focusEntity("topic", item.value, `#${item.value}`)} class="cursor-pointer"><rect x="755" y={topicY(item.value) - 13} width="170" height="26" rx="13" fill="#101b0a" stroke="#52791d"/><text x="768" y={topicY(item.value) + 4} fill="#bef264" font-size="10">#{compact(item.value, 18)} · {item.count}</text></g>}</For>
      <For each={graph().domains}>{(item) => <g onClick={() => focusEntity("domain", item.value, item.value)} class="cursor-pointer"><rect x="980" y={domainY(item.value) - 13} width="165" height="26" rx="4" fill="#07151a" stroke="#155e75"/><text x="991" y={domainY(item.value) + 4} fill="#67e8f9" font-size="10">{compact(item.value, 19)} · {item.count}</text></g>}</For>
      <For each={graph().relays}>{(item) => <g onClick={() => focusEntity("relay", item.value, new URL(item.value).hostname)} class="cursor-pointer"><rect x="1190" y={relayY(item.value) - 13} width="180" height="26" rx="4" fill="#07151a" stroke="#0e7490"/><text x="1201" y={relayY(item.value) + 4} fill="#67e8f9" font-size="10">{compact(new URL(item.value).hostname, 20)} · {item.count}</text></g>}</For>
    </svg></div><p class="border-t border-emerald-950 px-4 py-2 font-mono text-[9px] text-emerald-900">representative nodes are ranked by selection, in-corpus references, tags, and recency · click any entity to navigate or filter</p>
  </Show></div>;
}

function ComparisonLens(props) {
  const [dimension, setDimension] = createSignal("account");
  const [leftValue, setLeftValue] = createSignal("");
  const [rightValue, setRightValue] = createSignal("");
  createEffect(() => {
    const target = props.target;
    if (!target?.values?.length) return;
    setDimension(target.dimension);
    setLeftValue(target.values[0] ?? "");
    setRightValue(target.values[1] ?? "");
  });
  const options = createMemo(() => dimension() === "account" ? ranked(props.events.map((event) => event.pubkey), 30) : dimension() === "topic" ? ranked(props.events.flatMap((event) => tags(event, "t").map((topic) => topic.toLowerCase())), 30) : ranked(props.events.flatMap((event) => sourcesFor(event.id)), 20));
  const labelFor = (value) => dimension() === "account" ? props.profileFor(value).name : dimension() === "relay" && value ? new URL(value).hostname : value ? `#${value}` : "choose…";
  const eventsFor = (value) => !value ? [] : dimension() === "account" ? props.events.filter((event) => event.pubkey === value) : dimension() === "topic" ? props.events.filter((event) => tags(event, "t").some((topic) => topic.toLowerCase() === value)) : props.events.filter((event) => (sourcesFor(event.id)).includes(value));
  const summarize = (events) => ({ events: events.length, authors: new Set(events.map((event) => event.pubkey)).size, days: new Set(events.map((event) => new Date(event.created_at * 1000).toISOString().slice(0, 10))).size, topics: ranked(events.flatMap((event) => tags(event, "t").map((topic) => topic.toLowerCase())), 12), domains: ranked(events.flatMap(eventDomains), 10), kinds: ranked(events.map((event) => event.kind), 8), accounts: ranked(events.map((event) => event.pubkey), 10) });
  const comparison = createMemo(() => {
    const left = summarize(eventsFor(leftValue())); const right = summarize(eventsFor(rightValue()));
    const compareList = (key) => { const l = new Set(left[key].map(([value]) => value)); const r = new Set(right[key].map(([value]) => value)); return { shared: [...l].filter((value) => r.has(value)), leftOnly: [...l].filter((value) => !r.has(value)), rightOnly: [...r].filter((value) => !l.has(value)) }; };
    return { left, right, topics: compareList("topics"), domains: compareList("domains"), kinds: compareList("kinds"), accounts: compareList("accounts") };
  });
  const chooseDimension = (value) => { setDimension(value); setLeftValue(""); setRightValue(""); };
  return <div><LensHeader title="CONCRETE COMPARISON" detail="compare two subsets of the current corpus"/><div class="grid gap-3 border-b border-emerald-900 p-4 md:grid-cols-3"><select aria-label="Comparison type" value={dimension()} onChange={(event) => chooseDimension(event.currentTarget.value)} class="rounded border border-emerald-900 bg-[#07110c] p-2 text-emerald-300"><option value="account">account vs account</option><option value="topic">topic vs topic</option><option value="relay">relay vs relay</option></select><ComparisonSelect label="First side" value={leftValue()} options={options()} labelFor={labelFor} onChange={setLeftValue}/><ComparisonSelect label="Second side" value={rightValue()} options={options()} labelFor={labelFor} onChange={setRightValue}/></div><Show when={leftValue() && rightValue()} fallback={<EmptyLens text={`Choose two ${dimension()} values to compare their supporting events.`}/>}><div class="grid gap-px bg-emerald-950 lg:grid-cols-2"><ComparisonSide label={labelFor(leftValue())} summary={comparison().left}/><ComparisonSide label={labelFor(rightValue())} summary={comparison().right}/></div><div class="grid gap-px border-t border-emerald-950 bg-emerald-950 md:grid-cols-2"><ComparisonOverlap title="TOPICS" data={comparison().topics}/><ComparisonOverlap title="DOMAINS" data={comparison().domains}/><ComparisonOverlap title="EVENT KINDS" data={comparison().kinds} format={kindName}/><ComparisonOverlap title="ACCOUNTS" data={comparison().accounts} format={(value) => props.profileFor(value).name}/></div></Show><p class="border-t border-emerald-950 px-4 py-2 font-mono text-[9px] text-emerald-900">All figures link to events already present in the visible corpus; relay comparison requires live provenance.</p></div>;
}

function ComparisonSelect(props) { return <label class="text-[10px] text-emerald-700"><span class="mb-1 block">{props.label}</span><select value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)} class="w-full rounded border border-emerald-900 bg-[#07110c] p-2 text-emerald-300"><option value="">choose…</option><For each={props.options}>{([value, count]) => <option value={value}>{props.labelFor(value)} · {count}</option>}</For></select></label>; }
function ComparisonSide(props) { return <section class="bg-[#050b08] p-4"><h3 class="truncate font-mono text-sm text-lime-300">{props.label}</h3><div class="mt-3 grid grid-cols-3 gap-2"><MapStat label="events" value={props.summary.events}/><MapStat label="authors" value={props.summary.authors}/><MapStat label="days" value={props.summary.days}/></div><div class="mt-4 text-[9px] tracking-wider text-emerald-800">TOP SIGNALS</div><div class="mt-1 flex flex-wrap gap-1"><For each={props.summary.topics.slice(0, 6)}>{([topic, count]) => <span class="rounded bg-emerald-950 px-2 py-1 text-emerald-400">#{topic} · {count}</span>}</For></div></section>; }
function ComparisonOverlap(props) { const format = (value) => props.format ? props.format(value) : value; return <section class="bg-[#050b08] p-4"><h3 class="font-mono text-[10px] tracking-wider text-lime-300">{props.title}</h3><div class="mt-3 grid grid-cols-3 gap-3 text-[10px]"><div><span class="text-emerald-800">shared</span><For each={props.data.shared.slice(0, 8)}>{(value) => <span class="mt-1 block truncate text-lime-300">{format(value)}</span>}</For></div><div><span class="text-emerald-800">first only</span><For each={props.data.leftOnly.slice(0, 8)}>{(value) => <span class="mt-1 block truncate text-emerald-400">{format(value)}</span>}</For></div><div><span class="text-emerald-800">second only</span><For each={props.data.rightOnly.slice(0, 8)}>{(value) => <span class="mt-1 block truncate text-amber-400">{format(value)}</span>}</For></div></div></section>; }

function LensHeader(props) { return <div class="flex justify-between border-b border-emerald-950 px-4 py-3 font-mono text-[10px] tracking-[.12em]"><span class="text-lime-300">{props.title}</span><span class="text-emerald-800">{props.detail}</span></div>; }
function EmptyLens(props) { return <div class="p-10 text-center text-sm text-emerald-800">{props.text}</div>; }

function EventRow(props) {
  return <article class={`group border-b px-4 py-4 transition hover:bg-emerald-950/30 ${props.selected ? "border-l-2 border-l-lime-300 border-b-emerald-950 bg-emerald-950/30" : "border-emerald-950"}`}>
    <div class="flex flex-wrap items-center gap-2 font-mono text-[10px] text-emerald-800"><span class="text-lime-500">[{props.index}]</span><span>{kindName(props.event.kind)} · {props.event.kind}</span><span>{new Date(props.event.created_at * 1000).toLocaleDateString()}</span><span>{short(props.event.id)}</span><Show when={props.event.duplicateCount > 1}><span class="rounded bg-amber-950/40 px-1.5 py-0.5 text-amber-400">{props.event.duplicateCount} similar notes · {props.event.duplicateAuthors.length} accounts</span></Show></div>
    <div class="mt-2 text-[15px] leading-6 text-emerald-50"><RichContent value={props.event.content} openRoute={props.openRoute} preview/></div>
    <button onClick={() => props.openRoute(`#/account/${props.event.pubkey}`)} class="mt-1 font-mono text-xs text-emerald-600 hover:text-emerald-300">{props.profile.name} <span class="text-emerald-900">{props.profile.handle}</span></button>
    <div class="mt-3 flex flex-wrap gap-2 font-mono text-[11px]"><Show when={props.onSelect}><Action active={props.selected} onClick={() => props.onSelect(props.event.id)}>research from here</Action></Show><Show when={props.onNavigate}><Action onClick={() => props.onNavigate(props.event.id, "replies")}>conversation</Action><Show when={[...tags(props.event, "e"), ...tags(props.event, "q")].length}><Action onClick={() => props.onNavigate(props.event.id, "references")}>references · {[...tags(props.event, "e"), ...tags(props.event, "q")].length}</Action></Show><Action onClick={() => props.onNavigate(props.event.id, "author")}>more by author</Action></Show><Action onClick={() => props.openRoute(`#/raw/${props.event.id}`)}>raw</Action><Show when={props.onPin}><Action active={props.pinned} onClick={() => props.onPin(props.event.id)}>pin</Action></Show><Show when={props.actions}><EntityActions {...props.actions}/></Show></div>
  </article>;
}

function Action(props) { return <button onClick={props.onClick} class={`rounded border px-2 py-1 transition ${props.active ? "border-lime-400 bg-lime-300 text-black" : "border-emerald-900 text-emerald-500 hover:border-emerald-600 hover:text-emerald-200"}`}>{props.children}</button>; }

function RouteView(props) {
  return <Show when={props.data} fallback={<LoadingPanel label="assembling node"/>}>
    <Show when={props.route.kind === "account" || props.route.kind === "follows"} fallback={<EventView route={props.route} data={props.data} eventStates={props.eventStates} profileFor={props.profileFor} openRoute={props.openRoute} onComposeAuthor={props.onComposeAuthor} actionsFor={props.actionsFor}/> }>
      <AccountView route={props.route} data={props.data} profileFor={props.profileFor} openRoute={props.openRoute} onComposeAuthor={props.onComposeAuthor} onBlock={props.onBlock} onUnblock={props.onUnblock} isBlocked={props.isBlocked} blockReason={props.blockReason} onFollow={props.onFollow} onUnfollow={props.onUnfollow} isFollowed={props.isFollowed} actionsFor={props.actionsFor}/>
    </Show>
  </Show>;
}

function EventView(props) {
  const event = () => props.data.event;
  const semantics = createMemo(() => parseEventSemantics(event()));
  const lifecycle = () => props.eventStates?.get(event().id) ?? { state: "current" };
  const openSemanticTarget = (target) => target?.type?.toLowerCase() === "e" ? props.openRoute(`#/event/${target.value}`) : target?.type?.toLowerCase() === "a" ? props.openRoute(`#/address/${target.value}`) : undefined;
  return <section class="rounded border border-emerald-900 bg-emerald-950/10 p-4">
    <div class="mb-4 flex flex-wrap items-center gap-2"><Action onClick={() => props.openRoute("#/search")}>← search</Action><Action onClick={() => props.openRoute(`#/raw/${event().id}`)}>raw</Action><EntityActions {...props.actionsFor("event", event().id, short(event().id), { filter: false, compare: false })}/><EntityActions {...props.actionsFor("account", event().pubkey, props.profileFor(event().pubkey).name, { filter: false })}/></div>
    <Show when={props.route.kind === "raw"} fallback={<>
      <div class="border-y border-emerald-900 py-3 font-mono text-xs text-emerald-700"><div>kind <span class="text-lime-300">{event().kind} · {kindName(event().kind)}</span></div><div class="mt-1">lifecycle <span class="text-cyan-400">{semantics().class} · {lifecycle().state}</span></div><Show when={semantics().address}><div class="mt-1 break-all">address <button onClick={() => props.openRoute(`#/address/${semantics().address}`)} class="text-lime-300 hover:underline">{semantics().address}</button></div></Show><div class="mt-1 break-all">event {event().id}</div><button onClick={() => props.openRoute(`#/account/${event().pubkey}`)} class="mt-1 break-all text-left hover:text-emerald-300">author {event().pubkey}</button></div>
      <div class="py-6 text-emerald-50"><RichContent value={event().content} openRoute={props.openRoute}/></div>
      <Show when={semantics().root || semantics().parent || semantics().quotes.length || semantics().mentions.length}><div class="mb-5 rounded border border-emerald-950 bg-black/10 p-3"><h3 class="font-mono text-[10px] tracking-[.12em] text-cyan-300">PROTOCOL STRUCTURE</h3><div class="mt-3 grid gap-2 sm:grid-cols-2"><Show when={semantics().root}>{(root) => <ProtocolLink label={root().inferred ? "inferred thread root" : "thread root"} value={root().value} onClick={() => openSemanticTarget(root())}/>}</Show><Show when={semantics().parent}>{(parent) => <ProtocolLink label={parent().inferred ? "inferred parent" : "direct parent"} value={parent().value} onClick={() => openSemanticTarget(parent())}/>}</Show><For each={semantics().quotes}>{(id) => <ProtocolLink label="quoted event" value={id} onClick={() => props.openRoute(`#/event/${id}`)}/>}</For><For each={semantics().mentions.slice(0, 6)}>{(pubkey) => <ProtocolLink label="mentioned account" value={pubkey} onClick={() => props.openRoute(`#/account/${pubkey}`)}/>}</For></div><Show when={semantics().relayHints.length}><div class="mt-3 text-[9px] text-emerald-700">relay hints · {semantics().relayHints.join(" · ")}</div></Show></div></Show>
      <TagList event={event()} openRoute={props.openRoute}/>
      <Show when={props.data.claims?.length}><div class="mt-5 rounded border border-amber-950 bg-amber-950/5 p-3"><h3 class="font-mono text-[10px] tracking-[.12em] text-amber-400">REPORTS / LABELS · SUBJECTIVE CLAIMS</h3><p class="mt-1 text-[10px] text-amber-800">These are statements made by particular accounts, not verified facts or a universal reputation score.</p><div class="mt-3 space-y-2"><For each={props.data.claims}>{(claim) => <button onClick={() => props.openRoute(`#/event/${claim.id}`)} class="block w-full rounded border border-amber-950 p-2 text-left"><span class="font-mono text-[9px] text-amber-600">{claim.kind === 1984 ? "report" : "label"} · by {props.profileFor(claim.pubkey).name}</span><span class="mt-1 block text-xs text-amber-300">{compact(claim.content || claim.tags.map((tag) => tag.join(":")) .join(" · "), 180)}</span></button>}</For></div></div></Show>
      <div class="mt-6 border-t border-emerald-900 pt-4"><h3 class="mb-3 font-mono text-[11px] tracking-[.12em] text-lime-300">RELATED / REPLIES · {props.data.replies.length}</h3><For each={props.data.replies}>{(reply, index) => <EventRow event={reply} index={index() + 1} profile={props.profileFor(reply.pubkey)} openRoute={props.openRoute}/>}</For></div>
    </>}>
      <pre class="overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-emerald-300">{JSON.stringify(event(), null, 2)}</pre>
    </Show>
  </section>;
}

function ProtocolLink(props) { return <button disabled={!props.onClick} onClick={props.onClick} class="rounded border border-emerald-950 p-2 text-left hover:border-cyan-800 disabled:cursor-default"><span class="block font-mono text-[9px] text-emerald-700">{props.label}</span><span class="mt-1 block truncate font-mono text-[10px] text-cyan-300">{props.value}</span></button>; }

const URL_TOKEN = /(https?:\/\/[^\s<>]+|nostr:(?:npub|nprofile|note|nevent|naddr)1[023456789acdefghjklmnpqrstuvwxyz]+)/gi;

function InlineContent(props) {
  const pieces = () => props.value.split(URL_TOKEN);
  return <For each={pieces()}>{(piece) => {
    if (/^nostr:/i.test(piece)) {
      const target = routeForNip19(piece.slice(6));
      return target ? <button onClick={() => props.openRoute(target)} class="font-mono text-lime-300 underline decoration-emerald-700 underline-offset-2">{short(piece.slice(6))}</button> : piece;
    }
    if (/^https?:\/\//i.test(piece)) {
      const href = cleanEventUrl(piece);
      if (mediaTypeForUrl(href)) return piece.slice(href.length);
      return <><a href={href} target="_blank" rel="noreferrer" class="break-all text-lime-300 underline decoration-emerald-700 underline-offset-2">{compact(href, 70)}</a>{piece.slice(href.length)}</>;
    }
    const fragments = piece.split(/(\*\*[^*]+\*\*|`[^`]+`|#[\p{L}\p{N}_-]+)/gu);
    return <For each={fragments}>{(fragment) => fragment.startsWith("**") ? <strong class="font-semibold text-lime-100">{fragment.slice(2,-2)}</strong> : fragment.startsWith("`") ? <code class="rounded bg-black/40 px-1 py-0.5 font-mono text-emerald-300">{fragment.slice(1,-1)}</code> : fragment.startsWith("#") ? <button onClick={() => props.openRoute(`#/topic/${fragment.slice(1)}`)} class="text-lime-300 hover:underline">{fragment}</button> : fragment}</For>;
  }}</For>;
}

function RichContent(props) {
  const value = () => props.value?.trim() || "Empty content";
  const media = createMemo(() => eventMedia({ content: value() }).slice(0, props.preview ? 2 : 8));
  const text = () => props.preview ? compact(value(), 280) : value();
  return <div class="space-y-3"><div class={`whitespace-pre-wrap break-words ${props.preview ? "line-clamp-5" : "leading-7"}`}><InlineContent value={text()} openRoute={props.openRoute}/></div><Show when={media().length}><div class={`grid gap-2 ${media().length > 1 && !props.compactMedia ? "sm:grid-cols-2" : ""}`}><For each={media()}>{(item) => <Show when={item.type === "image"} fallback={<Show when={item.type === "video"} fallback={<audio src={item.url} controls preload="none" class="w-full"/>}><video src={item.url} controls preload="metadata" playsinline class={`${props.compactMedia ? "max-h-40" : "max-h-[520px]"} w-full rounded border border-emerald-900 bg-black object-contain`}/></Show>}><a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} loading="lazy" decoding="async" class={`${props.compactMedia ? "max-h-40" : "max-h-[520px]"} w-full rounded border border-emerald-900 bg-black object-contain`} alt="Media attached to note"/></a></Show>}</For></div></Show></div>;
}

function TagList(props) {
  const hint = (tag) => tag.slice(2).find((value) => /^wss?:\/\//i.test(value));
  const withHint = (route, tag) => hint(tag) ? `${route}?relay=${encodeURIComponent(hint(tag))}` : route;
  const destination = (tag) => ["p", "P"].includes(tag[0]) ? withHint(`#/account/${tag[1]}`, tag) : ["e", "E", "q"].includes(tag[0]) ? withHint(`#/event/${tag[1]}`, tag) : ["a", "A"].includes(tag[0]) ? withHint(`#/address/${tag[1]}`, tag) : tag[0] === "t" ? `#/topic/${tag[1]}` : "";
  return <div class="border-t border-emerald-900 pt-4"><h3 class="mb-1 font-mono text-[11px] tracking-[.12em] text-lime-300">STRUCTURED TAGS · {props.event.tags.length}</h3><p class="mb-3 text-[10px] text-emerald-800">Relationships, identifiers, relay hints, labels, and protocol metadata declared by this event.</p><div class="space-y-1 font-mono text-xs"><For each={props.event.tags}>{(tag, index) => { const description = describeTag(props.event, tag); return <div class="grid gap-2 border-b border-emerald-950 py-2 sm:grid-cols-[110px_150px_1fr]"><span class="text-emerald-800">[{index()}] {tag[0]}</span><span class={description.relation ? "text-cyan-500" : "text-emerald-700"}>{description.role}</span><Show when={destination(tag)} fallback={<span class="break-all text-emerald-500">{tag.slice(1).join(" · ")}</span>}><button onClick={() => props.openRoute(destination(tag))} class="break-all text-left text-lime-300 hover:underline">{tag.slice(1).join(" · ")}</button></Show></div>; }}</For></div></div>;
}

function AccountView(props) {
  const profile = () => props.profileFor(props.data.pubkey);
  const page = () => Math.max(1, Number(props.route.params.get("page")) || 1);
  const kind = () => props.route.params.get("kind");
  const authored = () => kind() === null ? props.data.authored : props.data.authored.filter((event) => String(event.kind) === kind());
  const follows = () => props.data.follows.slice((page() - 1) * 100, page() * 100);
  const visible = () => authored().slice((page() - 1) * PAGE_SIZE, page() * PAGE_SIZE);
  const counts = createMemo(() => [...props.data.authored.reduce((map, event) => map.set(event.kind, (map.get(event.kind) ?? 0) + 1), new Map()).entries()].sort((a, b) => a[0] - b[0]));
  const intelligence = createMemo(() => ({
    topics: ranked(props.data.authored.flatMap((event) => tags(event, "t").map((topic) => topic.toLowerCase())), 10),
    domains: ranked(props.data.authored.flatMap(eventDomains), 8),
    mentions: ranked(props.data.authored.flatMap((event) => tags(event, "p")), 8),
    days: new Set(props.data.authored.map((event) => new Date(event.created_at * 1000).toISOString().slice(0, 10))).size,
    relays: new Set(props.data.authored.flatMap((event) => sourcesFor(event.id))).size
  }));
  const blocked = () => props.isBlocked(props.data.pubkey);
  const reason = () => props.blockReason(props.data.pubkey);
  const followed = () => props.isFollowed(props.data.pubkey);
  return <section class={`overflow-hidden rounded border bg-emerald-950/10 ${blocked() ? "border-red-900" : "border-emerald-900"}`}>
    <Show when={blocked()}><div class="flex items-center gap-3 border-b border-red-950 bg-red-950/20 px-4 py-3"><span class="h-2 w-2 rounded-full bg-red-500"/><div><div class="font-mono text-xs font-bold tracking-wider text-red-400">BLOCKED GLOBALLY</div><div class="mt-1 text-[10px] text-red-800">{reason()?.type === "name" ? `Name contains blocked text “${reason().label}”.` : "Public key is on the block list."} Events are excluded from search, Relay Pulse, research views, and local storage.</div></div><Show when={reason()?.type === "key"} fallback={<button onClick={() => props.openRoute("#/settings")} class="ml-auto rounded border border-red-900 px-3 py-1.5 font-mono text-[10px] text-red-400 hover:border-red-600">manage name rules</button>}><button onClick={() => props.onUnblock(props.data.pubkey)} class="ml-auto rounded border border-red-900 px-3 py-1.5 font-mono text-[10px] text-red-400 hover:border-red-600">unblock</button></Show></div></Show>
    <div class="flex flex-wrap items-center gap-2 border-b border-emerald-900 p-4"><Action onClick={() => props.openRoute("#/search")}>← search</Action><Action onClick={() => props.openRoute(`#/follows/${props.data.pubkey}`)}>follows · {props.data.follows.length}</Action><EntityActions {...props.actionsFor("account", props.data.pubkey, profile().name, { filter: false, exclude: !blocked() })}/><Show when={followed()} fallback={<button onClick={() => props.onFollow(props.data.pubkey, profile().name)} class="rounded border border-cyan-900 px-3 py-1 font-mono text-[10px] text-cyan-500 hover:border-cyan-600">＋ add seed account</button>}><button onClick={() => props.onUnfollow(props.data.pubkey)} class="rounded border border-cyan-800 bg-cyan-950/20 px-3 py-1 font-mono text-[10px] text-cyan-300">✓ seed account</button></Show></div>
    <div class="p-5"><h1 class="text-xl text-lime-100">{profile().name}</h1><div class="mt-1 break-all font-mono text-xs text-emerald-800">{props.data.pubkey}</div><div class="mt-1 font-mono text-xs text-emerald-500">{profile().handle}</div><p class="mt-4 max-w-3xl whitespace-pre-wrap leading-7 text-emerald-300">{profile().about || "No profile description returned."}</p></div>
    <Show when={props.route.kind !== "follows"}><div class="grid border-y border-emerald-900 lg:grid-cols-3"><MapSection title="POSTING THEMES" detail="Topic tags in the retrieved account sample"><For each={intelligence().topics}>{([topic, count]) => <MapItem label={`#${topic}`} count={count} onClick={() => props.openRoute(`#/topic/${topic}`)}/>}</For></MapSection><MapSection title="REFERENCED SOURCES" detail="Domains linked by this account"><Show when={intelligence().domains.length} fallback={<p class="text-emerald-900">No external domains in this sample.</p>}><For each={intelligence().domains}>{([domain, count]) => <MapItem label={domain} count={count}/>}</For></Show></MapSection><MapSection title="ACCOUNT CONTEXT" detail="Inspectable facts from retrieved events"><div class="grid grid-cols-2 gap-2"><MapStat label="events" value={props.data.authored.length}/><MapStat label="active days" value={intelligence().days}/><MapStat label="follows" value={props.data.follows.length}/><MapStat label="observed relays" value={intelligence().relays || "cache"}/></div><div class="mt-3 text-[9px] tracking-wider text-emerald-800">FREQUENTLY REFERENCED ACCOUNTS</div><For each={intelligence().mentions}>{([pubkey, count]) => <MapItem label={props.profileFor(pubkey).name} count={count} onClick={() => props.openRoute(`#/account/${pubkey}`)}/>}</For></MapSection></div><Show when={props.data.relayPlan}><div class="mt-4 rounded border border-emerald-950 p-3 font-mono text-[9px]"><div class="text-cyan-400">ENTITY-AWARE RELAY PLAN</div><div class="mt-2 text-emerald-700">authored events · {props.data.relayPlan.authored.map((relay) => new URL(relay).hostname).join(" · ")}</div><div class="mt-1 text-emerald-700">mentions · {props.data.relayPlan.mentions.map((relay) => new URL(relay).hostname).join(" · ")}</div><div class="mt-2 text-emerald-900">NIP-65 relays are preferred when advertised; configured relays remain as fallback.</div></div></Show></Show>
    <Show when={props.route.kind === "follows"} fallback={<>
      <div class="border-y border-emerald-900 p-4"><h2 class="mb-3 font-mono text-[11px] tracking-[.12em] text-lime-300">AUTHORED DATA TYPES</h2><div class="flex flex-wrap gap-2"><For each={counts()}>{([eventKind, count]) => <Action active={String(eventKind) === kind()} onClick={() => props.openRoute(`#/account/${props.data.pubkey}?kind=${eventKind}`)}>{kindName(eventKind)} · {eventKind} ({count})</Action>}</For></div></div>
      <CollectionHeader title="AUTHORED NODES" count={authored().length} page={page()} size={PAGE_SIZE} base={`#/account/${props.data.pubkey}${kind() === null ? "" : `?kind=${kind()}`}`} openRoute={props.openRoute}/>
      <For each={visible()}>{(event, index) => <EventRow event={event} index={(page() - 1) * PAGE_SIZE + index() + 1} profile={props.profileFor(event.pubkey)} openRoute={props.openRoute}/>}</For>
      <div class="border-t border-emerald-900 p-4"><h2 class="mb-3 font-mono text-[11px] tracking-[.12em] text-lime-300">INBOUND MENTIONS · {props.data.mentions.length}</h2><For each={props.data.mentions.slice(0, 30)}>{(event, index) => <EventRow event={event} index={index() + 1} profile={props.profileFor(event.pubkey)} openRoute={props.openRoute}/>}</For></div>
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
