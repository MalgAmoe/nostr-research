import { useMemo } from 'react';
import { useState } from 'react';
import { accounts, fieldFor, notes, notesFor, type Account, type Media, type Note } from './data';
import { LiveQueryButton, LiveQueryPanel } from './LiveQuery';
import { useLiveStore } from './live-store';
import { currentLocation, useAtlasStore } from './store';

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
  const location = useAtlasStore(currentLocation);
  const query = useAtlasStore((state) => state.query);
  const back = useAtlasStore((state) => state.back);
  const forward = useAtlasStore((state) => state.forward);
  const setQuery = useAtlasStore((state) => state.setQuery);
  const field = fieldFor(location.fieldId);
  return (
    <header className="atlas-header">
      <div className="brand"><span className="brand-mark">N</span><div><strong>Nostrarium</strong><small>Atlas</small></div></div>
      <div className="history-controls">
        <button aria-label="Go back" disabled={historyIndex === 0} onClick={back}><Icon name="back" /></button>
        <button aria-label="Go forward" disabled={historyIndex === historyLength - 1} onClick={forward}><Icon name="forward" /></button>
      </div>
      <div className="location-bar"><span>Exploring</span><strong>{field.label}</strong><small>{field.noteIds.length} notes</small></div>
      <label className="search-box"><Icon name="search" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter this field" aria-label="Filter this field" />{query && <button onClick={() => setQuery('')} aria-label="Clear filter"><Icon name="close" size={15}/></button>}</label>
      <LiveQueryButton />
    </header>
  );
}

function Sidebar() {
  const state = useAtlasStore();
  const jump = useAtlasStore((store) => store.jump);
  const openPinnedNote = useAtlasStore((store) => store.openPinnedNote);
  const openPinnedAccount = useAtlasStore((store) => store.openPinnedAccount);
  const openLiveQuery = useLiveStore((store) => store.setPanelOpen);
  const queryOpen = useLiveStore((store) => store.panelOpen);
  return (
    <nav className="sidebar" aria-label="Exploration">
      <div className="sidebar-title">EXPLORE</div>
      <button className="nav-item nav-item--live" onClick={() => openLiveQuery(!queryOpen)} aria-expanded={queryOpen}>
        <span className="nav-symbol">⌁</span><span><strong>{queryOpen?'Hide relay search':'Search live relays'}</strong><small>Text, IDs, authors, tags, and bounds</small></span>
      </button>
      <LiveQueryPanel />
      <div className="sidebar-library">
      <div className="sidebar-section"><span>PINNED</span><b>{state.pinnedNoteIds.length + state.pinnedAccountIds.length}</b></div>
      <div className="pinned-list">
        {state.pinnedNoteIds.map((id) => {
          const note = notes[id]; const account = accounts[note.authorId];
          return <button key={id} onClick={() => openPinnedNote(id)}><Avatar account={account} size="small"/><span><strong>{account.name}</strong><small>{note.content}</small></span></button>;
        })}
        {state.pinnedAccountIds.map((id) => {
          const account = accounts[id];
          return <button key={id} onClick={() => openPinnedAccount(id)}><Avatar account={account} size="small"/><span><strong>{account.name}</strong><small>Account</small></span></button>;
        })}
        {!state.pinnedNoteIds.length && !state.pinnedAccountIds.length && <p className="empty-state">Pin a note or account to keep it close.</p>}
      </div>
      <div className="sidebar-section"><span>YOUR TRAIL</span><b>{state.history.filter(({target})=>target.type!=='none').length}</b></div>
      <ol className="trail">
        {state.history.map((entry, index) => {
          if (entry.target.type === 'none') return null;
          const target = entry.target.type === 'note' ? notes[entry.target.id] : accounts[entry.target.id];
          const label = entry.target.type === 'note' ? `${accounts[(target as Note).authorId].name} · ${(target as Note).id.slice(0,8)}…` : `${(target as Account).name} · account`;
          return <li key={`${entry.fieldId}-${entry.target.type}-${entry.target.id}-${index}`}><button className={index === state.historyIndex ? 'is-current' : ''} onClick={() => jump(index)}><i /><span><strong>{label}</strong><small>{fieldFor(entry.fieldId).label}</small></span></button></li>;
        })}
      </ol>
      <div className="sidebar-boundary"><i /> Browsing a bounded field<br/><span>Not a global Nostr inventory</span></div>
      </div>
    </nav>
  );
}

