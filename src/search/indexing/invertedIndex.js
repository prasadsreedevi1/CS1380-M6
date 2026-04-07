// builds inverted index from document terms
// maps each term to all the docs that contain it and how many times
// supports merging indices and filtering common/rare words

const storageKeys = require('../../services/storageKeys.js');

function buildInvertedIndex(documentTermFrequencies) {
  const invertedIndex = {};

  Object.entries(documentTermFrequencies).forEach(([docId, termFreqs]) => {
    Object.entries(termFreqs).forEach(([term, frequency]) => {
      if (!invertedIndex[term]) {
        invertedIndex[term] = {
          term,
          postings: {},
          documentFrequency: 0,
        };
      }

      if (!invertedIndex[term].postings[docId]) {
        invertedIndex[term].documentFrequency++;
      }
      invertedIndex[term].postings[docId] = frequency;
    });
  });

  return invertedIndex;
}

function mergeTermEntries(entries) {
  if (!entries || entries.length === 0) {
    return null;
  }

  if (entries.length === 1) {
    return entries[0];
  }

  const mergedPostings = {};
  let docFreqCount = 0;

  entries.forEach(entry => {
    if (entry && entry.postings) {
      Object.entries(entry.postings).forEach(([docId, freq]) => {
        if (!mergedPostings[docId]) {
          docFreqCount++;
        }
        mergedPostings[docId] = (mergedPostings[docId] || 0) + freq;
      });
    }
  });

  return {
    term: entries[0].term,
    postings: mergedPostings,
    documentFrequency: docFreqCount,
  };
}

function getTopDocumentsForTerm(indexEntry, limit = 10) {
  if (!indexEntry || !indexEntry.postings) {
    return [];
  }

  return Object.entries(indexEntry.postings)
      .map(([docId, freq]) => ({docId, frequency: freq}))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
}

function getDocumentFrequency(indexEntry) {
  return indexEntry?.documentFrequency || 0;
}

function findDocumentsWithTerms(indexEntries) {
  const docMatches = {};

  indexEntries.forEach(entry => {
    if (entry && entry.postings) {
      Object.keys(entry.postings).forEach(docId => {
        if (!docMatches[docId]) {
          docMatches[docId] = [];
        }
        docMatches[docId].push(entry.term);
      });
    }
  });

  return docMatches;
}

function calculateCoOccurrence(entry1, entry2) {
  if (!entry1 || !entry2) return 0;

  const docs1 = new Set(Object.keys(entry1.postings || {}));
  const docs2 = new Set(Object.keys(entry2.postings || {}));

  let overlap = 0;
  docs1.forEach(doc => {
    if (docs2.has(doc)) overlap++;
  });

  return overlap;
}

function getIndexStats(invertedIndex) {
  if (!invertedIndex || Object.keys(invertedIndex).length === 0) {
    return {
      termsCount: 0,
      totalPostings: 0,
      averageDF: 0,
      averagePostingsPerTerm: 0,
    };
  }

  const termEntries = Object.values(invertedIndex);
  const totalPostings = termEntries.reduce((sum, entry) => {
    return sum + Object.keys(entry.postings || {}).length;
  }, 0);

  const totalDF = termEntries.reduce((sum, entry) => {
    return sum + (entry.documentFrequency || 0);
  }, 0);

  return {
    termsCount: termEntries.length,
    totalPostings,
    averageDF: totalDF / termEntries.length,
    averagePostingsPerTerm: totalPostings / termEntries.length,
    maxDF: Math.max(...termEntries.map(e => e.documentFrequency || 0)),
    minDF: Math.min(...termEntries.map(e => e.documentFrequency || 0)),
  };
}

function filterTerms(invertedIndex, options = {}) {
  const minDF = options.minDF || 1;
  const maxDFRatio = options.maxDF || 0.95;

  if (!invertedIndex || Object.keys(invertedIndex).length === 0) {
    return {};
  }

  const totalDocs = Object.values(invertedIndex)
      .reduce((max, entry) => Math.max(max, entry.documentFrequency || 0), 0);

  const maxDF = Math.ceil(totalDocs * maxDFRatio);

  const filtered = {};
  Object.entries(invertedIndex).forEach(([term, entry]) => {
    const df = entry.documentFrequency || 0;
    if (df >= minDF && df <= maxDF) {
      filtered[term] = entry;
    }
  });

  return filtered;
}

module.exports = {
  buildInvertedIndex,
  mergeTermEntries,
  getTopDocumentsForTerm,
  getDocumentFrequency,
  findDocumentsWithTerms,
  calculateCoOccurrence,
  getIndexStats,
  filterTerms,
};
