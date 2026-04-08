#!/usr/bin/env node

// builds searchable index from crawled readme files
// index command runs mapreduce jobs to build inverted index

const {parseIndexArgs, printJson, printTable, formatIndexStats, printError} = require('./cliHelpers.js');
const {runIndex} = require('../pipelines/indexPipeline.js');

async function main() {
  try {
    const options = parseIndexArgs(process.argv.slice(2));
    const runtime = global.runtime || require('../../distribution.js')();

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
