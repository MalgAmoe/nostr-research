import { chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA_VERSION = 1;
const MAX_SETTING_BYTES = 64_000;
const MAX_RECIPE_BYTES = 32_000;

export class DesktopAppStore {
  #database;
  #now;
  #closed = false;

  constructor({ file, now = () => Date.now() }) {
    if (typeof file !== 'string' || !file) throw new TypeError('file is required.');
    if (typeof now !== 'function') throw new TypeError('now must be a function.');
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.#database = new DatabaseSync(file);
    this.#now = now;
    this.#database.exec('PRAGMA foreign_keys = ON;');
    if (file !== ':memory:') {
      this.#database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
      chmodSync(file, 0o600);
    }
    this.#migrate();
  }

  schemaVersion() {
    this.#assertOpen();
    return this.#database.prepare('PRAGMA user_version;').get().user_version;
  }

  setting(key) {
    this.#assertOpen();
    const normalized = identifier(key, 'setting key');
    const row = this.#database.prepare(
      'SELECT value_json, updated_at FROM app_settings WHERE key = ?',
    ).get(normalized);
    return row ? { key: normalized, value: parseJson(row.value_json), updatedAt: row.updated_at } : null;
  }

  settings() {
    this.#assertOpen();
    return this.#database.prepare(
      'SELECT key, value_json, updated_at FROM app_settings ORDER BY key',
    ).all().map((row) => ({
      key: row.key,
      value: parseJson(row.value_json),
      updatedAt: row.updated_at,
    }));
  }

  setSetting(key, value) {
    this.#assertOpen();
    const normalized = identifier(key, 'setting key');
    const encoded = encodeJson(value, MAX_SETTING_BYTES, 'setting value');
    const updatedAt = timestamp(this.#now());
    this.#database.prepare(`
      INSERT INTO app_settings (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `).run(normalized, encoded, updatedAt);
    return { key: normalized, value: clone(value), updatedAt };
  }

  deleteSetting(key) {
    this.#assertOpen();
    const normalized = identifier(key, 'setting key');
    const result = this.#database.prepare('DELETE FROM app_settings WHERE key = ?').run(normalized);
    return { key: normalized, deleted: result.changes === 1 };
  }

  recipes() {
    this.#assertOpen();
    return this.#database.prepare(`
      SELECT id, name, origin_voyage_id, revision, created_at, updated_at
      FROM recipes
      ORDER BY updated_at DESC, id ASC
    `).all().map(recipeMetadata);
  }

  recipe(id) {
    this.#assertOpen();
    const normalized = identifier(id, 'recipe id');
    const row = this.#database.prepare(`
      SELECT id, name, definition_json, origin_voyage_id, revision, created_at, updated_at
      FROM recipes
      WHERE id = ?
    `).get(normalized);
    return row ? recipeRecord(row) : null;
  }

  saveRecipe({ id, name, definition, originVoyageId = null }) {
    this.#assertOpen();
    const normalizedId = identifier(id, 'recipe id');
    const normalizedName = text(name, 'recipe name', 200);
    const normalizedOrigin = originVoyageId === null
      ? null
      : text(originVoyageId, 'originVoyageId', 200);
    if (!isPlainObject(definition)) throw new TypeError('recipe definition must be an object.');
    const encoded = encodeJson(definition, MAX_RECIPE_BYTES, 'recipe definition');
    const current = this.#database.prepare(
      'SELECT revision, created_at FROM recipes WHERE id = ?',
    ).get(normalizedId);
    const updatedAt = timestamp(this.#now());
    const revision = current ? current.revision + 1 : 1;
    const createdAt = current?.created_at ?? updatedAt;
    this.#database.prepare(`
      INSERT INTO recipes (
        id, name, definition_json, origin_voyage_id, revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        definition_json = excluded.definition_json,
        origin_voyage_id = excluded.origin_voyage_id,
        revision = excluded.revision,
        updated_at = excluded.updated_at
    `).run(
      normalizedId, normalizedName, encoded, normalizedOrigin, revision, createdAt, updatedAt,
    );
    return this.recipe(normalizedId);
  }

  deleteRecipe(id) {
    this.#assertOpen();
    const normalized = identifier(id, 'recipe id');
    const result = this.#database.prepare('DELETE FROM recipes WHERE id = ?').run(normalized);
    return { id: normalized, deleted: result.changes === 1 };
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    this.#database.close();
  }

  #migrate() {
    const version = this.schemaVersion();
    if (version > SCHEMA_VERSION) {
      throw new Error(`Application database schema ${version} is newer than supported ${SCHEMA_VERSION}.`);
    }
    if (version === SCHEMA_VERSION) return;
    this.#database.exec('BEGIN IMMEDIATE;');
    try {
      if (version < 1) {
        this.#database.exec(`
          CREATE TABLE app_settings (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL
          ) STRICT;

          CREATE TABLE recipes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            definition_json TEXT NOT NULL,
            origin_voyage_id TEXT,
            revision INTEGER NOT NULL CHECK (revision >= 1),
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          ) STRICT;

          PRAGMA user_version = 1;
        `);
      }
      this.#database.exec('COMMIT;');
    } catch (error) {
      this.#database.exec('ROLLBACK;');
      throw error;
    }
  }

  #assertOpen() {
    if (this.#closed) throw new Error('Application store is closed.');
  }
}

function recipeMetadata(row) {
  return {
    id: row.id,
    name: row.name,
    originVoyageId: row.origin_voyage_id,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recipeRecord(row) {
  return {
    ...recipeMetadata(row),
    definition: parseJson(row.definition_json),
  };
}

function identifier(value, name) {
  const normalized = text(value, name, 100);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(normalized)) {
    throw new TypeError(`${name} contains unsupported characters.`);
  }
  return normalized;
}

function text(value, name, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new TypeError(`${name} is invalid.`);
  }
  return value.trim();
}

function encodeJson(value, maximumBytes, name) {
  assertJsonData(value, name, new Set());
  const encoded = JSON.stringify(value);
  if (Buffer.byteLength(encoded, 'utf8') > maximumBytes) {
    throw new RangeError(`${name} exceeds ${maximumBytes} bytes.`);
  }
  return encoded;
}

function assertJsonData(value, name, ancestors) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${name} must contain finite numbers.`);
    return;
  }
  if (typeof value !== 'object') throw new TypeError(`${name} must be JSON-serializable.`);
  if (ancestors.has(value)) throw new TypeError(`${name} must not contain cycles.`);
  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new TypeError(`${name} must contain only JSON objects and arrays.`);
  }
  ancestors.add(value);
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    assertJsonData(child, name, ancestors);
  }
  ancestors.delete(value);
}

function parseJson(value) {
  return JSON.parse(value);
}

function timestamp(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('now() returned an invalid timestamp.');
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
