const queryParser = require('../search/query/queryParser.js');
const storageKeys = require('../services/storageKeys.js');
const snippets = require('../search/snippets.js');

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
  
  store.get({key, gid: 'gitgle'}, (err, stats) => {
    if (err) {
      return callback(null, {docsIndexed: 0, uniqueTerms: 0, indexedTerms: []});
    }
    const statsData = stats || {docsIndexed: 0, uniqueTerms: 0, indexedTerms: []};
    callback(null, statsData);
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
    const docsIndexed = indexStats && indexStats.docsIndexed ? indexStats.docsIndexed : 0;
    
    if (!docsIndexed || docsIndexed === 0) {
      callback(null, {
        query: queryString,
        results: [],
        total: 0,
      });
      return;
    }

    const totalDocs = docsIndexed;

    store.get({key: 'inv:full-index', gid: 'gitgle'}, (err, fullIndex) => {
      if (err || !fullIndex) {
        console.log(`[SEARCH] Could not load inverted index: ${err ? err.message : 'not found'}`);
        callback(null, {
          query: queryString,
          results: [],
          total: 0,
        });
        return;
      }

      const entry = fullIndex[queryTerm];
      if (!entry || !entry.postings) {
        callback(null, {
          query: queryString,
          results: [],
          total: 0,
        });
        return;
      }

      const docIds = Object.keys(entry.postings);
      const docFreq = entry.documentFrequency || docIds.length;
      
      const results = [];
      let completed = 0;

      docIds.forEach(docId => {
        const [owner, repo] = docId.split('/');
        const metaKey = storageKeys.documentMetadataKey(owner, repo);
        const termFreq = entry.postings[docId] || 0;

        store.get({key: metaKey, gid: 'gitgle'}, (err, metadata) => {
          if (!err && metadata) {
            const tfidfScore = calculateTFIDF(termFreq, docFreq, totalDocs);
            
            const boost = getMetadataBoost(metadata);
            const finalScore = tfidfScore * boost;
            
            const content = metadata.content || metadata.readme || '';
            const snippet = snippets.extractSnippet(queryTerm, content, 100);
            const termMetadata = snippets.extractTermMetadata(queryTerm, content);
            
            const excerpt = snippets.generateExcerpt(content, 150, [queryTerm]);
            
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
              
              snippet: snippet.highlighted,
              snippetContext: snippet.snippet,
              
              termMetadata: {
                frequency: termMetadata.frequency,
                density: termMetadata.density,
                firstOccurrence: termMetadata.firstOccurrence,
                position: snippet.position,
              },
              
              docMetadata: {
                wordCount: excerpt.wordCount,
                charCount: excerpt.charCount,
                language: metadata.language,
              },
              
              content: content 
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
        callback(null, {
          query: queryString,
          results: [],
          total: 0,
        });
        return;
      }
    });
  });
}

module.exports = {
  executeSearch,
  getIndexStats,
  calculateTFIDF,
  getMetadataBoost,
};
