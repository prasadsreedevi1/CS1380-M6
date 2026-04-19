// represents one term in the inverted index
// stores which docs have the term and how many times it appears in each
// document frequency tells you how many docs have this term

function createIndexEntry(term, postings = {}) {
  const docIds = Object.keys(postings);
  return {
    term,
    postings: postings || {},
    documentFrequency: docIds.length,
  };
}

function addPosting(entry, docId, frequency) {
  if (!entry.postings[docId]) {
    entry.documentFrequency = (entry.documentFrequency || 0) + 1;
  }
  entry.postings[docId] = frequency;
  return entry;
}

function getSortedPostings(entry) {
  if (!entry || !entry.postings) {
    return [];
  }
  return Object.entries(entry.postings)
      .sort((a, b) => b[1] - a[1]);
}

module.exports = {
  createIndexEntry,
  addPosting,
  getSortedPostings,
};
