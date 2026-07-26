import { ResearchMemoryError, subject } from './index.js';

const ACTIONS = new Set([
  'observe', 'focus', 'select', 'include', 'exclude', 'traverse',
  'compare', 'acquire', 'retain', 'branch', 'back',
]);

export function createResearchSession(memory, initial = undefined) {
  if (!memory || typeof memory.asCollection !== 'function') {
    throw new ResearchMemoryError('An open research memory is required.');
  }
  return new ResearchSession(memory, initial);
}

export class ResearchSession {
  #memory;
  #state;
  #history = [];
  #branches = new Map();

  constructor(memory, initial) {
    this.#memory = memory;
    this.#state = {
      selection: initialCollection(memory, initial),
      focus: null,
      exclusions: [],
      action: action('observe', { source: initialSource(initial) }),
    };
  }

  get selection() {
    return clone(this.#state.selection);
  }

  get focus() {
    return this.#state.focus ? { ...this.#state.focus } : null;
  }

  get exclusions() {
    return this.#state.exclusions.map((item) => ({ ...item }));
  }

  get currentAction() {
    return clone(this.#state.action);
  }

  get branches() {
    return [...this.#branches.keys()].sort();
  }

  replace(value, details = {}) {
    const collection = this.#memory.asCollection(value);
    return this.#transition({
      ...this.#state,
      selection: withoutSubjects(collection, this.#state.exclusions),
      action: action(details.action ?? 'select', details),
    });
  }

  setFocus(value = null) {
    const focus = value === null ? null : normalizeSubject(value);
    return this.#transition({
      ...this.#state, focus, action: action('focus', { subject: focus }),
    });
  }

  include(...values) {
    const additions = flattenSubjects(values).map(normalizeSubject);
    const excluded = new Set(additions.map(subjectKey));
    const exclusions = this.#state.exclusions.filter((item) => !excluded.has(subjectKey(item)));
    const selection = mergeCollection(this.#state.selection, additions);
    return this.#transition({
      ...this.#state, selection, exclusions,
      action: action('include', { subjects: additions }),
    });
  }

  exclude(...values) {
    const additions = flattenSubjects(values).map(normalizeSubject);
    const exclusions = uniqueSubjects([...this.#state.exclusions, ...additions]);
    return this.#transition({
      ...this.#state,
      exclusions,
      selection: withoutSubjects(this.#state.selection, additions),
      action: action('exclude', { subjects: additions }),
    });
  }

  select(query) {
    return this.replace(this.#memory.select(query), { action: 'select', query });
  }

  traverse(options) {
    return this.replace(this.#memory.traverse(this.#state.selection, options), {
      action: 'traverse', options,
    });
  }

  branch(name) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new ResearchMemoryError('A temporary branch name is required.');
    }
    const normalized = name.trim();
    this.#branches.set(normalized, snapshot(this.#state));
    this.#state = {
      ...this.#state, action: action('branch', { name: normalized }),
    };
    return this.describe();
  }

  returnToBranch(name) {
    if (!this.#branches.has(name)) {
      throw new ResearchMemoryError(`No temporary session branch named ${name}.`);
    }
    return this.#transition({
      ...snapshot(this.#branches.get(name)),
      action: action('back', { branch: name }),
    });
  }

  back() {
    if (this.#history.length === 0) return this.describe();
    const previous = this.#history.pop();
    this.#state = {
      ...previous,
      action: action('back', { previousAction: previous.action }),
    };
    return this.describe();
  }

  checkpoint(name, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new ResearchMemoryError('Checkpoint options must be an object.');
    }
    const unknown = Object.keys(options).filter(
      (key) => !['includeExclusions', 'signal'].includes(key),
    );
    if (unknown.length) throw new ResearchMemoryError(`Unknown checkpoint option: ${unknown[0]}.`);
    const reason = {
      type: 'session-checkpoint',
      action: this.#state.action,
      ...(options.includeExclusions ? { provisionalExclusions: this.#state.exclusions } : {}),
    };
    const saved = this.#memory.retain(this.#state.selection, name, {
      reason, ...(options.signal ? { signal: options.signal } : {}),
    });
    this.#history.push(snapshot(this.#state));
    this.#state = { ...this.#state, action: action('retain', { setId: saved.id, name }) };
    return saved;
  }

  view(type, options = {}) {
    if (type === 'subject-list') return this.#memory.project(this.#state.selection, options);
    if (type === 'account-list') {
      const accounts = this.#memory.traverse(this.#state.selection, {
        relationshipTypes: ['author', 'mentioned-account'],
        direction: 'outbound', depth: 1, limit: options.limit ?? 1000,
      });
      const collection = {
        ...accounts,
        items: accounts.items.filter(({ subject: item }) => item.type === 'account'),
      };
      const { limit: _limit, ...projectionOptions } = options;
      return this.#memory.project(collection, projectionOptions);
    }
    throw new ResearchMemoryError('Session view must be "subject-list" or "account-list".');
  }

  describe() {
    return {
      selection: this.selection,
      focus: this.focus,
      exclusions: this.exclusions,
      branches: this.branches,
      action: this.currentAction,
      canGoBack: this.#history.length > 0,
    };
  }

  #transition(next) {
    this.#history.push(snapshot(this.#state));
    this.#state = snapshot(next);
    return this.describe();
  }
}

