# Nostrarium desktop

The local agent-operated Nostrarium application. It embeds Pi's agent runtime,
the Nostrarium controller, and one in-process research session. Users do not
install or run Pi separately.

This first slice is deliberately narrow. It provides one encrypted OpenAI
Codex login, one visible research tool, a persistent in-process voyage, human
intervention, and bounded evidence presentation before wider interface work
begins.

```sh
npm run dev --workspace @nostrarium/desktop
```

Sign in with an eligible ChatGPT account, choose a model, and ask the agent to
begin from a bounded random field. The app opens OAuth pages in the system
browser; credentials are encrypted in Electron's application-data directory
and never enter the renderer.

The renderer is sandboxed and receives no Node, credential, filesystem, shell,
or raw IPC access. The embedded agent receives only the Nostrarium research
command tool—no coding, shell, file, browser, or arbitrary-network tools.
