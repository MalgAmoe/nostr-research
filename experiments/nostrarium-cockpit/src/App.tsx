import { useEffect, useState } from 'react';
import { Universe } from './Universe';
import { accountFacts, fields, type Signal } from './fixtures';
import { useFlightStore } from './store';

function Mark({ kind }: { kind: Signal['kind'] }) {
  return <span className={`signal-mark signal-mark--${kind}`} aria-hidden="true" />;
}

function FlightHeader() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <header className="flight-header">
      <div className="ship-identity">
        <div className="ship-glyph" aria-hidden="true">N</div>
        <div><strong>NOSTRARIUM</strong><span>survey vessel / experimental cockpit 01</span></div>
      </div>
      <div className="fixture-notice"><i /> FIXTURE FLIGHT · NO RELAY CONTACT</div>
      <time>{time.toISOString().slice(11, 19)} <small>UTC</small></time>
    </header>
  );
}

function NavigationPanel() {
  const activeFieldId = useFlightStore((state) => state.activeFieldId);
  const placedFieldIds = useFlightStore((state) => state.placedFieldIds);
  const pendingFieldId = useFlightStore((state) => state.pendingFieldId);
  const travel = useFlightStore((state) => state.travel);
  const place = useFlightStore((state) => state.place);
  const discard = useFlightStore((state) => state.discard);
  return (
    <aside className="panel navigation-panel" aria-label="Voyage position">
      <div className="panel-heading"><span>01</span><div><small>NAVIGATION</small><strong>Voyage position</strong></div></div>
      <section className="question-card">
        <small>ACTIVE QUESTION</small>
        <p>What lives around this quiet garden signal?</p>
        <span>1 bounded question · navigator written</span>
      </section>
      <div className="section-label"><span>POSITIONS</span><b>{placedFieldIds.length}/6</b></div>
      <div className="destinations">
        {placedFieldIds.map((fieldId) => {
          const field = fields[fieldId];
          const selected = fieldId === activeFieldId;
          return (
            <button key={fieldId} className={`destination ${selected ? 'is-active' : ''}`} onClick={() => travel(fieldId)} aria-current={selected ? 'location' : undefined}>
              <span className="destination-orbit"><i /></span>
              <span><small>{field.shortLabel} · {field.handle.count} SIGNALS</small><strong>{field.label}</strong><em>{field.reason}</em></span>
              <b>{selected ? 'HERE' : 'GO'}</b>
            </button>
          );
        })}
      </div>
      {pendingFieldId && (
        <section className="pending-card" aria-live="polite">
          <div><span className="pulse-dot" /> NEW RESULT</div>
          <strong>{fields[pendingFieldId].label}</strong>
          <p>{fields[pendingFieldId].handle.count} recorded events · ordinary handle <code>{fields[pendingFieldId].handle.id}</code></p>
          <div className="button-row">
            <button className="primary-action" onClick={place}>PLACE BRANCH</button>
            <button className="quiet-action" onClick={discard}>DISCARD</button>
          </div>
        </section>
      )}
      <div className="panel-footer">Ground + branches · one shared focus</div>
    </aside>
  );
}

function EvidencePanel() {
  const fieldId = useFlightStore((state) => state.activeFieldId);
  const focusId = useFlightStore((state) => state.focusId);
  const focusMode = useFlightStore((state) => state.focusMode);
  const accountId = useFlightStore((state) => state.focusedAccountId);
  const preserved = useFlightStore((state) => state.preservedIds.includes(state.focusId));
  const focusAccount = useFlightStore((state) => state.focusAccount);
  const returnToSignal = useFlightStore((state) => state.returnToSignal);
  const preserve = useFlightStore((state) => state.preserve);
  const field = fields[fieldId];
  const signal = field.signals.find(({ id }) => id === focusId) ?? field.signals[0];
  const account = accountFacts[accountId ?? signal.authorId];

  return (
    <aside className="panel evidence-panel" aria-label="Focused evidence">
      <div className="panel-heading"><span>02</span><div><small>EVIDENCE DESK</small><strong>{focusMode === 'signal' ? 'Focused signal' : 'Account claims'}</strong></div></div>
      {focusMode === 'signal' ? (
        <>
          <div className="focus-source"><Mark kind={signal.kind} /><span>{signal.kind.toUpperCase()} · {signal.id}</span><b>{signal.relayCount} relay{signal.relayCount === 1 ? '' : 's'}</b></div>
          <div className="author-line">
            <button onClick={() => focusAccount(signal.authorId)}><span>{signal.author.slice(0, 1)}</span><strong>{signal.author}<small>{signal.handle}</small></strong></button>
            <time>{signal.createdAt}</time>
          </div>
          <article className="post-content">{signal.content}</article>
          {signal.media?.type === 'image' && signal.media.src && (
            <figure className="media-frame"><img src={signal.media.src} alt={signal.media.label} /><figcaption><span>IMAGE</span>{signal.media.label}</figcaption></figure>
          )}
          {signal.media?.type === 'video' && (
            <div className="video-placeholder"><span>▶</span><div><strong>VIDEO SIGNAL</strong><small>{signal.media.label}</small></div></div>
          )}
          <div className="evidence-facts">
            <div><small>RESOLUTION</small><strong>fixture buffer</strong></div>
            <div><small>ROLE</small><strong>{signal.parentId ? 'reply' : 'discovery'}</strong></div>
            <div><small>PROVENANCE</small><strong>{signal.relayCount} observation path{signal.relayCount === 1 ? '' : 's'}</strong></div>
          </div>
          <div className="button-row evidence-actions">
            <button className="primary-action" onClick={() => focusAccount(signal.authorId)}>VIEW ACCOUNT</button>
            <button className={preserved ? 'quiet-action is-preserved' : 'quiet-action'} onClick={preserve}>{preserved ? 'IN LOGBOOK' : 'PRESERVE'}</button>
          </div>
        </>
      ) : (
        <>
          <button className="back-link" onClick={returnToSignal}>← RETURN TO SIGNAL {signal.id}</button>
          <div className="account-portrait">{account.name.slice(0, 1)}</div>
          <div className="account-title"><small>PROFILE CLAIM</small><h2>{account.name}</h2><span>{account.handle}</span></div>
          <p className="account-claim">“{account.claim}”</p>
          <div className="key-block"><small>PUBLIC KEY</small><code>{account.publicKey}</code></div>
          <p className="boundary-note">Name, handle, and description are displayed as recorded profile claims. Account ownership and trust are not inferred.</p>
        </>
      )}
      <div className="panel-footer">Already-observed facts · no automatic inspection</div>
    </aside>
  );
}

