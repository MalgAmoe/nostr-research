import { useEffect, useMemo, useState } from 'react';
import {
  accountProfilePresentation, accounts, fieldFor, fields, notes, notesFor, observationFor,
  type Account, type AccountResearchState, type Media, type Note, type NoteObservation, type ProfileObservation,
} from './data';
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

function AuthorButton({ accountId }: { accountId: string }) {
  const account = accounts[accountId];
  const inspect = useAtlasStore((state) => state.inspectAccount);
  return <button className="author-button" onClick={(event) => { event.stopPropagation(); inspect(accountId); }}><Avatar account={account} size="medium"/><span><strong>{account.name}</strong><small>{account.handle}</small></span></button>;
}

function NoteCard({ note, selected }: { note: Note; selected: boolean }) {
  const select = useAtlasStore((state) => state.selectNote);
  return <article className={`note-card ${selected ? 'is-selected' : ''}`} data-note-id={note.id}>
    <header><AuthorButton accountId={note.authorId}/><time>{note.createdAt}</time></header>
    <button className="note-body" onClick={() => select(note.id)} aria-label={`Open note by ${accounts[note.authorId].name}`}><p>{note.content}</p>{note.media?.src && <figure className="remote-media-indicator"><span>{note.media.type === 'video' ? '▶' : '▧'}</span><div><strong>Remote {note.media.type} available</strong><small>Select this note to inspect its declared file.</small></div></figure>}</button>
    <footer><button onClick={() => select(note.id)}><span className="note-dot"/> {note.id}</button><span>kind 1</span><span>{note.relayCount} observed relay{note.relayCount === 1 ? '' : 's'}</span></footer>
  </article>;
}

function StreamView({ visibleNotes, selectedId }: { visibleNotes: Note[]; selectedId: string | null }) {
  return <div className="stream-view">{visibleNotes.map((note) => <NoteCard key={note.id} note={note} selected={note.id === selectedId}/>)}</div>;
}

function GalleryView({ visibleNotes, selectedId }: { visibleNotes: Note[]; selectedId: string | null }) {
  const select = useAtlasStore((state) => state.selectNote);
  const media = visibleNotes.filter((note) => note.media);
  if (!media.length) return <div className="no-results"><Icon name="gallery" size={28}/><strong>No media in this bounded place</strong><span>Stream still shows readable notes.</span></div>;
  return <div className="gallery-view">{media.map((note) => <button key={note.id} className={note.id === selectedId ? 'is-selected' : ''} onClick={() => select(note.id)}><div className="gallery-remote"><span>{note.media!.type === 'video' ? '▶' : '▧'}</span><small>Remote {note.media!.type}<br/>Select to inspect</small></div><span className="gallery-type">{note.media!.type}</span><div><Avatar account={accounts[note.authorId]} size="small"/><span><strong>{accounts[note.authorId].name}</strong><small>{note.content}</small></span></div></button>)}</div>;
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
    <div>{projection.accountIds.map((id) => <button key={id} className={place.selected.type === 'account' && place.selected.id === id ? 'is-selected' : ''} onClick={() => select(id)}><Avatar account={accounts[id]} size="medium"/><span><strong>{accounts[id].name}</strong><small>{id}</small></span><b>{place.accountResearch[id]?.localStatus ?? 'unobserved'}</b></button>)}</div>
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
        <button className="facet-subject" onClick={() => selectFacet(record.account)}><Avatar account={accounts[record.account]} size="small"/><span><strong>{accounts[record.account]?.name ?? shortId(record.account)}</strong><small>{record.account}</small></span><b>{record.noteCount} notes</b></button>
        <div><button disabled={phase.type === 'working'} onClick={() => openNotes(placeId, record.account)}>Local · Notes here by this account</button><button onClick={() => prepare(placeId, record.account)}>Draft · Research this account on relays</button></div>
      </article>)}</div>
      <details className="command-disclosure"><summary>Facet commands, handles, lineage, bounds, and omissions</summary><pre>{JSON.stringify({commands: facet.commands, handles: facet.handles, countUnit: facet.countUnit, bounds: facet.bounds, truncated: facet.truncated, omissions: facet.omissions, lineage: facet.records[0]?.lineage}, null, 2)}</pre></details>
    </>}
  </section>;
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
    {field.role !== 'start' && <section className="place-orientation"><div><span>HANDLE</span><code>{field.handleId}</code></div><div><span>INSTALLED</span><strong>revision {field.installRevision} · never replaced</strong></div><div><span>REASON</span><strong>{field.navigatorReason}</strong></div><details><summary>Origin, bounds, omissions, and resolution</summary><pre>{JSON.stringify({command: field.originCommand, receipt: field.originReceipt, bounds: field.declaredBounds, omissions: field.declaredOmissions, evidenceResolution: field.evidenceResolution}, null, 2)}</pre></details></section>}
    <div className="result-line"><strong>{field.projection === 'accounts' ? field.accountProjection?.accountIds.length ?? 0 : visibleNotes.length}</strong> displayed {field.projection === 'accounts' ? field.accountProjection?.countUnit ?? 'accounts' : field.countingUnit}{query && field.projection !== 'accounts' && <span> · visible local constraint “{query}”</span>}</div>
    {field.projection === 'accounts' ? <AccountListView placeId={placeId}/> : !fieldNotes.length ? <div className="no-results live-start"><span className="live-start-mark">⌁</span><strong>{field.role === 'start' ? 'No Ground yet' : 'No displayed event subjects'}</strong><span>{field.role === 'start' ? 'Select relays and explicit request bounds to begin.' : 'The handle remains a valid bounded place even when its preview is empty.'}</span>{field.role === 'start' && <button onClick={() => openLiveQuery(true)}>Open acquisition draft</button>}</div> : visibleNotes.length ? <>{field.projection === 'stream' && <StreamView visibleNotes={visibleNotes} selectedId={selectedId}/>} {field.projection === 'gallery' && <GalleryView visibleNotes={visibleNotes} selectedId={selectedId}/>}</> : <div className="no-results"><Icon name="search" size={28}/><strong>No matching displayed notes</strong><span>This interface-only constraint did not alter the handle or contact a relay.</span></div>}
    {active && <div className="field-live-actions"><div><span>LOCAL HANDLE PAGE</span><strong>{active.nextOffset} of {active.total} event identities observed</strong><small>Paging this immutable handle is local. It cannot broaden the relay request.</small></div><div><button disabled={livePhase.type !== 'idle' || active.nextOffset >= active.total} onClick={showMore}>Load more from this handle</button></div>{livePhase.type === 'failure' && livePhase.stage === 'page' && <p className="is-error">{livePhase.message}</p>}</div>}
  </section>;
}

