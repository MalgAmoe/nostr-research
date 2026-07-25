import { inspect as nodeInspect } from 'node:util';
import repl from 'node:repl';
import {
  acquireRelayEvents,
  createResearchSession,
  createResearchWorkspace,
  openResearchMemory,
  ResearchMemoryError,
} from './index.js';

const DEFAULT_CAPACITY = 500;
const PREVIEW_LIMIT = 5;
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

    events(query = {}) {
      return workspace.select(query);
    },

    accounts(query = {}) {
      return memory.asCollection(memory.searchAccounts(query));
    },

    use(value) {
      return session.replace(value).selection;
    },

    inspect(reference, options = {}) {
      return workspace.inspect(reference, options);
    },

    traverse(valueOrOptions, maybeOptions) {
      if (maybeOptions === undefined) return session.traverse(valueOrOptions).selection;
      return workspace.traverse(valueOrOptions, maybeOptions);
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
