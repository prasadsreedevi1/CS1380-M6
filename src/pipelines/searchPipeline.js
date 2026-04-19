// handles the search queries
// takes a query string, finds all the matching docs in the index, scores them, and returns the best ones first
// uses tf-idf to rank results so most relevant stuff shows up at the top

const queryParser = require('../search/query/queryParser.js');
const queryProcessor = require('../search/query/queryProcessor.js');
const searchService = require('../search/query/searchService.js');
const storageKeys = require('../services/storageKeys.js');
const tfidf = require('../search/ranking/tfidf.js');
const metadataBoost = require('../search/ranking/metadataBoost.js');
const score = require('../search/ranking/score.js');

function executeSearch(queryString, options, runtime, callback) {
  if (!callback) {
    callback = runtime;
    runtime = global.runtime;
  }

  options = options || {};
  const store = runtime.store;
  const limit = options.limit || 10;

  // Parse query string
  const queryTerm = queryString.toLowerCase().trim();

  // Get index statistics
  getIndexStats(store, (err, indexStats) => {
    if (err || !indexStats || indexStats.docsIndexed === 0) {
      return callback(null, {
        query: queryString,
        results: [],
        total: 0,
      });
    }

    // Get postings for query term
    const indexKey = storageKeys.invertedIndexKey(queryTerm);
    store.get(indexKey, (err, entry) => {
      if (err || !entry || !entry.postings) {
        // Term not found, return empty results
        return callback(null, {
          query: queryString,
          results: [],
          total: 0,
        });
      }

      // Get matching documents
      const docIds = Object.keys(entry.postings);
      const results = [];
      let completed = 0;

      docIds.slice(0, limit).forEach(docId => {
        const [owner, repo] = docId.split('/');
        const metaKey = storageKeys.documentMetadataKey(owner, repo);

        store.get(metaKey, (err, metadata) => {
          if (!err && metadata) {
            results.push({
              owner: metadata.owner || owner,
              repo: metadata.repo || repo,
              url: metadata.url || `https://github.com/${owner}/${repo}`,
              description: metadata.description || '',
              language: metadata.language || null,
              stars: metadata.stars || 0,
              score: (entry.postings[docId] || 0) * 10, // Simple scoring based on frequency
              matchedTerms: [queryTerm]
            });
          }
          completed++;

          if (completed === Math.min(limit, docIds.length)) {
            // Sort by score
            results.sort((a, b) => b.score - a.score);
            callback(null, {
              query: queryString,
              results,
              total: docIds.length,
            });
          }
        });
      });

      // Handle empty results case
      if (docIds.length === 0) {
        callback(null, {
          query: queryString,
          results: [],
          total: 0,
        });
      }
    });
  });
}

function getIndexStats(store, callback) {
  const key = storageKeys.indexStatsKey();

  store.get(key, (err, stats) => {
    if (err && err.message && err.message.includes('not found')) {
      return callback(null, {
        docsIndexed: 0,
        uniqueTerms: 0,
        totalPostings: 0,
      });
    }
    if (err) return callback(err);

    callback(null, stats || {});
  });
}

function searchForMatches(store, terms, indexStats, callback) {
  if (!terms || terms.length === 0) {
    return callback(null, []);
  }

  const docMatches = {}; // Maps docId -> term match info

  let completed = 0;
  const errors = [];

  terms.forEach(term => {
    const key = storageKeys.invertedIndexKey(term);

    store.get(key, (err, entry) => {
      if (!err && entry && entry.postings) {
        Object.entries(entry.postings).forEach(([docId, freq]) => {
          if (!docMatches[docId]) {
            docMatches[docId] = {
              docId,
              matchedTerms: [],
              termFrequencies: {},
            };
          }
          docMatches[docId].matchedTerms.push(term);
          docMatches[docId].termFrequencies[term] = freq;
        });
      }

      completed++;
      if (completed === terms.length) {
        if (errors.length > 0) {
          return callback(errors[0]);
        }
        callback(null, Object.values(docMatches));
      }
    });
  });
}

function scoreResults(store, docMatches, terms, indexStats, explain, callback) {
  if (!docMatches || docMatches.length === 0) {
    return callback(null, []);
  }

  let completed = 0;
  const scoredResults = [];
  const errors = [];

  docMatches.forEach(match => {
    const docId = match.docId;
    const [owner, repo] = docId.split('/');

    // document metadata and TF vector
    Promise.all([
      new Promise((resolve) => {
        const metaKey = storageKeys.documentMetadataKey(owner, repo);
        store.get(metaKey, (err, meta) => {
          resolve(meta || {});
        });
      }),
      new Promise((resolve) => {
        const tfKey = storageKeys.termFrequencyKey(owner, repo);
        store.get(tfKey, (err, tf) => {
          resolve(tf || {});
        });
      }),
    ]).then(([metadata, tfVector]) => {
      let tfidfScore = 0;
      terms.forEach(term => {
        const termCount = match.termFrequencies[term] || 0;
        if (termCount > 0) {
          const dfKey = storageKeys.documentFrequencyKey(term);
          store.get(dfKey, (err, df) => {
            const docFreq = df || 1;
            const termScore = tfidf.calculateTFIDF(
              termCount,
              Object.values(tfVector).reduce((sum, v) => sum + v, 0) || 1,
              indexStats.docsIndexed || 1,
              docFreq
            );
            tfidfScore += termScore;
          });
        }
      });

      const boostScore = metadataBoost.boostScore({
        stars: metadata.stars || 0,
        language: metadata.language,
        queryLanguage: null,
      });

      const finalScore = score.combineScores(tfidfScore, boostScore);

      const result = {
        docId,
        owner,
        repo,
        score: finalScore,
        tfidfScore,
        boostScore,
        metadata,
      };

      if (explain) {
        result.explanation = {
          matchedTerms: match.matchedTerms,
          termFrequencies: match.termFrequencies,
          metadataFactors: {
            stars: metadata.stars,
            language: metadata.language,
          },
        };
      }

      scoredResults.push(result);
      completed++;

      if (completed === docMatches.length) {
        if (errors.length > 0) {
          return callback(errors[0]);
        }
        callback(null, scoredResults);
      }
    }).catch(err => {
      errors.push(err);
      completed++;

      if (completed === docMatches.length) {
        callback(errors[0] || null, scoredResults);
      }
    });
  });
}

function filterByLanguage(results, language) {
  if (!language) 
    return results;
  return results.filter(match => {
    const meta = match.metadata || {};
    return (meta.language || '').toLowerCase() === language.toLowerCase();
  });
}

function filterByOwner(results, owner) {
  if (!owner) 
    return results;
  return results.filter(match => match.docId.startsWith(`${owner}/`));
}

module.exports = {
  executeSearch,
  getIndexStats,
  searchForMatches,
  scoreResults,
  filterByLanguage,
  filterByOwner,
};
