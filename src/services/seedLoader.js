// loads repository seeds from files
// seeds are owner/repo pairs to crawl
// supports comments and different formats like owner/repo or owner repo

const fs = require('fs');
const path = require('path');
const readline = require('readline');

function parseSeedLine(line) {
  if (!line || typeof line !== 'string') {
    return null;
  }

  const trimmed = line.trim();
  if (trimmed.startsWith('#') || trimmed.length === 0) {
    return null; 
  }

  if (trimmed.includes('/')) {
    const [owner, repo] = trimmed.split('/').map(s => s.trim());
    if (owner && repo) {
      return {owner, repo};
    }
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return {owner: parts[0], repo: parts[1]};
  }

  return null;
}

function loadSeedsSync(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const seeds = [];

    lines.forEach(line => {
      const seed = parseSeedLine(line);
      if (seed) {
        seeds.push(seed);
      }
    });

    return seeds;
  } catch (err) {
    console.error(`Error loading seeds from ${filePath}:`, err.message);
    return [];
  }
}

function loadSeeds(filePath, callback) {
  if (!fs.existsSync(filePath)) {
    return callback(null, []);
  }

  const seeds = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  rl.on('line', (line) => {
    const seed = parseSeedLine(line);
    if (seed) {
      seeds.push(seed);
    }
  });

  rl.on('close', () => {
    callback(null, seeds);
  });

  rl.on('error', (err) => {
    callback(err, []);
  });
}

function isValidSeed(seed) {
  return seed &&
    typeof seed === 'object' &&
    typeof seed.owner === 'string' &&
    typeof seed.repo === 'string' &&
    seed.owner.length > 0 &&
    seed.repo.length > 0;
}

module.exports = {
  parseSeedLine,
  loadSeedsSync,
  loadSeeds,
  isValidSeed,
};
