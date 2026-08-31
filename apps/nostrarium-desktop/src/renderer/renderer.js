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

api.onEvent((event) => {
  if (event.type === 'message' && event.message.role === 'assistant') {
    const text = event.message.text || event.message.error;
    if (text) addMessage('assistant', text);
  }
  if (event.type === 'agent_start') setBusy(true);
  if (event.type === 'agent_end') {
    setBusy(false);
    void refreshState();
  }
  if (event.type === 'tool-start') addActivity(event.args);
  if (event.type === 'tool-end') showToolResult(event);
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
}

function addActivity(command) {
  const node = document.createElement('div');
  node.className = 'activity-item';
  const title = document.createElement('strong');
  title.textContent = command.command ?? 'research';
  const detail = document.createElement('span');
  detail.textContent = ` ${command.input ? `from ${command.input}` : ''}${command.resultId ? ` → ${command.resultId}` : ''}`;
  node.append(title, detail);
  elements.activity.prepend(node);
}

function showToolResult(event) {
  const details = event.result?.details;
  const outcome = details?.response ? details : null;
  elements['evidence-kind'].textContent = outcome?.receipt?.handle?.kind
    ?? outcome?.command?.command
    ?? (event.isError ? 'Command error' : 'Research result');
  elements.evidence.textContent = JSON.stringify(outcome ?? event.result, null, 2);
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
  elements.activity.replaceChildren();
  elements.evidence.textContent = 'The agent\'s bounded research results will appear here.';
  elements['evidence-kind'].textContent = 'Nothing selected';
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
