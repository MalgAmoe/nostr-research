const $ = (selector) => document.querySelector(selector);
let state = { open: false };

async function request(path, body = {}) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error);
  return value;
}

async function operation(path, body) {
  $('#operation-error').textContent = '';
  try {
    render(await request(path, body));
  } catch (error) {
    $('#operation-error').textContent = error.message;
  }
}

function text(element, value) {
  element.textContent = value ?? '';
  return element;
}

function short(id) {
  return id.length > 20 ? `${id.slice(0, 10)}…${id.slice(-8)}` : id;
}

function subjectLabel(value) {
  return value ? `${value.type}:${short(value.id)}` : 'none';
}

function linkifiedContent(content) {
  const fragment = document.createDocumentFragment();
  const urlPattern = /https?:\/\/[^\s<>"']+/gu;
  let position = 0;
  for (const match of content.matchAll(urlPattern)) {
    fragment.append(document.createTextNode(content.slice(position, match.index)));
    const anchor = document.createElement('a');
    anchor.href = match[0];
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.textContent = match[0];
    fragment.append(anchor);
    position = match.index + match[0].length;
  }
  fragment.append(document.createTextNode(content.slice(position)));
  return fragment;
}

function explicitMedia(event) {
  const values = [
    ...event.tags.filter((tag) => ['url', 'r', 'imeta'].includes(tag[0])).flatMap((tag) => tag.slice(1)),
    ...(event.content.match(/https?:\/\/[^\s<>"']+/gu) ?? []),
  ];
  const urls = [...new Set(values.flatMap((value) => {
    const match = typeof value === 'string' && value.match(/(?:^|\s)url\s+(https?:\/\/\S+)|^(https?:\/\/\S+)$/u);
    return match ? [match[1] ?? match[2]] : [];
  }))];
  return urls.filter((url) => /\.(?:avif|gif|jpe?g|png|webp|mp4|webm|mov|mp3|m4a|ogg|wav|flac)(?:[?#].*)?$/iu.test(url));
}

function mediaElement(url) {
  const extension = new URL(url).pathname.split('.').pop().toLowerCase();
  let element;
  if (['avif', 'gif', 'jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    element = document.createElement('img');
    element.alt = 'Media referenced by this event';
    element.loading = 'lazy';
  } else if (['mp4', 'webm', 'mov'].includes(extension)) {
    element = document.createElement('video');
    element.controls = true;
    element.preload = 'metadata';
  } else {
    element = document.createElement('audio');
    element.controls = true;
    element.preload = 'metadata';
  }
  element.src = url;
  return element;
}

function renderResult(result, { excluded = false } = {}) {
  const card = document.createElement('article');
  card.className = `card${excluded ? ' excluded' : ''}${state.session.focus?.type === result.type && state.session.focus.id === result.id ? ' focused' : ''}`;
  card.dataset.subjectType = result.type;
  card.dataset.subjectId = result.id;
  const header = document.createElement('header');
  const title = document.createElement('div');
  const profile = result.type === 'event' ? result.author?.profile : result.profile;
  text(title.appendChild(document.createElement('strong')), profile?.display_name || profile?.name || (result.type === 'event' ? 'Note' : 'Account'));
  text(title.appendChild(document.createElement('div')), `${result.type} · ${result.id}`).className = 'identifier';
  const actions = document.createElement('div');
  actions.className = 'actions';
  const availableActions = excluded
    ? [['Focus', '/api/focus'], ['Re-include', '/api/include']]
    : [['Focus', '/api/focus'], ['Exclude', '/api/exclude']];
  for (const [label, path] of availableActions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => operation(path, { value: { type: result.type, id: result.id } }));
    actions.append(button);
  }
  header.append(title, actions);
  card.append(header);
  if (result.type === 'event' && result.event) {
    const content = document.createElement('p');
    content.className = 'content';
    content.append(linkifiedContent(result.event.content));
    card.append(content);
    const media = document.createElement('div');
    media.className = 'media';
    explicitMedia(result.event).forEach((url) => media.append(mediaElement(url)));
    if (media.children.length) card.append(media);
    text(card.appendChild(document.createElement('p')),
      `${new Date(result.event.created_at * 1000).toLocaleString()} · kind ${result.event.kind} · ${result.observations.length} observation(s) via ${[...new Set(result.observations.map((item) => item.relay))].join(', ') || 'no recorded relay'}`,
    ).className = 'meta';
  } else if (result.type === 'account') {
    text(card.appendChild(document.createElement('p')),
      `${profile?.about || 'No stored profile description'} · ${result.relayCount ?? 0} relay(s)`,
    ).className = 'content';
  } else if (!result.resolved) {
    text(card.appendChild(document.createElement('p')), 'Missing local evidence for this subject.').className = 'notice';
  }
  const explanation = document.createElement('p');
  explanation.className = 'reasons';
  explanation.textContent = `Included because: ${result.reasons.map((reason) => reason.type).join(', ') || 'session selection'} · provenance records: ${result.provenance.length}`;
  card.append(explanation);
  const details = document.createElement('details');
  details.innerHTML = '<summary>Raw event, tags & protocol evidence</summary>';
  text(details.appendChild(document.createElement('pre')), JSON.stringify({
    event: result.event ?? result.metadataEvent ?? null,
    tags: result.event?.tags ?? result.metadataEvent?.tags ?? [],
    reasons: result.reasons,
    provenance: result.provenance,
  }, null, 2));
  card.append(details);
  return card;
}

function render(next) {
  state = next;
  $('#database-path').value ||= next.defaultDatabase ?? '';
  $('#database-status').textContent = next.open ? `Open: ${next.databasePath}` : 'No database open.';
  for (const element of ['#new-session', '#acquire', '#checkpoint-form button', '#traverse-form button']) {
    $(element).disabled = !next.open;
  }
  if (!next.open) return;
  $('#back').disabled = !next.session.canGoBack;
  $('#selection-count').textContent = next.selection.results.length;
  $('#selection-context').textContent = contextText(next.session);
  $('#focus').textContent = subjectLabel(next.session.focus);
  $('#exclusions').textContent = next.session.exclusions.length;
  const excludedSubjects = $('#excluded-subjects');
  excludedSubjects.hidden = !next.session.exclusions.length;
  $('#excluded-results').replaceChildren(
    ...(next.excludedSelection?.results ?? []).map((result) => renderResult(result, { excluded: true })),
  );
  $('#action').textContent = next.session.action.type;
  const saved = $('#saved-sets');
  saved.replaceChildren(...(next.sets.length ? next.sets : [{ id: '', name: 'No saved sets', memberCount: 0 }]).map((set) => {
    const option = document.createElement('option');
    option.value = set.id;
    option.textContent = `${set.name} (${set.memberCount ?? 0})`;
    return option;
  }));
  saved.disabled = !next.sets.length;
  $('#open-set').disabled = !next.sets.length;
  const selection = $('#selection');
  selection.replaceChildren(...next.selection.results.map(renderResult));
  if (!next.selection.results.length) {
    text(selection.appendChild(document.createElement('p')), 'This is an identified empty selection. Acquire evidence, include a subject, go back, or open a saved set.').className = 'notice';
  }
  if (next.lastAcquisition) renderProgress(next.lastAcquisition);
}

function contextText(session) {
  const context = session.selection.context;
  if (context.operation === 'traversal') {
    return `Traversal: ${context.relationshipTypes.join(', ')} · ${context.direction} · depth ${context.depth}${session.action.type === 'branch' ? ` · branch “${session.action.name}”` : ''}`;
  }
  if (context.operation === 'acquisition') return `Newly acquired evidence · completion: ${context.completionReason}`;
  if (context.operation === 'research-set') return `Opened durable research set ${context.setId}`;
  return `Local session selection · ${context.operation}`;
}

function renderProgress(progress) {
  const container = $('#relay-progress');
  container.replaceChildren();
  if (progress.completionReason || progress.counts) {
    text(container.appendChild(document.createElement('p')),
      `Operation: ${progress.completionReason ?? 'waiting'} · ${progress.counts?.observations ?? 0} observations · ${progress.counts?.newlyStored ?? 0} newly stored`,
    ).className = 'status';
  }
  for (const relay of progress.relays ?? []) {
    const row = document.createElement('div');
    row.className = 'relay';
    text(row.appendChild(document.createElement('span')), relay.relay);
    const outcome = text(row.appendChild(document.createElement('span')), relay.contacted ? relay.outcome : 'queued');
    outcome.className = `outcome ${relay.outcome === 'pending' ? 'pending' : ''}`;
    text(row.appendChild(document.createElement('span')),
      `${relay.observations} observations · ${relay.newlyStored} new · ${relay.invalid} invalid${relay.diagnostic ? ` · ${relay.diagnostic}` : ''}`);
    container.append(row);
  }
}

$('#open-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  await operation('/api/open', { path: $('#database-path').value });
});
$('#new-session').addEventListener('click', () => operation('/api/new-session'));
$('#open-set').addEventListener('click', () => operation('/api/open-set', { id: $('#saved-sets').value }));
$('#back').addEventListener('click', () => operation('/api/back'));
$('#use-empty').addEventListener('click', () => {
  $('#empty-choice').hidden = true;
  operation('/api/use-empty');
});
$('#checkpoint-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  await operation('/api/checkpoint', { name: $('#checkpoint-name').value });
  $('#checkpoint-name').value = '';
});
$('#traverse-form').addEventListener('submit', (event) => {
  event.preventDefault();
  operation('/api/traverse', {
    relationshipType: $('#relationship').value,
    direction: $('#direction').value,
    branchName: $('#branch-name').value,
  });
});
$('#acquire-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#operation-error').textContent = '';
  $('#empty-choice').hidden = true;
  $('#acquire').disabled = true;
  const timestamp = (selector) => $(selector).value ? Math.floor(new Date($(selector).value).getTime() / 1000) : undefined;
  try {
    const response = await fetch('/api/acquire', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        relays: $('#relays').value.split('\n'),
        kinds: $('#kinds').value.split(',').map((value) => value.trim()).filter(Boolean).map(Number),
        since: timestamp('#since'),
        until: timestamp('#until'),
        eventLimit: Number($('#event-limit').value),
        timeoutMs: Number($('#timeout').value),
      }),
    });
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      buffer += value ?? '';
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines.filter(Boolean)) {
        const message = JSON.parse(line);
        if (message.type === 'progress') renderProgress(message.progress);
        if (message.type === 'complete') {
          render(message.state);
          $('#empty-choice').hidden = !message.emptyPreserved;
        }
        if (message.type === 'error') throw new Error(message.error);
      }
      if (done) break;
    }
  } catch (error) {
    $('#operation-error').textContent = error.message;
  } finally {
    $('#acquire').disabled = !state.open;
  }
});

fetch('/api/state').then((response) => response.json()).then(render);
