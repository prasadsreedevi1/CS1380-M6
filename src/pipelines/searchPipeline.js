const queryParser = require('../search/query/queryParser.js');
const storageKeys = require('../services/storageKeys.js');

function calculateTFIDF(freq, docFreq, totalDocs) {
  if (docFreq === 0) return 0;
  
  const tf = freq;
  const idf = Math.log(totalDocs / docFreq);
  
  return tf * idf;
}

function getMetadataBoost(metadata) {
  let boost = 1.0;
  
  const progLanguages = ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'C++'];
  if (metadata.language && progLanguages.includes(metadata.language)) {
    boost *= 1.3;
  }
  
  const stars = metadata.stars || 0;
  if (stars > 1000) boost *= 2.0;
  else if (stars > 100) boost *= 1.5;
  else if (stars > 10) boost *= 1.2;
  
  return boost;
}

function getIndexStats(store, callback) {
  const key = storageKeys.indexStatsKey();
  store.get({key}, (err, stats) => {
    if (err) {
      return callback(null, {docsIndexed: 0, uniqueTerms: 0, indexedTerms: []});
    }
    callback(null, stats || {docsIndexed: 0, uniqueTerms: 0, indexedTerms: []});
  });
}

function getIndexedTerms(store, callback) {
  const key = storageKeys.indexStatsKey();
  store.get({key}, (err, stats) => {
    if (!err && stats && stats.indexedTerms && Array.isArray(stats.indexedTerms)) {
      return callback(null, stats.indexedTerms);
    }
    
    const terms = [];
    const prefix = 'idx:';
    
    store.get(null, (err, allKeys) => {
      if (err || !allKeys) {
        return callback(null, []);
      }
      
      const indexKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(prefix));
      
      indexKeys.forEach(key => {
        const term = key.substring(prefix.length);
        if (term.length > 0) {
          terms.push(term);
        }
      });
      
      callback(null, terms);
    });
  });
}

function executeSearch(queryString, options, runtime, callback) {
  if (!callback) {
    callback = runtime;
    runtime = global.runtime;
  }

  options = options || {};
  const store = runtime.store;
  const limit = options.limit || 10;

  const queryTerm = queryString.toLowerCase().trim();

  getIndexStats(store, (err, indexStats) => {
    if (err || !indexStats || indexStats.docsIndexed === 0) {
      return callback(null, {
        query: queryString,
        results: [],
        total: 0,
      });
    }

    const totalDocs = indexStats.docsIndexed;

    const indexKey = storageKeys.invertedIndexKey(queryTerm);
    store.get(indexKey, (err, entry) => {
      if (err || !entry || !entry.postings) {
        return callback(null, {
          query: queryString,
          results: [],
          total: 0,
        });
      }

      const docIds = Object.keys(entry.postings);
      const docFreq = entry.documentFrequency || docIds.length;
      
      const results = [];
      let completed = 0;

      docIds.forEach(docId => {
        const [owner, repo] = docId.split('/');
        const metaKey = storageKeys.documentMetadataKey(owner, repo);
        const termFreq = entry.postings[docId] || 0;

        store.get(metaKey, (err, metadata) => {
          if (!err && metadata) {
            const tfidfScore = calculateTFIDF(termFreq, docFreq, totalDocs);
            
            const boost = getMetadataBoost(metadata);
            const finalScore = tfidfScore * boost;
            
            const resultObj = {
              owner: metadata.owner || owner,
              repo: metadata.repo || repo,
              url: metadata.url || `https://github.com/${owner}/${repo}`,
              description: metadata.description || '',
              language: metadata.language || 'Unknown',
              stars: metadata.stars || 0,
              topics: metadata.topics || [],
              score: finalScore,
              matchedTerms: [queryTerm],
              termFrequency: termFreq,
              matchCount: 1,
              content: metadata.content || metadata.readme || '' // For snippet extraction
            };
            
            results.push(resultObj);
          }
          completed++;

          if (completed === docIds.length) {
            results.sort((a, b) => b.score - a.score);
            const limitedResults = results.slice(0, limit);
            
            let avgScore = 0;
            if (limitedResults.length > 0) {
              const totalScore = limitedResults.reduce((s, r) => s + r.score, 0);
              avgScore = (totalScore / limitedResults.length).toFixed(2);
            }
            
            callback(null, {
              query: queryString,
              results: limitedResults,
              total: docIds.length,
              stats: {
                totalMatches: docIds.length,
                returned: limitedResults.length,
                avgScore
              }
            });
          }
        });
      });

      if (docIds.length === 0) {
        getIndexedTerms(store, (err, indexedTerms) => {
          if (err || !indexedTerms || indexedTerms.length === 0) {
            return callback(null, {
              query: queryString,
              results: [],
              total: 0,
            });
          }
          
          
          callback(null, {
            query: queryString,
            results: [],
            total: 0,
          });
        });
        return;
      }
    });
  });
}

module.exports = {
  executeSearch,
  getIndexStats,
  getIndexedTerms,
  calculateTFIDF,
  getMetadataBoost,
};
