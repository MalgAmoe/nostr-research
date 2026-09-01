const api = window.nostrarium;
if (!api) {
  document.getElementById('setup-status').textContent =
    'This screen requires the Nostrarium desktop app. It cannot run as a plain browser file.';
  document.getElementById('login').disabled = true;
  document.getElementById('provider').disabled = true;
  document.getElementById('model').disabled = true;
} else {
const elements = Object.fromEntries([
  'setup-status', 'provider', 'login', 'model', 'login-prompt', 'login-label',
  'login-answer', 'login-select', 'agent-state', 'messages', 'composer', 'prompt', 'send',
  'abort', 'activity', 'evidence', 'evidence-kind', 'reset',
].map((id) => [id, document.getElementById(id)]));

let providers = [];
let state = null;
let activeLoginRequest = null;
let stepNumber = 0;
let pendingNarration = null;
let streamingMessage = null;
const steps = new Map();
const evidenceCards = new Map();

api.onEvent((event) => {
  if (event.type === 'message-delta') appendAssistantDelta(event.delta);
  if (event.type === 'message' && event.message.role === 'assistant') {
    const text = event.message.text || event.message.error;
    if (text) {
      finishAssistantMessage(text);
      attachNarration(text);
    }
  }
  if (event.type === 'agent_start') setBusy(true);
  if (event.type === 'agent_end') {
    setBusy(false);
    void refreshState();
  }
  if (event.type === 'tool-start') startStep(event);
  if (event.type === 'tool-end') finishStep(event);
  if (event.type === 'runtime-state') applyState(event.state);
  if (event.type === 'session-reset') clearVoyage();
  if (event.type === 'auth-notice') showAuthNotice(event.event);
  if (event.type === 'auth-prompt') showAuthPrompt(event);
});

elements.provider.addEventListener('change', renderModels);
elements.model.addEventListener('change', async () => {
  const providerId = elements.provider.value;
  const modelId = elements.model.value;
  if (!providerId || !modelId) return;
  try {
    applyState(await api.selectModel(providerId, modelId));
  } catch (error) {
    reportError(error);
  }
});

elements.login.addEventListener('click', async () => {
  const provider = selectedProvider();
  if (!provider) return;
  try {
    elements['setup-status'].textContent = `Signing in to ${provider.name}…`;
    await api.login(provider.id, provider.authTypes.includes('oauth') ? 'oauth' : 'api_key');
    await loadProviders();
    elements['setup-status'].textContent = `Signed in to ${provider.name}. Choose a model.`;
  } catch (error) {
    reportError(error);
    elements['setup-status'].textContent = `Sign-in failed: ${error.message}`;
  }
});

elements['login-prompt'].addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeLoginRequest) return;
  try {
    const value = elements['login-select'].hidden
      ? elements['login-answer'].value
      : elements['login-select'].value;
    await api.answerLogin(activeLoginRequest, value);
    hideAuthPrompt();
  } catch (error) {
    reportError(error);
  }
});

elements.composer.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = elements.prompt.value.trim();
  if (!text) return;
  elements.prompt.value = '';
  addMessage('user', text);
  setBusy(true);
  try {
    await api.prompt(text);
  } catch (error) {
    reportError(error);
    setBusy(false);
  }
});

elements.abort.addEventListener('click', () => api.abort().catch(reportError));
elements.reset.addEventListener('click', async () => {
  try {
    applyState(await api.resetSession());
    clearVoyage();
  } catch (error) {
    reportError(error);
  }
});

await loadProviders();
applyState(await api.state());

async function loadProviders() {
  providers = await api.providers();
  elements.provider.replaceChildren(...providers.map((provider) => option(
    provider.id,
    `${provider.name}${provider.auth ? ' · connected' : ''}`,
  )));
  renderModels();
}

function renderModels() {
  const provider = selectedProvider();
  elements.model.replaceChildren(
    option('', provider?.auth ? 'Choose a model' : 'Sign in first'),
    ...(provider?.auth ? provider.models.map((model) => option(model.id, model.name ?? model.id)) : []),
  );
  elements.login.textContent = provider?.auth ? 'Reconnect' : 'Sign in';
}

