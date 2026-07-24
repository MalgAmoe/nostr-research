import { createMemo, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { nip19 } from "nostr-tools";
import { eventDomains, ranked, tags } from "./event-analysis.js";
import { parseEventSemantics } from "./protocol-semantics.js";
import { applyLocalConstraints, compileRelayPlan, constraintChips, createResearchDraft, createSearchRequest, emptyQueryConstraints, researchPatchFromFacets, searchRequestProblem } from "./query-spec.js";
import { mergeSearchResults, pageAdditions, presentCorpus } from "./search-state.js";

const unique = (events) => [...new Map(events.filter((event) => event?.id).map((event) => [event.id, event])).values()];
const emptyFacets = () => ({ topic: "", author: "", kind: null, day: "", domain: "", relay: "", media: "" });
const normalizeView = (value) => ["list", "table", "thread", "timeline", "map", "graph", "compare"].includes(value) ? value : "list";

export function createResearchSession(deps, restored = {}) {
  const [draft, setDraft] = createStore(createResearchDraft({
    text: restored.query ?? "",
    mode: restored.startMode ?? "topic",
    constraints: restored.queryConstraints ?? emptyQueryConstraints(),
    operation: "replace",
    limit: restored.queryLimit ?? 100,
  }));
  const [corpus, setCorpus] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [relayStates, setRelayStates] = createSignal(new Map());
  const [kindFilter, setKindFilter] = createSignal(restored.kindFilter ?? "all");
  const [sinceDays, setSinceDays] = createSignal(restored.sinceDays ?? 0);
  const [view, setView] = createSignal(normalizeView(restored.view));
  const [pinned, setPinned] = createSignal(new Set(restored.pinned ?? []));
  const [selectedId, setSelectedId] = createSignal(restored.selectedId ?? "");
  const [constraintEditor, setConstraintEditor] = createSignal("");
  const [executedQuery, setExecutedQuery] = createSignal(restored.executedQuery ?? null);
  const [entryReasons, setEntryReasons] = createSignal(restored.entryReasons ?? {});
  const [expansionStatus, setExpansionStatus] = createSignal(null);
  const [expansionOperation, setExpansionOperation] = createSignal("union");
  const [dedupeEnabled, setDedupeEnabled] = createSignal(restored.dedupeEnabled ?? true);
  const [lastQueryPlan, setLastQueryPlan] = createSignal(restored.lastQueryPlan ?? null);
  const [paging, setPaging] = createSignal(false);
  const [hasMore, setHasMore] = createSignal(restored.hasMore ?? true);
  const [pageMessage, setPageMessage] = createSignal(restored.pageMessage ?? "");
  const [activeFacets, setActiveFacets] = createSignal(restored.activeFacets ?? emptyFacets());
  const [corpusHistory, setCorpusHistory] = createSignal(restored.corpusHistory ?? []);
  let requestToken = 0;
  let pagingToken = 0;
  let expansionToken = 0;

  const updateDraft = (patch) => setDraft(patch);
  const selectedEvent = createMemo(() => deps.eventFor(selectedId()) ?? corpus().find((event) => event.id === selectedId()));
  const presentedCorpus = createMemo(() => presentCorpus(corpus(), {
    kindFilter: kindFilter(),
    sinceDays: sinceDays(),
    facets: activeFacets(),
    dedupe: dedupeEnabled(),
  }, deps.runtime.sourcesFor));
  const eligibleCorpus = createMemo(() => presentedCorpus().eligible);
  const visibleCorpus = createMemo(() => presentedCorpus().visible);
  const corpusFacets = createMemo(() => {
    const events = eligibleCorpus();
    return {
      topics: ranked(events.flatMap((event) => tags(event, "t").map((topic) => topic.toLowerCase())), 12),
      authors: ranked(events.map((event) => event.pubkey), 8),
      kinds: ranked(events.map((event) => event.kind), 8),
      days: ranked(events.map((event) => new Date(event.created_at * 1000).toISOString().slice(0, 10)), 7),
      domains: ranked(events.flatMap(eventDomains), 8),
      relays: ranked(events.flatMap(deps.runtime.sourcesFor), 6),
    };
  });
  const composerChips = createMemo(() => constraintChips(draft.constraints));
  const activeFacetCount = createMemo(() => Object.values(activeFacets()).filter((value) => value !== "" && value !== null).length);

  const checkpoint = (label) => {
    if (!corpus().length) return;
    const item = { id: crypto.randomUUID(), label, at: Date.now(), query: draft.text, eventIds: corpus().slice(0, deps.sessionEventLimit).map((event) => event.id), view: view(), facets: activeFacets() };
    setCorpusHistory((current) => [item, ...current.filter((entry) => entry.eventIds.join() !== item.eventIds.join())].slice(0, 8));
    void deps.storeEvents(corpus(), deps.runtime.sourcesFor);
  };

  const restoreCheckpoint = async (item) => {
    const events = deps.allowedEvents(await deps.loadEvents(item.eventIds, deps.runtime.recordSources));
    deps.rememberEvents(events);
    setCorpus(events); setDraft("text", item.query); setView(normalizeView(item.view)); setActiveFacets(item.facets ?? emptyFacets()); setSelectedId(""); setExpansionStatus(null);
    setLastQueryPlan(null); setHasMore(false); setPageMessage("Restored checkpoints are fixed corpora. Run a relay search to retrieve more.");
    deps.openSearchRoute();
    deps.logUsage("corpus_checkpoint_restored", { checkpointId: item.id, eventCount: events.length });
  };

  async function resolveNip05(value) {
    const [name, domain] = value.split("@");
    const response = await fetch(`https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`);
    return (await response.json()).names?.[name] ?? "";
  }

  async function resolvePubkey(value) {
    const text = value.trim();
    if (!text) return "";
    if (/^[0-9a-f]{64}$/i.test(text)) return text;
    if (/^(npub|nprofile)1/i.test(text)) {
      const decoded = nip19.decode(text);
      return typeof decoded.data === "string" ? decoded.data : decoded.data.pubkey;
    }
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) return resolveNip05(text);
    throw new Error("Author must be a hex pubkey, npub, nprofile, or NIP-05 identifier");
  }

  async function resolveSearch(value, mode, limit, keywordRelays) {
    const text = value.trim();
    if (mode === "topic") return { filter: { "#t": [text.replace(/^#/, "").toLowerCase()], limit }, relays: deps.readRelays, mode: "topic" };
    if (mode === "words") return { filter: { search: text, limit }, relays: keywordRelays, mode: "NIP-50" };
    if (/^[0-9a-f]{64}$/i.test(text)) return { filter: { [mode === "person" ? "authors" : "ids"]: [text], limit }, relays: deps.readRelays, mode: mode === "person" ? "author" : "event id" };
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text) && mode !== "note") {
      const pubkey = await resolveNip05(text);
      if (!pubkey) throw new Error("NIP-05 identifier did not resolve");
      return { filter: { authors: [pubkey], limit }, relays: deps.readRelays, mode: "NIP-05" };
    }
    if (/^(npub|nprofile|note|nevent|naddr)1/i.test(text)) {
      const decoded = nip19.decode(text);
      if (mode === "person" && !["npub", "nprofile"].includes(decoded.type)) throw new Error("This value identifies a note, not a person.");
      if (mode === "note" && ["npub", "nprofile"].includes(decoded.type)) throw new Error("This value identifies a person, not a note.");
      if (decoded.type === "npub") return { filter: { authors: [decoded.data], limit }, relays: deps.readRelays, mode: "npub" };
      if (decoded.type === "nprofile") return { filter: { authors: [decoded.data.pubkey], limit }, relays: decoded.data.relays?.length ? decoded.data.relays : deps.readRelays, mode: "nprofile" };
      if (decoded.type === "note") return { filter: { ids: [decoded.data] }, relays: deps.readRelays, mode: "note" };
      if (decoded.type === "nevent") return { filter: { ids: [decoded.data.id] }, relays: decoded.data.relays?.length ? decoded.data.relays : deps.readRelays, mode: "nevent" };
      if (decoded.type === "naddr") return { filter: { authors: [decoded.data.pubkey], kinds: [decoded.data.kind], "#d": [decoded.data.identifier] }, relays: decoded.data.relays?.length ? decoded.data.relays : deps.readRelays, mode: "naddr" };
    }
    if (mode === "person") throw new Error("Enter a name@domain, npub, nprofile, or 64-character public key.");
    if (mode === "note") throw new Error("Enter a note, nevent, naddr, or 64-character event ID.");
    return { filter: { search: text, limit }, relays: keywordRelays, mode: "NIP-50" };
  }

  async function retrieve(request) {
    const { text, operation, mode, constraints } = request;
    const label = text || constraintChips(constraints).map((chip) => chip.label).join(" · ") || "constraints";
    checkpoint(`before ${operation} search · ${label}`);
    const token = ++requestToken;
    pagingToken += 1;
    const started = performance.now();
    const previous = { corpus: corpus(), facets: activeFacets(), plan: lastQueryPlan(), hasMore: hasMore(), pageMessage: pageMessage() };
    const restore = () => { setCorpus(previous.corpus); setActiveFacets(previous.facets); setLastQueryPlan(previous.plan); setHasMore(previous.hasMore); setPageMessage(previous.pageMessage); };
    const keywordRelays = [...deps.searchRelays()];
    let incoming = [];
    setLoading(true); setError("");
    if (operation === "replace") { setCorpus([]); setActiveFacets(emptyFacets()); }
    deps.openSearchRoute();
    deps.logUsage("search_started", { query: text });
    try {
      const basePlan = text ? await resolveSearch(text, mode, request.limit, keywordRelays) : { filter: { limit: request.limit }, relays: deps.readRelays, mode: "constraints" };
      let compiledConstraints = constraints;
      if (constraints.author) compiledConstraints = { ...constraints, author: await resolvePubkey(constraints.author) };
      const plan = compileRelayPlan(basePlan, request, compiledConstraints, keywordRelays, previous.corpus.map((event) => event.id));
      setLastQueryPlan(plan); setHasMore(!plan.exactLookup); setPageMessage(plan.exactLookup ? "Exact entity lookups do not have additional relay pages." : "");
      void deps.inspectRelays(plan.relays);
      if (plan.filter.ids?.length) {
        const local = unique((await deps.loadEvents(plan.filter.ids, deps.runtime.recordSources)).concat(plan.filter.ids.map(deps.eventFor).filter(Boolean)));
        incoming = applyLocalConstraints(local, compiledConstraints, deps.runtime.sourcesFor);
        deps.rememberEvents(incoming);
      }
      setRelayStates(new Map(plan.relays.map((relay) => [relay, { state: "searching", count: 0 }])));
      await Promise.all(plan.relays.map(async (relay) => {
        const relayStarted = performance.now();
        const events = await deps.runtime.queryRelay(relay, { ...plan.filter, limit: deps.relayQueryLimit(plan.filter.limit, deps.relayInformation().get(relay)) }, plan.mode);
        if (token !== requestToken) return;
        deps.rememberEvents(events);
        incoming = unique([...incoming, ...events]);
        setCorpus(mergeSearchResults(incoming, previous.corpus, operation).sort((a, b) => b.created_at - a.created_at));
        setRelayStates((current) => new Map(current).set(relay, { state: "ok", count: events.length, ids: events.map((event) => event.id), duration: Math.round(performance.now() - relayStarted) }));
      }));
      if (token !== requestToken) return;
      if (!incoming.length && operation === "replace" && previous.corpus.length) {
        restore(); setPageMessage("The queried relays returned no events. Your previous corpus was kept."); return;
      }
      setExecutedQuery({ value: text, mode: text ? mode : "constraints", constraints: compiledConstraints, operation, completedAt: Date.now() });
      deps.recordDecision("search", `${operation} search · ${label}`, `${corpus().length} events from ${plan.relays.length} relay${plan.relays.length === 1 ? "" : "s"}`);
      setActiveFacets({ ...emptyFacets(), domain: compiledConstraints.domain || "", media: compiledConstraints.media || "" });
      deps.logUsage("search_completed", { query: label, mode: plan.mode, resultCount: corpus().length, durationMs: Math.round(performance.now() - started) });
      void deps.recordResearchRun({ query: text, mode: plan.mode, filter: plan.filter, relays: plan.relays, operation }, corpus());
      deps.hydrateProfiles(corpus(), () => token === requestToken);
      if (operation === "replace") deps.focusComposer();
    } catch (cause) {
      restore(); setError(cause.message); deps.logUsage("search_failed", { query: text, error: cause.message });
    } finally { if (token === requestToken) setLoading(false); }
  }

  const startRelaySearch = (overrides = {}, onInvalid = setError) => {
    const request = createSearchRequest(draft, overrides);
    const problem = searchRequestProblem(request);
    if (problem) { onInvalid(problem); return; }
    updateDraft({ ...request, operation: "replace" });
    void retrieve(request);
  };

  async function loadMore() {
    if (paging() || !corpus().length) return;
    const plan = lastQueryPlan();
    if (!plan) { setHasMore(false); setPageMessage("This corpus was not produced by a pageable relay search."); return; }
    const token = ++pagingToken;
    setPaging(true); setPageMessage("Requesting older events from the relays…");
    try {
      if (plan.exactLookup) { setHasMore(false); setPageMessage("This lookup identifies a specific event; there are no additional pages."); return; }
      const oldest = Math.min(...corpus().map((event) => event.created_at));
      const filter = { ...plan.filter, until: oldest - 1, limit: plan.limit };
      const batches = await Promise.all(plan.relays.map((relay) => deps.runtime.queryRelay(relay, { ...filter, limit: deps.relayQueryLimit(filter.limit, deps.relayInformation().get(relay)) }, `${plan.mode}-older`)));
      if (token !== pagingToken) return;
      const incoming = deps.rememberEvents(unique(batches.flat()));
      const added = pageAdditions(incoming, corpus(), plan);
      if (added.length) {
        setCorpus((current) => unique([...current, ...added]).sort((a, b) => b.created_at - a.created_at));
        setEntryReasons((current) => ({ ...current, ...Object.fromEntries(added.map((event) => [event.id, `older results for ${plan.query}`])) }));
        setPageMessage(`Added ${added.length} older ${added.length === 1 ? "event" : "events"}.`);
        deps.hydrateProfiles(added);
      } else { setHasMore(false); setPageMessage("No more older events were returned by these relays."); }
      deps.logUsage("search_page", { query: plan.query, cursor: oldest - 1, returned: incoming.length, added: added.length });
    } catch (cause) { if (token === pagingToken) setPageMessage(`Could not load more: ${cause.message}`); }
    finally { if (token === pagingToken) setPaging(false); }
  }

  async function searchAuthors(pubkeys) {
    const authors = [...new Set(pubkeys.filter(Boolean))].slice(0, 100);
    if (!authors.length) { setError("Add at least one seed account first."); return; }
    checkpoint(`before seed account search · ${authors.length} accounts`);
    const token = ++requestToken;
    pagingToken += 1; expansionToken += 1;
    const relays = deps.readRelays;
    const filter = { authors, kinds: [1, 6, 20, 21, 22, 1111, 30023], limit: draft.limit };
    const plan = { filter, relays, mode: "seed accounts", query: `${authors.length} seed accounts`, limit: draft.limit, operation: "replace", constraints: emptyQueryConstraints(), intersectionBaseIds: [], exactLookup: false };
    setLoading(true); setError(""); setCorpus([]); setActiveFacets(emptyFacets()); setLastQueryPlan(plan); setHasMore(true); setPageMessage("");
    setRelayStates(new Map(relays.map((relay) => [relay, { state: "searching", count: 0 }])));
    deps.openSearchRoute();
    try {
      let incoming = [];
      await Promise.all(relays.map(async (relay) => {
        const started = performance.now();
        const found = await deps.runtime.queryRelay(relay, { ...filter, limit: deps.relayQueryLimit(filter.limit, deps.relayInformation().get(relay)) }, "seed-accounts");
        if (token !== requestToken) return;
        deps.rememberEvents(found);
        incoming = unique([...incoming, ...found]);
        setCorpus([...incoming].sort((left, right) => right.created_at - left.created_at));
        setRelayStates((current) => new Map(current).set(relay, { state: "ok", count: found.length, ids: found.map((event) => event.id), duration: Math.round(performance.now() - started) }));
      }));
      if (token !== requestToken) return;
      setExecutedQuery({ value: `${authors.length} seed accounts`, mode: "seed accounts", constraints: emptyQueryConstraints(), operation: "replace", completedAt: Date.now() });
      setEntryReasons(Object.fromEntries(corpus().map((event) => [event.id, "seed account activity"])));
      deps.recordDecision("search", `Searched ${authors.length} seed accounts`, `${corpus().length} events`);
      deps.logUsage("seed_accounts_search", { accounts: authors.length, resultCount: corpus().length });
      deps.hydrateProfiles(corpus(), () => token === requestToken);
    } catch (cause) { if (token === requestToken) setError(cause.message); }
    finally { if (token === requestToken) setLoading(false); }
  }

  const compileFacets = () => {
    const facets = activeFacets();
    if (!activeFacetCount()) return;
    updateDraft(researchPatchFromFacets(facets, draft.text, draft.constraints));
    setActiveFacets(emptyFacets());
    deps.recordDecision("refine", "Compiled corpus facets into a new query", Object.entries(facets).filter(([, value]) => value !== "" && value !== null).map(([key, value]) => `${key}: ${value}`).join(" · "));
    deps.notice("New search draft ready. Review the constraints, then search the relays.");
    deps.focusComposer(false);
    deps.logUsage("facets_compiled", { facets });
  };

  const prepareFacetSearch = (type, value) => {
    const facet = { ...emptyFacets(), [type]: value };
    const patch = researchPatchFromFacets(facet, "", emptyQueryConstraints());
    if (type === "domain") Object.assign(patch, { text: value, mode: "words", constraints: emptyQueryConstraints() });
    updateDraft({ ...patch, mode: type === "topic" ? "topic" : "words", operation: "replace" });
    deps.recordDecision("refine", `Prepared wider search from ${type}`, String(value));
    deps.notice("Wider search ready. Review it, then search the relays.");
    deps.openSearchRoute();
    deps.focusComposer(false);
  };

  async function searchLocalArchive() {
    const value = draft.text.trim();
    if (!value && !constraintChips(draft.constraints).length) return;
    checkpoint(`before local archive search · ${value}`);
    setLoading(true); setError("");
    try {
      let constraints = draft.constraints;
      if (constraints.author) constraints = { ...constraints, author: await resolvePubkey(constraints.author) };
      const cached = value
        ? deps.allowedEvents(await deps.searchStoredEvents(value.replace(/^#/, ""), 250, deps.runtime.recordSources))
        : deps.allowedEvents([...deps.allEvents()]);
      const events = applyLocalConstraints(cached, constraints, deps.runtime.sourcesFor);
      deps.rememberEvents(events); setCorpus(events); setEntryReasons(Object.fromEntries(events.map((event) => [event.id, `local archive search: ${value}`]))); setActiveFacets(emptyFacets()); setView("table");
      setExecutedQuery({ value, mode: "local archive", constraints, operation: "replace", completedAt: Date.now() }); setLastQueryPlan(null); setHasMore(false); setPageMessage("Local archive results do not request additional relay pages.");
      deps.recordDecision("local", `Searched the local archive · ${value}`, `${events.length} cached events`);
      if (!events.length) setError("No cached events matched this local archive search and its structured constraints. Retrieve data from relays first to grow the archive.");
      deps.logUsage("local_archive_search", { query: value, constraints: constraintChips(constraints).map((chip) => chip.label), resultCount: events.length });
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }

  async function expandSelection(relation) {
    const event = selectedEvent();
    if (!event) return;
    const definitions = {
      replies: { filters: [{ "#e": [event.id], kinds: [1, 1111], limit: draft.limit }, { "#E": [event.id], kinds: [1111], limit: draft.limit }], label: "replies / comments" },
      quotes: { filters: [{ "#q": [event.id], limit: draft.limit }], label: "quotes" },
      responses: { filters: [{ "#e": [event.id], kinds: [6, 7, 16, 9735], limit: draft.limit }], label: "reactions / reposts / zaps" },
      author: { filters: [{ authors: [event.pubkey], limit: draft.limit }], label: "author activity" },
      mentions: { filters: [{ "#p": [event.pubkey], limit: draft.limit }], label: "author mentions" },
      topics: { filters: tags(event, "t").slice(0, 4).map((topic) => ({ "#t": [topic], limit: draft.limit })), label: "shared topics" },
      references: { filters: (() => { const semantics = parseEventSemantics(event); const ids = [semantics.root, semantics.parent].filter((item) => item?.type?.toLowerCase() === "e").map((item) => item.value).concat(semantics.quotes, semantics.references).slice(0, draft.limit); return ids.length ? [{ ids }] : []; })(), label: "parents / roots / citations" },
      network: { filters: [{ authors: [event.pubkey], kinds: [3], limit: 1 }], label: "author follow network" },
    };
    const definition = definitions[relation];
    if (!definition?.filters.length) {
      setExpansionStatus({ state: "empty", relation, label: definition?.label ?? relation, message: `This note contains no ${definition?.label ?? relation} to follow.` });
      return;
    }
    checkpoint(`before ${expansionOperation()} expansion · ${definition.label}`);
    const token = ++expansionToken;
    const base = corpus();
    setLoading(true); setError("");
    setExpansionStatus({ state: "loading", relation, label: definition.label, message: `Looking for ${definition.label} across ${deps.readRelays.length} relays…` });
    try {
      const batches = await Promise.all(definition.filters.map((filter) => deps.runtime.readEvents(filter, `expand-${relation}`, deps.readRelays)));
      if (token !== expansionToken) return;
      let incoming = deps.rememberEvents(unique(batches.flat()));
      if (relation === "network" && incoming.length) {
        const followed = tags(incoming.sort((a, b) => b.created_at - a.created_at)[0], "p").slice(0, 80);
        if (followed.length) incoming = deps.rememberEvents(unique([...incoming, ...await deps.runtime.readEvents({ authors: followed, kinds: [1, 20, 21, 22, 30023], limit: draft.limit }, "expand-network", deps.readRelays)]));
      }
      const existingIds = new Set(base.map((item) => item.id));
      const added = incoming.filter((item) => !existingIds.has(item.id));
      if (!incoming.length) {
        setExpansionStatus({ state: "empty", relation, label: definition.label, message: `No ${definition.label} were found for this note on the configured relays.` });
        deps.logUsage("graph_expansion", { relation, from: event.id, returned: 0, added: 0, resultCount: base.length });
        return;
      }
      if (!added.length && expansionOperation() === "union") {
        setExpansionStatus({ state: "known", relation, label: definition.label, message: `${incoming.length} related ${incoming.length === 1 ? "note is" : "notes are"} already in this exploration.` });
        return;
      }
      const next = mergeSearchResults(incoming, base, expansionOperation()).sort((a, b) => b.created_at - a.created_at);
      setCorpus(next); setLastQueryPlan(null); setHasMore(false);
      setPageMessage("This corpus includes a graph expansion. Run a relay search to retrieve a pageable corpus.");
      const reason = `${definition.label} from ${deps.short(event.id)}`;
      setEntryReasons((current) => ({ ...current, ...Object.fromEntries(incoming.map((item) => [item.id, reason])) }));
      setExpansionStatus({ state: "added", relation, label: definition.label, message: expansionOperation() === "replace" ? `Opened ${incoming.length} connected ${incoming.length === 1 ? "event" : "events"} as the corpus.` : expansionOperation() === "intersect" ? `Kept ${next.length} current ${next.length === 1 ? "event" : "events"} that match this relationship.` : `Added ${added.length} new ${added.length === 1 ? "event" : "events"} to the corpus.` });
      deps.recordDecision("navigate", `${definition.label} from ${deps.short(event.id)}`, `${incoming.length} returned · ${added.length} new`);
      deps.logUsage("graph_expansion", { relation, operation: expansionOperation(), from: event.id, returned: incoming.length, added: added.length, resultCount: next.length });
      deps.hydrateProfiles(incoming, () => token === expansionToken);
    } catch (cause) {
      if (token === expansionToken) {
        setError(cause.message);
        setExpansionStatus({ state: "error", relation, label: definition.label, message: `Could not retrieve ${definition.label}: ${cause.message}` });
      }
    } finally { if (token === expansionToken) setLoading(false); }
  }

  const openFixedCorpus = ({ events, label, mode, entryReasons: reasons = {}, pinnedIds, nextView = "table", draftPatch, pageMessage: message }) => {
    requestToken += 1; pagingToken += 1; expansionToken += 1;
    deps.rememberEvents(events); setCorpus(events); setSelectedId(""); setActiveFacets(emptyFacets()); setExpansionStatus(null); setEntryReasons(reasons); setView(normalizeView(nextView));
    if (draftPatch) updateDraft(draftPatch);
    if (pinnedIds) setPinned(new Set(pinnedIds));
    setExecutedQuery({ value: label, mode, constraints: emptyQueryConstraints(), operation: "replace", completedAt: Date.now() });
    setLastQueryPlan(null); setHasMore(false); setPageMessage(message ?? "This is a fixed corpus. Run a relay search to retrieve more.");
  };

  const toggleFacet = (type, value) => setActiveFacets((current) => ({ ...current, [type]: current[type] === value ? (type === "kind" ? null : "") : value }));
  const reset = () => {
    requestToken += 1; pagingToken += 1;
    updateDraft({ text: "", constraints: emptyQueryConstraints(), mode: "topic", operation: "replace" });
    setExecutedQuery(null); setCorpus([]); setSelectedId(""); setPinned(new Set()); setEntryReasons({}); setExpansionStatus(null);
    setKindFilter("all"); setSinceDays(0); setView("list"); setRelayStates(new Map()); setError(""); setLastQueryPlan(null); setHasMore(true); setPageMessage(""); setActiveFacets(emptyFacets()); setCorpusHistory([]);
  };

  return {
    draft, setDraft, updateDraft, corpus, setCorpus, loading, setLoading, error, setError, relayStates, setRelayStates,
    kindFilter, setKindFilter, sinceDays, setSinceDays, view, setView, pinned, setPinned, selectedId, setSelectedId,
    constraintEditor, setConstraintEditor, executedQuery, setExecutedQuery, entryReasons, setEntryReasons,
    expansionStatus, setExpansionStatus, expansionOperation, setExpansionOperation, dedupeEnabled, setDedupeEnabled,
    lastQueryPlan, setLastQueryPlan, paging, hasMore, setHasMore, pageMessage, setPageMessage, activeFacets, setActiveFacets,
    corpusHistory, setCorpusHistory, selectedEvent, visibleCorpus, eligibleCorpus, corpusFacets, composerChips, activeFacetCount,
    startRelaySearch, searchAuthors, loadMore, compileFacets, prepareFacetSearch, searchLocalArchive, expandSelection, toggleFacet, checkpoint, restoreCheckpoint, openFixedCorpus, resolvePubkey, reset,
    invalidate: () => { requestToken += 1; pagingToken += 1; expansionToken += 1; },
  };
}