function Guide() {
  const visible = useAtlasStore((state) => state.guideVisible);
  const dismiss = useAtlasStore((state) => state.dismissGuide);
  if (!visible) return null;
  return (
    <section className="guide" aria-label="Getting started">
      <span>START HERE</span>
      <p><b>1.</b> Search relays &nbsp;→&nbsp; <b>2.</b> Display buffered notes &nbsp;→&nbsp; <b>3.</b> Load more or update explicitly</p>
      <button onClick={dismiss} aria-label="Dismiss guide"><Icon name="close" size={16}/></button>
    </section>
  );
}

function AuthorButton({ accountId }: { accountId: string }) {
  const account = accounts[accountId];
  const inspect = useAtlasStore((state) => state.inspectAccount);
  return <button className="author-button" onClick={(event) => { event.stopPropagation(); inspect(accountId); }}><Avatar account={account} size="medium"/><span><strong>{account.name}</strong><small>{account.handle}</small></span></button>;
}

function NoteCard({ note, selected }: { note: Note; selected: boolean }) {
  const select = useAtlasStore((state) => state.selectNote);
  return (
    <article className={`note-card ${selected ? 'is-selected' : ''}`} data-note-id={note.id}>
      <header><AuthorButton accountId={note.authorId}/><time>{note.createdAt}</time></header>
      <button className="note-body" onClick={() => select(note.id)} aria-label={`Open note by ${accounts[note.authorId].name}`}>
        <p>{note.content}</p>
        {note.media?.src && <figure className="remote-media-indicator"><span>{note.media.type === 'video' ? '▶' : '▧'}</span><div><strong>Remote {note.media.type} available</strong><small>Select this note to load the declared file.</small></div></figure>}
      </button>
      <footer>
        <button onClick={() => select(note.id)}><span className="note-dot"/> {note.id}</button>
        {note.replyCount ? <span><Icon name="reply" size={14}/> {note.replyCount} replies</span> : <span>kind 1</span>}
        <span>{note.relayCount} session relay{note.relayCount === 1 ? '' : 's'}</span>
      </footer>
    </article>
  );
}

function StreamView({ visibleNotes, selectedId }: { visibleNotes: Note[]; selectedId: string | null }) {
  return <div className="stream-view">{visibleNotes.map((note) => <NoteCard key={note.id} note={note} selected={note.id === selectedId}/>)}</div>;
}

function GalleryView({ visibleNotes, selectedId }: { visibleNotes: Note[]; selectedId: string | null }) {
  const select = useAtlasStore((state) => state.selectNote);
  const media = visibleNotes.filter((note) => note.media);
  if (!media.length) return <div className="no-results"><Icon name="gallery" size={28}/><strong>No media in this bounded field</strong><span>Try Stream to see its text notes.</span></div>;
  return <div className="gallery-view">{media.map((note) => <button key={note.id} className={note.id === selectedId ? 'is-selected' : ''} onClick={() => select(note.id)}><div className="gallery-remote"><span>{note.media!.type==='video'?'▶':'▧'}</span><small>Remote {note.media!.type}<br/>Select to load</small></div><span className="gallery-type">{note.media!.type}</span><div><Avatar account={accounts[note.authorId]} size="small"/><span><strong>{accounts[note.authorId].name}</strong><small>{note.content}</small></span></div></button>)}</div>;
}

function MediaEvidence({ media }: { media: Media }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!media.src) return null;
  if (!loaded) return <div className="remote-media-load"><span>REMOTE {media.type.toUpperCase()}</span><p>The note declares an external file. Its origin will receive a request only if you load it.</p><code>{media.src}</code><button onClick={()=>setLoaded(true)}>Load actual {media.type}</button></div>;
  if (failed) return <div className="remote-media-load is-failed"><span>MEDIA FAILED</span><p>The external file could not be displayed. The declared URL remains visible.</p><code>{media.src}</code></div>;
  return <figure className="inspector-media">{media.type==='video'?<video src={media.src} controls preload="metadata" onError={()=>setFailed(true)}/>:<img src={media.src} alt={media.alt} referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>}<figcaption>External file declared by this note</figcaption></figure>;
}

