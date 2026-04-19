const { normalizeText } = require('../search/parsing/normalizeText.js');
const { tokenize } = require('../search/parsing/tokenize.js');
const { stem } = require('../search/parsing/stem.js');
const storageKeys = require('../services/storageKeys.js');

function distributedIndex(documents, runtime, callback) {
  if (!documents || documents.length === 0) {
    return callback(new Error('No documents to index'));
  }

  const store = runtime.store;
  const jobId = `index-${Date.now()}`;

  const stats = {
    jobId,
    documentsProcessed: 0,
    mapPhaseCompleted: 0,
    shufflePhaseCompleted: 0,
    reducePhaseCompleted: 0,
    uniqueTerms: 0,
    totalPostings: 0,
    startTime: Date.now(),
  };

  mapPhase(documents, (err, termPostings) => {
    if (err) return callback(err);

    stats.mapPhaseCompleted = Object.keys(termPostings).length;
    stats.documentsProcessed = documents.length;
    console.log(`[MAP] Extracted ${stats.mapPhaseCompleted} unique terms from ${documents.length} documents`);

    shufflePhase(termPostings, runtime, (err, shuffleData) => {
      if (err) return callback(err);

      stats.shufflePhaseCompleted = Object.keys(shuffleData).length;
      console.log(`[SHUFFLE] Distributed terms to ${stats.shufflePhaseCompleted} nodes`);

      reducePhase(shuffleData, runtime, (err, reduceStats) => {
        if (err) return callback(err);

        stats.reducePhaseCompleted = reduceStats.termsStored;
        stats.uniqueTerms = reduceStats.uniqueTerms;
        stats.totalPostings = reduceStats.totalPostings;
        stats.endTime = Date.now();
        stats.duration = stats.endTime - stats.startTime;

        callback(null, stats);
      });
    });
  });
}

function mapPhase(documents, callback) {
  const termPostings = {};

  documents.forEach(doc => {
    const docId = `${doc.owner}/${doc.repo}`;
    const readme = doc.readme || '';
    const normalized = normalizeText(readme);
    const tokens = tokenize(normalized);
    const frequencies = {};
    tokens.forEach(token => {
      const stemmed = stem(token);
      if (stemmed && stemmed.length > 2) {
        frequencies[stemmed] = (frequencies[stemmed] || 0) + 1;
      }
    });

    Object.entries(frequencies).forEach(([term, freq]) => {
      if (!termPostings[term]) {
        termPostings[term] = [];
      }

      termPostings[term].push({
        docId,
        frequency: freq,
        language: doc.language,
        stars: doc.stars,
      });
    });
  });

  callback(null, termPostings);
}

function shufflePhase(termPostings, runtime, callback) {
  const distribution = globalThis.distribution;
  distribution.local.groups.get('gitgle', (err, nodeGroup) => {
    if (err) return callback(err);

    const nodeList = Object.values(nodeGroup);
    if (nodeList.length === 0) {
      return callback(new Error('No active nodes'));
    }

    const partitions = {};

    Object.entries(termPostings).forEach(([term, postings]) => {
        const nodeId = distribution.util.id.consistentHash(term, nodeList);
      const nidStr = nodeId;

      if (!partitions[nidStr]) {
        partitions[nidStr] = {};
      }
      partitions[nidStr][term] = postings;
    });

    let totalPostings = 0;
    Object.entries(partitions).forEach(([nid, terms]) => {
      const postingCount = Object.values(terms).reduce((sum, p) => sum + p.length, 0);
      totalPostings += postingCount;
      console.log(`    Shard ${nid}: ${Object.keys(terms).length} terms, ${postingCount} postings`);
    });
    console.log(`    Total postings: ${totalPostings}`);

    callback(null, partitions);
  });
}

function reducePhase(partitions, runtime, callback) {
  const store = runtime.store;
  const distribution = globalThis.distribution;

  const currentNodeConfig = distribution.node.config;
  const currentNodeId = distribution.util.id.getSID(currentNodeConfig);

  const myTerms = partitions[currentNodeId] || {};

  const termList = Object.entries(myTerms);
  if (termList.length === 0) {
    return callback(null, {
      termsStored: 0,
      uniqueTerms: 0,
      totalPostings: 0,
    });
  }

  let processed = 0;
  let stored = 0;
  let totalPostings = 0;
  let errors = 0;

  termList.forEach(([term, postingsList]) => {
    setTimeout(() => {
      const mergedPostings = {};
      const docFreq = new Set();

      postingsList.forEach(posting => {
        const {docId, frequency, language, stars} = posting;

        if (!mergedPostings[docId]) {
          mergedPostings[docId] = {
            frequency,
            language,
            stars,
          };
          docFreq.add(docId);
        } else {
          mergedPostings[docId].frequency += frequency;
        }
      });

      const documentFrequency = docFreq.size;
      totalPostings += Object.keys(mergedPostings).length;
      const indexEntry = {
        term,
        postings: mergedPostings,
        documentFrequency,
        storedAt: new Date().toISOString(),
      };

      const key = storageKeys.invertedIndexKey(term);
      store.put(indexEntry, {key}, (err) => {
        if (err) {
          console.log(`    ✗ Term "${term}": ${err.message}`);
          errors++;
        } else {
          console.log(`    ✓ Term "${term}" (docFreq: ${documentFrequency}, postings: ${Object.keys(mergedPostings).length})`);
          stored++;
        }

        processed++;
        if (processed === termList.length) {
          finalize();
        }
      });
    }, processed * 10);
  });

  function finalize() {
    callback(null, {
      termsStored: stored,
      uniqueTerms: Object.keys(myTerms).length,
      totalPostings,
    });
  }
}

module.exports = {
  distributedIndex,
  mapPhase,
  shufflePhase,
  reducePhase,
};
