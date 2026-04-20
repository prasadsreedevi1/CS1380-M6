#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const k = argv[i];
    const v = argv[i + 1];
    if (!k.startsWith('--') || v === undefined) continue;
    args[k.slice(2)] = v;
    i += 1;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const shardDir = args.shardDir || path.join('data', 'seeds', 'shards');
  const prefix = args.prefix || '';
  const workers = (args.workers || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const out = args.out || path.join(shardDir, 'assignment.txt');

  if (workers.length === 0) {
    throw new Error('Pass --workers "ip1:port,ip2:port,..."');
  }

  const shards = fs
    .readdirSync(shardDir)
    .filter((f) => f.endsWith('.txt') && (prefix ? f.startsWith(prefix) : true))
    .sort();

  if (shards.length === 0) {
    throw new Error(`No shards found in ${shardDir}`);
  }

  const lines = [];
  shards.forEach((shard, idx) => {
    const worker = workers[idx % workers.length];
    lines.push(`${path.join(shardDir, shard)} -> ${worker}`);
  });

  fs.writeFileSync(out, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${lines.length} assignments to ${out}`);
  lines.forEach((line) => console.log(line));
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
