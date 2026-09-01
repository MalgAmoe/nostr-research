# Desktop agent feasibility

Status: architecture decision for the next Nostrarium product phase, 2026-08-31.

## Decision

Build the first agent-operated Nostrarium application as a local Electron app
under `apps/nostrarium-desktop/`.

The application embeds Pi's libraries. It does not require the user to install
or run the Pi coding agent, and it does not require a Nostrarium server.

```text
Nostrarium desktop application
├── trusted Electron runtime
│   ├── Pi model providers and agent loop
│   ├── encrypted provider credentials
│   ├── Nostrarium research session
│   └── neutral Nostrarium controller
├── narrow preload bridge
└── sandboxed renderer
    ├── conversation
    ├── agent activity
    └── bounded evidence surfaces
```

This is a packaging and trust decision, not a new research architecture. The
existing engine and controller remain independently usable in Node and a
browser Worker.

## Why a local application

A static website is a poor first environment for the product we now want to
test:

- Pi's subscription OAuth flows are Node-only;
- direct browser API keys are extractable by the running page;
- provider CORS, OAuth, billing, and proxy behavior would dominate the product
  experiment;
- hosted inference would make Nostrarium responsible for accounts, costs,
  abuse, and credential infrastructure;
- testing agent behavior through metered API keys can be needlessly expensive
  when the navigator already has a supported inference subscription or plan.

Electron includes its own Node runtime, so users install one Nostrarium
application rather than Node, Pi, or a local companion service. The interface
still uses web technology.

## Libraries

Use only the lower Pi libraries needed by the application:

- `@earendil-works/pi-agent-core` for the stateful agent loop, streaming
  lifecycle, tool execution, steering, follow-ups, cancellation, and context
  transformation;
- `@earendil-works/pi-ai` for provider catalogs, streaming model access,
  OAuth-capable provider implementations, and the `CredentialStore` contract.

Do not build the application on `@earendil-works/pi-coding-agent`. It is a
complete coding harness with sessions, coding tools, configuration, and a TUI
that Nostrarium does not need. Do not adopt `pi-web-ui` as the product
interface; its chat components may be inspected later, but Nostrarium needs an
evidence surface rather than a generic chat shell.

At the time of this decision, Pi agent-core 0.84.4 requires Node 22.19 or
newer. Electron 42 ships Node 24.18.1, while Nostrarium currently requires Node
22.5 or newer. The runtime requirements are compatible. Exact dependency
versions should be pinned and upgraded deliberately.

Primary references:

- <https://github.com/earendil-works/pi/tree/main/packages/agent>
- <https://github.com/earendil-works/pi/tree/main/packages/ai>
- <https://github.com/earendil-works/pi/blob/main/packages/ai/README.md#browser-usage>
- <https://www.electronjs.org/docs/latest/tutorial/security>
- <https://www.electronjs.org/docs/latest/tutorial/context-isolation>
- <https://www.electronjs.org/docs/latest/api/safe-storage>

## Runtime ownership

### Trusted Electron runtime

The first implementation should keep the following together in Electron's
main process:

1. Pi's `Models` collection and agent;
2. provider login and credential refresh;
3. one in-process Nostrarium memory and declarative session;
4. one neutral navigator controller whose `request` calls
   `session.execute(command)`;
5. the adapter that exposes ordinary controller commands as an agent tool.

The controller already supports this injected in-process boundary in its
public API and functional tests. There is no reason to start a JSONL child
process or a browser Worker inside the desktop app. Plans, interactive
commands, the CLI, the browser adapter, and the desktop agent still reach the
same session executor.

Keeping the runtime in the main process is the smallest honest first slice.
The engine's current 1,000-event ceiling bounds synchronous work. If measured
voyages make the window unresponsive, the complete runtime can later move to
an Electron utility process behind the same application message boundary. Do
not build that process topology before measuring the problem.

### Sandboxed renderer

The renderer loads only packaged local application code. It has:

- no Node integration;
- context isolation and Chromium sandboxing enabled;
- a restrictive Content Security Policy;
- no raw Electron IPC surface;
- no provider credentials;
- no ability to execute code supplied by an agent or a Nostr event.

The preload script exposes a small application API with one method per
intent. It must not expose `ipcRenderer`, arbitrary channel names, filesystem
access, shell execution, or generic network requests.

Remote Nostr content is data. Notes, profile fields, URLs, and media metadata
must never be inserted as executable HTML. Opening external URLs is an
explicit human action and the main process validates the scheme before asking
the operating system to open it.

## Authentication and credentials

Pi AI's OAuth-capable providers can be used because login happens in the
trusted Node runtime. The exact providers available at any moment remain a Pi
capability, not a Nostrarium promise. Some subscriptions may have provider-
specific billing behavior.

