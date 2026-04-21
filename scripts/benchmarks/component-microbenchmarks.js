// Component Microbenchmarks
// Measures latency and throughput for individual pipeline components
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const components = process.env.COMPONENTS ? process.env.COMPONENTS.split(',') : ['tokenize','stem','tfidf','metadataBoost'];
const seedFile = process.env.SEED_FILE || 'data/seeds/github-repos.txt';
const repos = fs.readFileSync(seedFile, 'utf8').split('\n').filter(Boolean);
const logDir = process.env.OUT_DIR || 'results/component-benchmarks';
fs.mkdirSync(logDir, { recursive: true });

const results = [];
let completed = 0;
const startAll = Date.now();

function runComponent(component, repo, cb) {
  const start = Date.now();
  let proc;
  let args;
  let input;
  switch (component) {
    case 'tokenize':
      args = ['run-tokenize.js', repo];
      proc = spawn('node', args, { encoding: 'utf8' });
      break;
    case 'stem':
      args = ['run-stem.js', repo];
      proc = spawn('node', args, { encoding: 'utf8' });
      break;
    case 'tfidf':
      // For tfidf, simulate input JSON
      input = JSON.stringify({
        termFrequencies: { example: 2 },
        queryTerms: ['example'],
        totalDocs: 100,
        documentFrequencies: { example: 10 }
      });
      args = ['run-tfidf.js', input];
      proc = spawn('node', args, { encoding: 'utf8' });
      break;
    case 'metadataBoost':
      // For metadataBoost, simulate input JSON
      input = JSON.stringify({
        doc: { stars: 100, language: 'javascript', topics: ['example'] },
        queryTerms: ['example']
      });
      args = ['run-metadata-boost.js', input];
      proc = spawn('node', args, { encoding: 'utf8' });
      break;
    default:
      return cb({ component, repo, latency: 0, code: 1, output: 'Unknown component' });
  }
  let output = '';
  proc.stdout.on('data', d => output += d);
  proc.stderr.on('data', d => output += d);
  proc.on('close', code => {
    const latency = Date.now() - start;
    cb({ component, repo, latency, code, output });
  });
}

function runAll() {
  components.forEach(component => {
    repos.forEach(repo => {
      runComponent(component, repo, result => {
        results.push(result);
        completed++;
        if (completed === components.length * repos.length) finish();
      });
    });
  });
}

function finish() {
  const totalTime = Date.now() - startAll;
  const csv = ['component,repo,latency_ms,exit_code'].concat(results.map(r => `${r.component},${r.repo},${r.latency},${r.code}`)).join('\n');
  fs.writeFileSync(path.join(logDir, 'component-microbenchmarks.csv'), csv);
  const throughput = (results.length / (totalTime / 1000)).toFixed(2);
  console.log(`Throughput: ${throughput} ops/sec`);
  console.log(`Results written to ${path.join(logDir, 'component-microbenchmarks.csv')}`);
}

runAll();
