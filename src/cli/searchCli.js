#!/usr/bin/env node

// finds readme matches in indexed repositories
// search command queries the inverted index and ranks results

const {parseSearchArgs, printSearchResults, printJson, printError} = require('./cliHelpers.js');
const {executeSearch} = require('../pipelines/searchPipeline.js');

async function main() {
  try {
    const options = parseSearchArgs(process.argv.slice(2));

    if (!options.query) {
      console.error('Usage: node search-cli.js "<query>" [--language LANG] [--owner OWNER] [--limit N] [--explain] [--json]');
      process.exit(1);
    }

    const runtime = global.runtime || require('../runtime/distribution.js');

    executeSearch(options.query, options, runtime, (err, result) => {
      if (err) {
        printError(err);
        process.exit(1);
      }

      if (options.json) {
        printJson(result);
      } else {
        console.log(`\nResults for: "${options.query}"`);
        console.log(`Found: ${result.total} matches (showing ${result.results.length})\n`);
        printSearchResults(result.results, options);
      }

      process.exit(0);
    });
  } catch (error) {
    printError(error);
    process.exit(1);
  }
}

main();
