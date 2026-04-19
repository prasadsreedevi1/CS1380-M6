#!/usr/bin/env node

// builds searchable index from crawled readme files
// index command runs mapreduce jobs to build inverted index

const {parseIndexArgs, printJson, printTable, formatIndexStats, printError} = require('./cliHelpers.js');
const {runIndex} = require('../pipelines/indexPipeline.js');
const {ensureGitgleGroup} = require('../runtime/ensureGitgleGroup.js');

async function main() {
  try {
    const options = parseIndexArgs(process.argv.slice(2));
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

    runIndex(options, runtime, (err, summary) => {
      if (err) {
        printError(err);
        process.exit(1);
      }

      if (options.json) {
        printJson(summary);
      } else {
        const formatted = formatIndexStats(summary);
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
