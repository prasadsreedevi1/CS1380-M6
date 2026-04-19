#!/usr/bin/env node

const {parseSearchArgs, printSearchResults, printJson, printError} = require('./cliHelpers.js');
const {executeSearch} = require('../pipelines/searchPipeline.js');
const storageKeys = require('../services/storageKeys.js');
const demoRepositories = require('../data/demoRepositories.js');

const readline = require('readline');

const COLORS = {
  RESET: '\x1b[0m',
  GREEN: '\x1b[32m',
  BRIGHT_GREEN: '\x1b[1;32m',
  DIM_GREEN: '\x1b[2;32m',
  BOLD_GREEN: '\x1b[1;32m'
};

function runInteractiveSearch(runtime) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.clear();
  console.log(COLORS.BRIGHT_GREEN + '\n');
  console.log('     ██████╗ ██╗████████╗ ██████╗ ██╗     ███████╗');
  console.log('    ██╔════╝ ██║╚══██╔══╝██╔════╝ ██║     ██╔════╝');
  console.log('    ██║  ███╗██║   ██║   ██║  ███╗██║     █████╗');
  console.log('    ██║   ██║██║   ██║   ██║   ██║██║     ██╔══╝');
  console.log('    ╚██████╔╝██║   ██║   ╚██████╔╝███████╗███████╗');
  console.log('     ╚═════╝ ╚═╝   ╚═╝    ╚═════╝ ╚══════╝╚══════╝\n');
  console.log(COLORS.GREEN + '         Repository Search System');
  console.log(COLORS.BRIGHT_GREEN + '         ' + '═'.repeat(45) + '\n');
  
  console.log(COLORS.GREEN + '  COMMANDS:\n');
  console.log(COLORS.DIM_GREEN + '    • Type query to search (e.g., javascript, framework)');
  console.log(COLORS.DIM_GREEN + '    • Type "help" for more information');
  console.log(COLORS.DIM_GREEN + '    • Type "exit" to quit\n');
  console.log(COLORS.RESET);

  function prompt() {
    const promptText = COLORS.BRIGHT_GREEN + 'GITGLE> ' + COLORS.GREEN;
    rl.question(promptText, (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      if (trimmed.toLowerCase() === 'exit') {
        console.log(COLORS.BRIGHT_GREEN + '\n  [SYSTEM] Shutting down...\n' + COLORS.RESET);
        rl.close();
        process.exit(0);
      }

      if (trimmed.toLowerCase() === 'help') {
        console.log(COLORS.BRIGHT_GREEN + '\n  ─────────────────────────────');
        console.log('  SEARCH HELP');
        console.log('  ─────────────────────────────');
        console.log(COLORS.GREEN + '  Type any keywords to search\n' + COLORS.RESET);
        prompt();
        return;
      }

      // Parse query and options from input
      const parts = trimmed.split('--');
      const query = parts[0].trim().replace(/^["']|["']$/g, '');
      const options = {query: query, limit: 10};

      // Parse flags
      for (let i = 1; i < parts.length; i++) {
        const flag = parts[i].trim().split(' ');
        const flagName = flag[0];
        const flagValue = flag.slice(1).join(' ');

        if (flagName === 'language') options.language = flagValue;
        if (flagName === 'owner') options.owner = flagValue;
        if (flagName === 'limit') options.limit = parseInt(flagValue) || 10;
      }

      console.log(COLORS.BRIGHT_GREEN + '\n  [SEARCHING...]\n' + COLORS.RESET);

      executeSearch(options.query, options, runtime, (err, result) => {
        if (err) {
          console.log(COLORS.BRIGHT_GREEN + `  [ERROR] ${err.message}\n` + COLORS.RESET);
        } else {
          // Header
          console.log(COLORS.BRIGHT_GREEN + `  ─────────────────────────────────────`);
          console.log(`  RESULTS FOR: "${options.query}"`);
          console.log(`  Found ${result.total} matches (showing ${result.results.length})`);
          console.log(COLORS.BRIGHT_GREEN + `  ─────────────────────────────────────\n` + COLORS.RESET);

          // Results
          result.results.forEach((item, idx) => {
            const num = String(idx + 1).padStart(2, ' ');
            const repoFullName = `${item.owner}/${item.repo}`;
            console.log(COLORS.BRIGHT_GREEN + `  [${num}] ${COLORS.GREEN}${repoFullName}` + 
                       COLORS.DIM_GREEN + ` (${item.language || 'unknown'})` +
                       COLORS.BRIGHT_GREEN + ` [${item.score.toFixed(1)}]` + COLORS.RESET);
          });
        }

        console.log(COLORS.GREEN + '\n' + COLORS.RESET);
        prompt();
      });
    });
  }

  prompt();
}

function runSingleSearch(options, runtime) {
  console.clear();
  console.log(COLORS.BRIGHT_GREEN + '\n     ██████╗ ██╗████████╗ ██████╗ ██╗     ███████╗');
  console.log('    ██╔════╝ ██║╚══██╔══╝██╔════╝ ██║     ██╔════╝');
  console.log('    ██║  ███╗██║   ██║   ██║  ███╗██║     █████╗');
  console.log('    ██║   ██║██║   ██║   ██║   ██║██║     ██╔══╝');
  console.log('    ╚██████╔╝██║   ██║   ╚██████╔╝███████╗███████╗');
  console.log('     ╚═════╝ ╚═╝   ╚═╝    ╚═════╝ ╚══════╝╚══════╝\n' + COLORS.RESET);

  executeSearch(options.query, options, runtime, (err, result) => {
    if (err) {
      console.log(COLORS.BRIGHT_GREEN + `  [ERROR] ${err.message}\n` + COLORS.RESET);
      process.exit(1);
    }

    console.log(COLORS.BRIGHT_GREEN + `  ─────────────────────────────────────`);
    console.log(`  RESULTS FOR: "${options.query}"`);
    console.log(`  Found ${result.total} matches (showing ${result.results.length})`);
    console.log(COLORS.BRIGHT_GREEN + `  ─────────────────────────────────────\n` + COLORS.RESET);

    result.results.forEach((item, idx) => {
      const num = String(idx + 1).padStart(2, ' ');
      const repoFullName = `${item.owner}/${item.repo}`;
      console.log(COLORS.BRIGHT_GREEN + `  [${num}] ${COLORS.GREEN}${repoFullName}` + 
                 COLORS.DIM_GREEN + ` (${item.language || 'unknown'})` +
                 COLORS.BRIGHT_GREEN + ` [${item.score.toFixed(1)}]` + COLORS.RESET);
    });

    console.log(COLORS.RESET);
    process.exit(0);
  });
}

function populateDemoData(store) {
  const keyTerms = ['javascript', 'python', 'framework', 'library', 'machine', 'learning', 
                    'docker', 'kubernetes', 'react', 'node', 'build'];
  
  demoRepositories.forEach(repo => {
    const metaKey = storageKeys.documentMetadataKey(repo.owner, repo.repo);
    store.put(metaKey, {
      owner: repo.owner,
      repo: repo.repo,
      url: repo.url,
      description: repo.description,
      language: repo.language,
      stars: repo.stars
    });

    const tfKey = storageKeys.termFrequencyKey(repo.owner, repo.repo);
    const words = repo.readme.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const termFreq = {};
    words.forEach(word => {
      termFreq[word] = (termFreq[word] || 0) + 1;
    });
    store.put(tfKey, termFreq);
  });

  keyTerms.forEach(term => {
    const indexKey = storageKeys.invertedIndexKey(term);
    const postings = {};
    
    demoRepositories.forEach(repo => {
      const docId = `${repo.owner}/${repo.repo}`;
      const text = `${repo.readme} ${repo.description}`.toLowerCase();
      if (text.includes(term)) {
        postings[docId] = text.split(term).length - 1;
      }
    });

    if (Object.keys(postings).length > 0) {
      store.put(indexKey, { postings });
    }
  });

  const statsKey = storageKeys.indexStatsKey();
  store.put(statsKey, {
    docsIndexed: demoRepositories.length,
    uniqueTerms: keyTerms.length,
    totalPostings: keyTerms.length * demoRepositories.length
  });
}

async function main() {
  try {
    const options = parseSearchArgs(process.argv.slice(2));
    const runtime = global.runtime || require('../../distribution.js')();

    populateDemoData(runtime.store);

    if (options.query) {
      runSingleSearch(options, runtime);
    } else {
      runInteractiveSearch(runtime);
    }
  } catch (error) {
    printError(error);
    process.exit(1);
  }
}

main();