function FieldContent() {
  const location = useAtlasStore(currentLocation);
  const view = useAtlasStore((state) => state.view);
  const query = useAtlasStore((state) => state.query.trim().toLowerCase());
  const setView = useAtlasStore((state) => state.setView);
  const openLiveQuery = useLiveStore((state) => state.setPanelOpen);
  const active = useLiveStore((state) => state.active);
  const livePhase = useLiveStore((state) => state.phase);
  const showMore = useLiveStore((state) => state.showMore);
  const acquireAround = useLiveStore((state) => state.acquireAround);
  const field = fieldFor(location.fieldId);
  const fieldNotes = notesFor(location.fieldId);
  const visibleNotes = useMemo(() => !query ? fieldNotes : fieldNotes.filter((note) => `${note.content} ${accounts[note.authorId].name} ${note.tags?.join(' ') ?? ''}`.toLowerCase().includes(query)), [fieldNotes, query]);
  const selectedId = location.target.type === 'note' ? location.target.id : null;
  const bufferDrained = Boolean(active && active.nextOffset >= active.total);
  const timestampUpdatesAvailable = Boolean(active && bufferDrained && !active.draft.eventId && !active.draft.search);
  return (
    <section className="field-content">
      <Guide />
      <div className="field-heading"><div><span>CURRENT FIELD</span><h1>{field.label}</h1><p>{field.description}</p></div><div className="view-tabs" role="group" aria-label="Field view"><button aria-pressed={view==='stream'} className={view==='stream'?'is-active':''} onClick={()=>setView('stream')}><Icon name="stream"/> Stream</button><button aria-pressed={view==='gallery'} className={view==='gallery'?'is-active':''} onClick={()=>setView('gallery')}><Icon name="gallery"/> Gallery</button></div></div>
      <div className="result-line"><strong>{visibleNotes.length}</strong> of {fieldNotes.length} notes shown{query && <span> · local filter “{query}”</span>}</div>
      {!fieldNotes.length ? <div className="no-results live-start"><span className="live-start-mark">⌁</span><strong>No live field yet</strong><span>Select relays and explicit request bounds to begin.</span><button onClick={()=>openLiveQuery(true)}>Search live relays</button></div> : visibleNotes.length ? <>{view==='stream'&&<StreamView visibleNotes={visibleNotes} selectedId={selectedId}/>} {view==='gallery'&&<GalleryView visibleNotes={visibleNotes} selectedId={selectedId}/>}</> : <div className="no-results"><Icon name="search" size={28}/><strong>No matching notes</strong><span>This local filter did not broaden or acquire another field.</span></div>}
      {active?.fieldId===location.fieldId&&<div className="field-live-actions"><div><span>LIVE BUFFER</span><strong>{active.nextOffset} of {active.total} identities from the current handle displayed</strong><small>{active.nextOffset<active.total?'Drain this buffer before contacting relays for another page.':active.draft.search?'Experimental NIP-50 fields are refreshed by running a new one-relay search.':active.olderExhausted?'No additional unique older notes were returned; the timestamp boundary was not skipped.':'The current result handle has no undisplayed identities.'}</small></div><div><button disabled={livePhase.type!=='idle'||active.nextOffset>=active.total} onClick={showMore}>Load more from buffer</button><button disabled={livePhase.type!=='idle'||!timestampUpdatesAvailable||!active.newestTimestamp} onClick={()=>acquireAround('newer')}>Check for updates</button><button disabled={livePhase.type!=='idle'||!timestampUpdatesAvailable||!active.oldestTimestamp||active.olderExhausted} onClick={()=>acquireAround('older')}>Acquire older notes</button></div>{livePhase.type==='paging'&&<p>Reading the next explicit buffer page…</p>}{livePhase.type==='failure'&&livePhase.stage==='page'&&<p className="is-error">{livePhase.message}</p>}</div>}
    </section>
  );
}

function NoteInspector({ note }: { note: Note }) {
  const account = accounts[note.authorId];
  const location = useAtlasStore(currentLocation);
  const inspectAccount = useAtlasStore((state) => state.inspectAccount);
  const pinned = useAtlasStore((state) => state.pinnedNoteIds.includes(note.id));
  const togglePin = useAtlasStore((state) => state.toggleNotePin);
  const active = useLiveStore((state) => state.active?.fieldId === location.fieldId ? state.active : null);
  const field = fieldFor(location.fieldId);
  const exactTime = note.timestamp ? new Date(note.timestamp * 1000).toLocaleString() : 'Unavailable in this response';
  const queryScope = active ? [
    active.draft.search ? `text “${active.draft.search}”` : '',
    active.draft.eventId ? 'exact event ID' : '',
    active.draft.author ? 'exact author' : '',
    active.draft.hashtag ? `#${active.draft.hashtag}` : '',
  ].filter(Boolean).join(' · ') || 'recent kind-1 notes' : 'See recorded field command';
  return <div className="inspector-body note-context"><div className="inspector-kicker">EVENT CONTEXT <span>{note.id.slice(0,8)}…{note.id.slice(-4)}</span></div><button className="inspector-author" onClick={() => inspectAccount(note.authorId)}><Avatar account={account} size="large"/><span><strong>{account.name}</strong><small>{account.handle}</small></span><b>View account →</b></button><section className="event-identifiers"><div><span>EVENT ID</span><code>{note.id}</code></div><div><span>AUTHOR PUBLIC KEY</span><code>{account.publicKey}</code></div></section>{note.media&&<MediaEvidence key={note.id} media={note.media}/>}<div className="inspector-actions"><button className={pinned?'secondary-action is-pinned':'secondary-action'} onClick={()=>togglePin(note.id)}><Icon name="pin"/> {pinned?'Pinned':'Pin note'}</button></div><div className="fact-grid"><div><span>CREATED</span><strong>{exactTime}</strong></div><div><span>EVENT KIND</span><strong>kind 1</strong></div><div><span>SESSION RELAY OBSERVATIONS</span><strong>{note.relayCount} relay{note.relayCount===1?'':'s'}</strong></div><div><span>FIELD RELATION</span><strong>{note.parentId?'declared reply':'field result'}</strong></div></div><section className="request-context"><span>FIELD QUERY SETTINGS</span><strong>{field.label}</strong><dl><div><dt>Scope</dt><dd>{queryScope}</dd></div><div><dt>Time</dt><dd>{active ? active.draft.hours ? `last ${active.draft.hours} hours` : 'no time bound' : 'see field activity'}</dd></div><div><dt>Bound</dt><dd>{active ? `${active.draft.limit} per relay` : field.commandLabel}</dd></div></dl></section>{note.relayUrls?.length?<div className="observed-relays"><span>OBSERVED VIA THESE RELAYS DURING THIS SESSION</span>{note.relayUrls.map((relay)=><code key={relay}>{relay}</code>)}</div>:null}<p className="inspector-boundary">Relay observations are cumulative session memory and may include earlier requests. The note text remains in the center list; this panel does not infer trust or completeness.</p></div>;
}

