// Usage: node run-query.js "query string"
const { executeSearch } = require('../../src/pipelines/searchPipeline.js');

const query = process.argv[2];
if (!query) {
  console.error('Usage: node run-query.js "query string"');
  process.exit(1);
}

// Minimal runtime context
const runtime = {};
executeSearch(query, {}, runtime, (err, results) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  console.log(JSON.stringify(results));
});