function applyState(next) {
  state = next;
  const ready = Boolean(state?.agent?.ready);
  const busy = Boolean(state?.agent?.streaming);
  elements['agent-state'].textContent = busy
    ? 'Navigating…'
    : ready ? `${state.model.name ?? state.model.id} ready` : 'Choose a model';
  elements.prompt.disabled = !ready || busy;
  elements.send.disabled = !ready || busy;
  elements.abort.disabled = !busy;
  if (state?.model) {
    elements.provider.value = state.model.provider;
    renderModels();
    elements.model.value = state.model.id;
  }
}

function setBusy(busy) {
  if (!state) return;
  state.agent.streaming = busy;
  applyState(state);
}

function addMessage(role, text) {
  const node = document.createElement('div');
  node.className = `message ${role}`;
  node.textContent = text;
  elements.messages.append(node);
  node.scrollIntoView({ block: 'end' });
  return node;
}

function appendAssistantDelta(delta) {
  if (typeof delta !== 'string' || !delta) return;
  if (!streamingMessage) {
    streamingMessage = addMessage('assistant', '');
    streamingMessage.classList.add('streaming');
  }
  streamingMessage.textContent += delta;
  streamingMessage.scrollIntoView({ block: 'end' });
}

function finishAssistantMessage(text) {
  if (!streamingMessage) {
    addMessage('assistant', text);
    return;
  }
  streamingMessage.textContent = text;
  streamingMessage.classList.remove('streaming');
  streamingMessage.scrollIntoView({ block: 'end' });
  streamingMessage = null;
}

function startStep(event) {
  removeEmptyState(elements.activity);
  const request = event.args ?? {};
  const node = document.createElement('article');
  node.className = 'voyage-step running';

  const heading = document.createElement('div');
  heading.className = 'step-heading';
  const ordinal = document.createElement('span');
  ordinal.className = 'step-number';
  ordinal.textContent = String(++stepNumber).padStart(2, '0');
  const title = document.createElement('strong');
  title.textContent = request.intent?.trim() || 'Unstated research question';
  const status = document.createElement('span');
  status.className = 'step-status';
  status.textContent = 'running';
  heading.append(ordinal, title, status);

  const operation = document.createElement('p');
  operation.className = 'step-operation';
  operation.textContent = describeCommand(request);
  const result = document.createElement('div');
  result.className = 'step-result muted';
  result.textContent = 'Waiting for the research engine…';
  const narration = document.createElement('div');
  narration.className = 'step-narration';

  node.append(heading, operation, result, narration);
  elements.activity.append(node);
  node.scrollIntoView({ block: 'end' });
  steps.set(event.toolCallId, { node, request, status, result, narration });
}

function finishStep(event) {
  const step = steps.get(event.toolCallId);
  if (!step) return;
  const details = event.result?.details;
  const outcome = details?.response ? details : null;
  const batch = Array.isArray(details?.executions) ? details : null;
  const failedResponse = batch?.executions.find(({ receipt }) => receipt?.ok === false);
  step.node.classList.remove('running');
  step.node.classList.toggle('failed', event.isError || outcome?.response?.ok === false || failedResponse);
  step.status.textContent = event.isError || outcome?.response?.ok === false || failedResponse
    ? 'failed' : 'complete';
  step.result.className = 'step-result';
  step.result.replaceChildren(...(batch ? batchResultFacts(batch) : resultFacts(outcome, event)));

  step.node.append(lazyRawDetails(details, event));

  if (outcome) retainEvidence(outcome, stepNumberFor(step.node));
  for (const execution of batch?.executions ?? []) {
    retainEvidence(execution, stepNumberFor(step.node));
  }
  pendingNarration = step;
  step.node.scrollIntoView({ block: 'end' });
}