Nostrarium should inject its own small implementation of Pi AI's
`CredentialStore` rather than import the coding agent's `auth.json` machinery.
The store should:

- keep one typed credential per provider;
- serialize `modify` operations per provider so login and token refresh cannot
  overwrite one another;
- encrypt the stored document with Electron `safeStorage`;
- keep the encrypted file under Electron's application data directory;
- expose only non-secret provider/login status to the renderer;
- fail visibly when secure storage is unavailable.

Use Electron's safe-storage API behind asynchronous application storage
methods. On Linux, detect and report a weak fallback rather than silently
presenting it as protected storage.

The first live provider should be OpenAI Codex through a ChatGPT Plus or Pro
login because it directly tests the reason for choosing a local application.
The architecture must not special-case that provider: API-key providers,
GitHub Copilot, Claude, compatible inference plans, and local endpoints should
enter through the same Pi model collection when later enabled.

OAuth redirects and device-code prompts are application events. Only known
`https:` authorization URLs may be opened externally. OAuth tokens never
cross the preload bridge.

## Agent boundary

The embedded agent is not a coding agent. It receives no shell, read, write,
edit, browser-automation, arbitrary HTTP, or package-management tools.

The first tool should be one transparent bridge to the existing session
protocol:

```text
nostrarium(command draft)
    → navigatorController.execute(draft)
    → ordinary correlated session response
```

The controller continues to allocate command IDs, serialize execution, retain
its bounded transcript, and produce compact receipts. The bridge does not
invent research operations, automatic chains, recommendations, or hidden
acquisition.

For the first slice, the tool may return the session's already-bounded response
to the model and retain the structured command, response, and receipt in tool
details for the application. Actual voyages should then determine which
responses need a smaller model projection. Do not design another projection
framework before observing context pressure.

Tool execution is sequential. This matches the controller and session's
revisioned state model. Read-only parallelism can be reconsidered only if it
later has a measured benefit and a clear snapshot contract.

Nostr events and profiles are untrusted evidence and may contain instructions
aimed at the model. The agent's system instructions must say that tool results
are evidence, never authority. More importantly, the agent's only capability
is the bounded Nostrarium command bridge. Prompt injection therefore cannot
reach filesystem, shell, credentials, or arbitrary network functions through
the agent tool set.

## Application bridge

The first preload API needs only these conceptual actions:

- read non-secret provider and model status;
- start login, answer a login prompt, or log out;
- start or close one agent/research session;
- send a human message;
- steer or abort the current agent turn;
- subscribe to sanitized agent, tool, and application-state events.

The renderer does not send raw Electron channel names. Every incoming message
is validated in the main process. Every outgoing event is structured-cloned
and stripped of credentials before crossing the bridge.

## Current product slice

The current slice supports one complete loop:

```text
human asks a research question
→ embedded agent calls visible Nostrarium commands
→ bounded evidence appears beside the conversation
→ human reacts or changes direction
→ agent continues in the same research session
```

The renderer currently contains:

1. a provider/login and model chooser;
2. a conversation stream;
3. a compact chronological tool-activity stream;
4. one evidence area capable of rendering the latest bounded note, account,
   relation, coverage, or schema response as safe structured data;
5. stop/abort and session-reset controls.

It does not need a feed, graph, dashboard, posture registry, generic windowing
system, agent-written components, persistence, export, or a polished human
Nostr client.

Live and headless voyages verify that the human can follow the agent's movement,
inspect the evidence behind its statements, intervene, and continue without
operating the command protocol.

## Explicit non-goals

The current application does not:

- change the research engine or controller API;
- make the agent autonomous or allow unattended background research;
- preserve research sessions across application restarts;
- load arbitrary agent-generated JavaScript or UI code;
- expose Pi's coding tools;
- support every provider before one complete login and voyage works.

Skills, reusable research techniques, dynamic visual vocabulary, export, and
persistence should be added only after repeated real voyages justify them.

## Main risks and decision triggers

- **Main-process responsiveness:** measure first; move the runtime as a unit to
  a utility process only if UI stalls recur.
- **Provider packaging:** a development login is insufficient; the packaged
  OAuth and lazy provider path is part of Task 3 acceptance.
- **Credential storage:** do not silently store plaintext credentials when OS
  protection is unavailable.
- **Prompt injection:** keep authority narrow; never solve it by pretending
  Nostr content is trustworthy.
- **Model context growth:** begin with bounded engine responses and controller
  receipts; introduce compact model projections only from measured voyages.
- **Pi API movement:** pin exact versions behind a small app-owned adapter so
  Pi upgrades do not spread through the renderer or research packages.

## Conclusion

The desktop direction works without replacing Nostrarium's stable core: one
trusted local runtime, one neutral controller, one complete visible research
tool, and one isolated evidence interface. Future work should preserve that
boundary and respond to repeated voyage evidence rather than speculative UI.
