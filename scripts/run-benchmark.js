const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const runs = Number(process.env.RUNS || 3);
const fetchMode = process.env.FETCH_MODE || 'mock';
const seedFile = process.env.SEED_FILE || 'data/seeds/github-repos.txt';
const clusterConfig = process.env.CLUSTER_CONFIG || 'configs/cluster-4.json';
const outDir = process.env.OUT_DIR || 'results/benchmarks';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(outDir, `${stamp}-${fetchMode}`);

fs.mkdirSync(runDir, {recursive: true});

console.log(`Benchmark run directory: ${runDir}`);
console.log(`Runs: ${runs}`);
console.log(`Mode: ${fetchMode}`);
console.log(`Seed file: ${seedFile}`);
console.log(`Cluster config: ${clusterConfig}`);

for (let i = 1; i <= runs; i += 1) {
  const logFile = path.join(runDir, `trial-${i}.log`);
  console.log(`---- Trial ${i}/${runs} ----`);
  const startMs = Date.now();

  const proc = spawnSync('node', ['test-index.js'], {
    env: {
      ...process.env,
      FETCH_MODE: fetchMode,
      SEED_FILE: seedFile,
      CLUSTER_CONFIG: clusterConfig,
    },
    encoding: 'utf8',
  });

  fs.writeFileSync(logFile, `${proc.stdout || ''}${proc.stderr || ''}`);

  if (proc.status !== 0) {
    console.error(`Trial ${i} failed. See ${logFile}`);
    process.exit(proc.status || 1);
  }

  const elapsed = Date.now() - startMs;
  fs.appendFileSync(path.join(runDir, 'timings.csv'), `trial=${i},elapsed_ms=${elapsed}\n`);
}

console.log(`Done. See logs and timings in ${runDir}`);
