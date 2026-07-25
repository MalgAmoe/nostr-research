import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  acquireRelayEvents,
  createResearchSession,
  openResearchMemory,
  subject,
} from '@nostr-research/memory';

const root = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(root, '../..');
const defaultDatabase = resolve(
  process.env.NOSTR_RESEARCH_DB ?? join(repositoryRoot, '.data/playground.sqlite'),
);
const port = Number(process.env.PORT ?? 4317);
const host = process.env.HOST ?? '127.0.0.1';

let memory;
let session;
let databasePath;
let lastAcquisition = null;

function openDatabase(path = defaultDatabase, initial) {
  const resolved = resolve(path);
  mkdirSync(dirname(resolved), { recursive: true });
  memory?.close();
  memory = openResearchMemory(resolved);
  session = createResearchSession(memory, initial);
  databasePath = resolved;
  lastAcquisition = null;
  return applicationState();
}

function applicationState() {
  if (!memory || !session) {
    return { open: false, defaultDatabase };
  }
  return {
    open: true,
    databasePath,
    session: session.describe(),
    selection: session.view('subject-list', { mode: 'full' }),
    excludedSelection: memory.project(session.exclusions, { mode: 'full' }),
    sets: memory.listSets(),
    lastAcquisition,
  };
}

function publicError(error) {
  return { error: error instanceof Error ? error.message : String(error) };
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function json(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function requireSession() {
  if (!session) throw new Error('Open a research database first.');
}

async function api(request, response, pathname, acquireEvents) {
  try {
    if (request.method === 'GET' && pathname === '/api/state') {
      return json(response, 200, applicationState());
    }
    const body = await readJson(request);
    if (request.method === 'POST' && pathname === '/api/open') {
      return json(response, 200, openDatabase(body.path || defaultDatabase));
    }
    requireSession();
    if (request.method === 'POST' && pathname === '/api/new-session') {
      session = createResearchSession(memory);
    } else if (request.method === 'POST' && pathname === '/api/open-set') {
      session = createResearchSession(memory, memory.getSet(body.id));
    } else if (request.method === 'POST' && pathname === '/api/focus') {
      session.setFocus(body.value ? subject(body.value.type, body.value.id) : null);
    } else if (request.method === 'POST' && pathname === '/api/include') {
      session.include(subject(body.value.type, body.value.id));
    } else if (request.method === 'POST' && pathname === '/api/exclude') {
      session.exclude(subject(body.value.type, body.value.id));
    } else if (request.method === 'POST' && pathname === '/api/back') {
      session.back();
    } else if (request.method === 'POST' && pathname === '/api/use-empty') {
      session.replace(memory.asCollection({ acquiredObservations: [] }), {
        action: 'select', source: 'explicit-empty-acquisition',
      });
    } else if (request.method === 'POST' && pathname === '/api/traverse') {
      session.traverse({
        relationshipTypes: [body.relationshipType],
        direction: body.direction,
        depth: 1,
        limit: Number(body.limit ?? 100),
      });
      if (body.branchName?.trim()) session.branch(body.branchName.trim());
    } else if (request.method === 'POST' && pathname === '/api/checkpoint') {
      session.checkpoint(body.name);
    } else if (request.method === 'POST' && pathname === '/api/acquire') {
      return acquire(request, response, body, acquireEvents);
    } else {
      return json(response, 404, { error: 'No such operation.' });
    }
    return json(response, 200, applicationState());
  } catch (error) {
    return json(response, 400, publicError(error));
  }
}

async function acquire(_request, response, body, acquireEvents) {
  response.writeHead(200, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-store',
  });
  const send = (value) => response.write(`${JSON.stringify(value)}\n`);
  try {
    const relays = body.relays.map((value) => value.trim()).filter(Boolean);
    const filter = {};
    if (body.kinds?.length) filter.kinds = body.kinds.map(Number);
    if (body.since !== undefined) filter.since = Number(body.since);
    if (body.until !== undefined) filter.until = Number(body.until);
    filter.limit = Number(body.eventLimit);
    const result = await acquireEvents(memory, {
      relays,
      filter,
      eventLimit: Number(body.eventLimit),
      timeoutMs: Number(body.timeoutMs),
      concurrency: Math.min(relays.length, 4),
      onProgress: (progress) => send({ type: 'progress', progress }),
    });
    lastAcquisition = {
      requested: result.requested,
      budget: result.budget,
      completionReason: result.completionReason,
      counts: result.counts,
      relays: result.relays,
      coverage: result.coverage,
    };
    if (result.collection.items.length > 0) {
      session.replace(result, {
        action: 'acquire',
        completionReason: result.completionReason,
        coverageId: result.coverage?.id,
      });
    }
    send({
      type: 'complete',
      emptyPreserved: result.collection.items.length === 0,
      state: applicationState(),
    });
  } catch (error) {
    send({ type: 'error', ...publicError(error) });
  }
  response.end();
}

function staticFile(response, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const path = resolve(root, relative);
  if (!path.startsWith(`${root}/`) || !existsSync(path)) {
    return json(response, 404, { error: 'Not found.' });
  }
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
  };
  response.writeHead(200, { 'content-type': contentTypes[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(response);
}

export function createPlaygroundServer({ acquireEvents = acquireRelayEvents } = {}) {
  return createServer((request, response) => {
    const pathname = new URL(request.url, `http://${request.headers.host ?? host}`).pathname;
    if (pathname.startsWith('/api/')) return void api(request, response, pathname, acquireEvents);
    staticFile(response, pathname);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createPlaygroundServer();
  server.listen(port, host, () => {
    console.log(`Nostr research playground: http://${host}:${port}`);
    console.log(`Default research database: ${defaultDatabase}`);
  });
  const stop = () => server.close(() => {
    memory?.close();
    process.exit(0);
  });
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
