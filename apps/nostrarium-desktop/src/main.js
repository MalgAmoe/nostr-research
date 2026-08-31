import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  shell,
} from 'electron';
import { EncryptedCredentialStore } from './credential-store.js';
import { createDesktopRuntime } from './runtime.js';

const directory = fileURLToPath(new URL('.', import.meta.url));
let window;
let runtime;
const authPrompts = new Map();

void app.whenReady().then(start).catch((error) => {
  console.error(error);
  app.quit();
});

async function start() {
  const credentials = new EncryptedCredentialStore({
    file: join(app.getPath('userData'), 'credentials.enc'),
    safeStorage,
  });

  runtime = createDesktopRuntime({
    credentials,
    emit: (event) => send('nostrarium:event', event),
  });

  window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 600,
    backgroundColor: '#090b0d',
    show: false,
    webPreferences: {
      preload: join(directory, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  handle('nostrarium:state', () => runtime.state());
  handle('nostrarium:providers', () => runtime.providers());
  handle('nostrarium:reset-session', () => runtime.resetSession());
  handle('nostrarium:logout', ({ providerId }) => runtime.logout(string(providerId, 'providerId')));
  handle('nostrarium:select-model', ({ providerId, modelId }) => runtime.selectModel(
    string(providerId, 'providerId'),
    string(modelId, 'modelId'),
  ));
  handle('nostrarium:prompt', ({ message }) => runtime.prompt(string(message, 'message')));
  handle('nostrarium:steer', ({ message }) => runtime.steer(string(message, 'message')));
  handle('nostrarium:abort', () => runtime.abort());
  handle('nostrarium:login', ({ providerId, method }) => runtime.login(
    string(providerId, 'providerId'),
    string(method, 'method'),
    createAuthInteraction(),
  ));
  handle('nostrarium:answer-login', ({ requestId, value }) => {
    const prompt = authPrompts.get(string(requestId, 'requestId'));
    if (!prompt) throw new Error('Authentication prompt is no longer active.');
    prompt.resolve(string(value, 'value', { allowEmpty: true }));
    authPrompts.delete(requestId);
    return { accepted: true };
  });

  await window.loadFile(join(directory, 'renderer', 'index.html'));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
}

app.on('before-quit', () => {
  for (const prompt of authPrompts.values()) prompt.reject(new Error('Application closed.'));
  authPrompts.clear();
});

app.on('window-all-closed', async () => {
  await runtime?.close().catch(() => {});
  app.quit();
});

function handle(channel, action) {
  ipcMain.handle(channel, async (event, input = {}) => {
    assertTrusted(event);
    if (!isPlainObject(input)) throw new TypeError('IPC input must be an object.');
    return action(input);
  });
}

function createAuthInteraction() {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    notify(event) {
      if (event.type === 'auth_url') openAuthUrl(event.url);
      send('nostrarium:event', { type: 'auth-notice', event });
    },
    prompt(authPrompt) {
      const requestId = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const cleanup = () => authPrompts.delete(requestId);
        authPrompt.signal?.addEventListener('abort', () => {
          cleanup();
          reject(authPrompt.signal.reason ?? new Error('Authentication prompt cancelled.'));
        }, { once: true });
        authPrompts.set(requestId, {
          resolve: (value) => { cleanup(); resolve(value); },
          reject: (error) => { cleanup(); reject(error); },
        });
        send('nostrarium:event', {
          type: 'auth-prompt',
          requestId,
          prompt: structuredClone({ ...authPrompt, signal: undefined }),
        });
      });
    },
  };
}

function openAuthUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Only HTTPS authentication URLs are allowed.');
  void shell.openExternal(url.href);
}

function send(channel, value) {
  if (window && !window.isDestroyed()) window.webContents.send(channel, value);
}

function assertTrusted(event) {
  if (!window || event.sender !== window.webContents) throw new Error('Untrusted IPC sender.');
  const url = event.senderFrame?.url ?? '';
  if (!url.startsWith('file://')) throw new Error('Untrusted IPC origin.');
}

function string(value, name, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > 20_000) {
    throw new TypeError(`${name} is invalid.`);
  }
  return value;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
