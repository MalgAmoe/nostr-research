const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('callback must be a function.');
  }
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('nostrarium', Object.freeze({
  state: () => ipcRenderer.invoke('nostrarium:state'),
  commandRecord: (commandId) => ipcRenderer.invoke(
    'nostrarium:command-record',
    { commandId },
  ),
  resetSession: () => ipcRenderer.invoke('nostrarium:reset-session'),
  providers: () => ipcRenderer.invoke('nostrarium:providers'),
  login: (providerId, method) => ipcRenderer.invoke(
    'nostrarium:login',
    { providerId, method },
  ),
  answerLogin: (requestId, value) => ipcRenderer.invoke(
    'nostrarium:answer-login',
    { requestId, value },
  ),
  logout: (providerId) => ipcRenderer.invoke('nostrarium:logout', { providerId }),
  selectModel: (providerId, modelId) => ipcRenderer.invoke(
    'nostrarium:select-model',
    { providerId, modelId },
  ),
  prompt: (message) => ipcRenderer.invoke('nostrarium:prompt', { message }),
  steer: (message) => ipcRenderer.invoke('nostrarium:steer', { message }),
  abort: () => ipcRenderer.invoke('nostrarium:abort'),
  settings: () => ipcRenderer.invoke('nostrarium:settings'),
  setSetting: (key, value) => ipcRenderer.invoke('nostrarium:set-setting', { key, value }),
  deleteSetting: (key) => ipcRenderer.invoke('nostrarium:delete-setting', { key }),
  recipes: () => ipcRenderer.invoke('nostrarium:recipes'),
  recipe: (id) => ipcRenderer.invoke('nostrarium:recipe', { id }),
  saveRecipe: (recipe) => ipcRenderer.invoke('nostrarium:save-recipe', { recipe }),
  deleteRecipe: (id) => ipcRenderer.invoke('nostrarium:delete-recipe', { id }),
  onEvent: (callback) => subscribe('nostrarium:event', callback),
}));
