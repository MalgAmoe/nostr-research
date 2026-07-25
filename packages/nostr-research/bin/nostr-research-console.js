#!/usr/bin/env node

import { startResearchConsole } from '../src/console.js';

startResearchConsole(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});
