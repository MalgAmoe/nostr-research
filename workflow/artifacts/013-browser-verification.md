# Playground browser verification

Date: 2026-07-25

Environment: Codex in-app browser against the documented local application at
`http://127.0.0.1:4317/`. The application server was started by the workflow
host because the worker/reviewer sandbox rejects loopback listeners with
`EPERM`.

## Live vertical slice

The browser was driven through the visible application UI:

1. Opened the fresh `.data/playground-evidence-20260725.sqlite`.
2. Set the explicit relay to `wss://nos.lol`, kind to `1`, event budget to `5`,
   and timeout to `5000` ms.
3. Acquired five live observations. The visible completion was `limit`; the
   relay outcome showed five observations, five newly stored, and zero invalid.
4. Focused one acquired event. The selection remained five and the action
   became `focus`.
5. Excluded the focused event. The current selection became four, focus was
   retained, the exclusion count became one, and the action became `exclude`.
6. Opened the provisional-exclusions panel and used its `Re-include` action.
   The selection returned to five, exclusions returned to zero, and the action
   became `include`.
7. Traversed `author` in the outbound direction and named the temporary branch
   `authors-coherent`. The action became `branch`, the context named the exact
   relationship/direction/depth/branch, and the resulting selection contained
   ten subjects: the five selected events and five distinct authors.
8. Used `Back research state`. The prior meaningful five-event selection was
   restored.
9. Saved the selection as `coherent browser checkpoint`. The action became
   `retain`, and the saved set ID was
   `4dd53043-147b-41a3-8643-277ce964da0d`.
10. Started a new empty session and observed selection count zero, then opened
    the saved set in a new session and observed the five-member selection plus
    the context `Opened durable research set
    4dd53043-147b-41a3-8643-277ce964da0d`.

## Narrow-window verification

The same application was reloaded with an explicit 420 × 800 viewport. Browser
measurements reported:

- viewport/client width: 420 px;
- document scroll width: 420 px;
- main content left/right bounds: 0/420 px.

There was no horizontal overflow at this narrow width.

## Automated boundary verification

The task validation also passed 19 library tests and the server-adapter
vertical-slice test. The system Safari WebDriver test is present. In the
workflow worker/reviewer sandbox it skips before starting Safari because the
sandbox rejects the application's loopback listener with `EPERM`. The
host-driven browser run above covers the actual-browser acceptance criterion
through the task's documented fallback.

The coherent machine-readable trace is preserved in
`workflow/artifacts/013-browser-trace.json`. It contains ten sequential visible
browser states: acquisition, focus, exclusion, re-inclusion, traversal branch,
Back, checkpoint, empty session, checkpoint reopen, and narrow viewport.

## Reproducible evidence capture

The browser smoke scenario now owns the evidence capture rather than relying
on a separately written narrative. On a macOS workflow host with Safari remote
automation enabled, run:

```sh
npm run test:playground-browser-evidence
```

The command drives a controlled acquisition, focus, exclusion and re-inclusion,
explicit inbound `reply-parent` traversal into a branch, research-state Back,
checkpoint, new session, checkpoint reopen, and a 420 × 800 responsive check.
It writes these machine-captured files:

- `013-acquired.png`
- `013-focused.png`
- `013-excluded.png`
- `013-re-included.png`
- `013-traversed-branch.png`
- `013-back.png`
- `013-checkpoint.png`
- `013-empty-session.png`
- `013-checkpoint-reopened.png`
- `013-narrow.png`
- `013-browser-trace.json`

The JSON trace records the browser URL and visible DOM state at each screenshot,
including selection subjects, focus, exclusions, action, relationship context,
relay outcome, saved set, viewport, and document width. The test also asserts
that the narrow page has no horizontal overflow. A skipped run does not create
or refresh these files and is not browser evidence.

The checked-in evidence files were captured through the Codex in-app browser
against the live `wss://nos.lol` acquisition described above because Safari
remote automation is disabled. `013-browser-trace.json` identifies that browser
and live source explicitly; the filenames and visible-state schema match the
reproducible Safari evidence command.
