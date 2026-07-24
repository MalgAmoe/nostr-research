import { createMemo, createSignal } from "solid-js";
import { ranked, tags } from "./event-analysis.js";
import { analyzePulse, defaultPulseSettings, pulseKinds, pulseTimeSlices } from "./pulse-analysis.js";

const unique = (events) => [...new Map(events.filter((event) => event?.id).map((event) => [event.id, event])).values()];
export const emptyScanDirection = () => ({ topics: [], authors: [], domains: [], events: [] });

export function createRelayExplorer(deps, restored = {}) {
  const [events, setEvents] = createSignal([]);
  const [previousEvents, setPreviousEvents] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [settings, setSettings] = createSignal(restored.settings ?? defaultPulseSettings(deps.defaultRelays));
  const [meta, setMeta] = createSignal(null);
  const [progress, setProgress] = createSignal(null);
  const [view, setView] = createSignal("overview");
  const [direction, setDirection] = createSignal(restored.direction ?? emptyScanDirection());
  const [strategy, setStrategy] = createSignal(restored.strategy ?? "adjacent");
  const [round, setRound] = createSignal(0);
  const [reasons, setReasons] = createSignal({});
  let runToken = 0;

  const analysis = createMemo(() => analyzePulse(events(), previousEvents(), settings().relays, (event) => deps.runtime.sourcesFor(event.id)));
  const directionCount = createMemo(() => Object.values(direction()).reduce((sum, values) => sum + values.length, 0));
  const updateSettings = (patch) => {
    const next = { ...settings(), ...patch };
    setSettings(next); deps.persistSettings(next);
  };
  const updateStrategy = (next) => { setStrategy(next); deps.persistStrategy(next); };
  const pursue = (type, value) => {
    const key = `${type}s`;
    setDirection((current) => {
      if (!current[key] || current[key].includes(value) || current[key].length >= 8) return current;
      const next = { ...current, [key]: [...current[key], value] };
      deps.persistDirection(next); return next;
    });
    deps.logUsage("scan_direction_added", { type, value });
  };
  const removeDirection = (type, value) => setDirection((current) => {
    const next = { ...current, [type]: current[type].filter((item) => item !== value) };
    deps.persistDirection(next); return next;
  });
  const clearDirection = () => { const next = emptyScanDirection(); setDirection(next); deps.persistDirection(next); };

  async function scan() {
    const token = ++runToken;
    setLoading(true);
    const started = performance.now();
    try {
      setRound(0); setReasons({});
      const options = settings();
      const now = Math.floor(Date.now() / 60_000) * 60;
      const seconds = options.windowHours * 3600;
      const relays = options.relays.length ? options.relays.slice(0, 4) : deps.defaultRelays;
      const slices = pulseTimeSlices(now, seconds, options.depth, deps.queryLimit);
      let current = [];
      let previous = [];
      setProgress({ state: "collecting", completed: 0, total: slices.length, received: 0, unique: 0 });
      for (let index = 0; index < slices.length; index += 1) {
        if (token !== runToken) return;
        const slice = slices[index];
        const filter = { kinds: pulseKinds(options.scope), limit: slice.limit };
        const [currentBatch, previousBatch] = await Promise.all([
          deps.runtime.readEvents({ ...filter, since: slice.since, until: slice.until }, `relay-pulse-current-${index + 1}`, relays),
          deps.runtime.readEvents({ ...filter, since: slice.since - seconds, until: slice.until - seconds }, `relay-pulse-previous-${index + 1}`, relays),
        ]);
        if (token !== runToken) return;
        current = unique([...current, ...currentBatch]);
        previous = unique([...previous, ...previousBatch]);
        setEvents(current); setPreviousEvents(previous);
        setProgress({ state: "collecting", completed: index + 1, total: slices.length, received: current.length + previous.length, unique: current.length });
      }
      const durationMs = Math.round(performance.now() - started);
      setMeta({ collectedAt: Date.now(), durationMs, requested: options.depth * relays.length, relays: relays.length, slices: slices.length, mode: "baseline", round: 0 });
      setProgress({ state: "complete", completed: slices.length, total: slices.length, received: current.length + previous.length, unique: current.length });
      void deps.hydrateProfiles(deps.needsAllProfiles() ? current : ranked(current.map((event) => event.pubkey), 20).map(([pubkey]) => ({ pubkey })));
      deps.logUsage("relay_pulse", { current: current.length, previous: previous.length, relays: relays.length, depth: options.depth, slices: slices.length, windowHours: options.windowHours, scope: options.scope, durationMs });
    } finally { if (token === runToken) setLoading(false); }
  }

  const cancel = () => {
    runToken += 1; setLoading(false);
    setProgress((current) => current ? { ...current, state: "cancelled" } : null);
    deps.logUsage("relay_pulse_cancelled", { completed: progress()?.completed ?? 0, total: progress()?.total ?? 0, unique: events().length });
  };

  async function continueScan() {
    if (!directionCount()) { deps.notice("Pursue at least one topic, account, domain, or conversation first."); return; }
    const token = ++runToken;
    const started = performance.now();
    const options = settings();
    const relays = options.relays.length ? options.relays.slice(0, 4) : deps.defaultRelays;
    const focus = direction();
    const since = Math.floor(Date.now() / 1000) - options.windowHours * 3600;
    const directedLimit = Math.min(500, Math.max(100, Math.ceil(options.depth * 0.4)));
    const broadLimit = Math.min(500, Math.max(50, Math.ceil(options.depth * 0.15)));
    const kinds = pulseKinds(options.scope);
    const currentStrategy = strategy();
    let networkAuthors = [];
    if (currentStrategy === "network" && focus.authors.length) {
      const contacts = await deps.runtime.readEvents({ authors: focus.authors, kinds: [3], limit: focus.authors.length }, "scan-network-seeds", relays);
      networkAuthors = [...new Set(contacts.flatMap((event) => tags(event, "p")))].slice(0, 100);
    }
    const focusedPlans = [
      ...focus.topics.flatMap((topic) => [
        { label: `scan-topic-${topic}`, reason: `pursued topic #${topic}`, relays, filter: { kinds, "#t": [topic], since, limit: directedLimit } },
        { label: `scan-words-${topic}`, reason: `pursued terminology: ${topic}`, relays: deps.searchRelays(), filter: { kinds, search: topic, since, limit: directedLimit } },
      ]),
      ...(focus.authors.length ? [{ label: "scan-authors", reason: "pursued account", relays, filter: { authors: focus.authors, kinds, since, limit: directedLimit } }] : []),
      ...focus.domains.map((domain) => ({ label: `scan-domain-${domain}`, reason: `pursued linked domain: ${domain}`, relays: deps.searchRelays(), filter: { kinds, search: domain, since, limit: directedLimit } })),
      ...focus.events.map((id) => ({ label: `scan-conversation-${id.slice(0, 8)}`, reason: `pursued conversation: ${deps.short(id)}`, relays, filter: { kinds: [1, 6, 7, 16, 1111, 9735], "#e": [id], since, limit: directedLimit } })),
    ];
    const plans = currentStrategy === "crosscheck" ? relays.flatMap((relay) => focusedPlans.map((plan) => ({ ...plan, label: `${plan.label}-${new URL(relay).hostname}`, reason: `${plan.reason} · cross-check ${new URL(relay).hostname}`, relays: [relay] }))) : [
      { label: "scan-broad", reason: currentStrategy === "broader" ? "expanded broad exploration" : "broad exploration sample", relays, filter: { kinds, since, limit: currentStrategy === "broader" ? Math.min(500, broadLimit * 3) : broadLimit } },
      ...focusedPlans.filter((plan) => currentStrategy !== "closer" || plan.label.startsWith("scan-authors") || plan.label.startsWith("scan-conversation")),
      ...(currentStrategy === "network" && networkAuthors.length ? [{ label: "scan-follow-network", reason: "accounts followed by pursued accounts", relays, filter: { authors: networkAuthors, kinds, since, limit: directedLimit } }] : []),
      ...(currentStrategy === "skeptical" && focus.authors.length ? [{ label: "scan-account-reports", reason: "reports about pursued accounts", relays, filter: { kinds: [1984, 1985], "#p": focus.authors, since, limit: directedLimit } }] : []),
      ...(currentStrategy === "skeptical" && focus.events.length ? [{ label: "scan-event-reports", reason: "reports and labels about pursued events", relays, filter: { kinds: [1984, 1985], "#e": focus.events, since, limit: directedLimit } }] : []),
    ];
    const prior = events();
    let incoming = [];
    const nextReasons = {};
    setLoading(true); setProgress({ state: "collecting", completed: 0, total: plans.length, received: 0, unique: 0 });
    try {
      await Promise.all(plans.map(async (plan) => {
        const found = await deps.runtime.readEvents(plan.filter, plan.label, plan.relays);
        if (token !== runToken) return;
        for (const event of found) nextReasons[event.id] = nextReasons[event.id] ? `${nextReasons[event.id]} · ${plan.reason}` : plan.reason;
        incoming = unique([...incoming, ...found]); setEvents(incoming);
        setProgress((current) => ({ state: "collecting", completed: (current?.completed ?? 0) + 1, total: plans.length, received: incoming.length, unique: incoming.length }));
      }));
      if (token !== runToken) return;
      setPreviousEvents(prior); setReasons(nextReasons);
      const nextRound = round() + 1; setRound(nextRound);
      const durationMs = Math.round(performance.now() - started);
      setMeta({ collectedAt: Date.now(), durationMs, requested: plans.reduce((sum, plan) => sum + plan.filter.limit * plan.relays.length, 0), relays: relays.length, slices: plans.length, mode: "directed", strategy: currentStrategy, round: nextRound });
      setProgress({ state: "complete", completed: plans.length, total: plans.length, received: incoming.length, unique: incoming.length });
      void deps.hydrateProfiles(incoming);
      deps.logUsage("directed_scan", { round: nextRound, strategy: currentStrategy, directions: directionCount(), plans: plans.length, previous: prior.length, current: incoming.length, durationMs });
    } finally { if (token === runToken) setLoading(false); }
  }

  const restore = ({ events: current = [], previous = [], meta: nextMeta = null, round: nextRound = 0, reasons: nextReasons = {} }) => {
    setEvents(current); setPreviousEvents(previous); setMeta(nextMeta); setRound(nextRound); setReasons(nextReasons);
  };

  return {
    events, setEvents, previousEvents, setPreviousEvents, loading, settings, meta, setMeta, progress, view, setView,
    direction, strategy, round, reasons, analysis, directionCount, updateSettings, updateStrategy,
    pursue, removeDirection, clearDirection, scan, continueScan, cancel, restore,
  };
}
