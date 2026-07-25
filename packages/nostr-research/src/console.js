import { inspect as nodeInspect } from 'node:util';
import repl from 'node:repl';
import {
  acquireRelayEvents,
  createResearchSession,
  createResearchWorkspace,
  openResearchMemory,
  ResearchMemoryError,
} from './index.js';
import { facetResearchCollection, showResearchValue } from './presentation.js';

const DEFAULT_CAPACITY = 500;
const PREVIEW_LIMIT = 5;
const EXPANSION_RELATIONSHIP_TYPES = new Set([
  'author',
  'reply-root',
  'reply-parent',
  'mentioned-event',
  'quoted-event',
  'mentioned-account',
  'follow',
  'topic',
  'other-tag',
]);
const EXPANSION_OPTION_KEYS = new Set([
  'relays', 'relationshipTypes', 'direction', 'depth', 'limit',
  'timeoutMs', 'eventLimit', 'concurrency', 'signal',
]);
const HELP = `Usage: nostr-research-console --db <sqlite-path> [--capacity <1-1000>]

Starts a persistent JavaScript research REPL. The prepared research object owns
the SQLite memory, bounded workspace, and temporary session. Top-level await is
available. Use .exit or Ctrl-D to close all resources.
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
  const memory = openResearchMemory(options.database);
  let workspace;
  try {
    workspace = createResearchWorkspace(memory, { capacity: options.capacity });
  } catch (startupError) {
    memory.close();
    throw startupError;
  }

  const environment = createResearchEnvironment(memory, workspace, error);
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

export function createResearchEnvironment(memory, workspace, progress = process.stderr) {
  let session = createResearchSession(workspace);
  const activeAcquisitions = new Set();

  const research = {
    get memory() { return memory; },
    get workspace() { return workspace; },
    get session() { return session; },

    summary() {
      const state = session.describe();
      return {
        memory: memory.summary(),
        workspace: workspace.describe(),
        session: {
          selectionCount: state.selection.items.length,
          focus: state.focus,
          exclusionCount: state.exclusions.length,
          branches: state.branches,
          action: state.action,
          canGoBack: state.canGoBack,
        },
      };
    },

    load(query = {}) {
      const loaded = workspace.load(query);
      session = createResearchSession(workspace, loaded.collection);
      return loaded.collection;
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
        `Acquiring from ${options?.relays?.length ?? 0} relay(s), limit ${options?.eventLimit ?? 100}...\n`,
      );
      try {
        const result = await acquireRelayEvents(memory, request);
        const hydrated = workspace.add(result);
        progress.write(
          `Acquisition ${result.completionReason}: ${result.counts.observations} observation(s), `
          + `${hydrated.added.length} workspace event(s) added.\n`,
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
      const normalized = normalizeExpansionOptions(selection, options, workspace);
      const controller = new AbortController();
      activeAcquisitions.add(controller);
      const abort = () => controller.abort(normalized.signal?.reason);
      normalized.signal?.addEventListener('abort', abort, { once: true });
      if (normalized.signal?.aborted) abort();

      const startedAt = Date.now();
      const workspaceBefore = workspace.describe();
      const starting = workspace.asCollection(selection);
      const startingSubjects = starting.items.map(({ subject }) => structuredClone(subject));
      const requestedFilters = new Set();
      const requestedEventIds = new Set();
      const requestedAccounts = new Set();
      const requestedInboundIds = new Set();
      const requests = [];
      const totals = {
        received: 0, invalid: 0, duplicate: 0, newlyStored: 0, observations: 0,
      };
      let completionReason = 'completed';
      let firstTraversal = null;
      let unresolvedBefore = null;

      const traversalOptions = {
        relationshipTypes: normalized.relationshipTypes,
        direction: normalized.direction,
        depth: normalized.depth,
        limit: normalized.limit,
      };
      const traverse = () => {
        // Acquisitions may pressure a small FIFO workspace. Keep explicit
        // starts resident so the bounded final traversal remains possible.
        workspace.add(startingSubjects.filter(({ type }) => type === 'event'));
        return workspace.traverse(starting, traversalOptions);
      };
      const acquireFilter = async (filter) => {
        const filterKey = JSON.stringify(filter);
        if (requestedFilters.has(filterKey)) return false;
        const remainingEvents = normalized.eventLimit - totals.observations;
        const remainingTime = normalized.timeoutMs - (Date.now() - startedAt);
        if (remainingEvents <= 0) {
          completionReason = 'event-budget';
          return false;
        }
        if (remainingTime <= 0) {
          completionReason = 'timeout';
          return false;
        }
        requestedFilters.add(filterKey);
        const result = await acquireRelayEvents(memory, {
          relays: normalized.relays,
          filter,
          timeoutMs: Math.max(1, remainingTime),
          eventLimit: remainingEvents,
          concurrency: normalized.concurrency,
          signal: controller.signal,
        });
        workspace.add(result);
        for (const key of Object.keys(totals)) totals[key] += result.counts[key];
        requests.push({
          filter,
          completionReason: result.completionReason,
          counts: structuredClone(result.counts),
          relays: structuredClone(result.relays),
        });
        if (result.completionReason === 'limit') completionReason = 'event-budget';
        if (result.completionReason === 'timeout') completionReason = 'timeout';
        if (result.completionReason === 'cancelled') completionReason = 'cancelled';
        return result.counts.newlyStored > 0;
      };

      progress.write(
        `Expanding ${startingSubjects.length} subject(s) through ${normalized.relays.length} relay(s), `
        + `depth ${normalized.depth}, event limit ${normalized.eventLimit}...\n`,
      );
      try {
        // A depth-N traversal can expose a new frontier after each hydration.
        // One extra pass lets evidence fetched for the Nth hop participate in
        // the final traversal without creating an unbounded retry loop.
        for (let pass = 0; pass <= normalized.depth; pass += 1) {
          const traversed = traverse();
          if (!firstTraversal) {
            firstTraversal = traversed;
            unresolvedBefore = unresolvedExpansionTargets(workspace, memory, traversed);
          }
          hydrateDurableExpansionTargets(workspace, memory, traversed);
          const targets = unresolvedExpansionTargets(workspace, memory, traversed);
          let requested = false;

          const eventIds = targets.events.filter((id) => !requestedEventIds.has(id));
          if (eventIds.length) {
            eventIds.forEach((id) => requestedEventIds.add(id));
            requested = true;
            await acquireFilter({ ids: eventIds });
          }

          if (!['outbound'].includes(normalized.direction)
            && normalized.relationshipTypes.some((type) => (
              type === 'reply-parent' || type === 'reply-root'
            ))) {
            const inboundIds = traversed.items
              .filter((item) => (
                item.subject.type === 'event'
                && traversalItemDepth(item) < normalized.depth
              ))
              .map(({ subject }) => subject.id)
              .filter((id) => !requestedInboundIds.has(id));
            if (inboundIds.length) {
              inboundIds.forEach((id) => requestedInboundIds.add(id));
              requested = true;
              await acquireFilter({ '#e': inboundIds, kinds: [1], limit: inboundIds.length });
            }
          }

          const accounts = targets.accounts.filter((id) => !requestedAccounts.has(id));
          if (accounts.length) {
            accounts.forEach((id) => requestedAccounts.add(id));
            requested = true;
            await acquireFilter({ authors: accounts, kinds: [0], limit: accounts.length });
          }
          if (completionReason !== 'completed' || !requested) break;
        }

        const finalTraversal = traverse();
        const unresolvedAfter = unresolvedExpansionTargets(workspace, memory, finalTraversal);
        const workspaceAfter = workspace.describe();
        const traversalLimitReached = finalTraversal.items.length
          >= startingSubjects.length + normalized.limit;
        finalTraversal.context = {
          ...finalTraversal.context,
          expansion: {
            options: publicExpansionOptions(normalized),
            startingSubjects,
            workspaceBefore,
            workspaceAfter,
            requestCount: requests.length,
            filterCount: requestedFilters.size,
            counts: totals,
            requests,
            unresolvedBefore: unresolvedBefore ?? unresolvedAfter,
            unresolvedAfter,
            boundedBy: {
              depth: hasDepthBoundary(finalTraversal, normalized.depth),
              traversalLimit: traversalLimitReached,
              eventBudget: completionReason === 'event-budget',
              timeout: completionReason === 'timeout',
              cancellation: completionReason === 'cancelled',
            },
            completionReason,
          },
        };
        progress.write(
          `Expansion ${completionReason}: ${requests.length} request(s), `
          + `${totals.observations} observation(s), ${workspaceAfter.eventCount} workspace event(s).\n`,
        );
        return finalTraversal;
      } finally {
        normalized.signal?.removeEventListener('abort', abort);
        activeAcquisitions.delete(controller);
      }
    },

    events(query = {}) {
      return workspace.select(query);
    },

    accounts(query = {}) {
      return memory.asCollection(memory.searchAccounts(query));
    },

    currentEvent(account, kind, options = {}) {
      return memory.currentEvent(account, kind, options);
    },

    follows(account) {
      if (account === undefined) {
        throw new ResearchMemoryError('An explicit account is required for follows.');
      }
      return memory.follows(account);
    },

    collection(items, context = {}) {
      return workspace.collection(items, context);
    },

    exclude(value, predicate) {
      return transformCollection(workspace, value, predicate, 'exclude',
        (items, callback) => items.filter((item, index) => !callback(item, index)));
    },

    distinctBy(value, selector) {
      return transformCollection(workspace, value, selector, 'distinct-by', (items, callback) => {
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
      return transformCollection(workspace, value, selector, 'limit-per', (items, callback) => {
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
      const collection = workspace.asCollection(value);
      return workspace.collection(
        collection.items.filter((item) => item.role === 'discovery'),
        transformationContext('discoveries', collection),
      );
    },

    use(value) {
      return session.replace(value).selection;
    },

    inspect(reference, options = {}) {
      return workspace.inspect(reference, options);
    },

    show(value, options = {}) {
      return showResearchValue(memory, workspace, session, value, options);
    },

    facets(value, options = {}) {
      return facetResearchCollection(memory, workspace.asCollection(value), options);
    },

    traverse(...args) {
      if (args.length === 1) {
        const [options] = args;
        if (!isPlainObject(options) || looksLikeCollectionOrSubject(options)) {
          throw new ResearchMemoryError(
            'Session traversal requires one options object; explicit traversal requires selection and options.',
          );
        }
        return session.traverse(options).selection;
      }
      if (args.length === 2) {
        const [selection, options] = args;
        if (!isPlainObject(options)) {
          throw new ResearchMemoryError('Explicit traversal options must be an object.');
        }
        return workspace.traverse(selection, options);
      }
      throw new ResearchMemoryError(
        'traverse expects (options) or (selection, options).',
      );
    },

    compare(left, right) {
      const leftCollection = workspace.asCollection(left);
      const rightCollection = workspace.asCollection(right);
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

    retain(valueOrName, maybeName, options = {}) {
      if (typeof valueOrName === 'string') {
        return session.checkpoint(valueOrName, maybeName ?? {});
      }
      if (typeof maybeName !== 'string') {
        throw new ResearchMemoryError('A name is required to retain an explicit result.');
      }
      return workspace.retain(workspace.asCollection(valueOrName), maybeName, options);
    },
  };

  return {
    research,
    close() {
      for (const controller of activeAcquisitions) controller.abort();
      workspace.close();
      memory.close();
    },
  };
}

function transformCollection(workspace, value, callback, operation, transform, details = {}) {
  if (typeof callback !== 'function') {
    throw new ResearchMemoryError(`${operation} requires a callback.`);
  }
  const collection = workspace.asCollection(value);
  return workspace.collection(
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

function normalizeExpansionOptions(selection, options, workspace) {
  workspace.asCollection(selection);
  if (!isPlainObject(options)) {
    throw new ResearchMemoryError('Expansion options are required.');
  }
  const unknown = Object.keys(options).filter((key) => !EXPANSION_OPTION_KEYS.has(key));
  if (unknown.length) {
    throw new ResearchMemoryError(`Unknown expansion options: ${unknown.join(', ')}.`);
  }
  if (!Array.isArray(options.relays) || options.relays.length === 0) {
    throw new ResearchMemoryError('Expansion requires at least one explicit wss:// relay.');
  }
  const relays = options.relays.map((value) => {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new ResearchMemoryError(`Invalid expansion relay URL: ${value}`);
    }
    if (url.protocol !== 'wss:' || url.username || url.password || url.hash) {
      throw new ResearchMemoryError(`Expansion relay must be an explicit wss:// URL: ${value}`);
    }
    return url.href;
  });
  if (new Set(relays).size !== relays.length) {
    throw new ResearchMemoryError('Expansion relay URLs must not be repeated.');
  }
  if (!Array.isArray(options.relationshipTypes) || options.relationshipTypes.length === 0
    || options.relationshipTypes.some((type) => typeof type !== 'string')) {
    throw new ResearchMemoryError('Expansion relationshipTypes must be a non-empty string array.');
  }
  const relationshipTypes = [...new Set(options.relationshipTypes)];
  const unsupported = relationshipTypes.filter((type) => !EXPANSION_RELATIONSHIP_TYPES.has(type));
  if (unsupported.length) {
    throw new ResearchMemoryError(
      `Unsupported expansion relationship types: ${unsupported.join(', ')}.`,
    );
  }
  const direction = options.direction ?? 'outbound';
  if (!['inbound', 'outbound', 'both'].includes(direction)) {
    throw new ResearchMemoryError('Expansion direction must be "inbound", "outbound", or "both".');
  }
  const depth = boundedInteger(options.depth ?? 1, 'depth', 1, 100);
  const limit = boundedInteger(options.limit ?? 50, 'limit', 1, 1000);
  const timeoutMs = positiveInteger(options.timeoutMs ?? 10_000, 'timeoutMs');
  const eventLimit = positiveInteger(options.eventLimit ?? 100, 'eventLimit');
  const concurrency = positiveInteger(options.concurrency ?? 4, 'concurrency');
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) {
    throw new ResearchMemoryError('Expansion signal must be an AbortSignal.');
  }
  return {
    relays, relationshipTypes, direction, depth, limit,
    timeoutMs, eventLimit, concurrency, signal: options.signal,
  };
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ResearchMemoryError(`Expansion ${name} must be a positive integer.`);
  }
  return value;
}