function AccountInspector({ account }: { account: Account }) {
  const pinned = useAtlasStore((state) => state.pinnedAccountIds.includes(account.id));
  const togglePin = useAtlasStore((state) => state.toggleAccountPin);
  const prepareAuthorQuery = useLiveStore((state) => state.setAuthorQuery);
  return <div className="inspector-body account-inspector"><div className="inspector-kicker">ACCOUNT <span>profile not requested</span></div><Avatar account={account} size="large"/><h2>{account.name}</h2><span className="account-handle">{account.handle}</span><p className="account-about">{account.about}</p><div className="public-key"><span>PUBLIC KEY</span><code>{account.publicKey}</code></div><div className="inspector-actions"><button className="main-action" onClick={()=>prepareAuthorQuery(account.publicKey)}><Icon name="stream"/> Prepare author query <small>Choose relays and bounds before acquisition</small></button><button className={pinned?'secondary-action is-pinned':'secondary-action'} onClick={()=>togglePin(account.id)}><Icon name="pin"/> {pinned?'Pinned':'Pin account'}</button></div><p className="profile-warning">Profile metadata has not been requested. The displayed identifier comes from an observed event author field.</p></div>;
}

function EmptyInspector() {
  const openLiveQuery = useLiveStore((state) => state.setPanelOpen);
  return <div className="empty-inspector"><span>⌁</span><strong>No live note selected</strong><p>Run a relay query and display its bounded result to inspect notes and event authors.</p><button onClick={()=>openLiveQuery(true)}>Search live relays</button></div>;
}

function Inspector() {
  const location = useAtlasStore(currentLocation);
  return <aside className="inspector" aria-label="Inspector"><header><span>INSPECTOR</span><small>Event context and authors</small></header>{location.target.type==='note'?<NoteInspector note={notes[location.target.id]}/>:location.target.type==='account'?<AccountInspector account={accounts[location.target.id]}/>:<EmptyInspector/>}</aside>;
}

function ConditionsBar() {
  useAtlasStore((state) => state.fieldRevision);
  const location = useAtlasStore(currentLocation);
  const activities = useAtlasStore((state) => state.activities);
  const field = fieldFor(location.fieldId);
  return <footer className="conditions"><div><span>FIELD</span><strong>{field.noteIds.length} notes</strong></div><div><span>SOURCE</span><strong>{field.conditions.source}</strong></div><div><span>TERMINAL</span><strong>{field.conditions.terminal}</strong></div><div><span>WARNINGS</span><strong>{field.conditions.excludedWarnings} excluded</strong></div><div className="uncertainty"><span>BOUNDARY</span><strong>{field.conditions.uncertainty}</strong></div><details className="activity"><summary><Icon name="activity"/> Activity <b>{activities.length}</b></summary><div>{activities.map((entry)=><article key={entry.id}><strong>{entry.label}</strong><code>{entry.command}</code><span>{entry.outcome}</span></article>)}</div></details></footer>;
}

export default function App() {
  return <main className="atlas"><Header/><Sidebar/><FieldContent/><Inspector/><ConditionsBar/></main>;
}