function MediaEvidence({ media }: { media: Media }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!media.src) return null;
  if (!loaded) return <div className="remote-media-load"><span>REMOTE {media.type.toUpperCase()}</span><p>The note declares an external file. Its origin is contacted only if you load it.</p><code>{media.src}</code><button onClick={() => setLoaded(true)}>Load actual {media.type}</button></div>;
  if (failed) return <div className="remote-media-load is-failed"><span>MEDIA FAILED</span><p>The external file could not be displayed. The declared URL remains visible.</p><code>{media.src}</code></div>;
  return <figure className="inspector-media">{media.type === 'video' ? <video src={media.src} controls preload="metadata" onError={() => setFailed(true)}/> : <img src={media.src} alt={media.alt} referrerPolicy="no-referrer" onError={() => setFailed(true)}/>}<figcaption>External file declared by this note</figcaption></figure>;
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
    <button className="inspector-author" onClick={() => inspectAccount(note.authorId)}><Avatar account={account} size="large"/><span><strong>{account.name}</strong><small>{account.handle}</small></span><b>Select observed author →</b></button>
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
    </>}
    {note.media && <MediaEvidence key={note.id} media={note.media}/>}<div className="inspector-actions"><button className={pinned ? 'secondary-action is-pinned' : 'secondary-action'} onClick={() => togglePin(note.id)}><Icon name="pin"/> {pinned ? 'Pinned' : 'Pin note'}</button></div>
    <ObservationDisclosure placeId={placeId} type="note" id={note.id}/>
    <p className="inspector-boundary">Selection retained this place, projection, page offset, facets, constraints, and acquisition draft.</p>
  </div>;
}

function ProfilePictureClaim({ url, name }: { url: string; name: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!loaded) return <div className="profile-picture-claim"><span>RELAY-OBSERVED PICTURE CLAIM</span><code>{url}</code><button onClick={() => setLoaded(true)}>Load claimed profile picture</button></div>;
  if (failed) return <div className="profile-picture-claim is-failed"><span>PROFILE PICTURE UNAVAILABLE</span><code>{url}</code></div>;
  return <figure className="profile-picture-observation"><img src={url} alt={`Relay-observed profile picture claimed for ${name}`} referrerPolicy="no-referrer" onError={() => setFailed(true)}/><figcaption>External image from an attributed relay-observed profile claim</figcaption></figure>;
}

export function AccountProfileHeader({ account, profile }: { account: Account; profile?: ProfileObservation }) {
  const presentation = accountProfilePresentation(account, profile);
  return <section className={`account-profile-header is-${presentation.state}`}>
    <Avatar account={account} size="large"/><h2>{presentation.name}</h2><span className="account-handle">{account.handle}</span>
    <strong className="profile-attribution">{presentation.attribution}</strong>
    <p className="account-about">{presentation.about}</p>
    {presentation.picture && <ProfilePictureClaim url={presentation.picture} name={presentation.name}/>}
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
    <AccountProfileHeader account={account} profile={research?.profile}/>
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

function EmptyInspector() {
  const openLiveQuery = useLiveStore((state) => state.setPanelOpen);
  return <div className="empty-inspector"><span>⌁</span><strong>No subject selected</strong><p>Selection is not movement. Choose a displayed note or account without changing this place.</p><button onClick={() => openLiveQuery(true)}>Open acquisition draft</button></div>;
}

function Inspector() {
  useAtlasStore((state) => state.fieldRevision);
  const placeId = useAtlasStore(currentPlaceId);
  const target = fieldFor(placeId).selected;
  return <aside className="inspector" aria-label="Inspector"><header><span>SELECTED SUBJECT</span><small>Local evidence · explicit external doors</small></header>{target.type === 'note' && notes[target.id] ? <NoteInspector note={notes[target.id]} placeId={placeId}/> : target.type === 'account' && accounts[target.id] ? <AccountInspector account={accounts[target.id]} placeId={placeId}/> : <EmptyInspector/>}</aside>;
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