function lazyRawDetails(details, event) {
  const raw = document.createElement('details');
  raw.className = 'step-raw';
  const summary = document.createElement('summary');
  const batchExecutions = Array.isArray(details?.executions) ? details.executions : null;
  summary.textContent = batchExecutions
    ? 'Raw commands and responses'
    : 'Raw command and response';
  const pre = document.createElement('pre');
  pre.textContent = batchExecutions
    ? 'Open to load the retained controller records.'
    : 'Open to load the retained controller record.';
  let loaded = false;
  raw.addEventListener('toggle', async () => {
    if (!raw.open || loaded) return;
    loaded = true;
    if (batchExecutions) {
      pre.textContent = 'Loading retained command records…';
      try {
        const executions = await Promise.all(batchExecutions.map(async (execution) => ({
          intent: execution.intent,
          record: await api.commandRecord(execution.receipt.commandId),
        })));
        pre.textContent = JSON.stringify({
          intent: details.intent,
          batch: details.batch,
          executions,
        }, null, 2);
      } catch (error) {
        pre.textContent = `Unable to load the retained command records: ${error?.message ?? error}`;
      }
      return;
    }
    const commandId = details?.receipt?.commandId;
    if (!commandId) {
      pre.textContent = JSON.stringify(event.result, null, 2);
      return;
    }
    pre.textContent = 'Loading retained command record…';
    try {
      const record = await api.commandRecord(commandId);
      pre.textContent = JSON.stringify({ intent: details.intent, ...record }, null, 2);
    } catch (error) {
      pre.textContent = `Unable to load the retained command record: ${error?.message ?? error}`;
    }
  });
  raw.append(summary, pre);
  return raw;
}

function attachNarration(text) {
  if (!pendingNarration) return;
  const label = document.createElement('p');
  label.className = 'narration-label';
  label.textContent = 'Agent observation and decision';
  const body = document.createElement('p');
  body.textContent = text;
  pendingNarration.narration.replaceChildren(label, body);
  pendingNarration = null;
}

function resultFacts(outcome, event) {
  if (!outcome) return [fact('Result', event.isError ? 'Tool execution failed' : 'No structured outcome')];
  const receipt = outcome.receipt ?? {};
  const response = outcome.response ?? {};
  const result = response.result ?? {};
  const nodes = [];
  if (receipt.handle) {
    nodes.push(fact(
      'Result',
      `${receipt.handle.id} · ${receipt.handle.kind} · ${receipt.handle.count} ${countUnit(result)}`,
    ));
  } else if (response.ok) {
    nodes.push(fact('Result', `${outcome.command.command} completed`));
  }
  const completeness = completenessText(result, receipt);
  if (completeness) nodes.push(fact('Completeness', completeness));
  const resolution = resolutionText(result);
  if (resolution) nodes.push(fact('Evidence', resolution));
  if (receipt.warnings?.length) nodes.push(fact('Warnings', receipt.warnings.join(' '), 'warning'));
  if (receipt.error) nodes.push(fact('Error', `${receipt.error.code}: ${receipt.error.message}`, 'error'));
  return nodes.length ? nodes : [fact('Result', 'Command completed; no compact result facts declared.')];
}

function batchResultFacts(details) {
  const nodes = [fact(
    'Batch',
    `${details.batch.executed} of ${details.batch.requested} commands executed`,
    details.batch.stoppedOnFailure ? 'warning' : '',
  )];
  for (const execution of details.executions) {
    const receipt = execution.receipt ?? {};
    const label = execution.command?.command ?? 'command';
    if (receipt.error) {
      nodes.push(fact(label, `${receipt.error.code}: ${receipt.error.message}`, 'error'));
    } else if (receipt.handle) {
      nodes.push(fact(label, `${receipt.handle.id} · ${receipt.handle.kind} · ${receipt.handle.count}`));
    } else {
      nodes.push(fact(label, receipt.ok ? 'completed' : 'failed'));
    }
  }
  return nodes;
}

function fact(label, value, className = '') {
  const node = document.createElement('p');
  node.className = `result-fact ${className}`.trim();
  const key = document.createElement('span');
  key.textContent = `${label}: `;
  const content = document.createTextNode(value);
  node.append(key, content);
  return node;
}

