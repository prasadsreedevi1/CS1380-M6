// Usage: node run-metadata-boost.js '{"doc":..., "queryTerms":...}'
const { calculateMetadataBoost } = require('../../src/search/ranking/metadataBoost.js');

const input = process.argv[2];
if (!input) {
  console.error('Usage: node run-metadata-boost.js <json>');
  process.exit(1);
}

const { doc, queryTerms } = JSON.parse(input);
const boost = calculateMetadataBoost(doc, queryTerms);
console.log(boost);
