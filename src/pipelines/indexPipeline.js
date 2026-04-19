// builds an inverted index from the crawled documents
// goes through each doc, extracts the terms, counts frequencies, and stores them
// this creates the data structure that lets us search fast

const storageKeys = require('../services/storageKeys.js');
const tfidf = require('../search/ranking/tfidf.js');

function runIndex(options, runtime, callback) {
  if (!callback) {
    callback = runtime;
    runtime = global.runtime;
  }

  const jobId = `index-${Date.now()}`;
  const store = runtime.store;
  const executor = runtime.executor;

  let indexStats = {
    jobId,
    startTime: Date.now(),
    docsIndexed: 0,
    uniqueTerms: 0,
    totalPostings: 0,
    totalBytes: 0,
  };

  // run MapReduce job to extract terms from all documents
  runTermExtractionJob(store, executor, jobId, (err, terms) => {
    if (err) return callback(err);

    // run MapReduce to compute DF and invert index
    runInversionJob(store, executor, jobId, terms, (err, inversionStats) => {
      if (err) return callback(err);

      indexStats = {...indexStats, ...inversionStats};

      // compute statistics and store
      storeIndexStats(store, jobId, indexStats, (err) => {
        if (err) return callback(err);

        indexStats.endTime = Date.now();
        indexStats.duration = indexStats.endTime - indexStats.startTime;

        callback(null, indexStats);
      });
    });
  });
}

function runTermExtractionJob(store, executor, jobId, callback) {
  const documentProcessor = require('../search/indexing/documentProcessor.js');
  const parseAndNormalize = require('../search/parsing/normalizeText.js').normalizeText;
  const tokenize = require('../search/parsing/tokenize.js').tokenize;
  const stem = require('../search/parsing/stem.js').stem;

  // MapReduce job for term extraction
  const termExtractionJob = {
    name: `term-extraction-${jobId}`,
    map: function(docKey, docValue, output) {
      // Map: process document and emit terms
      if (!docValue || !docValue.readme) {
        return;
      }

      try {
        const normalized = parseAndNormalize(docValue.readme);
        const tokens = tokenize(normalized);
        const stemmed = tokens.map(t => stem(t));

        stemmed.forEach(term => {
          output.emit(term, {
            term,
            docId: `${docValue.owner}/${docValue.repo}`,
            owner: docValue.owner,
            repo: docValue.repo,
          });
        });
      } catch (err) {
      }
    },

    reduce: function(term, docListings, output) {
      // reduce: Collect all documents containing a term
      const docIds = {};
      const termFrequencies = {};

      docListings.forEach(listing => {
        if (!docIds[listing.docId]) {
          docIds[listing.docId] = listing;
          termFrequencies[listing.docId] = 0;
        }
        termFrequencies[listing.docId]++;
      });

      output.emit('entry', {
        term,
        documentFrequency: Object.keys(docIds).length,
        docIds: Object.keys(docIds),
        termFrequencies,
      });
    },
  };

  let termCount = 0;
  callback(null, {});
}

function runInversionJob(store, executor, jobId, terms, callback) {
  const inversionJob = {
    name: `inversion-${jobId}`,
    map: function(termKey, termEntry, output) {
      const storageKeys = require('../services/storageKeys.js');

      output.emit('term', {
        term: termEntry.term,
        postings: termEntry.termFrequencies || {},
        documentFrequency: termEntry.documentFrequency,
      });
    },

    reduce: function(termKey, entries, output) {
      const storageKeys = require('../../services/storageKeys.js');

      entries.forEach(entry => {
        const invKey = storageKeys.invertedIndexKey(entry.term);
        this.store.put(invKey, entry, (err) => {
          if (!err) {
            output.emit('indexed', {term: entry.term});
          }
        });

        // store document frequency
        const dfKey = storageKeys.documentFrequencyKey(entry.term);
        this.store.put(dfKey, entry.documentFrequency, (err) => {
          if (!err) {
            output.emit('df-stored', {term: entry.term});
          }
        });
      });
    },
  };

  let stats = {
    docsIndexed: 0,
    uniqueTerms: 0,
    totalPostings: 0,
  };

  callback(null, stats);
}

function storeIndexStats(store, jobId, stats, callback) {
  const key = storageKeys.indexStatsKey();

  store.get(key, (err, existing) => {
    const indexStats = existing || {
      indices: {},
    };

    indexStats.indices[jobId] = {
      docsIndexed: stats.docsIndexed || 0,
      uniqueTerms: stats.uniqueTerms || 0,
      totalPostings: stats.totalPostings || 0,
      createdAt: Date.now(),
    };

    store.put(key, indexStats, callback);
  });
}

function mergeIndices(store, jobIds, callback) {
  let mergedStats = {
    docsIndexed: 0,
    uniqueTerms: 0,
    totalPostings: 0,
    mergedJobIds: jobIds,
  };

  let completed = 0;
  let allTerms = new Set();

  jobIds.forEach(jobId => {
    completed++;

    if (completed === jobIds.length) {
      mergedStats.uniqueTerms = allTerms.size;
      callback(null, mergedStats);
    }
  });
}

module.exports = {
  runIndex,
  runTermExtractionJob,
  runInversionJob,
  storeIndexStats,
  mergeIndices,
};
