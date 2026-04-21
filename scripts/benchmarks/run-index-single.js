// Usage: node run-index-single.js "owner/repo"
const { runIndex } = require('../../src/pipelines/indexPipeline.js');

const repo = process.argv[2];
if (!repo) {
  console.error('Usage: node run-index-single.js "owner/repo"');
  process.exit(1);
}

// Minimal options and runtime context
const options = { repos: [repo] };
const runtime = {};
runIndex(options, runtime, (err, stats) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  console.log(JSON.stringify(stats));
});
