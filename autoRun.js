#!/usr/bin/env node

// it runs the whole pipeline: crawl, index, then starts the search CLI

const {spawn} = require('child_process');
const path = require('path');

const reset = "\x1b[0m";
const green = "\x1b[32m";
const blue = "\x1b[34m";
const red = "\x1b[31m";
const cyan = "\x1b[36m";
const yellow = "\x1b[33m";
const white = "\x1b[37m";
const brightWhite = "\x1b[97m";

let currentStep = 'CRAWL';

function showLoadingScreen() {
  console.clear();
  
  console.log(`${brightWhite}`);
  console.log(`
  ╔════════════════════════════════════════════════════════════════╗
  ║                                                                ║
  ║          ${cyan}⠿ INITIALIZING GITGLE SEARCH ENGINE...${brightWhite}          ║
  ║                                                                ║
  ║          ${yellow}Loading repositories...${brightWhite}                      ║
  ║          ${yellow}Building search index...${brightWhite}                      ║
  ║          ${yellow}Preparing interface...${brightWhite}                        ║
  ║                                                                ║
  ║          ${cyan}▓▓▓▓▓▓▓▓░░░░░░░░░  45%${brightWhite}                    ║
  ║                                                                ║
  ╚════════════════════════════════════════════════════════════════╝
${reset}`);
}

function log(message) {
  console.log(`\n${currentStep}: ${message}`);
}

function error(message) {
  console.error(`\n${currentStep}: ❌ ${message}`);
}

function success(message) {
  console.log(`${currentStep}: ✅`);
}

function runCli(cliFile, args = []) {
  return new Promise((resolve) => {
    const cliPath = path.join(__dirname, 'src', 'cli', cliFile);
    
    let dots = '';
    const loadingInterval = setInterval(() => {
      dots = dots.length < 3 ? dots + '.' : '';
      process.stdout.write(`\r${currentStep}: ⏳ Processing${dots}   `);
    }, 500);

    const child = spawn('node', [cliPath, ...args], {
      stdio: 'pipe',
      cwd: __dirname
    });

    child.on('close', (code) => {
      clearInterval(loadingInterval);
      if (code === 0) {
        success('completed');
        resolve(true);
      } else {
        error(`failed with exit code ${code}`);
        resolve(false);
      }
    });

    child.on('error', (err) => {
      clearInterval(loadingInterval);
      error(`Failed to start: ${err.message}`);
      resolve(false);
    });
  });
}

async function main() {
  showLoadingScreen();
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log(green);

  currentStep = 'CRAWL';
  const crawlSuccess = await runCli('crawlCli.js', ['--seed', 'data/seeds/github-repos.txt']);

  if (!crawlSuccess) {
    error('failed');
    process.exit(1);
  }

  currentStep = 'INDEX';
  const indexSuccess = await runCli('indexCli.js');

  if (!indexSuccess) {
    error('failed');
    process.exit(1);
  }

  currentStep = 'SEARCH';
  log('Starting...');
  
  const cliPath = path.join(__dirname, 'src', 'cli', 'searchCli.js');
  const searchChild = spawn('node', [cliPath], {
    stdio: 'inherit',
    cwd: __dirname
  });

  searchChild.on('close', (code) => {
    if (code === 0) {
      success('completed');
      console.log('\n' + '='.repeat(60) + '\n');
      process.exit(0);
    } else {
      error(`failed with exit code ${code}`);
      process.exit(1);
    }
  });

  searchChild.on('error', (err) => {
    error(`Failed to start: ${err.message}`);
    process.exit(1);
  });
}

main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
