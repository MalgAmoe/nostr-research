import { inspect as nodeInspect } from 'node:util';
import repl from 'node:repl';
import {
  acquireRelayEvents,
  createInMemoryResearchMemory,
  createResearchSession,
  expandResearch,
  hydrateAccounts,
  ResearchMemoryError,
  resolveReplyContexts,
} from './index.js';
import { normalizeExpansionOptions } from './expansion.js';
import { normalizeReplyContextOptions } from './reply-contexts.js';
import { facetResearchCollection, showResearchValue } from './presentation.js';

const DEFAULT_CAPACITY = 500;
const PREVIEW_LIMIT = 5;
const HELP = `Usage: nostr-research-console --capacity <1-1000>

Starts a process-local JavaScript research REPL. The prepared research object
owns one bounded in-memory corpus and one explicit active selection.

Read/return operations:
  acquire(options), hydrate(accounts, options), events(query), accounts(query)
  currentEvent(account, kind), follows(account), connections(result, options)
  expand(result, options), replyContexts(accounts, options)
  traverse(result, options), exclude(result, predicate), distinctBy(result, selector)
  limitPer(result, selector, limit), discoveries(result), facets(result)
  compare(left, right), lookup(subject), inspect(subject), project(value, options), show(value, options)
  annotated(query), summary()
  collection(items, context); memory and activeSelection expose current state

State operations:
  activate(result)             replace the active selection
  annotate(subject, value)     attach process-local labels and a note
  removeAnnotation(subject)    remove a process-local annotation
  retain(result, name, options) retain an explicit result
  checkpoint(name, options)    retain the active selection

Research operations never activate their results implicitly. Top-level await
is available. State is lost on close or process exit. Use .exit or Ctrl-D to
cancel owned operations and close the corpus.
`;

export async function startResearchConsole(args, streams = {}) {
  const options = parseArguments(args);
  if (options.help) {
    (streams.output ?? process.stdout).write(HELP);
    return;
  }

  const input = streams.input ?? process.stdin;
  const output = streams.output ?? process.stdout;
  const error = streams.error ?? process.stderr;
  const memory = createInMemoryResearchMemory({ capacity: options.capacity });
  const environment = createResearchEnvironment(memory, error);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    environment.close();
  };

  const server = repl.start({
    prompt: input.isTTY && output.isTTY ? 'research> ' : '',
    input,
    output,
    terminal: Boolean(input.isTTY && output.isTTY),
    useGlobal: false,
    ignoreUndefined: true,
    writer: createBoundedWriter(environment),
  });
  server.context.research = environment.research;
  server.on('exit', close);
  server.on('error', (replError) => {
    error.write(`REPL error: ${replError.message}\n`);
    close();
  });
}