function countUnit(result) {
  return result.summary?.countUnit ?? (result.handle?.kind === 'relations' ? 'rows' : 'items');
}

function completenessText(result, receipt) {
  const external = result.external ?? {};
  const completeness = external.completeness ?? result.completeness ?? result.summary?.completeness ?? {};
  const bounds = receipt.external?.boundsReached ?? completeness.boundsReached ?? result.bounds?.boundsReached;
  const parts = [
    receipt.external?.status ? `attempt ${receipt.external.status}` : null,
    completeness.attemptStatus ? `attempt ${completeness.attemptStatus}` : null,
    completeness.exhaustive === false || result.exhaustive === false ? 'not exhaustive' : null,
    result.sizeBounded ? 'presentation size-bounded' : null,
    Array.isArray(bounds) && bounds.length ? `bounds: ${bounds.join(', ')}` : null,
    Number.isInteger(result.omitted) && result.omitted ? `${result.omitted} omitted` : null,
  ].filter(Boolean);
  return [...new Set(parts)].join(' · ');
}

function resolutionText(result) {
  const resolution = result.summary?.evidenceResolution
    ?? result.coverage?.evidenceResolution
    ?? result.evidenceResolution;
  if (!resolution || typeof resolution !== 'object') return null;
  return Object.entries(resolution)
    .filter(([, value]) => Number.isFinite(value))
    .map(([key, value]) => `${key} ${value}`)
    .join(' · ');
}

function describeCommand(request) {
  if (Array.isArray(request.commands)) {
    return `Run ${request.commands.length} predetermined commands`;
  }
  const command = request.command ?? request.action ?? 'research';
  const source = request.input ? ` from ${request.input}` : '';
  const destination = request.resultId ? ` into ${request.resultId}` : '';
  const focus = command === 'schema' && request.parameters?.operation
    ? ` for ${request.parameters.operation}` : '';
  return `${humanize(command)}${focus}${source}${destination}`;
}

