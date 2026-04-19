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
  add <owner>/<repo>    - add a repository
  search <query>        - search repositories
  help                  - show this message
  exit                  - quit

examples:
  tensorflow/tensorflow
  python framework
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
    
    startInteractiveSearch(runtime);
    
    if (runtime.store && runtime.executor) {
      const crawlOptions = {seedFile: 'data/seeds/github-repos.txt'};
      
      runCrawl(crawlOptions, runtime, (err, crawlStats) => {
        if (err) {
          console.error(`${colors.yellow}[Background] Crawl error: ${err.message}${colors.reset}`);
          return;
        }
        console.log(`${colors.green}[Background] Crawl complete${colors.reset}`);

        runIndex({}, runtime, (err, indexStats) => {
          if (err) {
            console.error(`${colors.yellow}[Background] Index error: ${err.message}${colors.reset}`);
            return;
          }
          console.log(`${colors.green}[Background] Indexing complete${colors.reset}`);
        });
      });
    } else {
      console.log(`${colors.yellow}[Note] Background crawl/index skipped (no runtime support)${colors.reset}\n`);
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

        // ADD COMMAND
        if (trimmedLower.startsWith('add ')) {
          const repoPath = trimmed.substring(4).trim();
          const parts = repoPath.split('/');
          
          if (parts.length !== 2 || !parts[0] || !parts[1]) {
            console.log(`${colors.cyan}Invalid format. Use: add owner/repo${colors.reset}\n`);
            prompt();
            return;
          }

          const [owner, repo] = parts;

          const githubApi = require('./src/services/githubApi.js');
          
          githubApi.getRepositoryDocument(owner, repo, null, (err, repoData) => {
            if (err) {
              console.log(`${colors.cyan}Failed to fetch: ${err.message}${colors.reset}\n`);
              prompt();
              return;
            }

            const storageKeys = require('./src/services/storageKeys.js');
            const metaKey = storageKeys.documentMetadataKey(owner, repo);
            const data = {
              owner,
              repo,
              url: `https://github.com/${owner}/${repo}`,
              description: repoData.description || '',
              language: repoData.language || 'Unknown',
              stars: repoData.stars || 0,
              topics: repoData.topics || [],
              readme: repoData.readme || '',
            };

            runtime.store.put(data, {key: metaKey, gid: 'gitgle'}, (err2) => {
              if (err2) {
                console.log(`${colors.cyan}Failed to store: ${err2.message}${colors.reset}\n`);
              } else {
                console.log(`${colors.green}Added ${owner}/${repo} to index!${colors.reset}`);
                console.log(`   ${colors.blue}${data.description}${colors.reset}`);
                console.log(`   Stars: ${data.stars} ⭐ | Language: ${data.language}\n`);
              }
              prompt();
            });
          });
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
            console.log(`${colors.green}Found ${results.total} repositories:${colors.reset}`);
            results.results.forEach((r, i) => {
              console.log(`  ${i + 1}. ${colors.blue}${r.owner}/${r.repo}${colors.reset} (${r.stars} ⭐, score: ${r.score.toFixed(2)})`);
              if (r.description) {
                console.log(`     ${r.description.substring(0, 60)}...`);
              }
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
