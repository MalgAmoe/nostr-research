import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  shell,
} from 'electron';
import { normalizeSessionConfiguration } from '@nostr-research/memory';
import { DesktopAppStore } from './app-store.js';
import { EncryptedCredentialStore } from './credential-store.js';
import { createDesktopRuntime, DEFAULT_RELAYS } from './runtime.js';
import { runVoyageMode } from './voyage-mode.js';

const directory = fileURLToPath(new URL('.', import.meta.url));
const voyageMode = process.argv.includes('--voyage');
let window;
let runtime;
let appStore;
const authPrompts = new Map();

void app.whenReady().then(voyageMode ? startVoyage : start).catch((error) => {
  console.error(error);
  appStore?.close();
  appStore = null;
  app.quit();
});

async function startVoyage() {
  const credentials = new EncryptedCredentialStore({
    file: join(app.getPath('userData'), 'credentials.enc'),
    safeStorage,
  });
  appStore = openAppStore();
  try {
    await runVoyageMode({
      credentials,
      defaultRelays: configuredRelays(appStore),
      recipeStore: appStore,
      args: process.argv.slice(process.argv.indexOf('--voyage') + 1),
    });
  } finally {
    appStore.close();
    appStore = null;
    app.quit();
  }
}

async function start() {
  const credentials = new EncryptedCredentialStore({
    file: join(app.getPath('userData'), 'credentials.enc'),
    safeStorage,
  });
  appStore = openAppStore();

  runtime = createDesktopRuntime({
    credentials,
    defaultRelays: configuredRelays(appStore),
    recipeStore: appStore,
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
  handle('nostrarium:command-record', ({ commandId }) => runtime.commandRecord(
    string(commandId, 'commandId'),
  ));
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
  appStore?.close();
  appStore = null;
});

app.on('window-all-closed', async () => {
  if (voyageMode) return;
  await runtime?.close().catch(() => {});
  appStore?.close();
  appStore = null;
  app.quit();
});

function openAppStore() {
  const store = new DesktopAppStore({
    file: join(app.getPath('userData'), 'nostrarium.sqlite3'),
  });
  if (store.setting('relayDefaults') === null) {
    store.setSetting('relayDefaults', DEFAULT_RELAYS);
  }
  return store;
}

function configuredRelays(store) {
  return normalizeSessionConfiguration({
    relays: store.setting('relayDefaults')?.value ?? DEFAULT_RELAYS,
  }).relays;
}

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
