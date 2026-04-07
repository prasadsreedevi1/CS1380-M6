// boosts relevance scores based on document popularity and metadata
// repositories with more stars rank higher
// language and topic matches also add boost

function calculateMetadataBoost(doc, queryTerms = []) {
  if (!doc || typeof doc !== 'object') {
    return 0;
  }

  let boostScore = 0.1; 

  if (doc.stars && typeof doc.stars === 'number') {
    // log scale: 0-10 stars = 0.1, 100 = 0.4, 1000 = 0.7, 10000+ = 1.0
    const starBoost = Math.min(1, Math.log(doc.stars + 1) / Math.log(10000)) * 0.5;
    boostScore += starBoost;
  }

  if (doc.language && typeof doc.language === 'string') {
    const lang = doc.language.toLowerCase();
    const queryText = (queryTerms || []).join(' ').toLowerCase();
    if (queryText.includes(lang) || queryText.includes(lang.split('+')[0])) {
      boostScore += 0.3;
    }
  }

  if (Array.isArray(doc.topics) && doc.topics.length > 0) {
    const queryText = (queryTerms || []).join(' ').toLowerCase();
    const topicMatches = doc.topics.filter(topic =>
      queryText.includes(topic.toLowerCase()),
    ).length;
    boostScore += Math.min(0.3, topicMatches * 0.1);
  }

  return Math.min(1, boostScore);
}

module.exports = {
  calculateMetadataBoost,
};
