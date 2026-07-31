import { useEffect, useMemo, useRef } from 'react';
import { useLiveStore } from './live-store';

function safeObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function LiveQueryButton() {
  const open = useLiveStore((state) => state.setPanelOpen);
  const selected = useLiveStore((state) => state.relays.filter((relay) => relay.selected).length);
  return <button className="source-chip source-chip--button" onClick={() => open(true)}><i /> {selected} SOURCE{selected === 1 ? '' : 'S'} · SEARCH</button>;
}

export function LiveQueryPanel() {
  const store = useLiveStore();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (store.panelOpen) requestAnimationFrame(() => panel.current?.scrollIntoView({ block: 'start' }));
  }, [store.panelOpen]);
  const visibleRelays = useMemo(() => {
    const search = store.relaySearch.trim().toLowerCase();
    return search
      ? store.relays.filter((relay) => relay.selected || `${relay.label} ${relay.url}`.toLowerCase().includes(search))
      : store.relays;
  }, [store.relays, store.relaySearch]);
  if (!store.panelOpen) return null;
  const selected = store.relays.filter((relay) => relay.selected);
  const busy = ['acquiring', 'observing', 'paging'].includes(store.phase.type);
  const nip50RelayMismatch = Boolean(store.draft.search.trim()) && selected.length !== 1;
  const coverage = store.phase.type === 'acquired' ? safeObject(store.phase.coverage?.external) : {};
  const completeness = safeObject(coverage.completeness);
  const updateMode = store.phase.type === 'acquired' && store.phase.mode !== 'replace';

  return <section ref={panel} className="query-panel" role="region" aria-labelledby="query-title">
      <header>
        <div><span>LIVE EXPLORATION</span><h2 id="query-title">Search relays</h2><p>Choose where to ask and the exact bounded filter to send.</p></div>
        <button disabled={busy} onClick={() => store.setPanelOpen(false)} aria-label="Close relay search">×</button>
      </header>
      <div className="query-columns">
        <section className="relay-column">
          <div className="query-section-title"><span>1</span><div><strong>Sources</strong><small>Choose relays explicitly</small></div></div>
          <label className="relay-filter"><span aria-hidden="true">⌕</span><input aria-label="Filter relay list" value={store.relaySearch} onChange={(event) => store.setRelaySearch(event.target.value)} placeholder="Filter your relay list"/></label>
          <div className="relay-list">{visibleRelays.map((relay) => <label key={relay.url} className={relay.selected ? 'is-selected' : ''}><input type="checkbox" checked={relay.selected} onChange={() => store.toggleRelay(relay.url)}/><span><strong>{relay.label}</strong><small>{relay.url}</small></span>{relay.custom&&<button type="button" onClick={(event)=>{event.preventDefault();store.removeRelay(relay.url);}} aria-label={`Remove ${relay.label}`}>Remove</button>}</label>)}</div>
          <div className="custom-relay"><label><span>Add custom relay</span><div><input value={store.customRelay} onChange={(event)=>store.setCustomRelay(event.target.value)} placeholder="wss://relay.example"/><button onClick={store.addRelay}>Add</button></div></label>{store.customRelayError&&<p>{store.customRelayError}</p>}</div>
          <p className="query-boundary">No relay is ranked, substituted, retried, or broadened automatically.</p>
        </section>
        <section className="filter-column">
          <div className="query-section-title"><span>2</span><div><strong>Request filters</strong><small>NIP-01 bounds or experimental NIP-50 text</small></div></div>
          <div className="filter-grid">
            <label className="text-search-filter nip50-filter"><span>Experimental NIP-50 text search</span><input value={store.draft.search} onChange={(event)=>store.setDraft({search:event.target.value})} maxLength={200} placeholder="relay-side full-text search (NIP-50)"/><small>Requires exactly one relay. Support and matching behavior are relay-specific and unverified.</small></label>
            <label><span>Limit per relay</span><select value={store.draft.limit} onChange={(event)=>store.setDraft({limit:Number(event.target.value)})}><option value="5">5</option><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label>
            <label><span>Time window</span><select value={store.draft.hours} onChange={(event)=>store.setDraft({hours:Number(event.target.value)})}><option value="1">Last hour</option><option value="6">Last 6 hours</option><option value="24">Last 24 hours</option><option value="72">Last 3 days</option><option value="168">Last 7 days</option><option value="720">Last 30 days</option><option value="0">No time bound</option></select></label>
            <label><span>Hashtag</span><input value={store.draft.hashtag} onChange={(event)=>store.setDraft({hashtag:event.target.value})} placeholder="optional, without #"/></label>
            <label className="event-filter"><span>Exact event ID</span><input value={store.draft.eventId} onChange={(event)=>store.setDraft({eventId:event.target.value})} placeholder="optional 64-character hex ID"/></label>
            <label className="author-filter"><span>Exact author public key</span><input value={store.draft.author} onChange={(event)=>store.setDraft({author:event.target.value})} placeholder="optional 64-character hex key"/></label>
            <label className="warning-filter"><input type="checkbox" checked={store.draft.excludeContentWarnings} onChange={(event)=>store.setDraft({excludeContentWarnings:event.target.checked})}/><span><strong>Exclude direct content warnings</strong><small>Applied before ingestion and budgets</small></span></label>
          </div>
          <div className="request-summary"><span>REQUEST SUMMARY</span><p>Ask <strong>{selected.length} selected relay{selected.length===1?'':'s'}</strong> for up to <strong>{store.draft.limit} kind-1 notes per relay</strong>{store.draft.search?` matching “${store.draft.search}”`:''}{store.draft.hours?` from the last ${store.draft.hours} hours`:''}{store.draft.eventId?' with one exact event ID':''}{store.draft.author?' by one exact author':''}{store.draft.hashtag?` tagged #${store.draft.hashtag.replace(/^#/u,'')}`:''}.</p><div className="selected-relay-summary">{selected.length?selected.map((relay)=><code key={relay.url}>{relay.url}</code>):<em>No relay selected</em>}</div><small>{store.draft.search?'Experimental NIP-50 uses one relay and Atlas displays matches newest-first; relay relevance order is not preserved.':'Structured filters remain exact request constraints.'}</small></div>
        </section>
      </div>
      <footer className="query-footer">
        <div className="query-status">
          {store.phase.type==='idle'&&<><i className={nip50RelayMismatch?'failed':'ready'}/><span>{nip50RelayMismatch?'Choose exactly one relay for experimental NIP-50 text search.':'Ready. Each installed field retains its own ordinary result handle.'}</span></>}
          {store.phase.type==='acquiring'&&<><i className="working"/><span>{store.phase.mode==='replace'?'Searching selected relays':store.phase.mode==='newer'?'Checking for newer notes':'Acquiring an older page'}…</span></>}
          {store.phase.type==='observing'&&<><i className="working"/><span>Displaying the explicit bounded buffer page…</span></>}
          {store.phase.type==='paging'&&<><i className="working"/><span>Loading the next explicit page from the buffer…</span></>}
          {store.phase.type==='failure'&&<><i className="failed"/><span>{store.phase.message}</span></>}
          {store.phase.type==='acquired'&&<><i className="ready"/><span><strong>{store.phase.count} identities buffered.</strong> {Number(completeness.excludedContentWarnings)||0} direct warnings excluded. Display has not been requested.</span></>}
        </div>
        <div className="query-buttons">
          {store.phase.type==='failure'&&<button className="query-secondary" onClick={store.resetPhase}>Revise search</button>}
          {store.phase.type==='acquired'?(store.phase.count>0?<button className="query-primary" onClick={store.observe}>{updateMode?'Display buffered update':`Display ${Math.min(20,store.phase.count)}${store.phase.count>20?` of ${store.phase.count}`:''} notes`}</button>:<button className="query-secondary" onClick={store.resetPhase}>No results · revise</button>):<button className="query-primary" disabled={busy||nip50RelayMismatch} onClick={store.acquire}>{store.phase.type==='acquiring'?'Working…':nip50RelayMismatch?'Choose one relay':'Search and update buffer'}</button>}
        </div>
      </footer>
      {store.phase.type==='acquired'&&<details className="command-disclosure"><summary>Inspect buffer command and outcome</summary><pre>{JSON.stringify({command:store.phase.command,acquisitionStage:store.phase.coverage},null,2)}</pre></details>}
      {(['acquiring','observing','paging','failure'].includes(store.phase.type))&&'command' in store.phase&&store.phase.command&&<details className="command-disclosure"><summary>Inspect visible command</summary><pre>{JSON.stringify(store.phase.command,null,2)}</pre></details>}
  </section>;
}
