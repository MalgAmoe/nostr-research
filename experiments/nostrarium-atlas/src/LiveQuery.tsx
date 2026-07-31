import { useEffect, useMemo, useRef } from 'react';
import { useLiveStore } from './live-store';
import { useAtlasStore } from './store';

export function LiveQueryButton() {
  const open = useLiveStore((state) => state.setPanelOpen);
  const selected = useLiveStore((state) => state.relays.filter((relay) => relay.selected).length);
  return <button className="source-chip source-chip--button" onClick={() => open(true)}><i/> {selected} SOURCE{selected === 1 ? '' : 'S'} · DRAFT</button>;
}

export function LiveQueryPanel() {
  const store = useLiveStore();
  const groundPlaceId = useAtlasStore((state) => state.groundPlaceId);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { if (store.panelOpen) requestAnimationFrame(() => panel.current?.scrollIntoView({ block: 'start' })); }, [store.panelOpen]);
  const visibleRelays = useMemo(() => {
    const search = store.relaySearch.trim().toLowerCase();
    return search ? store.relays.filter((relay) => relay.selected || `${relay.label} ${relay.url}`.toLowerCase().includes(search)) : store.relays;
  }, [store.relays, store.relaySearch]);
  if (!store.panelOpen) return null;
  const selected = store.relays.filter((relay) => relay.selected);
  const busy = store.phase.type === 'working';
  const nip50RelayMismatch = Boolean(store.draft.search.trim()) && selected.length !== 1;

  return <section ref={panel} className="query-panel" role="region" aria-labelledby="query-title">
    <header><div><span>INDEPENDENT ACQUISITION DRAFT</span><h2 id="query-title">{groundPlaceId ? 'Replace Ground explicitly' : 'Acquire Ground'}</h2><p>Editable engine-shaped parameters. Nothing contacts a relay until execution.</p></div><button disabled={busy} onClick={() => store.setPanelOpen(false)} aria-label="Close acquisition draft">×</button></header>
    <div className="query-columns">
      <section className="relay-column">
        <div className="query-section-title"><span>1</span><div><strong>Visible relay targets</strong><small>Never inherited invisibly from a place</small></div></div>
        <label className="relay-filter"><span aria-hidden="true">⌕</span><input aria-label="Filter relay list" value={store.relaySearch} onChange={(event) => store.setRelaySearch(event.target.value)} placeholder="Filter your relay list"/></label>
        <div className="relay-list">{visibleRelays.map((relay) => <label key={relay.url} className={relay.selected ? 'is-selected' : ''}><input type="checkbox" checked={relay.selected} onChange={() => store.toggleRelay(relay.url)}/><span><strong>{relay.label}</strong><small>{relay.url}</small></span>{relay.custom && <button type="button" onClick={(event) => { event.preventDefault(); store.removeRelay(relay.url); }} aria-label={`Remove ${relay.label}`}>Remove</button>}</label>)}</div>
        <div className="custom-relay"><label><span>Add custom relay</span><div><input value={store.customRelay} onChange={(event) => store.setCustomRelay(event.target.value)} placeholder="wss://relay.example"/><button onClick={store.addRelay}>Add</button></div></label>{store.customRelayError && <p>{store.customRelayError}</p>}</div>
        <p className="query-boundary">No relay is ranked, substituted, retried, or contacted in the background.</p>
      </section>
      <section className="filter-column">
        <div className="query-section-title"><span>2</span><div><strong>Visible Nostr constraints and bounds</strong><small>The engine reports its effective normalized request after execution</small></div></div>
        <div className="filter-grid">
          <label className="text-search-filter nip50-filter"><span>Experimental NIP-50 text search</span><input value={store.draft.search} onChange={(event) => store.setDraft({ search: event.target.value })} maxLength={200} placeholder="relay-side full-text search (NIP-50)"/><small>Requires exactly one relay. Relay matching remains unverified.</small></label>
          <label><span>NIP-01 filter limit</span><select aria-label="NIP-01 filter limit" disabled={!store.draft.includeFilterLimit} value={store.draft.limit} onChange={(event) => store.setDraft({ limit: Number(event.target.value) })}><option value="5">5</option><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select><small><input type="checkbox" checked={store.draft.includeFilterLimit} onChange={(event) => store.setDraft({ includeFilterLimit: event.target.checked })}/> Include this filter constraint</small></label>
          <label><span>Time window</span><select value={store.draft.hours} onChange={(event) => store.setDraft({ hours: Number(event.target.value) })}><option value="1">Last hour</option><option value="6">Last 6 hours</option><option value="24">Last 24 hours</option><option value="72">Last 3 days</option><option value="168">Last 7 days</option><option value="720">Last 30 days</option><option value="0">No time bound</option></select></label>
          <label><span>Hashtag</span><input value={store.draft.hashtag} onChange={(event) => store.setDraft({ hashtag: event.target.value })} placeholder="optional, without #"/></label>
          <label className="event-filter"><span>Exact event ID</span><input value={store.draft.eventId} onChange={(event) => store.setDraft({ eventId: event.target.value })} placeholder="optional 64-character hex ID"/></label>
          <label className="author-filter"><span>Exact author public key</span><input value={store.draft.author} onChange={(event) => store.setDraft({ author: event.target.value })} placeholder="optional 64-character hex key"/></label>
          <label><span>Timeout ms</span><input aria-label="Acquisition timeout" type="number" min="100" max="60000" value={store.draft.timeoutMs} onChange={(event) => store.setDraft({ timeoutMs: Number(event.target.value) })}/></label>
          <label><span>Observation bound</span><input aria-label="Acquisition observation bound" type="number" min="1" value={store.draft.observationLimit} onChange={(event) => store.setDraft({ observationLimit: Number(event.target.value) })}/></label>
          <label><span>Distinct-event bound</span><input aria-label="Acquisition distinct-event bound" type="number" min="1" value={store.draft.distinctEventLimit} onChange={(event) => store.setDraft({ distinctEventLimit: Number(event.target.value) })}/></label>
          <label><span>Concurrency</span><input aria-label="Acquisition concurrency" type="number" min="1" max="10" value={store.draft.concurrency} onChange={(event) => store.setDraft({ concurrency: Number(event.target.value) })}/></label>
          <label className="warning-filter"><input type="checkbox" checked={store.draft.excludeContentWarnings} onChange={(event) => store.setDraft({ excludeContentWarnings: event.target.checked })}/><span><strong>Exclude direct content warnings</strong><small>Configured acquisition exclusion; no per-event warning claim</small></span></label>
        </div>
        <div className="request-summary"><span>VISIBLE REQUEST DRAFT</span><p>Ask <strong>{selected.length} selected relay{selected.length === 1 ? '' : 's'}</strong> for kind-1 notes{store.draft.includeFilterLimit ? <> under a <strong>{store.draft.limit}-event NIP-01 filter limit</strong></> : ' with no NIP-01 filter limit'}{store.draft.search ? ` matching “${store.draft.search}”` : ''}{store.draft.hours ? ` from the last ${store.draft.hours} hours` : ''}{store.draft.eventId ? ' with one exact event ID' : ''}{store.draft.author ? ' by one exact author' : ''}{store.draft.hashtag ? ` tagged #${store.draft.hashtag.replace(/^#/u, '')}` : ''}.</p><div className="selected-relay-summary">{selected.length ? selected.map((relay) => <code key={relay.url}>{relay.url}</code>) : <em>No relay selected</em>}</div><small>Timeout {store.draft.timeoutMs} ms · observation bound {store.draft.observationLimit} · distinct-event bound {store.draft.distinctEventLimit} · concurrency {store.draft.concurrency} · no hidden older-draft constraints.</small></div>
      </section>
    </div>
    <footer className="query-footer"><div className="query-status">
      {store.phase.type === 'idle' && <><i className={nip50RelayMismatch ? 'failed' : 'ready'}/><span>{nip50RelayMismatch ? 'Choose exactly one relay for NIP-50.' : groundPlaceId ? 'Execution explicitly replaces Ground; the former place remains a branch.' : 'Success installs one never-replaced handle as Ground and current place.'}</span></>}
      {store.phase.type === 'working' && <><i className="working"/><span>{store.phase.stage === 'acquire' ? 'Executing explicit bounded acquisition and local first-page observation…' : `Working: ${store.phase.stage}…`}</span></>}
      {store.phase.type === 'failure' && <><i className="failed"/><span>{store.phase.message}</span></>}
    </div><div className="query-buttons">{store.phase.type === 'failure' && <button className="query-secondary" onClick={store.resetPhase}>Revise draft</button>}<button className="query-primary" disabled={busy || nip50RelayMismatch || !selected.length} onClick={store.acquire}>{store.phase.type === 'working' && store.phase.stage === 'acquire' ? 'Acquiring…' : groundPlaceId ? 'Replace Ground with this acquisition' : 'Acquire and establish Ground'}</button></div></footer>
    {store.phase.type !== 'idle' && 'command' in store.phase && store.phase.command && <details className="command-disclosure"><summary>Inspect visible command</summary><pre>{JSON.stringify(store.phase.command, null, 2)}</pre></details>}
  </section>;
}