function humanize(value) {
  return String(value).replaceAll('-', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function stepNumberFor(node) {
  return node.querySelector('.step-number')?.textContent ?? '?';
}

function retainEvidence(outcome, sourceStep) {
  const result = outcome.response?.result;
  if (!result || !Array.isArray(result.preview)) return;
  const items = result.preview.slice(0, 8);
  for (const rawItem of items) {
    const item = rawItem?.preview && typeof rawItem.preview === 'object' ? rawItem.preview : rawItem;
    const card = evidenceCard(item, outcome.command.input, sourceStep);
    if (!card) continue;
    evidenceCards.set(card.key, card);
  }
  renderEvidence();
}

function evidenceCard(item, sourceHandle, sourceStep) {
  if (!item || typeof item !== 'object') return null;
  if (item.type === 'account') {
    return {
      key: `account:${item.publicKey ?? item.id}`,
      type: 'account',
      id: item.publicKey ?? item.id,
      title: item.displayName ?? item.name ?? shortId(item.publicKey ?? item.id),
      text: item.descriptionExcerpt,
      meta: evidenceMeta(item),
      sourceHandle,
      sourceStep,
    };
  }
  if (item.type === 'event' && item.kind === 0 && item.author?.publicKey) {
    return {
      key: `account:${item.author.publicKey}`,
      type: 'account',
      id: item.author.publicKey,
      title: item.author.displayName ?? item.author.name ?? shortId(item.author.publicKey),
      text: item.author.descriptionExcerpt,
      meta: evidenceMeta(item),
      sourceHandle,
      sourceStep,
    };
  }
  if (item.type === 'event') {
    return {
      key: `event:${item.id}`,
      type: item.kind === 1 ? 'note' : `event · kind ${item.kind}`,
      id: item.id,
      title: item.author?.displayName ?? item.author?.name ?? shortId(item.author?.publicKey),
      text: item.contentExcerpt,
      meta: evidenceMeta(item),
      sourceHandle,
      sourceStep,
    };
  }
  return null;
}

function evidenceMeta(item) {
  return [
    item.resolutionSource,
    item.resolved === false ? 'unresolved' : null,
    Number.isInteger(item.relayCount) ? `${item.relayCount} relays` : null,
    Number.isInteger(item.createdAt) ? new Date(item.createdAt * 1000).toLocaleString() : null,
  ].filter(Boolean).join(' · ');
}

function renderEvidence() {
  removeEmptyState(elements.evidence);
  const cards = [...evidenceCards.values()].slice(-60);
  elements.evidence.replaceChildren(...cards.map(renderEvidenceCard));
  elements['evidence-kind'].textContent = `${cards.length} stable ${cards.length === 1 ? 'object' : 'objects'}`;
}

function renderEvidenceCard(card) {
  const node = document.createElement('article');
  node.className = 'evidence-card';
  const heading = document.createElement('div');
  heading.className = 'evidence-heading';
  const type = document.createElement('span');
  type.className = 'evidence-type';
  type.textContent = card.type;
  const source = document.createElement('span');
  source.className = 'muted';
  source.textContent = `step ${card.sourceStep}`;
  heading.append(type, source);
  const title = document.createElement('strong');
  title.textContent = card.title || 'Unnamed subject';
  const id = document.createElement('code');
  id.textContent = card.id;
  node.append(heading, title, id);
  if (card.text !== undefined) {
    const excerpt = document.createElement('p');
    excerpt.textContent = card.text || '(empty content)';
    node.append(excerpt);
  }
  if (card.meta) {
    const meta = document.createElement('small');
    meta.textContent = card.meta;
    node.append(meta);
  }
  return node;
}

function shortId(value) {
  return typeof value === 'string' && value.length > 14
    ? `${value.slice(0, 7)}…${value.slice(-5)}` : value;
}

function removeEmptyState(node) {
  node.querySelector('.empty-state')?.remove();
}

function showAuthNotice(event) {
  const text = event.message ?? event.instructions
    ?? (event.userCode ? `Use code ${event.userCode} at ${event.verificationUri}` : 'Authentication opened in your browser.');
  elements['setup-status'].textContent = text;
}

function showAuthPrompt(event) {
  activeLoginRequest = event.requestId;
  const prompt = event.prompt;
  elements['login-label'].textContent = prompt.message;
  elements['login-answer'].type = prompt.type === 'secret' ? 'password' : 'text';
  elements['login-answer'].placeholder = prompt.placeholder ?? '';
  if (prompt.type === 'select') {
    elements['login-answer'].hidden = true;
    elements['login-select'].hidden = false;
    elements['login-select'].replaceChildren(...prompt.options.map((item) => option(item.id, item.label)));
    elements['login-select'].focus();
  } else {
    elements['login-answer'].hidden = false;
    elements['login-select'].hidden = true;
    elements['login-answer'].focus();
  }
  elements['login-answer'].value = '';
  elements['login-prompt'].hidden = false;
}

function hideAuthPrompt() {
  activeLoginRequest = null;
  elements['login-prompt'].hidden = true;
  elements['login-answer'].value = '';
  elements['login-select'].replaceChildren();
}

function clearVoyage() {
  elements.messages.replaceChildren();
  elements.activity.replaceChildren(emptyState('The narrated research path will appear here.'));
  elements.evidence.replaceChildren(emptyState('Notes and accounts shown during the voyage will remain here.'));
  elements['evidence-kind'].textContent = 'No notes or accounts yet';
  stepNumber = 0;
  pendingNarration = null;
  streamingMessage = null;
  steps.clear();
  evidenceCards.clear();
}

function emptyState(text) {
  const node = document.createElement('p');
  node.className = 'empty-state';
  node.textContent = text;
  return node;
}

function selectedProvider() {
  return providers.find((provider) => provider.id === elements.provider.value);
}

function option(value, label) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
}

function reportError(error) {
  addMessage('error', error?.message ?? String(error));
}
}