function boundedInteger(value, name, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ResearchMemoryError(
      `Expansion ${name} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return value;
}

function publicExpansionOptions(options) {
  return {
    relays: options.relays,
    relationshipTypes: options.relationshipTypes,
    direction: options.direction,
    depth: options.depth,
    limit: options.limit,
    timeoutMs: options.timeoutMs,
    eventLimit: options.eventLimit,
    concurrency: options.concurrency,
  };
}

function unresolvedExpansionTargets(workspace, memory, collection) {
  const events = new Set();
  const accounts = new Set();
  for (const { subject } of collection.items) {
    if (subject.type === 'event' && !workspace.inspect(subject).loaded) {
      events.add(subject.id);
    } else if (subject.type === 'account') {
      const metadata = memory.currentEvent(subject.id, 0);
      if (!metadata || !workspace.inspect({ type: 'event', id: metadata.event.id }).loaded) {
        accounts.add(subject.id);
      }
    }
  }
  return { events: [...events].sort(), accounts: [...accounts].sort() };
}

function hydrateDurableExpansionTargets(workspace, memory, collection) {
  const subjects = [];
  for (const { subject } of collection.items) {
    if (subject.type === 'event' && !workspace.inspect(subject).loaded
      && memory.getEvent(subject.id)) {
      subjects.push(subject);
    } else if (subject.type === 'account') {
      const metadata = memory.currentEvent(subject.id, 0);
      if (metadata && !workspace.inspect({ type: 'event', id: metadata.event.id }).loaded) {
        subjects.push({ type: 'event', id: metadata.event.id });
      }
    }
  }
  if (subjects.length) workspace.add(subjects);
}

function hasDepthBoundary(collection, depth) {
  return collection.context.relationships.some((relationship) => relationship.depth === depth);
}

function traversalItemDepth(item) {
  if (item.role === 'seed') return 0;
  const depths = item.reasons
    .filter((reason) => reason.type === 'relationship')
    .map((reason) => reason.depth);
  return depths.length ? Math.min(...depths) : 0;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function looksLikeCollectionOrSubject(value) {
  return value.type === 'result-collection'
    || (typeof value.type === 'string' && typeof value.id === 'string')
    || value.collection !== undefined
    || value.results !== undefined
    || value.acquiredObservations !== undefined;
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
  let database;
  let capacity = DEFAULT_CAPACITY;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (argument !== '--db' && argument !== '--capacity') {
      throw new ResearchMemoryError(`Unknown startup option: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new ResearchMemoryError(`Missing value for ${argument}.`);
    }
    if (argument === '--db') database = value;
    else capacity = Number(value);
    index += 1;
  }
  if (!database) throw new ResearchMemoryError('The --db <sqlite-path> option is required.');
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1000) {
    throw new ResearchMemoryError('--capacity must be an integer from 1 to 1000.');
  }
  return { database, capacity };
}
