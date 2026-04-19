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

  store.get(null, (err, keys) => {
    if (err) return callback(err);

    if (!keys || keys.length === 0) {
      return callback(new Error('No documents found in store — run crawl first'));
    }

    const docKeys = keys.filter(
      (k) => typeof k === 'string' && k.startsWith('meta'),
    );

    if (docKeys.length === 0) {
      return callback(new Error('No metadata keys found — run crawl first'));
    }

    mr.exec({
      keys: docKeys,

      map: function(key, repoData) {
        if (!repoData || !repoData.readme) return [];

        const results = [];
        const text = repoData.readme.toLowerCase();
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
      if (err) return callback(err);

      indexStats.docsIndexed = docKeys.length;
      indexStats.uniqueTerms = results ? results.length : 0;
      indexStats.totalPostings = results
        ? results.reduce((sum, r) => {
            const entry = r ? Object.values(r)[0] : null;
            return sum + (entry ? Object.keys(entry.postings || {}).length : 0);
          }, 0)
        : 0;

      writeInvertedIndexEntries(store, results, (writeErr) => {
        if (writeErr) return callback(writeErr);

        storeIndexStats(store, jobId, indexStats, (statsErr) => {
          if (statsErr) return callback(statsErr);

          indexStats.endTime = Date.now();
          indexStats.duration = indexStats.endTime - indexStats.startTime;

          callback(null, indexStats);
        });
      });
    });
  });
}

function writeInvertedIndexEntries(store, mrResults, callback) {
  const rows = (mrResults || []).filter(Boolean);
  if (rows.length === 0) {
    return callback(null);
  }

  let pending = rows.length;
  let firstErr = null;

  rows.forEach((row) => {
    const term = Object.keys(row)[0];
    const entry = row[term];
    if (!term || !entry) {
      pending--;
      if (pending === 0) callback(firstErr);
      return;
    }

    const invKey = storageKeys.invertedIndexKey(term);
    store.put(entry, {key: invKey, gid: 'gitgle'}, (err) => {
      if (err) firstErr = firstErr || err;
      pending--;
      if (pending === 0) callback(firstErr);
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

module.exports = {
  runIndex,
  storeIndexStats,
};