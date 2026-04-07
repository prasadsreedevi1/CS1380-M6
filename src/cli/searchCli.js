#!/usr/bin/env node

/**
 * search command - finds README matches in the indexed repositories
 */

const { parseSearchArgs, printSearchResults, printError } = require('./cliHelpers.js');
const { runSearch } = require('../pipelines/searchPipeline.js');

async function main() {
  try {
    const options = parseSearchArgs(process.argv.slice(2));

    if (!options.query) {
      console.error('Usage: node src/cli/searchCli.js "<query>" [--language LANG] [--owner OWNER] [--limit N]');
      process.exit(1);
    }

    const results = await runSearch(options);
    printSearchResults(results);
  } catch (error) {
    printError(error);
    process.exit(1);
  }
}

main();
