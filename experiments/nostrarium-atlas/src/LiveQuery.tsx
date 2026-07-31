import { useEffect, useMemo, useRef } from 'react';
import { navigatorActions } from './actions';
import { selectAcquisition, selectAcquisitionOperation, useAtlasStore, type AcquisitionUiState, type NavigatorOperation } from './store';

export function LiveQueryButton() {
  const selected = useAtlasStore((state) => state.acquisition.relays.filter((relay) => relay.selected).length);
  return <button className="source-chip source-chip--button" onClick={() => navigatorActions.setAcquisitionPanel(true)}><i/> {selected} SOURCE{selected === 1 ? '' : 'S'} · DRAFT</button>;
}

export function LiveQueryPanel() {
  const acquisition = useAtlasStore(selectAcquisition);
  const operation = useAtlasStore(selectAcquisitionOperation);
  const navigatorBusy = useAtlasStore((state) => Object.entries(state.navigatorOperations).some(([key, item]) => key !== 'acquisition' && item.status === 'working'));
  const groundPlaceId = useAtlasStore((state) => state.groundPlaceId);
  return <LiveQueryPanelContent acquisition={acquisition} operation={operation} navigatorBusy={navigatorBusy} groundPlaceId={groundPlaceId}/>;
}

export function LiveQueryPanelContent({ acquisition, operation, navigatorBusy, groundPlaceId }: {
  acquisition: AcquisitionUiState;
  operation?: NavigatorOperation;
  navigatorBusy: boolean;
  groundPlaceId: string | null;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { if (acquisition.panelOpen) requestAnimationFrame(() => panel.current?.scrollIntoView({ block: 'start' })); }, [acquisition.panelOpen]);
  const visibleRelays = useMemo(() => {
    const search = acquisition.relaySearch.trim().toLowerCase();
    return search ? acquisition.relays.filter((relay) => relay.selected || `${relay.label} ${relay.url}`.toLowerCase().includes(search)) : acquisition.relays;
  }, [acquisition.relays, acquisition.relaySearch]);
  if (!acquisition.panelOpen) return null;
  const selected = acquisition.relays.filter((relay) => relay.selected);
  const busy = operation?.status === 'working' || navigatorBusy;
  const nip50RelayMismatch = Boolean(acquisition.draft.search.trim()) && selected.length !== 1;

  return <section ref={panel} className="query-panel" role="region" aria-labelledby="query-title">
    <header><div><span>INDEPENDENT ACQUISITION DRAFT</span><h2 id="query-title">{groundPlaceId ? 'Replace Ground explicitly' : 'Acquire Ground'}</h2><p>Editable engine-shaped parameters. Nothing contacts a relay until execution.</p></div><button disabled={busy} onClick={() => navigatorActions.setAcquisitionPanel(false)} aria-label="Close acquisition draft">×</button></header>
    <div className="query-columns">
      <section className="relay-column">
        <div className="query-section-title"><span>1</span><div><strong>Visible relay targets</strong><small>Never inherited invisibly from a place</small></div></div>
        <label className="relay-filter"><span aria-hidden="true">⌕</span><input aria-label="Filter relay list" value={acquisition.relaySearch} onChange={(event) => navigatorActions.setRelaySearch(event.target.value)} placeholder="Filter your relay list"/></label>
        <div className="relay-list">{visibleRelays.map((relay) => <label key={relay.url} className={relay.selected ? 'is-selected' : ''}><input type="checkbox" checked={relay.selected} onChange={() => navigatorActions.toggleRelay(relay.url)}/><span><strong>{relay.label}</strong><small>{relay.url}</small></span>{relay.custom && <button type="button" onClick={(event) => { event.preventDefault(); navigatorActions.removeRelay(relay.url); }} aria-label={`Remove ${relay.label}`}>Remove</button>}</label>)}</div>
        <div className="custom-relay"><label><span>Add custom relay</span><div><input value={acquisition.customRelay} onChange={(event) => navigatorActions.setCustomRelay(event.target.value)} placeholder="wss://relay.example"/><button onClick={navigatorActions.addRelay}>Add</button></div></label>{acquisition.customRelayError && <p>{acquisition.customRelayError}</p>}</div>
        <p className="query-boundary">No relay is ranked, substituted, retried, or contacted in the background.</p>
      </section>
      <section className="filter-column">
        <div className="query-section-title"><span>2</span><div><strong>Visible Nostr constraints and bounds</strong><small>The engine reports its effective normalized request after execution</small></div></div>
        <div className="filter-grid">
          <label className="text-search-filter nip50-filter"><span>Experimental NIP-50 text search</span><input value={acquisition.draft.search} onChange={(event) => navigatorActions.patchAcquisitionDraft({ search: event.target.value })} maxLength={200} placeholder="relay-side full-text search (NIP-50)"/><small>Requires exactly one relay. Relay matching remains unverified.</small></label>
          <label><span>NIP-01 filter limit</span><select aria-label="NIP-01 filter limit" disabled={!acquisition.draft.includeFilterLimit} value={acquisition.draft.limit} onChange={(event) => navigatorActions.patchAcquisitionDraft({ limit: Number(event.target.value) })}><option value="5">5</option><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select><small><input type="checkbox" checked={acquisition.draft.includeFilterLimit} onChange={(event) => navigatorActions.patchAcquisitionDraft({ includeFilterLimit: event.target.checked })}/> Include this filter constraint</small></label>
          <label><span>Time window</span><select value={acquisition.draft.hours} onChange={(event) => navigatorActions.patchAcquisitionDraft({ hours: Number(event.target.value) })}><option value="1">Last hour</option><option value="6">Last 6 hours</option><option value="24">Last 24 hours</option><option value="72">Last 3 days</option><option value="168">Last 7 days</option><option value="720">Last 30 days</option><option value="0">No time bound</option></select></label>
          <label><span>Hashtag</span><input value={acquisition.draft.hashtag} onChange={(event) => navigatorActions.patchAcquisitionDraft({ hashtag: event.target.value })} placeholder="optional, without #"/></label>
          <label className="event-filter"><span>Exact event ID</span><input value={acquisition.draft.eventId} onChange={(event) => navigatorActions.patchAcquisitionDraft({ eventId: event.target.value })} placeholder="optional 64-character hex ID"/></label>
          <label className="author-filter"><span>Exact author public key</span><input value={acquisition.draft.author} onChange={(event) => navigatorActions.patchAcquisitionDraft({ author: event.target.value })} placeholder="optional 64-character hex key"/></label>
          <label><span>Timeout ms</span><input aria-label="Acquisition timeout" type="number" min="100" max="60000" value={acquisition.draft.timeoutMs} onChange={(event) => navigatorActions.patchAcquisitionDraft({ timeoutMs: Number(event.target.value) })}/></label>
          <label><span>Observation bound</span><input aria-label="Acquisition observation bound" type="number" min="1" value={acquisition.draft.observationLimit} onChange={(event) => navigatorActions.patchAcquisitionDraft({ observationLimit: Number(event.target.value) })}/></label>
          <label><span>Distinct-event bound</span><input aria-label="Acquisition distinct-event bound" type="number" min="1" value={acquisition.draft.distinctEventLimit} onChange={(event) => navigatorActions.patchAcquisitionDraft({ distinctEventLimit: Number(event.target.value) })}/></label>
          <label><span>Concurrency</span><input aria-label="Acquisition concurrency" type="number" min="1" max="10" value={acquisition.draft.concurrency} onChange={(event) => navigatorActions.patchAcquisitionDraft({ concurrency: Number(event.target.value) })}/></label>
          <label className="warning-filter"><input type="checkbox" checked={acquisition.draft.excludeContentWarnings} onChange={(event) => navigatorActions.patchAcquisitionDraft({ excludeContentWarnings: event.target.checked })}/><span><strong>Exclude direct content warnings</strong><small>Configured acquisition exclusion; no per-event warning claim</small></span></label>
        </div>
        <div className="request-summary"><span>VISIBLE REQUEST DRAFT</span><p>Ask <strong>{selected.length} selected relay{selected.length === 1 ? '' : 's'}</strong> for kind-1 notes{acquisition.draft.includeFilterLimit ? <> under a <strong>{acquisition.draft.limit}-event NIP-01 filter limit</strong></> : ' with no NIP-01 filter limit'}{acquisition.draft.search ? ` matching “${acquisition.draft.search}”` : ''}{acquisition.draft.hours ? ` from the last ${acquisition.draft.hours} hours` : ''}{acquisition.draft.eventId ? ' with one exact event ID' : ''}{acquisition.draft.author ? ' by one exact author' : ''}{acquisition.draft.hashtag ? ` tagged #${acquisition.draft.hashtag.replace(/^#/u, '')}` : ''}.</p><div className="selected-relay-summary">{selected.length ? selected.map((relay) => <code key={relay.url}>{relay.url}</code>) : <em>No relay selected</em>}</div><small>Timeout {acquisition.draft.timeoutMs} ms · observation bound {acquisition.draft.observationLimit} · distinct-event bound {acquisition.draft.distinctEventLimit} · concurrency {acquisition.draft.concurrency} · no hidden older-draft constraints.</small></div>
      </section>
    </div>
    <footer className="query-footer"><div className="query-status">
      {!operation && !navigatorBusy && <><i className={nip50RelayMismatch ? 'failed' : 'ready'}/><span>{nip50RelayMismatch ? 'Choose exactly one relay for NIP-50.' : groundPlaceId ? 'Execution explicitly replaces Ground; the former place remains a branch.' : 'Success installs one never-replaced handle as Ground and current place.'}</span></>}
      {!operation && navigatorBusy && <><i className="working"/><span>Working: bounded research operation…</span></>}
      {operation?.status === 'working' && <><i className="working"/><span>{operation.stage === 'acquire' ? 'Executing explicit bounded acquisition and local first-page observation…' : `Working: ${operation.stage}…`}</span></>}
      {operation?.status === 'failure' && <><i className="failed"/><span>{operation.message}</span></>}
    </div><div className="query-buttons">{operation?.status === 'failure' && <button className="query-secondary" onClick={navigatorActions.resetAcquisitionFailure}>Revise draft</button>}<button className="query-primary" disabled={busy || nip50RelayMismatch || !selected.length} onClick={navigatorActions.acquireGround}>{operation?.status === 'working' && operation.stage === 'acquire' ? 'Acquiring…' : groundPlaceId ? 'Replace Ground with this acquisition' : 'Acquire and establish Ground'}</button></div></footer>
    {operation?.command && <details className="command-disclosure"><summary>Inspect visible command</summary><pre>{JSON.stringify(operation.command, null, 2)}</pre></details>}
  </section>;
}
