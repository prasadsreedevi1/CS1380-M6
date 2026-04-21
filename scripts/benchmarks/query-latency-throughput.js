// Query Latency & Throughput Benchmark
// Measures latency and throughput for a set of queries
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const queries = process.env.QUERIES ? process.env.QUERIES.split(',') : ['javascript','python','database'];
const runs = Number(process.env.RUNS || 10);
const logDir = process.env.OUT_DIR || 'results/query-benchmarks';
fs.mkdirSync(logDir, { recursive: true });

const results = [];
let completed = 0;
const startAll = Date.now();

function runQuery(query, cb) {
  const start = Date.now();
  const proc = spawn('node', ['benchmarks/run-query.js', query], { encoding: 'utf8' });
  let output = '';
  proc.stdout.on('data', d => output += d);
  proc.stderr.on('data', d => output += d);
  proc.on('close', code => {
    const latency = Date.now() - start;
    cb({ query, latency, code, output });
  });
}

function runAll() {
  queries.forEach(query => {
    let count = 0;
    function next() {
      if (count++ < runs) {
        runQuery(query, result => {
          results.push(result);
          next();
          completed++;
          if (completed === queries.length * runs) finish();
        });
      }
    }
    next();
  });
}

function finish() {
  const totalTime = Date.now() - startAll;
  const csv = ['query,latency_ms,exit_code'].concat(results.map(r => `${r.query},${r.latency},${r.code}`)).join('\n');
  fs.writeFileSync(path.join(logDir, 'query-latency-throughput.csv'), csv);
  const throughput = (results.length / (totalTime / 1000)).toFixed(2);
  console.log(`Throughput: ${throughput} queries/sec`);
  console.log(`Results written to ${path.join(logDir, 'query-latency-throughput.csv')}`);
}

runAll();
