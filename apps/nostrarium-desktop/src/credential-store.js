import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class EncryptedCredentialStore {
  #file;
  #safeStorage;
  #tail = Promise.resolve();

  constructor({ file, safeStorage }) {
    if (typeof file !== 'string' || !file) throw new TypeError('file is required.');
    if (!safeStorage || typeof safeStorage.encryptString !== 'function') {
      throw new TypeError('Electron safeStorage is required.');
    }
    this.#file = file;
    this.#safeStorage = safeStorage;
  }

  async read(providerId, options = {}) {
    abortIfNeeded(options.signal);
    const credentials = await this.#load();
    return clone(credentials[providerId]);
  }

  async list(options = {}) {
    abortIfNeeded(options.signal);
    const credentials = await this.#load();
    return Object.entries(credentials).map(([providerId, credential]) => ({
      providerId,
      type: credential.type,
    }));
  }

  modify(providerId, fn, options = {}) {
    const operation = this.#tail.then(async () => {
      abortIfNeeded(options.signal);
      const credentials = await this.#load();
      const next = await fn(clone(credentials[providerId]));
      abortIfNeeded(options.signal);
      if (next !== undefined) {
        credentials[providerId] = clone(next);
        await this.#save(credentials);
      }
      return clone(credentials[providerId]);
    });
    this.#tail = operation.catch(() => {});
    return operation;
  }

  delete(providerId, options = {}) {
    const operation = this.#tail.then(async () => {
      abortIfNeeded(options.signal);
      const credentials = await this.#load();
      if (Object.hasOwn(credentials, providerId)) {
        delete credentials[providerId];
        await this.#save(credentials);
      }
    });
    this.#tail = operation.catch(() => {});
    return operation;
  }

  async #load() {
    this.#assertEncryption();
    let encrypted;
    try {
      encrypted = await readFile(this.#file);
    } catch (error) {
      if (error?.code === 'ENOENT') return {};
      throw error;
    }
    const text = this.#safeStorage.decryptString(encrypted);
    const value = JSON.parse(text);
    if (!isPlainObject(value)) throw new Error('Credential file is invalid.');
    return value;
  }

  async #save(credentials) {
    this.#assertEncryption();
    await mkdir(dirname(this.#file), { recursive: true });
    const temporary = `${this.#file}.tmp`;
    const encrypted = this.#safeStorage.encryptString(JSON.stringify(credentials));
    await writeFile(temporary, encrypted, { mode: 0o600 });
    await rename(temporary, this.#file);
  }

  #assertEncryption() {
    if (!this.#safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure credential storage is unavailable on this system.');
    }
    if (process.platform === 'linux'
        && this.#safeStorage.getSelectedStorageBackend?.() === 'basic_text') {
      throw new Error('A secure Linux credential store is required; basic_text is not accepted.');
    }
  }
}

function abortIfNeeded(signal) {
  if (signal?.aborted) throw signal.reason ?? new Error('Operation aborted.');
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
