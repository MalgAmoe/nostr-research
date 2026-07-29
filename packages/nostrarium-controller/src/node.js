import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const executable = fileURLToPath(
  new URL('../bin/nostr-research-session.js', import.meta.resolve('@nostr-research/memory')),
);
const STDERR_LIMIT = 4_096;
const MALFORMED_LINE_LIMIT = 1_024;
const STDOUT_LINE_LIMIT = 1_048_576;

export function createNodeJsonlTransport(options = {}) {
  const configuration = validateOptions(options);
  const args = [
    executable,
    '--capacity', String(configuration.capacity),
    ...(configuration.archiveCapacity === undefined
      ? [] : ['--archive-capacity', String(configuration.archiveCapacity)]),
    ...(configuration.notebookCapacity === undefined
      ? [] : ['--notebook-capacity', String(configuration.notebookCapacity)]),
  ];
  const child = spawn(process.execPath, args, {
    cwd: configuration.workingDirectory,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let lifecycle = 'starting';
  let stdoutBuffer = Buffer.alloc(0);
  let stderrBuffer = Buffer.alloc(0);
  let stderrOmittedBytes = 0;
  let malformedLineExcerpt = null;
  let exitCode = null;
  let exitSignal = null;
  let pending = null;
  let closePromise = null;
  let latestFailure = null;
  let childClosed = false;

  child.once('spawn', () => {
    if (lifecycle === 'starting') lifecycle = 'open';
  });
  child.stdout.on('data', consumeStdout);
  child.stderr.on('data', consumeStderr);
  child.stdin.on('error', (error) => {
    fail('BROKEN_STDIN', `JSONL process stdin failed: ${error.message}`);
  });
  child.once('error', (error) => {
    fail('PROCESS_ERROR', `JSONL process failed to start or run: ${error.message}`);
  });
  child.once('exit', (code, signal) => {
    exitCode = code;
    exitSignal = signal;
    const wasClosing = lifecycle === 'closing';
    if (pending) {
      fail('PROCESS_EXIT', 'JSONL process exited before returning a response.', false);
    } else {
      lifecycle = wasClosing && code === 0 ? 'closed' : 'failed';
    }
    if (latestFailure !== null) latestFailure = diagnostics();
  });
  child.once('close', () => {
    childClosed = true;
  });

  function request(command) {
    if (!isPlainObject(command) || typeof command.commandId !== 'string') {
      return Promise.reject(new TypeError('command must be a plain object with a string commandId.'));
    }
    if (pending) {
      return Promise.reject(transportError(
        'REQUEST_IN_FLIGHT',
        'The Node JSONL transport already has a request in flight.',
      ));
    }
    if (lifecycle === 'closing' || lifecycle === 'closed' || lifecycle === 'failed') {
      return Promise.reject(transportError(
        'TRANSPORT_NOT_OPEN',
        `The Node JSONL transport is ${lifecycle}.`,
      ));
    }

    let line;
    try {
      line = `${JSON.stringify(command)}\n`;
    } catch (error) {
      return Promise.reject(new TypeError(`command must be JSON-serializable: ${error.message}`));
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        fail(
          'RESPONSE_TIMEOUT',
          `No JSONL response arrived within ${configuration.responseTimeoutMs}ms.`,
        );
      }, configuration.responseTimeoutMs);
      pending = { commandId: command.commandId, resolve, reject, timer };
      child.stdin.write(line, 'utf8', (error) => {
        if (error && pending?.commandId === command.commandId) {
          fail('BROKEN_STDIN', `Could not write JSONL request: ${error.message}`);
        }
      });
    });
  }

  function consumeStdout(chunk) {
    if (lifecycle === 'failed' || lifecycle === 'closed') return;
    stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
    if (stdoutBuffer.length > STDOUT_LINE_LIMIT && !stdoutBuffer.includes(0x0a)) {
      malformedLineExcerpt = excerpt(stdoutBuffer, MALFORMED_LINE_LIMIT);
      fail('MALFORMED_STDOUT', 'JSONL stdout line exceeded the transport limit.');
      return;
    }
    let newline;
    while ((newline = stdoutBuffer.indexOf(0x0a)) !== -1) {
      const rawLine = stdoutBuffer.subarray(0, newline);
      stdoutBuffer = stdoutBuffer.subarray(newline + 1);
      consumeLine(rawLine);
      if (lifecycle === 'failed') return;
    }
  }

  function consumeLine(rawLine) {
    let response;
    try {
      response = JSON.parse(rawLine.toString('utf8'));
    } catch {
      malformedLineExcerpt = excerpt(rawLine, MALFORMED_LINE_LIMIT);
      fail('MALFORMED_STDOUT', 'JSONL stdout contained a malformed response line.');
      return;
    }
    if (!isPlainObject(response) || typeof response.commandId !== 'string') {
      malformedLineExcerpt = excerpt(rawLine, MALFORMED_LINE_LIMIT);
      fail('MALFORMED_STDOUT', 'JSONL stdout response must be an object with a string commandId.');
      return;
    }
    if (!pending) {
      malformedLineExcerpt = excerpt(rawLine, MALFORMED_LINE_LIMIT);
      fail('UNEXPECTED_RESPONSE', 'JSONL stdout returned a response with no pending request.');
      return;
    }
    if (response.commandId !== pending.commandId) {
      malformedLineExcerpt = excerpt(rawLine, MALFORMED_LINE_LIMIT);
      fail(
        'MISMATCHED_COMMAND_ID',
        `JSONL response commandId ${JSON.stringify(response.commandId)} does not match ${JSON.stringify(pending.commandId)}.`,
      );
      return;
    }
    const settled = pending;
    pending = null;
    clearTimeout(settled.timer);
    settled.resolve(response);
  }

  function consumeStderr(chunk) {
    const available = Math.max(0, STDERR_LIMIT - stderrBuffer.length);
    stderrBuffer = Buffer.concat([stderrBuffer, chunk.subarray(0, available)]);
    stderrOmittedBytes += Math.max(0, chunk.length - available);
  }

  function fail(code, message, terminate = true) {
    if (lifecycle === 'closed' || lifecycle === 'failed') return;
    lifecycle = 'failed';
    const error = transportError(code, message);
    latestFailure = error.details;
    if (pending) {
      const settled = pending;
      pending = null;
      clearTimeout(settled.timer);
      settled.reject(error);
    }
    if (terminate && child.exitCode === null && child.signalCode === null) child.kill();
  }

  function transportError(code, message) {
    const error = new Error(message);
    error.name = 'NodeJsonlTransportError';
    error.code = code;
    error.details = diagnostics();
    return error;
  }

  function diagnostics() {
    return structuredClone({
      lifecycle,
      stderrExcerpt: stderrBuffer.toString('utf8'),
      stderrOmittedBytes,
      malformedLineExcerpt,
      exitCode,
      exitSignal,
    });
  }

  function status() {
    return {
      ...diagnostics(),
      pid: child.pid,
      pendingCommandId: pending?.commandId ?? null,
      latestFailure: latestFailure === null ? null : structuredClone(latestFailure),
    };
  }

  function close() {
    if (closePromise) return closePromise;
    if (lifecycle === 'closed') return Promise.resolve();
    closePromise = new Promise((resolve, reject) => {
      if (lifecycle === 'failed') {
        if (childClosed) resolve();
        else child.once('close', resolve);
        return;
      }
      lifecycle = 'closing';
      child.once('exit', (code, signal) => {
        if (code === 0) resolve();
        else reject(transportError(
          'PROCESS_EXIT',
          `JSONL process exited during close (code ${code}, signal ${signal}).`,
        ));
      });
      child.stdin.end((error) => {
        if (error) fail('BROKEN_STDIN', `Could not close JSONL stdin: ${error.message}`);
      });
    });
    return closePromise;
  }

  return Object.freeze({ request, status, close });
}

function validateOptions(options) {
  if (!isPlainObject(options)) throw new TypeError('options must be a plain object.');
  const allowed = new Set([
    'workingDirectory', 'capacity', 'archiveCapacity', 'notebookCapacity',
    'responseTimeoutMs',
  ]);
  for (const key of Object.keys(options)) {
    if (!allowed.has(key)) throw new TypeError(`Unsupported Node transport option: ${key}.`);
  }
  if (typeof options.workingDirectory !== 'string' || options.workingDirectory.length === 0) {
    throw new TypeError('workingDirectory must be a non-empty string.');
  }
  for (const name of ['capacity', 'archiveCapacity', 'notebookCapacity']) {
    if (options[name] !== undefined
        && (!Number.isSafeInteger(options[name]) || options[name] < 0)) {
      throw new TypeError(`${name} must be a non-negative integer.`);
    }
  }
  if (options.capacity === undefined) throw new TypeError('capacity is required.');
  if (!Number.isSafeInteger(options.responseTimeoutMs) || options.responseTimeoutMs <= 0) {
    throw new TypeError('responseTimeoutMs must be a positive integer.');
  }
  return { ...options };
}

function excerpt(buffer, limit) {
  return buffer.subarray(0, limit).toString('utf8');
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
