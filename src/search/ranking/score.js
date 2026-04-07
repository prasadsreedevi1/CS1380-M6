// combines multiple ranking signals into final score
// uses tfidf as base, adds metadata boost for stars/language/topics
// mixes tfidf (75%) with metadata boost (25%)

const tfidf = require('./tfidf.js');
const metadataBoost = require('./metadata-boost.js');

function scoreDocument(doc, termFrequencies, queryTerms, totalDocs, documentFrequencies) {
  const tfidfScore = tfidf.calculateDocumentTFIDF(
      termFrequencies,
      queryTerms,
      totalDocs,
      documentFrequencies,
  );

  const boostScore = metadataBoost.calculateMetadataBoost(doc, queryTerms);

  // TF-IDF (75%) + Metadata (25%)
  const compositeScore = tfidfScore * 0.75 + boostScore * 0.25;

  return Math.max(0, compositeScore);
}

function scoreDocuments(docs, docTermFrequencies, queryTerms, totalDocs, documentFrequencies) {
  if (!Array.isArray(docs)) {
    return [];
  }

  return docs
      .map(doc => {
        const docId = `${doc.owner}:${doc.repo}`;
        const tf = docTermFrequencies[docId] || {};
        const score = scoreDocument(doc, tf, queryTerms, totalDocs, documentFrequencies);
        return {doc, score};
      })
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score);
}

module.exports = {
  scoreDocument,
  scoreDocuments,
};
