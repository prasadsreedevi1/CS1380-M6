// End-to-End Pipeline Benchmark
// Measures total time to crawl, index, and make searchable a set of repositories
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const runs = Number(process.env.RUNS || 1);
const logDir = process.env.OUT_DIR || 'results/end2end-benchmarks';
fs.mkdirSync(logDir, { recursive: true });

const results = [];
for (let i = 0; i < runs; i++) {
  const start = Date.now();

  const proc = spawnSync('node', ['scripts/auto.js'], { encoding: 'utf8' });
  const elapsed = Date.now() - start;
  results.push({ run: i+1, elapsed, code: proc.status });
}

const csv = ['run,elapsed_ms,exit_code'].concat(results.map(r => `${r.run},${r.elapsed},${r.code}`)).join('\n');
fs.writeFileSync(path.join(logDir, 'end-to-end-pipeline-benchmark.csv'), csv);
console.log(`Results written to ${path.join(logDir, 'end-to-end-pipeline-benchmark.csv')}`);
