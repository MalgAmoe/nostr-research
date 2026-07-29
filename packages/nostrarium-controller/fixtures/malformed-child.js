if (process.argv.some((argument) => argument.endsWith('nostr-research-session.js'))) {
  process.stderr.write(`diagnostic-${'x'.repeat(8_000)}\n`);
  process.stdout.write(`not-json-${'y'.repeat(2_000)}\n`);
}
