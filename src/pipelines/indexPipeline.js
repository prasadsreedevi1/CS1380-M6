// builds an inverted index from the crawled documents
// goes through each doc, extracts the terms, counts frequencies, and stores them
// this creates the data structure that lets us search fast

const storageKeys = require('../services/storageKeys.js');

function runIndex(options, runtime, callback) {
  if (!callback) {
    callback = runtime;
    runtime = global.runtime;
  }

  const jobId = `index-${Date.now()}`;
  const store = runtime.store || globalThis.distribution.gitgle.store;
  const mr = runtime.executor || globalThis.distribution.gitgle.mr;

  let indexStats = {
    jobId,
    startTime: Date.now(),
    docsIndexed: 0,
    uniqueTerms: 0,
    totalPostings: 0,
    totalBytes: 0,
  };

  const metadataKeysKey = 'crawl:all-metadata-keys';
  
  store.get({key: metadataKeysKey, gid: 'gitgle'}, (err, metadata) => {
    if (err || !metadata || !metadata.keys) {
      return callback(new Error('Could not retrieve metadata keys from store — run crawl first'));
    }

    const docKeys = metadata.keys;
    
    if (!docKeys || docKeys.length === 0) {
      return callback(new Error('No documents found in store — run crawl first'));
    }

    if (docKeys.length === 0) {
      return callback(new Error('No metadata keys found — run crawl first'));
    }

    let callbackCalled = false;
    const mrTimeoutMs = Number(process.env.MR_INDEX_TIMEOUT_MS || 30000);
    const timeoutId = setTimeout(() => {
      if (!callbackCalled) {
        callbackCalled = true;
        console.warn(`[INDEX] MR timeout after ${mrTimeoutMs}ms, using fallback indexer.`);
        simpleFallbackIndex(store, docKeys, jobId, indexStats, callback);
      }
    }, mrTimeoutMs);

    mr.exec({
      gid: 'gitgle',
      keys: docKeys,

      map: function(key, repoData) {
        if (!repoData) return [];
        
        let textToIndex = (repoData.readme || '') + ' ' + (repoData.description || '');
        if (!textToIndex || textToIndex.trim().length === 0) {
          return []; 
        }

        const results = [];
        const text = textToIndex.toLowerCase();
        const docId = `${repoData.owner}/${repoData.repo}`;

        const tokens = text
          .split(/\W+/)
          .filter(t => t.length > 2);

        const termFreqs = {};
        tokens.forEach(token => {
          termFreqs[token] = (termFreqs[token] || 0) + 1;
        });

        Object.entries(termFreqs).forEach(([term, freq]) => {
          const result = {};
          result[term] = { docId, freq };
          results.push(result);
        });

        return results;
      },

      reduce: function(term, postingsList) {
        if (!postingsList || postingsList.length === 0) return null;

        const postings = {};
        postingsList.forEach(entry => {
          if (entry && entry.docId) {
            postings[entry.docId] = (postings[entry.docId] || 0) + entry.freq;
          }
        });

        const entry = {
          term,
          postings,
          documentFrequency: Object.keys(postings).length,
        };

        const result = {};
        result[term] = entry;
        return result;
      },

    }, (err, results) => {
      if (!callbackCalled) {
        callbackCalled = true;
        clearTimeout(timeoutId);

        if (err) {
          console.warn(`[INDEX] MR exec error, using fallback indexer: ${err.message}`);
          return simpleFallbackIndex(store, docKeys, jobId, indexStats, callback);
        }

        if (!results || results.length === 0) {
          console.warn('[INDEX] MR returned empty results, using fallback indexer.');
          return simpleFallbackIndex(store, docKeys, jobId, indexStats, callback);
        }

        indexStats.docsIndexed = docKeys.length;
        indexStats.uniqueTerms = results ? results.length : 0;
        indexStats.totalPostings = results
          ? results.reduce((sum, r) => {
              const entry = r ? Object.values(r)[0] : null;
              return sum + (entry ? Object.keys(entry.postings || {}).length : 0);
            }, 0)
          : 0;

        writeInvertedIndexEntries(store, results, (putErr) => {
          if (putErr) {
            return callback(putErr);
          }
          storeIndexStats(store, jobId, indexStats, (statsErr) => {
            if (statsErr) return callback(statsErr);

            indexStats.endTime = Date.now();
            indexStats.duration = indexStats.endTime - indexStats.startTime;

            callback(null, indexStats);
          });
        });
      }
    });
  });
}

