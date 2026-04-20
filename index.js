#!/usr/bin/env node

// gitgle search engine - main entry point

const readline = require('readline');
const {runCrawl} = require('./src/pipelines/crawlPipeline.js');
const {runIndex} = require('./src/pipelines/indexPipeline.js');
const {executeSearch} = require('./src/pipelines/searchPipeline.js');
const {ensureGitgleGroup} = require('./src/runtime/ensureGitgleGroup.js');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  brightWhite: '\x1b[97m',
  magenta: '\x1b[35m',
};

const HELP_MESSAGE = `
available commands:
  add <owner>/<repo>     - add a repository
  search <query>         - search repositories
  status                 - show system status
  help                   - show this message
  exit                   - quit

examples:
  search python framework
  add google/go
  exit
`;

function showLoadingScreen() {
  console.clear();
  console.log(`${colors.brightWhite}`);
  console.log(`
     ██████╗ ██╗████████╗ ██████╗ ██╗     ███████╗
    ██╔════╝ ██║╚══██╔══╝██╔════╝ ██║     ██╔════╝
    ██║  ███╗██║   ██║   ██║  ███╗██║     █████╗
    ██║   ██║██║   ██║   ██║   ██║██║     ██╔══╝
    ╚██████╔╝██║   ██║   ╚██████╔╝███████╗███████╗
     ╚═════╝ ╚═╝   ╚═╝    ╚═════╝ ╚══════╝╚══════╝

           ${colors.cyan}GitHub README Search Engine${colors.brightWhite}

${colors.reset}`);
}

function showReadyScreen() {
  console.log('');
}

const distribution = require('./distribution.js')({ip: '127.0.0.1', port: 3000});

distribution.node.start((err) => {
  if (err) {
    console.error(`${colors.yellow}[Warning] Distribution startup: ${err.message}${colors.reset}`);
  }
  
  console.log(`${colors.green}Initializing GitGle...${colors.reset}`);
  
  ensureGitgleGroup((err) => {
    if (err) {
      console.error(`${colors.yellow}[Warning] Group initialization: ${err.message}${colors.reset}`);
      console.log(`${colors.cyan}Continuing with local-only mode...${colors.reset}\n`);
    }

    runPipeline();
  });

  function runPipeline() {
    const runtime = {
      store: distribution.gitgle && distribution.gitgle.store ? distribution.gitgle.store : null,
      executor: distribution.gitgle && distribution.gitgle.mr ? distribution.gitgle.mr : null,
    };

    showLoadingScreen();
    
    if (runtime.store && runtime.executor) {
      const crawlOptions = {seedFile: 'data/seeds/github-repos.txt'};
      
      console.log(`${colors.cyan}Starting crawl...${colors.reset}`);
      
      runCrawl(crawlOptions, runtime, (err, crawlStats) => {
        if (err) {
          // Crawl failed silently, continue with available data
          startInteractiveSearch(runtime);
          return;
        }

        console.log(`${colors.green}✓ Crawl complete${colors.reset}`);
        console.log(`${colors.cyan}Starting index...${colors.reset}`);

        runIndex({}, runtime, (err, indexStats) => {
          if (err) {
          } else {
            console.log(`${colors.green}✓ Index complete${colors.reset}`);
          }
          
          console.log(`\n${colors.green}══════════════════════════════════${colors.reset}`);
          console.log(`${colors.green}✓ Ready for search!${colors.reset}`);
          console.log(`${colors.green}══════════════════════════════════${colors.reset}\n`);
          
          startInteractiveSearch(runtime);
        });
      });
    } else {
      console.log(`${colors.cyan}Starting search (local mode)...${colors.reset}\n`);
      startInteractiveSearch(runtime);
    }
  }

  /**
   * Interactive search CLI
   */
  function startInteractiveSearch(runtime) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    function prompt() {
      rl.question(`${colors.magenta}gitgle> ${colors.reset}`, (input) => {
        const trimmed = input.trim();
        const trimmedLower = trimmed.toLowerCase();

        // EXIT COMMAND
        if (trimmedLower === 'exit' || trimmedLower === 'quit') {
          console.log(`${colors.cyan}Goodbye! ${colors.reset}`);
          process.exit(0);
        }

        // HELP COMMAND
        if (trimmedLower === 'help') {
          console.log(`${colors.cyan}${HELP_MESSAGE}${colors.reset}`);
          prompt();
          return;
        }

        // STATUS COMMAND - Show system status
        if (trimmedLower === 'status') {
          console.log(`${colors.green}=== System Status ===${colors.reset}`);
          console.log(`Node ID: ${colors.blue}${distribution.nodeID || 'unknown'}${colors.reset}`);
          if (distribution.all && distribution.all.store) {
            console.log(`Store: ${colors.green}active${colors.reset}`);
          }
          console.log('');
          prompt();
          return;
        }

        // EMPTY INPUT
        if (trimmedLower === '') {
          prompt();
          return;
        }

        // SEARCH QUERY (default)
        const query = trimmed;

        executeSearch(query, {limit: 10}, runtime, (err, results) => {
          if (err) {
            console.log(`${colors.cyan}Search failed: ${err.message}${colors.reset}`);
          } else if (results.total === 0) {
            console.log(`${colors.cyan}No results found for "${query}"${colors.reset}`);
          } else {
            console.log(`${colors.green}Found ${results.total} repositories:${colors.reset}\n`);
            results.results.forEach((r, i) => {
              // Repository header
              console.log(`  ${i + 1}. ${colors.blue}${r.owner}/${r.repo}${colors.reset}`);

              // Metadata: stars, language, score
              const metadata = `${r.stars} ⭐ | ${r.language} | Score: ${r.score.toFixed(3)}`;
              console.log(`     ${colors.cyan}${metadata}${colors.reset}`);

              // Description
              if (r.description) {
                console.log(`     ${r.description.substring(0, 70)}...`);
              }

              if (r.snippet) {
                const snippetText = r.snippet
                  .replace(/\*\*/g, '') // Remove markdown bold markers for display
                  .substring(0, 100);
                console.log(`     ${colors.yellow}Excerpt:${colors.reset} ${snippetText}...`);
              }

              if (r.termMetadata) {
                const meta = r.termMetadata;
                const termStats = `freq: ${meta.frequency} | density: ${meta.density}%`;
                console.log(`     ${colors.magenta}${termStats}${colors.reset}`);
              }

              console.log('');
            });
          }
          console.log('');
          prompt();
        });
      });
    }

    prompt();
  }
});
