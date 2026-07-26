import { ResearchMemoryError } from './index.js';

export function createResearchSession(memory, initial = undefined) {
  if (!memory || typeof memory.asCollection !== 'function') {
    throw new ResearchMemoryError('An open research memory is required.');
  }
  return new ResearchSession(memory, initial);
}

/**
 * The console's small amount of active-navigation state.
 *
 * Research operations do not use this object implicitly. A caller must
 * explicitly activate a result, or checkpoint the already-active result.
 */
export class ResearchSession {
  #memory;
  #selection;
  #action;

  constructor(memory, initial) {
    this.#memory = memory;
    this.#selection = initialCollection(memory, initial);
    this.#action = action('empty');
    if (initial !== undefined && initial !== null) this.#action = action('activate');
  }

  get selection() {
    return structuredClone(this.#selection);
  }

  get currentAction() {
    return structuredClone(this.#action);
  }

  activate(value) {
    this.#selection = this.#memory.asCollection(value);
    this.#action = action('activate', {
      sourceOperation: this.#selection.context.operation,
    });
    return this.selection;
  }

  checkpoint(name, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new ResearchMemoryError('Checkpoint options must be an object.');
    }
    const unknown = Object.keys(options).find((key) => !['signal'].includes(key));
    if (unknown) throw new ResearchMemoryError(`Unknown checkpoint option: ${unknown}.`);
    const saved = this.#memory.retain(this.#selection, name, {
      reason: { type: 'active-selection-checkpoint', action: this.#action },
      ...(options.signal ? { signal: options.signal } : {}),
    });
    this.#action = action('checkpoint', { setId: saved.id, name });
    return saved;
  }

  describe() {
    return {
      selection: this.selection,
      action: this.currentAction,
    };
  }
}

function initialCollection(memory, initial) {
  if (initial === undefined || initial === null) {
    return memory.collection([], { operation: 'session-empty' });
  }
  return memory.asCollection(initial);
}

function action(type, details = {}) {
  return { type, at: new Date().toISOString(), ...structuredClone(details) };
}
