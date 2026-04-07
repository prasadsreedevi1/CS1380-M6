// applies same processing to query terms as applied to indexed documents
// normalizes, tokenizes, stems, generates ngrams
// ensures query and index use same vocabulary

const {parseQuery} = require('./query-parser.js');
const {normalizeText} = require('../parsing/normalize-text.js');
const {tokenize} = require('../parsing/tokenize.js');
const {stemTokens} = require('../parsing/stem.js');
const {generateAllNGrams} = require('../parsing/ngrams.js');

function processQuery(queryString) {
  const parsed = parseQuery(queryString);

  if (parsed.terms.length === 0) {
    return {
      terms: [],
      ngrams: [],
      language: parsed.language,
      owner: parsed.owner,
      rawQuery: queryString,
    };
  }

  const ngrams = generateAllNGrams(parsed.terms);

  return {
    terms: parsed.terms,
    ngrams,
    language: parsed.language,
    owner: parsed.owner,
    rawQuery: queryString,
  };
}

function getAllQueryVariations(processedQuery) {
  if (!processedQuery) {
    return [];
  }
  const all = new Set([...(processedQuery.terms || []), ...(processedQuery.ngrams || [])]);
  return Array.from(all);
}

module.exports = {
  processQuery,
  getAllQueryVariations,
};
