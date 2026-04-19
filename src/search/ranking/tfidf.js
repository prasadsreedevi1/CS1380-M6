// computes tfidf scores - standard ranking algorithm
// gives high scores to words that are common in one doc but rare overall
// helps find docs most relevant to a query

function calculateTF(termCount, totalTerms) {
  if (totalTerms === 0) return 0;
  return termCount / totalTerms;
}

function calculateIDF(totalDocuments, documentsWithTerm) {
  if (documentsWithTerm === 0 || totalDocuments === 0) return 0;
  return Math.log(totalDocuments / documentsWithTerm);
}

function calculateTFIDF(termCount, docLength, totalDocs, docsWithTerm) {
  const tf = calculateTF(termCount, docLength);
  const idf = calculateIDF(totalDocs, docsWithTerm);
  return tf * idf;
}

function calculateDocumentTFIDF(termFrequencies, queryTerms, totalDocs, documentFrequencies) {
  if (!termFrequencies || !queryTerms || queryTerms.length === 0) {
    return 0;
  }

  let totalScore = 0;
  const docLength = Object.values(termFrequencies).reduce((sum, count) => sum + count, 0);

  queryTerms.forEach(term => {
    const termCount = termFrequencies[term] || 0;
    if (termCount > 0) {
      const docsWithTerm = documentFrequencies[term] || 1;
      const tfidf = calculateTFIDF(termCount, docLength, totalDocs, docsWithTerm);
      totalScore += tfidf;
    }
  });

  return totalScore;
}

module.exports = {
  calculateTF,
  calculateIDF,
  calculateTFIDF,
  calculateDocumentTFIDF,
};
