// one search result returned to the user
// has the repo info, relevance score, and which terms matched
// results are sorted by score so best matches show up first

function createSearchResult(doc, score, matchedTerms = []) {
  if (!doc) {
    return null;
  }
  return {
    owner: doc.owner || 'unknown',
    repo: doc.repo || 'unknown',
    url: doc.url || '',
    description: doc.description || '',
    language: doc.language || null,
    stars: doc.stars || 0,
    score,
    matchedTerms,
  };
}

function sortByRelevance(results) {
  if (!Array.isArray(results)) {
    return [];
  }
  return [...results].sort((a, b) => b.score - a.score);
}

function filterByLanguage(results, language) {
  if (!language || !Array.isArray(results)) {
    return results;
  }
  return results.filter(r => r.language && r.language.toLowerCase() === language.toLowerCase());
}

function filterByOwner(results, owner) {
  if (!owner || !Array.isArray(results)) {
    return results;
  }
  return results.filter(r => r.owner.toLowerCase() === owner.toLowerCase());
}

module.exports = {
  createSearchResult,
  sortByRelevance,
  filterByLanguage,
  filterByOwner,
};