function SignalList() {
  const fieldId = useFlightStore((state) => state.activeFieldId);
  const focusId = useFlightStore((state) => state.focusId);
  const focus = useFlightStore((state) => state.focusSignal);
  const field = fields[fieldId];
  return (
    <div className="signal-list" aria-label="Flat signal navigator">
      <div className="signal-list-heading"><span>FLAT NAVIGATOR</span><small>Same field · same shared focus</small></div>
      {field.signals.map((signal) => (
        <button key={signal.id} className={signal.id === focusId ? 'is-active' : ''} onClick={() => focus(signal.id)}>
          <Mark kind={signal.kind} />
          <span><strong>{signal.author}</strong><small>{signal.content}</small></span>
          <code>{signal.id}</code>
        </button>
      ))}
    </div>
  );
}

function CommandConsole() {
  const staged = useFlightStore((state) => state.staged);
  const pending = useFlightStore((state) => state.pendingFieldId);
  const placed = useFlightStore((state) => state.placedFieldIds);
  const stage = useFlightStore((state) => state.stage);
  const execute = useFlightStore((state) => state.execute);
  const cancel = useFlightStore((state) => state.cancelStage);
  const canConversation = !placed.includes('conversation');
  const canAuthor = !placed.includes('author');
  return (
    <section className={`command-console ${staged ? 'is-staged' : ''}`} aria-label="Visible command gate">
      <div className="console-label"><span>03</span><div><small>FLIGHT COMPUTER</small><strong>{staged ? 'Command staged' : pending ? 'Placement required' : 'Explicit action gate'}</strong></div></div>
      {staged ? (
        <>
          <code className="command-draft">{JSON.stringify(staged.command)}</code>
          <div className="button-row">
            <button className="execute-action" onClick={execute}>EXECUTE RECORDED OUTCOME</button>
            <button className="quiet-action" onClick={cancel}>CANCEL</button>
          </div>
        </>
      ) : pending ? (
        <p className="console-message">Place or discard the pending handle before staging another command.</p>
      ) : (
        <div className="console-actions">
          <button disabled={!canConversation} onClick={() => stage('conversation')}><span>⌁</span><b>{canConversation ? 'STAGE CONVERSATION' : 'CONVERSATION PLACED'}</b><small>one visible continue command</small></button>
          <button disabled={!canAuthor} onClick={() => stage('author-history')}><span>◎</span><b>{canAuthor ? 'STAGE AUTHOR FIELD' : 'AUTHOR FIELD PLACED'}</b><small>one visible authored-notes command</small></button>
        </div>
      )}
    </section>
  );
}

function InstrumentStrip() {
  const fieldId = useFlightStore((state) => state.activeFieldId);
  const view = useFlightStore((state) => state.view);
  const setView = useFlightStore((state) => state.setView);
  const log = useFlightStore((state) => state.log);
  const field = fields[fieldId];
  return (
    <footer className="instrument-strip">
      <div className="instrument"><small>FIELD</small><strong>{field.handle.count}</strong><span>signals</span></div>
      <div className="instrument"><small>SOURCE</small><strong>{field.shortLabel}</strong><span>{field.source}</span></div>
      <div className="instrument"><small>END</small><strong>{field.completion}</strong><span>not exhaustive</span></div>
      <div className="instrument"><small>CONTENT WARNINGS</small><strong>{field.excludedWarnings}</strong><span>excluded</span></div>
      <div className="instrument uncertainty"><small>CONDITION</small><strong>BOUNDED</strong><span>{field.uncertainty}</span></div>
      <div className="view-switch" role="group" aria-label="Viewport mode">
        <button aria-pressed={view === 'universe'} className={view === 'universe' ? 'is-active' : ''} onClick={() => setView('universe')}>UNIVERSE</button>
        <button aria-pressed={view === 'signals'} className={view === 'signals' ? 'is-active' : ''} onClick={() => setView('signals')}>SIGNALS</button>
      </div>
      <details className="flight-log"><summary>LOG <b>{log.length}</b></summary><div>{log.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}</div></details>
    </footer>
  );
}

export default function App() {
  const view = useFlightStore((state) => state.view);
  return (
    <main className="cockpit-shell">
      <FlightHeader />
      <Universe />
      {view === 'signals' && <SignalList />}
      <div className="cockpit-frame" aria-hidden="true"><span className="strut left" /><span className="strut right" /><i className="horizon left" /><i className="horizon right" /></div>
      <NavigationPanel />
      <EvidencePanel />
      <CommandConsole />
      <InstrumentStrip />
    </main>
  );
}
