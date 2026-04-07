// defines all the storage key patterns used throughout the system
// centralizes naming so refactoring is easier
// avoid hardcoding keys in multiple places

function frontierKey(jobId) {
  return `crawl:${jobId}:frontier`;
}

function seenReposKey(jobId) {
  return `crawl:${jobId}:seen-repos`;
}

function documentKey(repoOwner, repoName) {
  return `doc:${repoOwner}:${repoName}`;
}

function indexJobKey(jobId) {
  return `index:${jobId}`;
}

function invertedIndexKey(term) {
  return `inv:${term}`;
}

function documentFrequencyKey(term) {
  return `df:${term}`;
}

function termFrequencyKey(repoOwner, repoName) {
  return `tf:${repoOwner}:${repoName}`;
}

function documentMetadataKey(repoOwner, repoName) {
  return `meta:${repoOwner}:${repoName}`;
}

function indexStatsKey() {
  return 'stats:index';
}

module.exports = {
  frontierKey,
  seenReposKey,
  documentKey,
  indexJobKey,
  invertedIndexKey,
  documentFrequencyKey,
  termFrequencyKey,
  documentMetadataKey,
  indexStatsKey,
};
