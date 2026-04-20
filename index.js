#!/usr/bin/env node

// gitgle search engine - main entry point

const originalLog = console.log;
console.log = () => {}; 
require('dotenv').config();
console.log = originalLog; 

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
  // console.clear() causes hanging on some systems - skip it
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

let distributionReady = false;
distribution.node.start((err) => {
  distributionReady = true;
});

setTimeout(() => {
  ensureGitgleGroup((err) => {

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
      
      runCrawl(crawlOptions, runtime, (err, crawlStats) => {
        if (err) {
          // Crawl failed silently, continue with available data
          startInteractiveSearch(runtime);
          return;
        }

        runIndex({}, runtime, (err, indexStats) => {
          if (err) {
          } else {
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
                let snippetText = r.snippet
                  // Remove markdown and HTML artifacts
                  .replace(/!\[.*?\]/g, '') // Remove markdown image syntax
                  .replace(/\[.*?\]/g, '') // Remove markdown link/reference syntax  
                  .replace(/\(.*?(https?|www).*?\)/g, '') // Remove URLs in parentheses
                  .replace(/#+\s/g, '') // Remove markdown headers
                  .replace(/^[-_*=\s]+$/gm, '') // Remove horizontal rules and empty lines
                  .replace(/\|/g, '') // Remove table pipes
                  .replace(/^[-*]\s/gm, '') // Remove list markers
                  .replace(/^>\s/gm, '') // Remove blockquotes
                  .replace(/\*\*/g, '') // Remove bold markers
                  .replace(/~~.*?~~/g, '') // Remove strikethrough
                  .replace(/`+/g, '') // Remove code backticks
                  .replace(/\n\n+/g, ' ') // Multiple newlines to space
                  .replace(/\n/g, ' ') // Single newlines to space
                  .replace(/\s+/g, ' ') // Multiple spaces to single space
                  .split(/[.!?:]/) // Split on sentence boundaries
                  [0] // Take first sentence
                  .trim();
                
                if (snippetText && snippetText.length > 10) {
                  console.log(`     ${colors.yellow}Excerpt:${colors.reset} ${snippetText.substring(0, 90)}...`);
                }
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
}, 5000);
