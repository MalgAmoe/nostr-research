import { useEffect, useMemo } from 'react';
import {
  accountProfilePresentation, accounts, fieldFor, fields, notes, notesFor, observationFor, profileForAccount,
  type Account, type AccountResearchState, type AttachmentFact, type MediaLoadState, type Note, type NoteObservation, type ProfileObservation,
} from './data';
import type { AuthorResolutionDraft, NoteRelationship, RelationshipActionDraft } from './live-types';
import { LiveQueryButton, LiveQueryPanel } from './LiveQuery';
import { useLiveStore } from './live-store';
import { currentPlaceId, useAtlasStore } from './store';

function Icon({ name, size = 18 }: { name: 'back' | 'forward' | 'search' | 'stream' | 'gallery' | 'pin' | 'reply' | 'account' | 'activity' | 'close'; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    back: <><path d="m15 18-6-6 6-6"/><path d="M9 12h10"/></>,
    forward: <><path d="m9 18 6-6-6-6"/><path d="M5 12h10"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    stream: <><path d="M5 6h14M5 12h14M5 18h14"/></>,
    gallery: <><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m4 16 4-4 3 3 3-4 6 6"/></>,
    pin: <><path d="m12 17-5 3 1-6-4-4 6-1 2-5 2 5 6 1-4 4 1 6z"/></>,
    reply: <><path d="m9 17-5-5 5-5"/><path d="M4 12h10a6 6 0 0 1 6 6"/></>,
    account: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    activity: <><path d="M4 12h3l2-6 4 12 2-6h5"/></>,
    close: <><path d="m7 7 10 10M17 7 7 17"/></>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Avatar({ account, size = 'medium' }: { account: Account; size?: 'small' | 'medium' | 'large' }) {
  return <span className={`avatar avatar--${size}`} style={{ '--avatar-color': account.color } as React.CSSProperties}>{account.name.slice(0, 1)}</span>;
}

function Header() {
  useAtlasStore((state) => state.fieldRevision);
  const historyIndex = useAtlasStore((state) => state.historyIndex);
  const historyLength = useAtlasStore((state) => state.history.length);
  const placeId = useAtlasStore(currentPlaceId);
  const back = useAtlasStore((state) => state.back);
  const forward = useAtlasStore((state) => state.forward);
  const setQuery = useAtlasStore((state) => state.setQuery);
  const field = fieldFor(placeId);
  const query = field.localConstraints.text;
  return <header className="atlas-header">
    <div className="brand"><span className="brand-mark">N</span><div><strong>Nostrarium</strong><small>Atlas</small></div></div>
    <div className="history-controls">
      <button aria-label="Go back" disabled={historyIndex === 0} onClick={back}><Icon name="back" /></button>
      <button aria-label="Go forward" disabled={historyIndex === historyLength - 1} onClick={forward}><Icon name="forward" /></button>
    </div>
    <div className="location-bar"><span>{field.role === 'ground' ? 'GROUND' : field.role === 'branch' ? 'BRANCH' : 'START'}</span><strong>{field.label}</strong><small>{field.handleId ? `${field.countingUnit} · rev ${field.installRevision}` : 'No engine handle'}</small></div>
    <label className="search-box"><Icon name="search" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter this place locally" aria-label="Filter this place locally" disabled={field.role === 'start'}/>{query && <button onClick={() => setQuery('')} aria-label="Clear filter"><Icon name="close" size={15}/></button>}</label>
    <LiveQueryButton />
  </header>;
}

function Sidebar() {
  useAtlasStore((state) => state.fieldRevision);
  const state = useAtlasStore();
  const currentId = useAtlasStore(currentPlaceId);
  const activate = useAtlasStore((store) => store.activatePlace);
  const remove = useAtlasStore((store) => store.removePlace);
  const openLiveQuery = useLiveStore((store) => store.setPanelOpen);
  const queryOpen = useLiveStore((store) => store.panelOpen);
  const places = Object.values(fields);
  return <nav className="sidebar" aria-label="Exploration">
    <div className="sidebar-title">CONTEXT</div>
    <button className="nav-item nav-item--live" onClick={() => openLiveQuery(!queryOpen)} aria-expanded={queryOpen}>
      <span className="nav-symbol">⌁</span><span><strong>{queryOpen ? 'Hide acquisition draft' : 'Open acquisition draft'}</strong><small>Independent relays, filters, and bounds</small></span>
    </button>
    <AccountFacets placeId={currentId}/>
    <LiveQueryPanel />
    <div className="sidebar-library">
      <div className="sidebar-section"><span>PLACES</span><b>{places.length}</b></div>
      <div className="place-list">
        {places.map((place) => <article key={place.id} className={place.id === currentId ? 'is-current' : ''}>
          <button onClick={() => activate(place.id)}><i/><span><strong>{place.label}</strong><small>{place.role.toUpperCase()} · {place.countingUnit} · {place.noteIds.length} displayed</small></span></button>
          {place.role === 'branch' && <button className="remove-place" aria-label={`Remove ${place.label} place reference`} title="Remove UI reference; engine handle is not released" onClick={() => remove(place.id)}>×</button>}
        </article>)}
        {!places.length && <p className="empty-state">The first successful explicit acquisition becomes Ground.</p>}
      </div>
      <div className="sidebar-section"><span>HISTORY</span><b>{state.history.filter((id) => id !== 'start').length}</b></div>
      <ol className="trail">{state.history.map((placeId, index) => placeId === 'start' || !fields[placeId] ? null : <li key={`${placeId}-${index}`}><button className={index === state.historyIndex ? 'is-current' : ''} onClick={() => state.jump(index)}><i/><span><strong>{fields[placeId].label}</strong><small>{fields[placeId].role} · selection {fields[placeId].selected.type}</small></span></button></li>)}</ol>
      <div className="sidebar-boundary"><i/> UI place removal never releases an engine handle<br/><span>Ground changes only through an explicit acquisition</span></div>
    </div>
  </nav>;
}

function Guide() {
  const visible = useAtlasStore((state) => state.guideVisible);
  const dismiss = useAtlasStore((state) => state.dismissGuide);
  if (!visible) return null;
  return <section className="guide" aria-label="Getting started"><span>START HERE</span><p><b>1.</b> Acquire Ground &nbsp;→&nbsp; <b>2.</b> Derive account frequency &nbsp;→&nbsp; <b>3.</b> Take a local or relay door</p><button onClick={dismiss} aria-label="Dismiss guide"><Icon name="close" size={16}/></button></section>;
}

function presenceFor(account: Account, local?: ProfileObservation) {
  return accountProfilePresentation(account, profileForAccount(account.id, local));
}

function ProfilePresenceAvatar({ account, placeId, size = 'medium' }: { account: Account; placeId: string; size?: 'small' | 'medium' | 'large' }) {
  useAtlasStore((state) => state.fieldRevision);
  const profile = profileForAccount(account.id);
  const presentation = presenceFor(account, profile);
  const url = presentation.picture;
  const mediaKey = `profile:${account.id}`;
  const status = url ? fieldFor(placeId).mediaLoads?.[mediaKey]?.[url] ?? 'placeholder' : 'placeholder';
  const setMediaLoad = useAtlasStore((state) => state.setMediaLoad);
  if (!url) return <Avatar account={account} size={size}/>;
  if (status === 'loaded') return <span className={`presence-avatar avatar--${size}`}><img src={url} alt={`Relay-observed profile picture claimed for ${presentation.name}`} referrerPolicy="no-referrer" onError={() => setMediaLoad(placeId, mediaKey, url, 'failed')}/><small>relay-observed</small></span>;
  if (status === 'failed') return <span className="presence-avatar is-failed"><Avatar account={account} size={size}/><small>picture failed</small><code>{url}</code></span>;
  return <span className="presence-avatar"><Avatar account={account} size={size}/><button onClick={(event) => { event.stopPropagation(); setMediaLoad(placeId, mediaKey, url, 'loaded'); }}>Load relay-observed picture</button><code>{url}</code></span>;
}

function AuthorButton({ accountId, placeId }: { accountId: string; placeId: string }) {
  const account = accounts[accountId];
  const presentation = presenceFor(account);
  const inspect = useAtlasStore((state) => state.inspectAccount);
  return <div className="author-presence"><ProfilePresenceAvatar account={account} placeId={placeId} size="medium"/><button className="author-button" onClick={(event) => { event.stopPropagation(); inspect(accountId); }}><span><strong>{presentation.name}</strong><small>{account.handle} · public key available</small>{presentation.state === 'observed' && <em>{presentation.attribution}</em>}</span></button></div>;
}

const RICH_TOKEN = /(https?:\/\/[^\s<>"']+|nostr:[^\s<>"']+|(?:npub1|note1|nevent1|nprofile1|naddr1)[0-9a-z]+|#[\p{L}\p{N}_]+)/giu;
export function RichText({ text }: { text: string }) {
  return <p className="rich-note-text">{text.split(RICH_TOKEN).map((part, index) => {
    if (/^https?:\/\//iu.test(part)) {
      try { const url = new URL(part); return <a key={index} href={url.href} target="_blank" rel="noreferrer noopener" onClick={(event) => event.stopPropagation()}>{part}</a>; } catch { return part; }
    }
    if (/^#/u.test(part)) return <span className="rich-hashtag" key={index}>{part}</span>;
    if (/^(?:nostr:|npub1|note1|nevent1|nprofile1|naddr1)/iu.test(part)) return <code className="rich-nostr-reference" key={index}>{part}</code>;
    return part;
  })}</p>;
}

function attachmentFamily(attachment: AttachmentFact) {
  return attachment.families.find((family) => ['image', 'video', 'audio'].includes(family)) ?? attachment.families[0] ?? 'unknown';
}

export function AttachmentResource({ attachment, noteId, placeId }: { attachment: AttachmentFact; noteId: string; placeId: string }) {
  useAtlasStore((state) => state.fieldRevision);
  const setMediaLoad = useAtlasStore((state) => state.setMediaLoad);
  const status: MediaLoadState = fieldFor(placeId).mediaLoads?.[noteId]?.[attachment.url] ?? 'placeholder';
  const family = attachmentFamily(attachment);
  const metadata = [attachment.classification, ...attachment.mimeTypes, attachment.width && attachment.height ? `${attachment.width}×${attachment.height}` : '', attachment.durationSeconds !== undefined ? `${attachment.durationSeconds}s` : '', ...attachment.sources.map((source) => `source:${source}`)].filter(Boolean);
  if (status === 'failed') return <section className="attachment-resource is-failed"><strong>{family.toUpperCase()} LOAD FAILED</strong><code>{attachment.url}</code><small>{metadata.join(' · ') || 'No additional factual metadata'}</small></section>;
  if (status !== 'loaded') return <section className="attachment-resource"><strong>REMOTE {family.toUpperCase()} PLACEHOLDER</strong><code>{attachment.url}</code><small>{metadata.join(' · ') || 'No additional factual metadata'}</small>{attachment.hashes.length > 0 && <small>Hashes: {attachment.hashes.join(' · ')}</small>}<button onClick={() => setMediaLoad(placeId, noteId, attachment.url, 'loaded')}>Load this {family} resource</button></section>;
  const failed = () => setMediaLoad(placeId, noteId, attachment.url, 'failed');
  return <figure className="attachment-loaded">
    {family === 'image' ? <img src={attachment.url} alt={attachment.alt ?? 'External image referenced by this note'} referrerPolicy="no-referrer" onError={failed}/>
      : family === 'video' ? <video src={attachment.url} controls preload="metadata" onError={failed}/>
        : family === 'audio' ? <audio src={attachment.url} controls preload="metadata" onError={failed}/>
          : <a href={attachment.url} target="_blank" rel="noreferrer noopener">Open explicitly loaded external file</a>}
    <figcaption>Explicit external load · {metadata.join(' · ')}</figcaption>
  </figure>;
}

function NoteAttachments({ note, placeId }: { note: Note; placeId: string }) {
  if (!note.attachments?.length) return null;
  return <div className="note-attachments">{note.attachments.map((attachment) => <AttachmentResource key={attachment.url} attachment={attachment} noteId={note.id} placeId={placeId}/>)}</div>;
}

function NoteCard({ note, selected, placeId }: { note: Note; selected: boolean; placeId: string }) {
  const select = useAtlasStore((state) => state.selectNote);
  return <article className={`note-card ${selected ? 'is-selected' : ''}`} data-note-id={note.id}>
    <header><AuthorButton accountId={note.authorId} placeId={placeId}/><time>{note.createdAt}</time></header>
    {(note.conversationRole || note.contentRole) && <div className="note-role-context">{note.conversationRole && <span>CONVERSATION · {note.conversationRole}</span>}{note.contentRole && <span>ROLE · {note.contentRole}</span>}</div>}
    <div className="note-body"><RichText text={note.content}/><NoteAttachments note={note} placeId={placeId}/><button className="select-note-action" onClick={() => select(note.id)} aria-label={`Select note by ${presenceFor(accounts[note.authorId]).name}`}>Select exact note evidence</button></div>
    <footer><button onClick={() => select(note.id)}><span className="note-dot"/> {note.id}</button><span>kind 1</span><span>{note.relayCount} observed relay{note.relayCount === 1 ? '' : 's'}</span></footer>
  </article>;
}

function StreamView({ visibleNotes, selectedId, placeId }: { visibleNotes: Note[]; selectedId: string | null; placeId: string }) {
  return <div className="stream-view">{visibleNotes.map((note) => <NoteCard key={note.id} note={note} selected={note.id === selectedId} placeId={placeId}/>)}</div>;
}

function GalleryView({ visibleNotes, selectedId, placeId }: { visibleNotes: Note[]; selectedId: string | null; placeId: string }) {
  const select = useAtlasStore((state) => state.selectNote);
  const media = visibleNotes.filter((note) => note.attachments?.length);
  if (!media.length) return <div className="no-results"><Icon name="gallery" size={28}/><strong>No factual media references in this bounded place</strong><span>Stream still shows readable notes. Selecting a note may expose normalized attachment facts.</span></div>;
  return <div className="gallery-view">{media.map((note) => <article key={note.id} className={note.id === selectedId ? 'is-selected' : ''}><span className="gallery-type">{note.attachments!.map(attachmentFamily).join(' · ')}</span><AuthorButton accountId={note.authorId} placeId={placeId}/><RichText text={note.content}/><NoteAttachments note={note} placeId={placeId}/><button onClick={() => select(note.id)}>Select exact note evidence</button></article>)}</div>;
}

function AccountListView({ placeId }: { placeId: string }) {
  useAtlasStore((state) => state.fieldRevision);
  const place = fieldFor(placeId);
  const select = useAtlasStore((state) => state.inspectAccount);
  const projection = place.accountProjection;
  if (!projection || projection.status === 'loading') return <div className="no-results"><Icon name="account" size={28}/><strong>Deriving account-list projection locally…</strong><span>No relay is contacted and the place handle remains unchanged.</span></div>;
  if (projection.status === 'failure') return <div className="no-results"><Icon name="account" size={28}/><strong>Account-list projection unavailable</strong><span>{projection.error}</span></div>;
  return <section className="account-list-projection">
    <header><span>ACCOUNT LIST · {projection.countUnit?.toUpperCase()}</span><strong>{projection.accountIds.length} displayed accounts</strong><small>Supporting handle {projection.handleId} · installed revision {projection.installRevision}</small></header>
    <div>{projection.accountIds.map((id) => <button key={id} className={place.selected.type === 'account' && place.selected.id === id ? 'is-selected' : ''} onClick={() => select(id)}><Avatar account={accounts[id]} size="medium"/><span><strong>{presenceFor(accounts[id]).name}</strong><small>{id} · {presenceFor(accounts[id]).state === 'observed' ? 'relay-observed profile claim' : 'public-key fallback'}</small></span><b>{place.accountResearch[id]?.localStatus ?? 'unobserved'}</b></button>)}</div>
    <details className="command-disclosure"><summary>Projection command, handle, bounds, and omissions</summary><pre>{JSON.stringify(projection, null, 2)}</pre></details>
  </section>;
}

function AccountFacets({ placeId }: { placeId: string }) {
  useAtlasStore((state) => state.fieldRevision);
  const place = fieldFor(placeId);
  const phase = useLiveStore((state) => state.phase);
  const derive = useLiveStore((state) => state.deriveAccountFacet);
  const openNotes = useLiveStore((state) => state.openAccountNotes);
  const prepare = useLiveStore((state) => state.prepareAccountResearch);
  const selectFacet = useAtlasStore((state) => state.selectAccountFacet);
  const facet = place.accountFacet;
  if (place.role !== 'ground' && !facet) return null;
  return <section className="facet-panel" aria-label="Account frequency within retained source place">
    <header><div><span>BOUNDED FACET · LOCAL</span><h2>Accounts in {place.role === 'ground' ? 'Ground' : 'retained source place'}</h2><p>Counts event rows in this immutable source handle only. No activity, importance, or quality claim.</p></div>{place.role === 'ground' && (!facet || facet.status === 'idle' || facet.status === 'failure') && <button disabled={phase.type === 'working'} onClick={() => derive(placeId)}>{facet?.status === 'failure' ? 'Retry derivation' : 'Derive account frequency'}</button>}</header>
    {facet?.status === 'loading' && <p className="facet-status">Running visible relate → aggregate → sort observations locally…</p>}
    {facet?.status === 'failure' && <p className="facet-status is-error">{facet.error}</p>}
    {facet?.status === 'available' && <>
      <div className="facet-meta"><span>{facet.records.length} displayed {facet.countUnit ?? 'rows'}</span><span>{facet.truncated ? 'TRUNCATED' : 'No declared truncation'}</span><span>Source {shortId(facet.sourceHandleId)}</span></div>
      <div className="facet-rows">{facet.records.map((record) => <article key={record.account} className={place.selectedFacet === record.account ? 'is-selected' : ''}>
        <button className="facet-subject" onClick={() => selectFacet(record.account)}><Avatar account={accounts[record.account]} size="small"/><span><strong>{accounts[record.account] ? presenceFor(accounts[record.account]).name : shortId(record.account)}</strong><small>{record.account}{accounts[record.account] && presenceFor(accounts[record.account]).state === 'observed' ? ' · relay-observed profile claim' : ''}</small></span><b>{record.noteCount} notes</b></button>
        <div><button disabled={phase.type === 'working'} onClick={() => openNotes(placeId, record.account)}>Local · Notes here by this account</button><button onClick={() => prepare(placeId, record.account)}>Draft · Research this account on relays</button></div>
      </article>)}</div>
      <details className="command-disclosure"><summary>Facet commands, handles, lineage, bounds, and omissions</summary><pre>{JSON.stringify({commands: facet.commands, handles: facet.handles, countUnit: facet.countUnit, bounds: facet.bounds, truncated: facet.truncated, omissions: facet.omissions, lineage: facet.records[0]?.lineage}, null, 2)}</pre></details>
    </>}
  </section>;
}

function AuthorResolutionPanel({ placeId }: { placeId: string }) {
  useAtlasStore((state) => state.fieldRevision);
  const place = fieldFor(placeId);
  const prepare = useLiveStore((state) => state.prepareAuthorResolution);
  const update = useLiveStore((state) => state.updateAuthorResolutionDraft);
  const execute = useLiveStore((state) => state.resolveAuthors);
  const phase = useLiveStore((state) => state.phase);
  const state = place.authorResolution;
  if (place.role === 'start') return null;
  if (!state?.draftOpen) return <section className="author-resolution-panel"><span>ATTRIBUTED ACCOUNT PRESENCE · EXPLICIT</span><button onClick={() => prepare(placeId)}>Resolve authors in this place</button><small>Prepares move authors → hydrate kind 0. No request runs until confirmation.</small>{state?.attempt && <AuthorResolutionResult attempt={state.attempt}/>}</section>;
  const draft = state.draft;
  const patch = (value: Partial<AuthorResolutionDraft>) => update(placeId, value);
  return <section className="author-resolution-panel is-open">
    <header><div><span>RESOLVE AUTHORS IN THIS PLACE · DRAFT</span><strong>move authors → hydrate kind 0</strong></div><small>Editable bounded request</small></header>
    <label>Relay targets<textarea aria-label="Author resolution relay targets" value={draft.relays.join('\n')} onChange={(event) => patch({ relays: event.target.value.split(/[\s,]+/u).filter(Boolean) })}/></label>
    <div className="compact-draft-fields"><label>Author limit<input aria-label="Author resolution limit" type="number" min="1" max="20" value={draft.authorLimit} onChange={(event) => patch({ authorLimit: Number(event.target.value) })}/></label><label>Timeout ms<input type="number" min="100" max="60000" value={draft.timeoutMs} onChange={(event) => patch({ timeoutMs: Number(event.target.value) })}/></label><label>Observation bound<input type="number" min="1" value={draft.observationLimit} onChange={(event) => patch({ observationLimit: Number(event.target.value) })}/></label><label>Distinct-event bound<input type="number" min="1" value={draft.distinctEventLimit} onChange={(event) => patch({ distinctEventLimit: Number(event.target.value) })}/></label><label>Concurrency<input type="number" min="1" max="10" value={draft.concurrency} onChange={(event) => patch({ concurrency: Number(event.target.value) })}/></label></div>
    <label className="draft-warning"><input type="checkbox" checked={draft.excludeContentWarnings} onChange={(event) => patch({ excludeContentWarnings: event.target.checked })}/> Preserve configured direct-warning exclusion</label>
    <button className="external-action" disabled={!draft.relays.length || phase.type === 'working'} onClick={() => execute(placeId)}>Execute bounded author resolution</button>
    <p>No hydration occurs on acquisition, selection, scrolling, paging, or branch activation.</p>
    {state.attempt && <AuthorResolutionResult attempt={state.attempt}/>}
  </section>;
}

function AuthorResolutionResult({ attempt }: { attempt: NonNullable<NonNullable<ReturnType<typeof fieldFor>['authorResolution']>['attempt']> }) {
  return <section className={`author-resolution-result is-${attempt.status}`}><strong>{attempt.status.toUpperCase()}</strong><span>{attempt.authorCount ?? 0} bounded authors · {attempt.resolvedCount ?? 0} resolved · {attempt.unresolvedCount ?? 0} unresolved · {attempt.failedCount ?? 0} failed</span>{attempt.authorBoundarySized && <span>AUTHOR WINDOW REACHED ITS CONFIGURED BOUNDARY</span>}{attempt.error && <p>{attempt.error}</p>}<small>Author handle {attempt.authorHandleId ?? 'unavailable'} · profile-event handle {attempt.supportingHandleId ?? 'unavailable'}</small>{attempt.commands && <details className="command-disclosure"><summary>Commands, author bounds, omissions, completeness, and external facts</summary><pre>{JSON.stringify({ commands: attempt.commands, authorBounds: attempt.authorBounds, authorOmissions: attempt.authorOmissions, authorBoundarySized: attempt.authorBoundarySized, completeness: attempt.completeness, external: attempt.external }, null, 2)}</pre></details>}</section>;
}

function FieldContent() {
  useAtlasStore((state) => state.fieldRevision);
  const placeId = useAtlasStore(currentPlaceId);
  const setView = useAtlasStore((state) => state.setView);
  const openLiveQuery = useLiveStore((state) => state.setPanelOpen);
  const livePhase = useLiveStore((state) => state.phase);
  const showMore = useLiveStore((state) => state.showMore);
  const openAccountProjection = useLiveStore((state) => state.openAccountProjection);
  const field = fieldFor(placeId);
  const location = { fieldId: placeId, target: field.selected };
  const query = field.localConstraints.text.trim().toLowerCase();
  const fieldNotes = notesFor(placeId);
  const visibleNotes = useMemo(() => !query ? fieldNotes : fieldNotes.filter((note) => `${note.content} ${accounts[note.authorId].name} ${note.tags?.join(' ') ?? ''}`.toLowerCase().includes(query)), [fieldNotes, query]);
  const selectedId = location.target.type === 'note' ? location.target.id : null;
  const active = field.runtime;
  return <section className="field-content">
    <Guide/>
    <div className="field-heading"><div><span>CURRENT PLACE · {field.role.toUpperCase()}</span><h1>{field.label}</h1><p>{field.description}</p></div><div className="view-tabs" role="group" aria-label="Place projection"><button aria-pressed={field.projection === 'stream'} className={field.projection === 'stream' ? 'is-active' : ''} onClick={() => setView('stream')}><Icon name="stream"/> Stream</button><button aria-pressed={field.projection === 'gallery'} className={field.projection === 'gallery' ? 'is-active' : ''} onClick={() => setView('gallery')}><Icon name="gallery"/> Gallery</button><button aria-pressed={field.projection === 'accounts'} className={field.projection === 'accounts' ? 'is-active' : ''} disabled={field.role === 'start' || livePhase.type === 'working'} onClick={() => openAccountProjection(placeId)}><Icon name="account"/> Accounts</button></div></div>
    {field.role !== 'start' && <AuthorResolutionPanel placeId={placeId}/>}
    {field.role !== 'start' && <section className="place-orientation"><div><span>HANDLE</span><code>{field.handleId}</code></div><div><span>INSTALLED</span><strong>revision {field.installRevision} · never replaced</strong></div><div><span>REASON</span><strong>{field.navigatorReason}</strong></div><details><summary>Origin, bounds, omissions, and resolution</summary><pre>{JSON.stringify({command: field.originCommand, receipt: field.originReceipt, bounds: field.declaredBounds, omissions: field.declaredOmissions, evidenceResolution: field.evidenceResolution}, null, 2)}</pre></details></section>}
    <div className="result-line"><strong>{field.projection === 'accounts' ? field.accountProjection?.accountIds.length ?? 0 : visibleNotes.length}</strong> displayed {field.projection === 'accounts' ? field.accountProjection?.countUnit ?? 'accounts' : field.countingUnit}{query && field.projection !== 'accounts' && <span> · visible local constraint “{query}”</span>}</div>
    {field.projection === 'accounts' ? <AccountListView placeId={placeId}/> : !fieldNotes.length ? <div className="no-results live-start"><span className="live-start-mark">⌁</span><strong>{field.role === 'start' ? 'No Ground yet' : 'No displayed event subjects'}</strong><span>{field.role === 'start' ? 'Select relays and explicit request bounds to begin.' : 'The handle remains a valid bounded place even when its preview is empty.'}</span>{field.role === 'start' && <button onClick={() => openLiveQuery(true)}>Open acquisition draft</button>}</div> : visibleNotes.length ? <>{field.projection === 'stream' && <StreamView visibleNotes={visibleNotes} selectedId={selectedId} placeId={placeId}/>} {field.projection === 'gallery' && <GalleryView visibleNotes={visibleNotes} selectedId={selectedId} placeId={placeId}/>}</> : <div className="no-results"><Icon name="search" size={28}/><strong>No matching displayed notes</strong><span>This interface-only constraint did not alter the handle or contact a relay.</span></div>}
    {active && <div className="field-live-actions"><div><span>LOCAL HANDLE PAGE</span><strong>{active.nextOffset} of {active.total} event identities observed</strong><small>Paging this immutable handle is local. It cannot broaden the relay request.</small></div><div><button disabled={livePhase.type !== 'idle' || active.nextOffset >= active.total} onClick={showMore}>Load more from this handle</button></div>{livePhase.type === 'failure' && livePhase.stage === 'page' && <p className="is-error">{livePhase.message}</p>}</div>}
  </section>;
}

const NOTE_RELATIONSHIPS: Array<{ value: NoteRelationship; label: string }> = [
  { value: 'ancestors', label: 'Parent / ancestors' }, { value: 'replies', label: 'Replies' },
  { value: 'quotes', label: 'Quoted events' }, { value: 'mentions', label: 'Mentioned events' },
  { value: 'referenced-events', label: 'Referenced events' },
];

function RelationshipDraft({ placeId, noteId, draft }: { placeId: string; noteId: string; draft: RelationshipActionDraft }) {
  const update = useLiveStore((state) => state.updateNoteRelationshipDraft);
  const execute = useLiveStore((state) => state.requestNoteRelationship);
  const phase = useLiveStore((state) => state.phase);
  const patch = (value: Partial<RelationshipActionDraft>) => update(placeId, noteId, value);
  return <section className="relationship-draft">
    <span>NOTE RELATIONSHIP · RELAY DRAFT</span>
    <label>Exact relationship<select aria-label="Note relationship" value={draft.relationship} onChange={(event) => patch({ relationship: event.target.value as NoteRelationship })}>{NOTE_RELATIONSHIPS.map((route) => <option value={route.value} key={route.value}>{route.label}</option>)}</select></label>
    <label>Relay targets<textarea aria-label="Relationship relay targets" value={draft.relays.join('\n')} onChange={(event) => patch({ relays: event.target.value.split(/[\s,]+/u).filter(Boolean) })}/></label>
    <div className="compact-draft-fields"><label>Event limit<input aria-label="Relationship event limit" type="number" min="1" max="100" value={draft.eventLimit} onChange={(event) => patch({ eventLimit: Number(event.target.value) })}/></label><label>Timeout ms<input type="number" min="100" max="60000" value={draft.timeoutMs} onChange={(event) => patch({ timeoutMs: Number(event.target.value) })}/></label><label>Observation bound<input type="number" min="1" value={draft.observationLimit} onChange={(event) => patch({ observationLimit: Number(event.target.value) })}/></label><label>Distinct-event bound<input type="number" min="1" value={draft.distinctEventLimit} onChange={(event) => patch({ distinctEventLimit: Number(event.target.value) })}/></label><label>Concurrency<input type="number" min="1" max="10" value={draft.concurrency} onChange={(event) => patch({ concurrency: Number(event.target.value) })}/></label></div>
    <label className="draft-warning"><input type="checkbox" checked={draft.excludeContentWarnings} onChange={(event) => patch({ excludeContentWarnings: event.target.checked })}/> Preserve configured direct-warning exclusion</label>
    <button className="external-action" disabled={!draft.relays.length || phase.type === 'working'} onClick={() => execute(placeId, noteId)}>Execute relay continuation and open branch</button>
    <small>Ordinary continue source=relays. Bounded empty results still open an immutable branch.</small>
  </section>;
}

function NoteDoors({ note, placeId, observation }: { note: Note; placeId: string; observation: NoteObservation }) {
  useAtlasStore((state) => state.fieldRevision);
  const selectExact = useAtlasStore((state) => state.selectExactSubject);
  const openLocal = useLiveStore((state) => state.openLocalNoteRelationship);
  const prepare = useLiveStore((state) => state.prepareNoteRelationship);
  const phase = useLiveStore((state) => state.phase);
  const research = fieldFor(placeId).noteResearch?.[note.id];
  return <section className="note-doors">
    <header><span>TYPED NOTE DOORS</span><p>Exact subjects select locally. Sets open ordinary never-replaced branches. No route is recommended.</p></header>
    <div className="exact-subject-groups">
      {observation.referencedEvents?.length ? <div><strong>Referenced events · exact selection</strong>{observation.referencedEvents.map((id) => <button key={id} onClick={() => selectExact('note', id)}>{notes[id] ? 'Known event' : 'Unresolved event'} · {shortId(id)}</button>)}</div> : null}
      {observation.referencedAccounts?.length ? <div><strong>Mentioned / referenced accounts · exact selection</strong>{observation.referencedAccounts.map((id) => <button key={id} onClick={() => selectExact('account', id)}>{accounts[id] ? presenceFor(accounts[id]).name : shortId(id)} · {shortId(id)}</button>)}</div> : null}
      {observation.referencedAddresses?.length ? <div><strong>Referenced addresses · exact selection</strong>{observation.referencedAddresses.map((id) => <button key={id} onClick={() => selectExact('address', id)}>Address · {shortId(id)}</button>)}</div> : null}
    </div>
    <div className="relationship-routes">{NOTE_RELATIONSHIPS.map((route) => {
      const attempts = research?.attempts[route.value];
      return <article key={route.value}><strong>{route.label}</strong><code>continue · {route.value} · source local · eventLimit {research?.relationshipDraft.eventLimit ?? 20}</code><div><button disabled={!observation.eventHandleId || phase.type === 'working'} onClick={() => openLocal(placeId, note.id, route.value)}>Open bounded local branch</button><button disabled={!observation.eventHandleId} onClick={() => prepare(placeId, note.id, route.value)}>Prepare relay draft</button></div>{(['local', 'relays'] as const).map((source) => { const attempt = attempts?.[source]; return attempt ? <small key={source} className={`attempt-${attempt.status}`}>{source.toUpperCase()} · {attempt.status.toUpperCase()} · {attempt.count ?? 0} events · handle {attempt.handleId ?? 'unavailable'}</small> : null; })}</article>;
    })}</div>
    {research?.draftOpen && <RelationshipDraft placeId={placeId} noteId={note.id} draft={research.relationshipDraft}/>}
    <details className="command-disclosure"><summary>Relationship evidence bounds and retained handles</summary><pre>{JSON.stringify({ eventHandleId: observation.eventHandleId, referencedEvents: observation.referencedEvents, referencedAccounts: observation.referencedAccounts, referencedAddresses: observation.referencedAddresses, relationshipsOmitted: observation.relationshipsOmitted, bounds: observation.bounds, attempts: research?.attempts }, null, 2)}</pre></details>
  </section>;
}

function NoteInspector({ note, placeId }: { note: Note; placeId: string }) {
  useAtlasStore((state) => state.fieldRevision);
  const account = accounts[note.authorId];
  const inspectAccount = useAtlasStore((state) => state.inspectAccount);
  const pinned = useAtlasStore((state) => state.pinnedNoteIds.includes(note.id));
  const togglePin = useAtlasStore((state) => state.toggleNotePin);
  const observeNote = useLiveStore((state) => state.observeNote);
  const field = fieldFor(placeId);
  const observation = observationFor<NoteObservation>(placeId, 'note', note.id);
  useEffect(() => { if (!observation) void observeNote(note.id, placeId); }, [note.id, observation, observeNote, placeId]);
  const relationshipGroups = observation ? [['Referenced events', observation.referencedEvents], ['Referenced accounts', observation.referencedAccounts], ['Referenced addresses', observation.referencedAddresses]] as const : [];
  return <div className="inspector-body note-context">
    <div className="inspector-kicker">SELECTED NOTE <span>LOCAL OBSERVATION</span></div>
    <button className="inspector-author" onClick={() => inspectAccount(note.authorId)}><Avatar account={account} size="large"/><span><strong>{presenceFor(account).name}</strong><small>{account.handle} · {presenceFor(account).state === 'observed' ? presenceFor(account).attribution : 'public-key fallback'}</small></span><b>Select exact author locally →</b></button>
    <section className="event-identifiers"><div><span>EVENT ID</span><code>{note.id}</code></div><div><span>AUTHOR PUBLIC KEY</span><code>{account.publicKey}</code></div></section>
    {(!observation || observation.status === 'loading') && <div className="local-evidence-status is-loading"><strong>Reading bounded known evidence…</strong><span>The selection gesture authorized disclosed local commands; no relay is contacted.</span></div>}
    {observation?.status === 'failure' && <div className="local-evidence-status is-error"><strong>Local observation failed</strong><span>{observation.error}</span><button onClick={() => observeNote(note.id, placeId)}>Retry local observation</button></div>}
    {observation?.status === 'unresolved' && <div className="local-evidence-status is-unresolved"><strong>Evidence unresolved</strong><span>The place identifies this event, but canonical evidence is not currently resident or preserved.</span></div>}
    {observation && ['available', 'unresolved'].includes(observation.status) && <>
      <section className="evidence-section"><span>CONTENT · {observation.contentState?.toUpperCase()}</span>{observation.contentState === 'unavailable' ? <p>Canonical content was unavailable in this bounded observation.</p> : <p className="canonical-content">{observation.content}</p>}<small>{observation.contentState === 'returned' ? 'A bounded public excerpt was returned; Atlas does not claim canonical completeness.' : observation.contentState === 'boundary-sized' ? 'Reached the public 1,000-character bound and may be truncated.' : 'No content was returned.'}</small></section>
      <div className="fact-grid"><div><span>RESOLUTION</span><strong>{observation.resolution?.resolved ? observation.resolution.source ?? 'resolved' : 'unresolved'}</strong></div><div><span>ROLE</span><strong>{observation.role ?? 'not provided'}</strong></div><div><span>CONVERSATION</span><strong>{observation.conversationRole ?? 'not provided'}</strong></div><div><span>SOURCE HANDLE</span><strong>{shortId(field.handleId)}</strong></div></div>
      {observation.tags && <section className="evidence-section"><span>BOUNDED CANONICAL TAGS · {observation.tags.length}{observation.omittedTags ? ` + ${observation.omittedTags} omitted` : ''}</span><div className="tag-evidence">{observation.tags.map((tag, index) => <code key={index}>{JSON.stringify(tag)}</code>)}</div></section>}
      {relationshipGroups.some(([, ids]) => ids?.length) && <section className="evidence-section"><span>RELATIONSHIPS · BOUNDED{observation.relationshipsOmitted ? ` · ${observation.relationshipsOmitted} OMITTED` : ''}</span>{relationshipGroups.map(([label, ids]) => ids?.length ? <div className="relationship-evidence" key={label}><strong>{label}</strong>{ids.map((id) => <code key={id}>{id}</code>)}</div> : null)}</section>}
      {observation.attachments && <section className="evidence-section"><span>NORMALIZED ATTACHMENTS · {observation.attachments.length}{observation.attachmentsOmitted ? ` + ${observation.attachmentsOmitted} omitted` : ''}</span>{observation.attachments.map((attachment, index) => <div className="attachment-evidence" key={index}><code>{String(attachment.url ?? 'URL unavailable')}</code><small>{String(attachment.classification ?? '')}</small></div>)}</section>}
      {observation.observedRelays?.length ? <div className="observed-relays"><span>OBSERVED VIA DURING THIS SESSION</span>{observation.observedRelays.map((relay) => <code key={relay}>{relay}</code>)}</div> : null}
      {(observation.provenance || observation.bounds) && <details className="evidence-details"><summary>Attributed provenance and response bounds</summary><pre>{JSON.stringify({provenance: observation.provenance, bounds: observation.bounds}, null, 2)}</pre></details>}
      <NoteDoors note={note} placeId={placeId} observation={observation}/>
    </>}
    <NoteAttachments note={note} placeId={placeId}/><div className="inspector-actions"><button className={pinned ? 'secondary-action is-pinned' : 'secondary-action'} onClick={() => togglePin(note.id)}><Icon name="pin"/> {pinned ? 'Pinned' : 'Pin note'}</button></div>
    <ObservationDisclosure placeId={placeId} type="note" id={note.id}/>
    <p className="inspector-boundary">Selection retained this place, projection, page offset, facets, constraints, and acquisition draft.</p>
  </div>;
}

function ProfilePictureClaim({ url, name, placeId, accountId }: { url: string; name: string; placeId?: string; accountId: string }) {
  useAtlasStore((state) => state.fieldRevision);
  const setMediaLoad = useAtlasStore((state) => state.setMediaLoad);
  const mediaKey = `profile:${accountId}`;
  const status = placeId ? fieldFor(placeId).mediaLoads?.[mediaKey]?.[url] ?? 'placeholder' : 'placeholder';
  if (status === 'placeholder') return <div className="profile-picture-claim"><span>RELAY-OBSERVED PICTURE CLAIM</span><code>{url}</code><button onClick={() => placeId && setMediaLoad(placeId, mediaKey, url, 'loaded')}>Load claimed profile picture</button></div>;
  if (status === 'failed') return <div className="profile-picture-claim is-failed"><span>PROFILE PICTURE UNAVAILABLE</span><code>{url}</code></div>;
  return <figure className="profile-picture-observation"><img src={url} alt={`Relay-observed profile picture claimed for ${name}`} referrerPolicy="no-referrer" onError={() => placeId && setMediaLoad(placeId, mediaKey, url, 'failed')}/><figcaption>External image from an attributed relay-observed profile claim</figcaption></figure>;
}

export function AccountProfileHeader({ account, profile, placeId }: { account: Account; profile?: ProfileObservation; placeId?: string }) {
  const presentation = accountProfilePresentation(account, profile);
  return <section className={`account-profile-header is-${presentation.state}`}>
    <Avatar account={account} size="large"/><h2>{presentation.name}</h2><span className="account-handle">{account.handle}</span>
    <strong className="profile-attribution">{presentation.attribution}</strong>
    <p className="account-about">{presentation.about}</p>
    {presentation.picture && <ProfilePictureClaim url={presentation.picture} name={presentation.name} placeId={placeId} accountId={account.id}/>}
  </section>;
}

function DraftFields({ kind, state, placeId, accountId }: { kind: 'profile' | 'authored'; state: AccountResearchState; placeId: string; accountId: string }) {
  const updateProfile = useLiveStore((store) => store.updateProfileDraft);
  const updateAuthored = useLiveStore((store) => store.updateAuthoredDraft);
  const draft = kind === 'profile' ? state.profileDraft : state.authoredDraft;
  const update = (patch: Record<string, unknown>) => kind === 'profile'
    ? updateProfile(placeId, accountId, patch as Partial<typeof state.profileDraft>)
    : updateAuthored(placeId, accountId, patch as Partial<typeof state.authoredDraft>);
  return <div className="external-draft">
    <span>{kind === 'profile' ? 'PROFILE HYDRATION DRAFT · KIND 0' : 'AUTHORED-NOTES DRAFT · RELATIONSHIP authored-notes'}</span>
    <label>Relay targets<textarea aria-label={`${kind} relay targets`} value={draft.relays.join('\n')} onChange={(event) => update({ relays: event.target.value.split(/[\s,]+/u).filter(Boolean) })}/></label>
    <div>{kind === 'authored' && <label>Event limit<input aria-label="Authored event limit" type="number" min="1" max="100" value={state.authoredDraft.eventLimit} onChange={(event) => update({ eventLimit: Number(event.target.value) })}/></label>}<label>Timeout ms<input type="number" min="100" max="60000" value={draft.timeoutMs} onChange={(event) => update({ timeoutMs: Number(event.target.value) })}/></label><label>Observation bound<input type="number" min="1" value={draft.observationLimit} onChange={(event) => update({ observationLimit: Number(event.target.value) })}/></label><label>Distinct-event bound<input type="number" min="1" value={draft.distinctEventLimit} onChange={(event) => update({ distinctEventLimit: Number(event.target.value) })}/></label><label>Concurrency<input type="number" min="1" max="10" value={draft.concurrency} onChange={(event) => update({ concurrency: Number(event.target.value) })}/></label></div>
    <label className="draft-warning"><input type="checkbox" checked={draft.excludeContentWarnings} onChange={(event) => update({ excludeContentWarnings: event.target.checked })}/> Preserve configured direct-warning exclusion</label>
  </div>;
}

function AccountInspector({ account, placeId }: { account: Account; placeId: string }) {
  useAtlasStore((state) => state.fieldRevision);
  const pinned = useAtlasStore((state) => state.pinnedAccountIds.includes(account.id));
  const togglePin = useAtlasStore((state) => state.toggleAccountPin);
  const observeAccount = useLiveStore((state) => state.observeAccount);
  const requestProfile = useLiveStore((state) => state.requestProfile);
  const requestAuthoredNotes = useLiveStore((state) => state.requestAuthoredNotes);
  const phase = useLiveStore((state) => state.phase);
  const place = fieldFor(placeId);
  const research = place.accountResearch[account.id];
  useEffect(() => { if (!research || research.localStatus === 'idle') void observeAccount(account.id, placeId); }, [account.id, observeAccount, placeId, research]);
  return <div className="inspector-body account-inspector">
    <div className="inspector-kicker">SELECTED ACCOUNT <span>LOCAL SUBJECT</span></div>
    <AccountProfileHeader account={account} profile={research?.profile} placeId={placeId}/>
    <div className="public-key"><span>PUBLIC KEY</span><code>{account.publicKey}</code></div>
    <div className={`local-evidence-status ${research?.engineHandleId ? '' : research?.localStatus === 'failure' ? 'is-error' : research?.localStatus === 'unresolved' ? 'is-unresolved' : 'is-loading'}`}><strong>{research?.engineHandleId ? 'Operational account handle retained' : research?.localStatus === 'failure' ? 'Local author observation failed' : research?.localStatus === 'unresolved' ? 'Author evidence unresolved' : 'Resolving account from retained event evidence…'}</strong><span>{research?.engineHandleId ? `${research.engineHandleId} · no relay contacted` : research?.localError ?? 'Selection leaves the place and all drafts unchanged.'}</span></div>
    {research && <>
      <DraftFields kind="profile" state={research} placeId={placeId} accountId={account.id}/>
      <button className="external-action" disabled={!research.engineHandleId || !research.profileDraft.relays.length || phase.type === 'working'} onClick={() => requestProfile(placeId, account.id)}><Icon name="account"/><span><strong>{research.profile?.status === 'loading' ? 'Requesting profile…' : 'Execute profile hydration'}</strong><small>Relay request · dedicated visible draft · place unchanged</small></span></button>
      {research.profile && <section className={`evidence-section profile-result is-${research.profile.status}`}><span>PROFILE ATTEMPT · {research.profile.status.toUpperCase()}</span>{research.profile.status === 'loading' ? <p>Executing the displayed bounded relay request…</p> : research.profile.error ? <p>{research.profile.error}</p> : research.profile.claims && Object.keys(research.profile.claims).length ? <dl>{Object.entries(research.profile.claims).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd></div>)}</dl> : <p>No resolvable profile claim was returned.</p>}<small>Supporting handle: {research.profile.supportingHandleId ?? 'unavailable'}. Claims remain attributed relay observations.</small><details className="evidence-details"><summary>Profile attempt facts</summary><pre>{JSON.stringify({external: research.profile.external, completeness: research.profile.completeness, provenance: research.profile.provenance, resolution: research.profile.resolution}, null, 2)}</pre></details></section>}
      <DraftFields kind="authored" state={research} placeId={placeId} accountId={account.id}/>
      <button className="external-action" disabled={!research.engineHandleId || !research.authoredDraft.relays.length || phase.type === 'working'} onClick={() => requestAuthoredNotes(placeId, account.id)}><Icon name="stream"/><span><strong>{research.authoredNotes?.status === 'loading' ? 'Requesting authored notes…' : 'Execute and open authored-note branch'}</strong><small>Relay request · dedicated visible draft · opens branch on success</small></span></button>
      {research.authoredNotes && research.authoredNotes.status !== 'loading' && <section className={`evidence-section authored-result is-${research.authoredNotes.status}`}><span>AUTHORED ATTEMPT · {research.authoredNotes.status.toUpperCase()}</span>{research.authoredNotes.error ? <p>{research.authoredNotes.error}</p> : <p>{research.authoredNotes.count ?? 0} event subjects retained in {research.authoredNotes.handleId}.</p>}<details className="evidence-details"><summary>Authored attempt facts</summary><pre>{JSON.stringify({external: research.authoredNotes.external, completeness: research.authoredNotes.completeness}, null, 2)}</pre></details></section>}
    </>}
    <div className="inspector-actions"><button className={pinned ? 'secondary-action is-pinned' : 'secondary-action'} onClick={() => togglePin(account.id)}><Icon name="pin"/> {pinned ? 'Pinned' : 'Pin account'}</button></div>
    <ObservationDisclosure placeId={placeId} type="account" id={account.id}/>
    <p className="profile-warning">Profile and authored actions use separate editable drafts prefilled from this place’s producing relays. Neither reads the main acquisition draft.</p>
  </div>;
}

function ObservationDisclosure({ placeId, type, id }: { placeId: string; type: 'note' | 'account'; id: string }) {
  const snapshot = [...fieldFor(placeId).observationSnapshots].reverse().find((candidate) => candidate.target.type === type && candidate.target.id === id);
  if (!snapshot?.exchanges.length) return null;
  return <details className="command-disclosure"><summary>Inspect attributed {snapshot.locality} commands and bounded responses</summary><pre>{JSON.stringify({sourceHandle: snapshot.sourceHandleId, observedRevision: snapshot.observedRevision, exchanges: snapshot.exchanges}, null, 2)}</pre></details>;
}

function ExactSubjectInspector({ target }: { target: { type: 'note' | 'address'; id: string } }) {
  return <div className="inspector-body exact-subject-inspector"><div className="inspector-kicker">EXACT {target.type.toUpperCase()} SUBJECT <span>SELECTION · NO MOVEMENT</span></div><h2>{target.type === 'note' && notes[target.id] ? 'Retained event subject' : 'Unresolved stable subject'}</h2><code>{target.id}</code>{target.type === 'note' && notes[target.id] ? <><RichText text={notes[target.id].content}/><p>This event is retained elsewhere in the process but is not a member of the current place. Selection did not install a branch or contact a relay.</p></> : <p>The typed identifier remains selectable, but no bounded presentation evidence is currently available here.</p>}<p className="inspector-boundary">Opening one exact subject changed only this place’s selection.</p></div>;
}

function EmptyInspector() {
  const openLiveQuery = useLiveStore((state) => state.setPanelOpen);
  return <div className="empty-inspector"><span>⌁</span><strong>No subject selected</strong><p>Selection is not movement. Choose a displayed note or account without changing this place.</p><button onClick={() => openLiveQuery(true)}>Open acquisition draft</button></div>;
}

function Inspector() {
  useAtlasStore((state) => state.fieldRevision);
  const placeId = useAtlasStore(currentPlaceId);
  const target = fieldFor(placeId).selected;
  const currentMember = target.type === 'note' && fieldFor(placeId).noteIds.includes(target.id);
  return <aside className="inspector" aria-label="Inspector"><header><span>SELECTED SUBJECT</span><small>Local evidence · explicit external doors</small></header>{target.type === 'note' && notes[target.id] && currentMember ? <NoteInspector note={notes[target.id]} placeId={placeId}/> : target.type === 'account' && accounts[target.id] ? <AccountInspector account={accounts[target.id]} placeId={placeId}/> : target.type === 'note' || target.type === 'address' ? <ExactSubjectInspector target={target}/> : <EmptyInspector/>}</aside>;
}

function ConditionsBar() {
  useAtlasStore((state) => state.fieldRevision);
  const placeId = useAtlasStore(currentPlaceId);
  const activities = useAtlasStore((state) => state.activities);
  const phase = useLiveStore((state) => state.phase);
  const latestExternal = useLiveStore((state) => state.latestExternal);
  const field = fieldFor(placeId);
  return <footer className="conditions"><div><span>PLACE</span><strong>{field.role.toUpperCase()} · {field.countingUnit}</strong></div><div><span>RELAY TARGETS</span><strong>{field.runtime?.relays.length ?? 0} visible · cancel unavailable</strong></div><div><span>EXTERNAL STATUS</span><strong>{phase.type === 'working' ? phase.stage.toUpperCase() : `${latestExternal.label} · ${latestExternal.status}`}</strong></div><div><span>WARNINGS</span><strong>{field.conditions.excludedWarnings} excluded · {latestExternal.warningCount} latest</strong></div><div className="uncertainty"><span>PARTIALITY / BOUNDARY</span><strong>{field.conditions.partial ? 'PARTIAL · ' : ''}{field.conditions.uncertainty}</strong></div><details className="activity"><summary><Icon name="activity"/> Activity <b>{activities.length}</b></summary><div>{activities.map((entry) => <article key={entry.id}><strong>{entry.label}</strong><code>{entry.command}</code><span>{entry.outcome}</span></article>)}</div></details></footer>;
}

function shortId(value: string) { return value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value; }

export default function App() {
  return <main className="atlas"><Header/><Sidebar/><FieldContent/><Inspector/><ConditionsBar/></main>;
}
