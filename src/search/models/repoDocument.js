// standard shape for a github repo we crawled
// has the readme content and metadata like stars, language, topics
// used everywhere: crawling, indexing, and search

function createRepoDocument(owner, repo, url, metadata = {}) {
  return {
    owner,
    repo,
    url,
    readme: metadata.readme || '',
    language: metadata.language || null,
    stars: metadata.stars || 0,
    topics: metadata.topics || [],
    description: metadata.description || '',
    ...metadata,
  };
}

function isValidRepoDocument(doc) {
  return doc &&
    typeof doc === 'object' &&
    typeof doc.owner === 'string' &&
    typeof doc.repo === 'string' &&
    typeof doc.url === 'string' &&
    doc.owner.length > 0 &&
    doc.repo.length > 0 &&
    doc.url.length > 0;
}

module.exports = {
  createRepoDocument,
  isValidRepoDocument,
};
