#!/usr/bin/env node

// gitgle search engine - main entry point

const fs = require('fs');
const originalLog = console.log;
console.log = () => {};
require('dotenv').config();
console.log = originalLog;

const readline = require('readline');
const {runCrawl} = require('./src/pipelines/crawlPipeline.js');
const {runIndex} = require('./src/pipelines/indexPipeline.js');
const {executeSearch} = require('./src/pipelines/searchPipeline.js');

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

function loadClusterConfig() {
  const configPath = process.env.CLUSTER_CONFIG || './configs/cluster-local.json';
  if (!fs.existsSync(configPath)) {
    return {
      coordinator: {host: '127.0.0.1', port: 3000},
      workers: [
        {host: '127.0.0.1', port: 3001},
        {host: '127.0.0.1', port: 3002},
        {host: '127.0.0.1', port: 3003},
      ],
    };
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

const cluster = loadClusterConfig();
const coordinator = {
  ip: cluster.coordinator.host,
  port: Number(cluster.coordinator.port || 3000),
};
const workers = (cluster.workers || []).map((w) => ({
  ip: w.host,
  port: Number(w.port || 3001),
}));

const skipWorkerSpawn =
  process.env.SKIP_WORKER_SPAWN === '1' || cluster.skipWorkerSpawn === true;

const seedFile =
  process.env.SEED_FILE || cluster.seedFile || 'data/seeds/github-repos.txt';

const fetchMode = (process.env.FETCH_MODE || 'mock').toLowerCase();

function showLoadingScreen() {
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

const distribution = require('./distribution.js')(coordinator);

distribution.node.start(() => {
  const configPath = process.env.CLUSTER_CONFIG || './configs/cluster-local.json';
  console.log(`${colors.cyan}Coordinator at ${coordinator.ip}:${coordinator.port}${colors.reset}`);
  console.log(`${colors.cyan}CLUSTER_CONFIG: ${configPath}${colors.reset}`);
  console.log(`${colors.cyan}SEED_FILE: ${seedFile}${colors.reset}`);
  console.log(
    `${colors.cyan}FETCH_MODE: ${fetchMode}${colors.reset}` +
      (fetchMode === 'mock'
        ? ` ${colors.yellow}(set FETCH_MODE=github + GITHUB_TOKEN in .env for real API)${colors.reset}`
        : ''),
  );

  if (skipWorkerSpawn) {
    console.log(`${colors.cyan}skipWorkerSpawn: remote workers — run distribution.js on each worker.${colors.reset}`);
  }

  function spawnWorker(index, callback) {
    if (index >= workers.length) {
      callback();
      return;
    }
    distribution.local.status.spawn(workers[index], (err) => {
      if (err) {
        callback(err);
        return;
      }
      spawnWorker(index + 1, callback);
    });
  }

  const afterWorkers = (spawnErr) => {
    if (spawnErr) {
      console.error('Worker spawn failed:', spawnErr);
      process.exit(1);
      return;
    }

    const group = {};
    workers.forEach((n) => {
      group[distribution.util.id.getSID(n)] = n;
    });

    distribution.all.groups.put({gid: 'gitgle'}, group, () => {
      console.log(`${colors.green}Group registered (gitgle)${colors.reset}`);

      const runtime = {
        store: distribution.gitgle.store,
        executor: distribution.gitgle.mr,
        group: distribution.gitgle,
      };

      runPipeline(runtime);
    });
  };

  if (skipWorkerSpawn) {
    afterWorkers(null);
  } else {
    spawnWorker(0, afterWorkers);
  }
});

function runPipeline(runtime) {
  showLoadingScreen();

  if (!runtime.store || !runtime.executor) {
    console.log(`${colors.cyan}Starting search (local mode — no gitgle store/mr)...${colors.reset}\n`);
    startInteractiveSearch(runtime);
    return;
  }

  runCrawl({seedFile}, runtime, (err, crawlStats) => {
    if (err) {
      console.error(`${colors.yellow}Crawl failed:${colors.reset}`, err.message);
      console.log(`${colors.cyan}Continuing with search (may be empty)...${colors.reset}\n`);
      startInteractiveSearch(runtime);
      return;
    }

    console.log(`${colors.green}Crawl done: ${crawlStats.reposProcessed} repos${colors.reset}`);

    runIndex({}, runtime, (err) => {
      if (err) {
        console.error(`${colors.yellow}Index failed:${colors.reset}`, err.message);
      }

      console.log(`\n${colors.green}══════════════════════════════════${colors.reset}`);
      console.log(`${colors.green}✓ Ready for search!${colors.reset}`);
      console.log(`${colors.green}══════════════════════════════════${colors.reset}\n`);

      startInteractiveSearch(runtime);
    });
  });
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

      if (trimmedLower === 'exit' || trimmedLower === 'quit') {
        console.log(`${colors.cyan}Goodbye! ${colors.reset}`);
        process.exit(0);
      }

      if (trimmedLower === 'help') {
        console.log(`${colors.cyan}${HELP_MESSAGE}${colors.reset}`);
        prompt();
        return;
      }

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

      if (trimmedLower === '') {
        prompt();
        return;
      }

      const query = trimmed;

      executeSearch(query, {limit: 10}, runtime, (err, results) => {
        if (err) {
          console.log(`${colors.cyan}Search failed: ${err.message}${colors.reset}`);
        } else if (results.total === 0) {
          console.log(`${colors.cyan}No results found for "${query}"${colors.reset}`);
        } else {
          console.log(`${colors.green}Found ${results.total} repositories:${colors.reset}\n`);
          results.results.forEach((r, i) => {
            console.log(`  ${i + 1}. ${colors.blue}${r.owner}/${r.repo}${colors.reset}`);

            const metadata = `${r.stars} ⭐ | ${r.language} | Score: ${r.score.toFixed(3)}`;
            console.log(`     ${colors.cyan}${metadata}${colors.reset}`);

            if (r.description) {
              console.log(`     ${r.description.substring(0, 70)}...`);
            }

            if (r.snippet) {
              let snippetText = r.snippet
                .replace(/!\[.*?\]/g, '')
                .replace(/\[.*?\]/g, '')
                .replace(/\(.*?(https?|www).*?\)/g, '')
                .replace(/#+\s/g, '')
                .replace(/^[-_*=\s]+$/gm, '')
                .replace(/\|/g, '')
                .replace(/^[-*]\s/gm, '')
                .replace(/^>\s/gm, '')
                .replace(/\*\*/g, '')
                .replace(/~~.*?~~/g, '')
                .replace(/`+/g, '')
                .replace(/\n\n+/g, ' ')
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .split(/[.!?:]/)[0]
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
