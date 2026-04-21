// Indexing Latency & Throughput Benchmark
// Measures latency and throughput for indexing README files
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const seedFile = process.env.SEED_FILE || 'data/seeds/github-repos.txt';
const runs = Number(process.env.RUNS || 1);
const logDir = process.env.OUT_DIR || 'results/indexing-benchmarks';
fs.mkdirSync(logDir, { recursive: true });

const repos = fs.readFileSync(seedFile, 'utf8').split('\n').filter(Boolean);
const results = [];
const startAll = Date.now();
let completed = 0;

function indexRepo(repo, cb) {
  const start = Date.now();
  const proc = spawn('node', ['benchmarks/run-index-single.js', repo], { encoding: 'utf8' });
  let output = '';
  proc.stdout.on('data', d => output += d);
  proc.stderr.on('data', d => output += d);
  proc.on('close', code => {
    const latency = Date.now() - start;
    cb({ repo, latency, code, output });
  });
}

function runAll() {
  repos.forEach(repo => {
    for (let i = 0; i < runs; i++) {
      indexRepo(repo, result => {
        results.push(result);
        completed++;
        if (completed === repos.length * runs) finish();
      });
    }
  });
}

function finish() {
  const totalTime = Date.now() - startAll;
  const csv = ['repo,latency_ms,exit_code'].concat(results.map(r => `${r.repo},${r.latency},${r.code}`)).join('\n');
  fs.writeFileSync(path.join(logDir, 'indexing-latency-throughput.csv'), csv);
  const throughput = (results.length / (totalTime / 1000)).toFixed(2);
  console.log(`Throughput: ${throughput} repos/sec`);
  console.log(`Results written to ${path.join(logDir, 'indexing-latency-throughput.csv')}`);
}

runAll();
