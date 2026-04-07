#!/usr/bin/env node

// loads readme files from github repos listed in a seed file
// crawl command distributes the work across the network

const {parseCrawlArgs, printJson, printTable, formatCrawlStats, printError} = require('./cliHelpers.js');
const {runCrawl} = require('../pipelines/crawlPipeline.js');

async function main() {
  try {
    const options = parseCrawlArgs(process.argv.slice(2));

    if (!options.seedFile) {
      console.error('ERROR: --seed <file> is required');
      process.exit(1);
    }

    const runtime = global.runtime || require('../runtime/distribution.js');

    runCrawl(options, runtime, (err, summary) => {
      if (err) {
        printError(err);
        process.exit(1);
      }

      if (options.json) {
        printJson(summary);
      } else {
        const formatted = formatCrawlStats(summary);
        printTable(formatted);
      }

      process.exit(0);
    });
  } catch (error) {
    printError(error);
    process.exit(1);
  }
}

main();