function initialCollection(memory, initial) {
  if (initial === undefined || initial === null) return collection([], { operation: 'session-empty' });
  if (initial.type === 'set' || isPublicResearchSet(initial)) {
    return collection(memory.getSet(initial.id).members.map((item) => ({
      subject: subject(item.type, item.id), reasons: item.reasons,
    })), { operation: 'research-set', setId: initial.id });
  }
  if (initial.type === 'result-collection' || initial.collection || initial.results
      || initial.acquiredObservations) return memory.asCollection(initial);
  throw new ResearchMemoryError('Session initial value must be a result collection or retained selection.');
}

function isPublicResearchSet(value) {
  return value && typeof value === 'object'
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.createdAt === 'string'
    && (Array.isArray(value.members)
      || (Number.isInteger(value.memberCount) && Array.isArray(value.preview)));
}

function initialSource(initial) {
  if (!initial) return 'empty';
  return initial.type ?? 'public-result';
}

function collection(items, context) {
  return {
    type: 'result-collection',
    items: items.map((item) => ({
      subject: normalizeSubject(item.subject),
      role: item.role === 'seed' ? 'seed' : 'discovery',
      reasons: clone(item.reasons ?? []),
      provenance: clone(item.provenance ?? []),
      ...(item.record ? { record: clone(item.record) } : {}),
    })),
    context: clone(context),
  };
}

function mergeCollection(existing, subjects) {
  const result = clone(existing);
  const known = new Set(result.items.map(({ subject: item }) => subjectKey(item)));
  for (const item of subjects) {
    if (!known.has(subjectKey(item))) {
      result.items.push({
        subject: item, role: 'discovery',
        reasons: [{ type: 'session-include' }], provenance: [],
      });
      known.add(subjectKey(item));
    }
  }
  result.context = { operation: 'session-include', previous: existing.context };
  return result;
}

function withoutSubjects(value, excluded) {
  const keys = new Set(excluded.map(subjectKey));
  const result = clone(value);
  result.items = result.items.filter(({ subject: item }) => !keys.has(subjectKey(item)));
  return result;
}

function action(type, details = {}) {
  if (!ACTIONS.has(type)) throw new ResearchMemoryError(`Unsupported session action: ${type}.`);
  return { type, at: new Date().toISOString(), ...clone(details) };
}

function flattenSubjects(values) {
  return values.flatMap((value) => Array.isArray(value) ? value : [value]);
}

function normalizeSubject(value) {
  return subject(value?.type, value?.id);
}

function uniqueSubjects(values) {
  const known = new Set();
  return values.filter((item) => {
    const key = subjectKey(item);
    if (known.has(key)) return false;
    known.add(key);
    return true;
  });
}

function subjectKey(value) {
  return `${value.type}:${value.id}`;
}

function snapshot(value) {
  return clone(value);
}

function clone(value) {
  return structuredClone(value);
}
