import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { createDesktopRuntime } from './runtime.js';

const DEFAULT_PROVIDER = 'openai-codex';
const DEFAULT_MODEL = 'gpt-5.6-sol';

export async function runVoyageMode({
  credentials,
  args = [],
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const options = parseVoyageArguments(args);
  const trace = await createTrace(options.output, stdout);
  let runtime;
  let finalAssistantText = '';
  try {
    runtime = createDesktopRuntime({
      credentials,
      ...(options.contextTokenLimit === null ? {} : {
        contextTokenLimit: options.contextTokenLimit,
      }),
      emit(event) {
        if (event.type === 'message-delta') return;
        trace.write({ type: 'runtime-event', at: new Date().toISOString(), event });
        if (event.type === 'message' && event.message?.role === 'assistant') {
          finalAssistantText = event.message.text || event.message.error || finalAssistantText;
          if (options.output && finalAssistantText) stderr.write(`\n${finalAssistantText}\n`);
        }
        if (options.output && event.type === 'tool-start') {
          stderr.write(`→ ${event.toolName}: ${event.args?.intent ?? 'research operation'}\n`);
        }
      },
    });

    const providers = await runtime.providers();
    const selection = selectVoyageModel(providers, options.provider, options.model);
    await runtime.selectModel(selection.providerId, selection.modelId);
    trace.write({
      type: 'voyage-ready',
      at: new Date().toISOString(),
      provider: selection.providerId,
      model: selection.modelId,
      authenticated: true,
    });

    if (!options.check) {
      const prompt = await readPrompt(options);
      trace.write({ type: 'voyage-prompt', at: new Date().toISOString(), prompt });
      await runtime.prompt(prompt);
    }

    const state = runtime.state();
    trace.write({
      type: options.check ? 'voyage-check' : 'voyage-complete',
      at: new Date().toISOString(),
      state,
      ...(finalAssistantText ? { finalAssistantText } : {}),
    });
    return { selection, state, finalAssistantText };
  } catch (error) {
    trace.write({
      type: 'voyage-error',
      at: new Date().toISOString(),
      error: { name: error?.name ?? 'Error', message: errorMessage(error) },
    });
    throw error;
  } finally {
    await runtime?.close().catch(() => {});
    await trace.close();
  }
}

export function parseVoyageArguments(args) {
  const options = {
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    prompt: null,
    promptFile: null,
    output: null,
    check: false,
    contextTokenLimit: null,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--check') options.check = true;
    else if (argument === '--provider') options.provider = nextValue(args, ++index, argument);
    else if (argument === '--model') options.model = nextValue(args, ++index, argument);
    else if (argument === '--prompt') options.prompt = nextValue(args, ++index, argument);
    else if (argument === '--prompt-file') options.promptFile = nextValue(args, ++index, argument);
    else if (argument === '--output') options.output = resolve(nextValue(args, ++index, argument));
    else if (argument === '--context-token-limit') {
      options.contextTokenLimit = integerValue(nextValue(args, ++index, argument), argument);
      if (options.contextTokenLimit < 1_000) {
        throw new Error('--context-token-limit must be at least 1000.');
      }
    }
    else throw new Error(`Unknown voyage option: ${argument}`);
  }
  if (options.prompt && options.promptFile) {
    throw new Error('Use either --prompt or --prompt-file, not both.');
  }
  if (!options.check && !options.prompt && !options.promptFile) {
    throw new Error('Voyage mode requires --prompt, --prompt-file, or --check.');
  }
  return options;
}

export function selectVoyageModel(providers, providerId, modelId) {
  const provider = providers.find(({ id }) => id === providerId);
  if (!provider) throw new Error(`Voyage provider is unavailable: ${providerId}.`);
  if (!provider.auth || provider.auth.error) {
    throw new Error(`Voyage provider is not signed in: ${providerId}. Open the desktop app and sign in first.`);
  }
  const model = provider.models.find(({ id }) => id === modelId);
  if (!model) {
    throw new Error(`Voyage model is unavailable: ${providerId}/${modelId}. No fallback model was selected.`);
  }
  return { providerId, modelId };
}

async function readPrompt(options) {
  const prompt = options.prompt ?? await readFile(options.promptFile, 'utf8');
  if (!prompt.trim()) throw new Error('Voyage prompt must not be empty.');
  return prompt.trim();
}

async function createTrace(output, stdout) {
  if (!output) {
    return {
      write(value) { stdout.write(`${JSON.stringify(value)}\n`); },
      async close() {},
    };
  }
  const stream = createWriteStream(output, { flags: 'w', mode: 0o600 });
  await once(stream, 'open');
  return {
    write(value) { stream.write(`${JSON.stringify(value)}\n`); },
    async close() {
      stream.end();
      await once(stream, 'finish');
    },
  };
}

function nextValue(args, index, option) {
  const value = args[index];
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
  return value;
}

function integerValue(value, option) {
  if (!/^\d+$/u.test(value)) throw new Error(`${option} requires an integer.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(`${option} requires a safe integer.`);
  return number;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
