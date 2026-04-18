#!/usr/bin/env node

// loads readme files from github repos listed in a seed file
// crawl command distributes the work across the network

const {parseCrawlArgs, printJson, printTable, formatCrawlStats, printError} = require('./cliHelpers.js');
const {runCrawl} = require('../pipelines/crawlPipeline.js');
const {ensureGitgleGroup} = require('../runtime/ensureGitgleGroup.js');

async function main() {
  try {
    const options = parseCrawlArgs(process.argv.slice(2));

    if (!options.seedFile) {
      console.error('ERROR: --seed <file> is required');
      process.exit(1);
    }

    const distribution = require('../../distribution.js')();

    await new Promise((resolve, reject) => {
      distribution.node.start((err) => (err ? reject(err) : resolve()));
    });

    await new Promise((resolve, reject) => {
      ensureGitgleGroup((err) => (err ? reject(err) : resolve()));
    });

    const runtime =
      global.runtime && global.runtime.store
        ? global.runtime
        : {
            store: distribution.gitgle.store,
            executor: distribution.gitgle.mr,
            group: distribution.gitgle,
          };

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