function storeIndexStats(store, jobId, stats, callback) {
  const key = storageKeys.indexStatsKey();

  store.get({key, gid: 'gitgle'}, (err, existing) => {
    const indexStats = existing || { indices: {} };

    indexStats.indices[jobId] = {
      docsIndexed: stats.docsIndexed || 0,
      uniqueTerms: stats.uniqueTerms || 0,
      totalPostings: stats.totalPostings || 0,
      createdAt: Date.now(),
    };

    indexStats.docsIndexed = stats.docsIndexed || 0;
    indexStats.uniqueTerms = stats.uniqueTerms || 0;
    indexStats.totalPostings = stats.totalPostings || 0;

    store.put(indexStats, {key, gid: 'gitgle'}, callback);
  });
}

/**
 * Persist inverted-index rows from the same shape as mr.exec `results`
 * (`[{ term: entry }, ...]`). Writes `inv:full-index` plus per-term `inv:<term>`
 * keys so search / test-index verification can resolve a term.
 */
function writeInvertedIndexEntries(store, results, callback) {
  const invertedIndex = {};
  results.forEach((row) => {
    if (row) {
      const term = Object.keys(row)[0];
      const entry = row[term];
      if (term && entry) {
        invertedIndex[term] = entry;
      }
    }
  });

  store.put(invertedIndex, {key: 'inv:full-index', gid: 'gitgle'}, (putErr) => {
    if (putErr) return callback(putErr);

    const terms = Object.keys(invertedIndex);
    if (terms.length === 0) {
      return callback(null);
    }

    let pending = terms.length;
    let firstErr = null;
    terms.forEach((term) => {
      const entry = invertedIndex[term];
      store.put(entry, {key: storageKeys.invertedIndexKey(term), gid: 'gitgle'}, (err) => {
        if (err && !firstErr) firstErr = err;
        pending -= 1;
        if (pending === 0) {
          callback(firstErr);
        }
      });
    });
  });
}

function simpleFallbackIndex(store, docKeys, jobId, indexStats, callback) {
  
  const allTerms = {};
  let processed = 0;
  let errors = 0;
  let successfulReads = 0;
  console.log(`[INDEX FALLBACK] Starting fallback index for ${docKeys.length} metadata keys`);

  const processDoc = (index) => {
    if (index >= docKeys.length) {
      console.log(
        `[INDEX FALLBACK] Read summary: total=${docKeys.length} successful=${successfulReads} failed=${errors}`,
      );
      indexStats.docsIndexed = docKeys.length - errors;
      indexStats.uniqueTerms = Object.keys(allTerms).length;
      indexStats.totalPostings = Object.values(allTerms).reduce(
        (sum, entry) => sum + Object.keys(entry.postings || {}).length,
        0
      );

      Object.values(allTerms).forEach((entry) => {
        entry.documentFrequency = Object.keys(entry.postings || {}).length;
      });

      const results = Object.entries(allTerms).map(([term, entry]) => {
        const result = {};
        result[term] = entry;
        return result;
      });

      writeInvertedIndexEntries(store, results, (writeErr) => {
        if (writeErr) return callback(writeErr);

        storeIndexStats(store, jobId, indexStats, (statsErr) => {
          if (statsErr) return callback(statsErr);

          indexStats.endTime = Date.now();
          indexStats.duration = indexStats.endTime - indexStats.startTime;

          callback(null, indexStats);
        });
      });
      return;
    }

    const docKey = docKeys[index];
    store.get({key: docKey, gid: 'gitgle'}, (err, repoData) => {
      if (err || !repoData) {
        errors++;
        processed++;
        if (processed % 20 === 0) {
        }
        processDoc(index + 1);
        return;
      }
      successfulReads++;

      let textToIndex = (repoData.readme || '') + ' ' + (repoData.description || '');
      if (!textToIndex || textToIndex.trim().length === 0) {
        processed++;
        if (processed % 20 === 0) {
          console.log(`[INDEX FALLBACK] Processed ${processed}/${docKeys.length} documents`);
        }
        processDoc(index + 1);
        return;
      }

      const text = textToIndex.toLowerCase();
      const docId = `${repoData.owner}/${repoData.repo}`;
      const tokens = text.split(/\W+/).filter(t => t.length > 2);
      
      const termFreqs = {};
      tokens.forEach(token => {
        termFreqs[token] = (termFreqs[token] || 0) + 1;
      });

      Object.entries(termFreqs).forEach(([term, freq]) => {
        if (!allTerms[term]) {
          allTerms[term] = {
            term,
            postings: {},
            documentFrequency: 0,
          };
        }
        allTerms[term].postings[docId] = freq;
      });

      processed++;
      if (processed % 20 === 0) {
        console.log(`[INDEX FALLBACK] Processed ${processed}/${docKeys.length} documents`);
      }
      
      processDoc(index + 1);
    });
  };

  processDoc(0);
}

module.exports = {
  runIndex,
  storeIndexStats,
  simpleFallbackIndex,
  writeInvertedIndexEntries,
};