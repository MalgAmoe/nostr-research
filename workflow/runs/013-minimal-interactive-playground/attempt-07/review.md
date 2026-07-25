CHANGES_REQUIRED

1. `workflow/artifacts/013-browser-trace.json` does not record the actual-browser focus, exclusion/re-inclusion, or Back states. Those actions appear only in the narrative and skipped Safari test. Record inspectable browser state for each required action so the host-driven evidence confirms the complete vertical slice.

2. The browser evidence is internally inconsistent. `013-browser-verification.md` says the reopened set is `ea6350fa-…`, while the trace and screenshot show `7768d059-…`; `013-browser-state.json` also contains the older `ea6350fa-…` set named “live browser field check.” Refresh the stale artifacts and narrative from one coherent browser run so set IDs, names, selection, and checkpoint state agree.