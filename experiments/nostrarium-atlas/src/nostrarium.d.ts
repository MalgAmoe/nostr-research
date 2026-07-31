declare module '@nostrarium/controller' {
  export type ControllerOutcome = {
    response: Record<string, unknown>;
    receipt: Record<string, unknown>;
  };
  export type NavigatorController = {
    execute(command: Record<string, unknown>): Promise<ControllerOutcome>;
    state(): Record<string, unknown>;
    transcript(options?: Record<string, unknown>): Record<string, unknown>;
    synchronize(): Promise<Record<string, unknown>>;
    close(): Promise<void>;
  };
  export function createNavigatorController(options: {
    request(command: Record<string, unknown>): Promise<Record<string, unknown>>;
    closeTransport?: () => Promise<void> | void;
    transcript: { maxEntries: number; maxBytes: number };
  }): NavigatorController;
}

declare module '@nostrarium/controller/worker' {
  export type BrowserWorkerTransport = {
    request(command: Record<string, unknown>): Promise<Record<string, unknown>>;
    status(): Record<string, unknown>;
    close(): Promise<void> | void;
  };
  export function createBrowserWorkerTransport(options: {
    worker: Worker;
    memory: Record<string, unknown>;
    configuration?: Record<string, unknown>;
    responseTimeoutMs: number;
  }): Promise<BrowserWorkerTransport>;
}

declare module '@nostr-research/memory/browser-worker';
