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
  const offset = options.offset || 0;
  const explainScores = options.explain || false;

  // parse query with filters
  const parsed = queryParser.parseQuery(queryString);

  // get index statistics
  getIndexStats(store, (err, indexStats) => {
    if (err) 
        return callback(err);

    if (!indexStats || indexStats.docsIndexed === 0) {
      return callback(null, {
        query: queryString,
        results: [],
        total: 0,
        explainedResults: [],
      });
    }

    // search for documents matching terms
    searchForMatches(store, parsed.terms, indexStats, (err, docMatches) => {
      if (err) 
        return callback(err);

      // apply filters if any
      let filtered = docMatches;
      if (parsed.filters.language) {
        filtered = filterByLanguage(filtered, parsed.filters.language);
      }
      if (parsed.filters.owner) {
        filtered = filterByOwner(filtered, parsed.filters.owner);
      }

      // score and rank results
      scoreResults(store, filtered, parsed.terms, indexStats, explainScores, (err, scored) => {
        if (err) return callback(err);

        scored.sort((a, b) => b.score - a.score);

        // pagination
        const paginatedResults = scored.slice(offset, offset + limit);

        const result = {
          query: queryString,
          filters: parsed.filters,
          results: paginatedResults,
          total: scored.length,
          limit,
          offset,
        };

        callback(null, result);
      });
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
