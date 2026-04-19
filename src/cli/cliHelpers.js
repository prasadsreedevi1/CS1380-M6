// shared helper functions for CLI
// parses flags like --language, --owner, --seed, --max
// formats output for console in tables or json format

const yargs = require('yargs');

function parseSearchArgs(args) {
  const argv = yargs(args)
      .positional('query', {
        describe: 'the search query',
        type: 'string',
      })
      .option('language', {
        alias: 'l',
        describe: 'Filter by programming language',
        type: 'string',
      })
      .option('owner', {
        alias: 'o',
        describe: 'Filter by repository owner',
        type: 'string',
      })
      .option('limit', {
        alias: 'n',
        describe: 'Maximum results to return',
        type: 'number',
        default: 10,
      })
      .option('offset', {
        describe: 'Pagination offset',
        type: 'number',
        default: 0,
      })
      .option('explain', {
        alias: 'e',
        describe: 'Show ranking explanation',
        type: 'boolean',
        default: false,
      })
      .option('json', {
        alias: 'j',
        describe: 'Output as JSON',
        type: 'boolean',
        default: false,
      })
      .option('csv', {
        describe: 'Output as CSV',
        type: 'boolean',
        default: false,
      })
      .option('demo', {
        describe: 'Load in-memory demo data instead of the gitgle index',
        type: 'boolean',
        default: false,
      })
      .argv;

  return {
    query: argv._[0] || '',
    language: argv.language,
    owner: argv.owner,
    limit: argv.limit,
    offset: argv.offset,
    explain: argv.explain,
    json: argv.json,
    csv: argv.csv,
    demo: argv.demo,
  };
}

function parseCrawlArgs(args) {
  const argv = yargs(args)
      .option('seed', {
        alias: 's',
        describe: 'Path to seed file',
        type: 'string',
        required: true,
      })
      .option('max', {
        alias: 'm',
        describe: 'Maximum repositories to crawl',
        type: 'number',
      })
      .option('timeout', {
        alias: 't',
        describe: 'Timeout in milliseconds',
        type: 'number',
        default: 3600000,
      })
      .option('json', {
        alias: 'j',
        describe: 'Output as JSON',
        type: 'boolean',
        default: false,
      })
      .argv;

  return {
    seedFile: argv.seed,
    max: argv.max,
    timeout: argv.timeout,
    json: argv.json,
  };
}

function parseIndexArgs(args) {
  const argv = yargs(args)
      .option('max', {
        alias: 'm',
        describe: 'Maximum documents to index',
        type: 'number',
      })
      .option('timeout', {
        alias: 't',
        describe: 'Timeout in milliseconds',
        type: 'number',
      })
      .option('merge', {
        describe: 'Merge with previous jobs',
        type: 'array',
      })
      .option('rebuild', {
        describe: 'Rebuild entire index',
        type: 'boolean',
        default: false,
      })
      .option('json', {
        alias: 'j',
        describe: 'Output as JSON',
        type: 'boolean',
        default: false,
      })
      .argv;

  return {
    max: argv.max,
    timeout: argv.timeout,
    merge: argv.merge,
    rebuild: argv.rebuild,
    json: argv.json,
  };
}

function printSearchResults(results, options = {}) {
  if (!Array.isArray(results) || results.length === 0) {
    console.log('No results found.');
    return;
  }

  if (options.json) {
    printJson(results);
    return;
  }

  if (options.csv) {
    printCSV(results);
    return;
  }

  // Pretty print
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.repo || result.docId || 'unknown'}`);
    if (result.owner) console.log(`   Owner: ${result.owner}`);
    if (result.score !== undefined) console.log(`   Score: ${result.score.toFixed(4)}`);
    if (result.metadata?.stars) console.log(`   Stars: ${result.metadata.stars}`);
    if (result.metadata?.language) console.log(`   Language: ${result.metadata.language}`);
    if (options.explain && result.explanation) {
      console.log(`   Terms: ${result.explanation.matchedTerms?.join(', ') || 'N/A'}`);
    }
    console.log('');
  });
}

function printTable(data, columns) {
  if (!Array.isArray(data)) {
    data = [data];
  }

  if (data.length === 0) {
    console.log('(empty)');
    return;
  }

  const cols = columns || Object.keys(data[0]);
  const header = cols.map(col => padRight(col, 20)).join(' | ');
  console.log(header);
  console.log('-'.repeat(Math.min(header.length, 120)));

  data.forEach(row => {
    const values = cols.map(col => {
      const val = row[col];
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val || '');
      return padRight(str, 20);
    }).join(' | ');
    console.log(values);
  });
}

function printCSV(data, columns) {
  if (!Array.isArray(data)) {
    data = [data];
  }

  if (data.length === 0) return;

  const cols = columns || Object.keys(data[0]);
  console.log(cols.map(escapeCSV).join(','));

  data.forEach(row => {
    const values = cols.map(col => {
      const val = row[col];
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val || '');
      return escapeCSV(str);
    });
    console.log(values.join(','));
  });
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printError(error) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`ERROR: ${msg}`);
}

function padRight(str, width) {
  const s = String(str);
  if (s.length >= width) return s.substring(0, width);
  return s + ' '.repeat(width - s.length);
}

function escapeCSV(str) {
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatCrawlStats(stats) {
  return {
    'Job ID': stats.jobId,
    'Seeds Loaded': stats.seedsLoaded,
    'Repos Processed': stats.reposProcessed,
    'Successful': stats.successful,
    'Failed': stats.failed,
    'Total Size (MB)': (stats.totalBytes / 1024 / 1024).toFixed(2),
    'Duration (s)': Math.round(stats.duration / 1000),
  };
}

function formatIndexStats(stats) {
  return {
    'Job ID': stats.jobId,
    'Documents Indexed': stats.docsIndexed,
    'Unique Terms': stats.uniqueTerms,
    'Total Postings': stats.totalPostings,
    'Total Size (MB)': (stats.totalBytes / 1024 / 1024).toFixed(2),
    'Duration (s)': Math.round(stats.duration / 1000),
  };
}

module.exports = {
  parseSearchArgs,
  parseCrawlArgs,
  parseIndexArgs,
  printSearchResults,
  printTable,
  printCSV,
  printJson,
  printError,
  formatCrawlStats,
  formatIndexStats,
};
