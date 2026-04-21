// Usage: node run-stem.js "word1 word2 ..."
const { stemTokens } = require('../../src/search/parsing/stem.js');

const text = process.argv[2];
if (!text) {
  console.error('Usage: node run-stem.js "word1 word2 ..."');
  process.exit(1);
}

const tokens = text.split(/\s+/);
console.log(JSON.stringify(stemTokens(tokens)));
