// Usage: node run-tokenize.js "some text"
const { tokenize } = require('../../src/search/parsing/tokenize.js');

const text = process.argv[2];
if (!text) {
  console.error('Usage: node run-tokenize.js "some text"');
  process.exit(1);
}

console.log(JSON.stringify(tokenize(text)));
