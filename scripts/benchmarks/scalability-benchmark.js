// Scalability Benchmark
// Measures throughput and latency as number of nodes increases
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const nodeCounts = [1,2,4,8];
const runs = 1;
const logDir = process.env.OUT_DIR || 'results/scalability-benchmarks';
fs.mkdirSync(logDir, { recursive: true });

const results = [];

function makeClusterConfig(n) {
  return {
    coordinator: { host: '127.0.0.1', port: 3000 },
    workers: Array.from({length: n}, (_, i) => ({ host: '127.0.0.1', port: 3001 + i })),
    seedFile: 'data/seeds/generated-10k.txt',
    skipWorkerSpawn: true
  };
}

nodeCounts.forEach(n => {
  const configPath = path.join(logDir, `cluster-${n}.json`);
  fs.writeFileSync(configPath, JSON.stringify(makeClusterConfig(n), null, 2));
  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    // start the correct number of workers manually
    const proc = spawnSync('node', ['scripts/run-benchmark.js'], {
      env: {
        ...process.env,
        CLUSTER_CONFIG: configPath,
        SKIP_WORKER_SPAWN: '1',
      },
      encoding: 'utf8',
    });
    const elapsed = Date.now() - start;
    results.push({ nodes: n, run: i+1, elapsed, code: proc.status });
  }
});

const csv = ['nodes,run,elapsed_ms,exit_code'].concat(results.map(r => `${r.nodes},${r.run},${r.elapsed},${r.code}`)).join('\n');
fs.writeFileSync(path.join(logDir, 'scalability-benchmark.csv'), csv);
console.log(`Results written to ${path.join(logDir, 'scalability-benchmark.csv')}`);
