#!/usr/bin/env node

/**
 * crawl command - loads README files from GitHub repositories listed in seed file
 */

const { parseCrawlArgs, printJson, printError } = require('./cliHelpers.js');
const { runCrawl } = require('../pipelines/crawlPipeline.js');

async function main() {
  try {
    const options = parseCrawlArgs(process.argv.slice(2));
    const summary = await runCrawl(options);
    printJson(summary);
  } catch (error) {
    printError(error);
    process.exit(1);
  }
}

main();
