// Usage: node run-tfidf.js '{"termFrequencies":..., "queryTerms":..., "totalDocs":..., "documentFrequencies":...}'
const { calculateDocumentTFIDF } = require('../../src/search/ranking/tfidf.js');

const input = process.argv[2];
if (!input) {
  console.error('Usage: node run-tfidf.js <json>');
  process.exit(1);
}

const { termFrequencies, queryTerms, totalDocs, documentFrequencies } = JSON.parse(input);
const score = calculateDocumentTFIDF(termFrequencies, queryTerms, totalDocs, documentFrequencies);
console.log(score);
