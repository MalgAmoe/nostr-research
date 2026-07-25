CHANGES_REQUIRED

1. The documented root launcher is not machine-readable as shown. `npm run research -- --db … search` writes npm’s script banner to stdout before the JSON, causing `JSON.parse` to fail. Update the root/package README invocation to use a quiet local command such as `npm run --silent research -- …`, and add boundary coverage that parses stdout from the documented root invocation.