export function createResearchEnvironment(memory, progress = process.stderr) {
  let session = createResearchSession(memory);
  const activeAcquisitions = new Set();

  const research = {
    get memory() { return memory; },
    get activeSelection() { return session.selection; },

    summary() {
      const state = session.describe();
      return {
        corpus: memory.describe(),
        activeSelection: {
          selectionCount: state.selection.items.length,
          action: state.action,
        },
      };
    },

    async acquire(options) {
      const controller = new AbortController();
      activeAcquisitions.add(controller);
      const suppliedSignal = options?.signal;
      const abort = () => controller.abort(suppliedSignal?.reason);
      suppliedSignal?.addEventListener('abort', abort, { once: true });
      if (suppliedSignal?.aborted) abort();
      const request = { ...options, signal: controller.signal };
      progress.write(
        `Acquiring from ${options?.relays?.length ?? 0} relay(s), `
        + `observation limit ${options?.observationLimit ?? 100}, `
        + `distinct-event limit ${options?.distinctEventLimit ?? 100}...\n`,
      );
      try {
        const result = await acquireRelayEvents(memory, request);
        progress.write(
          `Acquisition ${result.completionReason}: `
          + `${result.counts.acceptedObservations} accepted observation(s), `
          + `${result.counts.distinctEventsAcquired} distinct event(s), `
          + `${result.additions.added.length} corpus event(s) added, `
          + `${result.additions.evicted.length} evicted.\n`,
        );
        return result;
      } catch (error) {
        error.message = `Relay acquisition failed: ${error.message}`;
        throw error;
      } finally {
        suppliedSignal?.removeEventListener('abort', abort);
        activeAcquisitions.delete(controller);
      }
    },

    async expand(selection, options) {
      normalizeExpansionOptions(memory, selection, options);
      const controller = new AbortController();
      activeAcquisitions.add(controller);
      const suppliedSignal = options?.signal;
      const abort = () => controller.abort(suppliedSignal?.reason);
      suppliedSignal?.addEventListener('abort', abort, { once: true });
      if (suppliedSignal?.aborted) abort();
      progress.write(
        `Expanding through ${options?.relays?.length ?? 0} relay(s), `
        + `depth ${options?.depth ?? 1}, `
        + `observation limit ${options?.observationLimit ?? 100}, `
        + `distinct-event limit ${options?.distinctEventLimit ?? 100}`
        + (options?.authoredLimit === undefined
          ? ''
          : `, authored-note limit ${options.authoredLimit} per starting account`)
        + '...\n',
      );
      try {
        const result = await expandResearch(memory, selection, {
          ...options,
          signal: controller.signal,
        });
        const report = result.context.expansion;
        progress.write(
          `Expansion ${report.completionReason}: ${report.requestCount} request(s), `
          + `${report.counts.acceptedObservations} accepted observation(s), `
          + `${report.counts.distinctEventsAcquired} distinct event(s), `
          + `${report.corpusAfter.eventCount} resident event(s).\n`,
        );
        return result;
      } finally {
        suppliedSignal?.removeEventListener('abort', abort);
        activeAcquisitions.delete(controller);
      }
    },

    async replyContexts(accounts, options) {
      normalizeReplyContextOptions(memory, accounts, options);
      const controller = new AbortController();
      activeAcquisitions.add(controller);
      const suppliedSignal = options?.signal;
      const abort = () => controller.abort(suppliedSignal?.reason);
      suppliedSignal?.addEventListener('abort', abort, { once: true });
      if (suppliedSignal?.aborted) abort();
      progress.write(
        `Resolving reply contexts through ${options?.relays?.length ?? 0} relay(s), `
        + `authored limit ${options?.authoredLimit ?? 20}, `
        + `parent limit ${options?.parentLimit ?? 20}...\n`,
      );
      try {
        const result = await resolveReplyContexts(memory, accounts, {
          ...options,
          signal: controller.signal,
        });
        progress.write(
          `Reply contexts ${result.report.completionReason}: `
          + `${result.report.replyCount} reply/replies, `
          + `${result.report.unresolvedParentCount} unresolved parent(s), `
          + `${result.report.counts.acceptedObservations} accepted observation(s), `
          + `${result.report.counts.distinctEventsAcquired} distinct event(s).\n`,
        );
        return result;
      } finally {
        suppliedSignal?.removeEventListener('abort', abort);
        activeAcquisitions.delete(controller);
      }
    },

    async hydrate(accounts, options) {
      const controller = new AbortController();
      activeAcquisitions.add(controller);
      const suppliedSignal = options?.signal;
      const abort = () => controller.abort(suppliedSignal?.reason);
      suppliedSignal?.addEventListener('abort', abort, { once: true });
      if (suppliedSignal?.aborted) abort();
      progress.write(
        `Hydrating accounts from ${options?.relays?.length ?? 0} relay(s), `
        + `kinds ${(options?.kinds ?? [0]).join(', ')}...\n`,
      );
      try {
        const result = await hydrateAccounts(memory, accounts, {
          ...options,
          signal: controller.signal,
        });
        progress.write(
          `Hydration ${result.completionReason}: `
          + `${result.counts.distinctEventsAcquired} distinct event(s), `
          + `${result.additions.added.length} corpus event(s) added.\n`,
        );
        return result;
      } finally {
        suppliedSignal?.removeEventListener('abort', abort);
        activeAcquisitions.delete(controller);
      }
    },

    events(query = {}) {
      return memory.select(query);
    },

    accounts(query = {}) {
      return memory.asCollection(memory.searchAccounts(query));
    },

    currentEvent(account, kind, options = {}) {
      return memory.currentEvent(account, kind, options);
    },

    lookup(subject) {
      return memory.lookup(subject);
    },

    follows(account) {
      if (account === undefined) {
        throw new ResearchMemoryError('An explicit account is required for follows.');
      }
      return memory.follows(account);
    },

    connections(selection, options = {}) {
      return memory.connections(selection, options);
    },

    collection(items, context = {}) {
      return memory.collection(items, context);
    },

    exclude(value, predicate) {
      return transformCollection(memory, value, predicate, 'exclude',
        (items, callback) => items.filter((item, index) => !callback(item, index)));
    },

    distinctBy(value, selector) {
      return transformCollection(memory, value, selector, 'distinct-by', (items, callback) => {
        const seen = new Set();
        return items.filter((item, index) => {
          const key = callback(item, index);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
    },

    limitPer(value, selector, limit) {
      if (!Number.isSafeInteger(limit) || limit < 0) {
        throw new ResearchMemoryError('limitPer limit must be a non-negative integer.');
      }
      return transformCollection(memory, value, selector, 'limit-per', (items, callback) => {
        const counts = new Map();
        return items.filter((item, index) => {
          const key = callback(item, index);
          const count = counts.get(key) ?? 0;
          counts.set(key, count + 1);
          return count < limit;
        });
      }, { limit });
    },

    discoveries(value) {
      const collection = memory.asCollection(value);
      return memory.collection(
        collection.items.filter((item) => item.role === 'discovery'),
        transformationContext('discoveries', collection),
      );
    },

    activate(value) {
      return session.activate(value);
    },

    inspect(subject) {
      return memory.inspect(subject);
    },

    show(value, options = {}) {
      return showResearchValue(memory, session, value, options);
    },

    project(value, options = {}) {
      return memory.project(value, options);
    },

    annotate(subject, annotation) {
      return memory.annotate(subject, annotation);
    },

    annotated(query = {}) {
      return memory.annotated(query);
    },

    removeAnnotation(subject) {
      return memory.removeAnnotation(subject);
    },

    facets(value, options = {}) {
      return facetResearchCollection(memory, memory.asCollection(value), options);
    },

    traverse(selection, options) {
      if (!isPlainObject(options)) {
        throw new ResearchMemoryError('traverse expects (selection, options).');
      }
      return memory.traverse(selection, options);
    },

    compare(left, right) {
      const leftCollection = memory.asCollection(left);
      const rightCollection = memory.asCollection(right);
      const leftKeys = new Set(leftCollection.items.map(itemKey));
      const rightKeys = new Set(rightCollection.items.map(itemKey));
      return {
        leftCount: leftCollection.items.length,
        rightCount: rightCollection.items.length,
        shared: leftCollection.items.filter((item) => rightKeys.has(itemKey(item))),
        onlyLeft: leftCollection.items.filter((item) => !rightKeys.has(itemKey(item))),
        onlyRight: rightCollection.items.filter((item) => !leftKeys.has(itemKey(item))),
      };
    },

    retain(value, name, options = {}) {
      if (typeof name !== 'string') {
        throw new ResearchMemoryError('A name is required to retain an explicit result.');
      }
      return memory.retain(memory.asCollection(value), name, options);
    },

    checkpoint(name, options = {}) {
      return session.checkpoint(name, options);
    },
  };

  return {
    research,
    close() {
      for (const controller of activeAcquisitions) controller.abort();
      memory.close();
    },
  };
}

function transformCollection(memory, value, callback, operation, transform, details = {}) {
  if (typeof callback !== 'function') {
    throw new ResearchMemoryError(`${operation} requires a callback.`);
  }
  const collection = memory.asCollection(value);
  return memory.collection(
    transform(collection.items, callback),
    transformationContext(operation, collection, details),
  );
}

function transformationContext(operation, collection, details = {}) {
  return {
    operation,
    ...details,
    inputOperation: collection.context.operation,
    sourceContext: collection.context.sourceContext ?? collection.context,
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createBoundedWriter(environment) {
  return (value) => nodeInspect(boundedView(value, environment), {
    colors: Boolean(process.stdout.isTTY),
    depth: 6,
    maxArrayLength: 20,
    maxStringLength: 500,
    breakLength: 100,
    compact: 3,
  });
}

function boundedView(value, environment) {
  try {
    return environment.research.show(value);
  } catch {
    // Unknown JavaScript values still receive the generic REPL flood guard.
  }
  const collection = collectionFrom(value);
  if (collection && collection.items.length > PREVIEW_LIMIT) {
    const previewCollection = {
      ...collection,
      items: collection.items.slice(0, PREVIEW_LIMIT),
    };
    const projected = environment.research.memory.project(previewCollection, {
      mode: 'compact', previewLimit: PREVIEW_LIMIT,
    });
    return {
      type: collection.type,
      count: collection.items.length,
      context: collection.context,
      preview: projected.results,
      omitted: collection.items.length - PREVIEW_LIMIT,
    };
  }
  if (Array.isArray(value) && value.length > 20) {
    return { type: 'Array', count: value.length, preview: value.slice(0, 20), omitted: value.length - 20 };
  }
  return value;
}

function collectionFrom(value) {
  if (value?.type === 'result-collection' && Array.isArray(value.items)) return value;
  if (value?.collection?.type === 'result-collection' && Array.isArray(value.collection.items)) {
    return value.collection;
  }
  return null;
}

function itemKey(item) {
  return `${item.subject.type}:${item.subject.id}`;
}

function parseArguments(args) {
  let capacity;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (argument !== '--capacity') {
      throw new ResearchMemoryError(`Unknown startup option: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new ResearchMemoryError(`Missing value for ${argument}.`);
    }
    capacity = Number(value);
    index += 1;
  }
  if (capacity === undefined) {
    throw new ResearchMemoryError('The --capacity <1-1000> option is required.');
  }
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1000) {
    throw new ResearchMemoryError('--capacity must be an integer from 1 to 1000.');
  }
  return { capacity };
}
