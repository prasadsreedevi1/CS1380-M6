// processes raw readme text into tokens ready for indexing
// takes markdown, extracts text, normalizes, tokenizes, stems, and generates ngrams
// returns tokens and term frequencies for each document

const {extractReadmeText} = require('../parsing/extarct-readme-text.js');
const {normalizeText} = require('../parsing/normalize-text.js');
const {tokenize} = require('../parsing/tokenize.js');
const {stemTokens} = require('../parsing/stem.js');
const {generateAllNGrams} = require('../parsing/ngrams.js');

function processDocument(doc) {
  if (!doc || !doc.readme) {
    return {
      docId: `${doc.owner}:${doc.repo}`,
      tokens: [],
      termFrequency: {},
      allText: '',
    };
  }

  const plainText = extractReadmeText(doc.readme);
  const normalized = normalizeText(plainText);
  const tokens = tokenize(normalized);
  const stemmed = stemTokens(tokens);
  const ngrams = generateAllNGrams(stemmed);
  const termFrequency = calculateTermFrequency(ngrams);

  return {
    docId: `${doc.owner}:${doc.repo}`,
    tokens: stemmed,
    ngrams,
    termFrequency,
    allText: normalized,
    originalTokenCount: tokens.length,
  };
}

function calculateTermFrequency(tokens) {
  const tf = {};
  tokens.forEach(token => {
    tf[token] = (tf[token] || 0) + 1;
  });
  return tf;
}

function processBatch(docs) {
  if (!Array.isArray(docs)) {
    return [];
  }
  return docs.map(processDocument);
}

module.exports = {
  processDocument,
  calculateTermFrequency,
  processBatch,
};
