/**
 * shared helper functions for CLI - parses flags and formats output nicely
 *
 * SEARCH FLAGS:
 * --language LANG  filter by programming language
 *   example: "React" --language JavaScript
 * --owner OWNER    filter by repository owner
 *   example: "auth" --owner facebook
 * --limit N        max results (default: 10)
 *   example: "database" --limit 5
 *
 * CRAWL FLAGS:
 * --seed FILE      path to seed file with repo list
 * --limit N        max repositories to crawl (default: 100)
 * --resume         continue from previous crawl
 * --group NAME     assign to group (default: all)
 *
 * INDEX FLAGS:
 * --source-group G read from group (default: all)
 * --out-group G    write to group (default: all)
 * --rebuild        rebuild entire index from scratch
 */

function parseSearchArgs(args) {
  const options = {
    query: '',
    language: null,
    owner: null,
    limit: 10,
  };

  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--language':
        options.language = args[++i] || null;
        break;
      case '--owner':
        options.owner = args[++i] || null;
        break;
      case '--limit':
        options.limit = Number(args[++i] || 10);
        break;
      default:
        positional.push(arg);
    }
  }

  options.query = positional.join(' ').trim();
  return options;
}

function parseCrawlArgs(args) {
  const options = {
    seedFile: null,
    limit: 100,
    resume: false,
    group: 'all',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--seed':
        options.seedFile = args[++i] || null;
        break;
      case '--limit':
        options.limit = Number(args[++i] || 100);
        break;
      case '--resume':
        options.resume = true;
        break;
      case '--group':
        options.group = args[++i] || 'all';
        break;
    }
  }

  return options;
}

function parseIndexArgs(args) {
  const options = {
    sourceGroup: 'all',
    outGroup: 'all',
    rebuild: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--source-group':
        options.sourceGroup = args[++i] || 'all';
        break;
      case '--out-group':
        options.outGroup = args[++i] || 'all';
        break;
      case '--rebuild':
        options.rebuild = true;
        break;
    }
  }

  return options;
}

function printSearchResults(results) {
  if (!Array.isArray(results) || results.length === 0) {
    console.log('No results found.');
    return;
  }

  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.repo || 'unknown repo'}`);

    const fieldsToShow = ['score', 'language', 'owner', 'stars', 'snippet', 'url'];

    fieldsToShow.forEach(field => {
      switch (field) {
        case 'score':
        case 'stars':
          if (result[field] !== undefined) console.log(`${field}: ${result[field]}`);
          break;
        case 'language':
        case 'owner':
        case 'snippet':
        case 'url':
          if (result[field]) console.log(`${field}: ${result[field]}`);
          break;
      }
    });

    console.log('');
  });
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printError(error) {
  console.error(error?.message || String(error));
}

module.exports = {
  parseSearchArgs,
  parseCrawlArgs,
  parseIndexArgs,
  printSearchResults,
  printJson,
  printError,
};
