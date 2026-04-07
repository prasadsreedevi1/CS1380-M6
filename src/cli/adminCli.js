#!/usr/bin/env node

// admin tool for monitoring and managing the search engine
// commands: status, crawl-progress, index-stats, clear

const {parseSearchArgs, printJson, printTable, printError} = require('./cliHelpers.js');
const storageKeys = require('../services/storageKeys.js');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  try {
    const runtime = global.runtime || require('../runtime/distribution.js');
    const store = runtime.store;

    switch (command) {
      case 'status':
        await showStatus(store);
        break;

      case 'crawl-progress':
        await showCrawlProgress(store, args[1]);
        break;

      case 'index-stats':
        await showIndexStats(store);
        break;

      case 'clear':
        await clearAllData(store);
        break;

      case 'help':
        printHelp();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    printError(error);
    process.exit(1);
  }
}

async function showStatus(store) {
  console.log('\n=== M6 System Status ===\n');

  // Get index statistics
  const indexKey = storageKeys.indexStatsKey();
  store.get(indexKey, (err, stats) => {
    if (stats && stats.indices) {
      const indices = Object.entries(stats.indices);
      console.log(`Current Indices: ${indices.length}`);
      indices.forEach(([jobId, stat]) => {
        console.log(`  - ${jobId}`);
        console.log(`    Documents: ${stat.docsIndexed}`);
        console.log(`    Terms: ${stat.uniqueTerms}`);
      });
    } else {
      console.log('No indices found');
    }

    console.log('\nUse "admin-cli.js crawl-progress <jobId>" for crawl details');
    console.log('Use "admin-cli.js index-stats" for index details\n');
  });
}

async function showCrawlProgress(store, jobId) {
  if (!jobId) {
    console.error('Job ID required. Usage: admin-cli.js crawl-progress <jobId>');
    process.exit(1);
  }

  const frontierKey = storageKeys.frontierKey(jobId);
  const seenKey = storageKeys.seenReposKey(jobId);

  console.log(`\n=== Crawl Progress for ${jobId} ===\n`);

  store.get(frontierKey, (err, frontier) => {
    const queue = frontier || [];
    console.log(`Frontier Queue Size: ${queue.length}`);

    store.get(seenKey, (err, seen) => {
      const seenCount = seen ? Object.keys(seen).length : 0;
      const successful = seen ? Object.values(seen).filter(e => e.success).length : 0;

      console.log(`Total Repositories Seen: ${seenCount}`);
      console.log(`Successfully Crawled: ${successful}`);
      console.log(`Failed: ${seenCount - successful}`);
      console.log();
    });
  });
}

async function showIndexStats(store) {
  console.log('\n=== Index Statistics ===\n');
  const indexKey = storageKeys.indexStatsKey();

  store.get(indexKey, (err, stats) => {
    if (!stats || !stats.indices) {
      console.log('No index data found');
      return;
    }

    const table = Object.entries(stats.indices).map(([jobId, stat]) => ({
      'Job ID': jobId,
      'Documents': stat.docsIndexed,
      'Terms': stat.uniqueTerms,
      'Postings': stat.totalPostings,
      'Created': new Date(stat.createdAt).toISOString(),
    }));

    printTable(table);
  });
}

async function clearAllData(store) {
  console.log('\n⚠ Clearing all M6 data...\n');

  const keysPattern = ['crawl:*', 'doc:*', 'inv:*', 'df:*', 'tf:*', 'meta:*', 'stats:*'];
  // Note: This is simplified - actual implementation would scan all keys

  console.log('Please manually clear the store using your M4 store interface');
  console.log('Or restart your nodes to clear in-memory storage\n');
}

function printHelp() {
  console.log(`
M6 Admin CLI Usage:

  node admin-cli.js <command> [options]

Commands:
  status                     - Show system status
  crawl-progress <jobId>     - Show crawling progress for job
  index-stats                - Show indexing statistics
  clear                      - Clear all data
  help                       - Show this help message

Examples:
  node admin-cli.js status
  node admin-cli.js crawl-progress crawl-1234567890
  node admin-cli.js index-stats

`);
}

main();
