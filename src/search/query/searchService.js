// main search orchestration
// takes a query, processes it, looks up matching docs in the index, ranks them
// combines query processing, index lookup, and scoring into one place

const {processQuery, getAllQueryVariations} = require('./queryProcessor.js');
const score = require('../ranking/score.js');
const {createSearchResult, sortByRelevance, filterByLanguage, filterByOwner} = require('../models/searchResult.js');

function search(queryString, searchContext, callback) {
  if (!queryString || typeof callback !== 'function') {
    return callback(new Error('Query and callback required'));
  }

  const processedQuery = processQuery(queryString);
  if (processedQuery.terms.length === 0) {
    return callback(null, {
      results: [],
      query: queryString,
      count: 0,
    });
  }

  const results = executeSearchSync(processedQuery, searchContext);

  callback(null, results);
}

function executeSearchSync(processedQuery, context = {}) {
  if (!context.documentMetadata || !context.documentIds) {
    return {
      results: [],
      query: processedQuery.rawQuery,
      count: 0,
    };
  }

  const queryVariations = getAllQueryVariations(processedQuery);
  const candidateDocs = new Set();

  queryVariations.forEach(term => {
    if (context.termPostings && context.termPostings[term]) {
      const postings = context.termPostings[term];
      Object.keys(postings).forEach(docId => candidateDocs.add(docId));
    }
  });

  const candidateDocuments = Array.from(candidateDocs)
      .map(docId => context.documentMetadata[docId])
      .filter(doc => doc !== undefined);

  // score documents
  const docTermFrequencies = buildTermFrequencyMap(
      candidateDocuments,
      context.documentTermFrequencies,
  );

  const scored = score.scoreDocuments(
      candidateDocuments,
      docTermFrequencies,
      processedQuery.terms,
      context.documentIds.length,
      context.documentFrequencies || {},
  );

  let results = scored.map(item => createSearchResult(
      item.doc,
      item.score,
      processedQuery.terms,
  )).filter(r => r !== null);

  if (processedQuery.language) {
    results = filterByLanguage(results, processedQuery.language);
  }
  if (processedQuery.owner) {
    results = filterByOwner(results, processedQuery.owner);
  }

  results = sortByRelevance(results);

  return {
    results,
    query: processedQuery.rawQuery,
    count: results.length,
    processedTerms: processedQuery.terms,
  };
}

function buildTermFrequencyMap(docs, dtf = {}) {
  const map = {};
  docs.forEach(doc => {
    const docId = `${doc.owner}:${doc.repo}`;
    map[docId] = dtf[docId] || {};
  });
  return map;
}

module.exports = {
  search,
  executeSearchSync,
};
