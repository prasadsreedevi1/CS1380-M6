#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith('--') || value === undefined) continue;
    args[key.slice(2)] = value;
    i += 1;
  }
  return args;
}

function formatShardName(prefix, shardIndex) {
  const index = String(shardIndex).padStart(2, '0');
  return `${prefix}.shard-${index}.txt`;
}

async function splitSeeds({input, outputDir, prefix, total, perShard}) {
  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  fs.mkdirSync(outputDir, {recursive: true});

  const stream = fs.createReadStream(input);
  const rl = readline.createInterface({input: stream, crlfDelay: Infinity});

  let processed = 0;
  let shardIndex = 0;
  let shardCount = 0;
  let currentWriter = null;
  let currentPath = '';
  const createdFiles = [];

  function openNextShard() {
    if (currentWriter) {
      currentWriter.end();
    }
    const shardName = formatShardName(prefix, shardIndex);
    currentPath = path.join(outputDir, shardName);
    currentWriter = fs.createWriteStream(currentPath, {flags: 'w'});
    createdFiles.push(currentPath);
    shardIndex += 1;
    shardCount = 0;
  }

  openNextShard();

  for await (const line of rl) {
    if (processed >= total) break;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (shardCount >= perShard) {
      openNextShard();
    }

    currentWriter.write(`${trimmed}\n`);
    shardCount += 1;
    processed += 1;
  }

  if (currentWriter) {
    currentWriter.end();
  }

  return {processed, createdFiles};
}

async function main() {
  const args = parseArgs(process.argv);
  const input = args.input || 'data/seeds/generated-10k.txt';
  const outputDir = args.outputDir || 'data/seeds/shards';
  const prefix = args.prefix || 'generated-split';
  const total = Number(args.total || 5000);
  const perShard = Number(args.perShard || 1000);

  if (!Number.isInteger(total) || total <= 0) {
    throw new Error('--total must be a positive integer');
  }
  if (!Number.isInteger(perShard) || perShard <= 0) {
    throw new Error('--perShard must be a positive integer');
  }

  const {processed, createdFiles} = await splitSeeds({
    input,
    outputDir,
    prefix,
    total,
    perShard,
  });

  console.log(`Processed ${processed} seeds.`);
  console.log(`Created ${createdFiles.length} shard files in ${outputDir}:`);
  createdFiles.forEach((file) => console.log(`- ${file}`));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
