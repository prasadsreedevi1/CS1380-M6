#!/usr/bin/env node

/**
 * index command - builds searchable index from crawled README files
 */

const { parseIndexArgs, printJson, printError } = require('./cliHelpers.js');
const { runIndex } = require('../pipelines/indexPipeline.js');

async function main() {
  try {
    const options = parseIndexArgs(process.argv.slice(2));
    const summary = await runIndex(options);
    printJson(summary);
  } catch (error) {
    printError(error);
    process.exit(1);
  }
}

main();
