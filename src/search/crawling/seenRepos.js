// tracks which repos have already been crawled
// we use this to avoid crawling the same repo twice
// also stores info about when it was crawled, if it worked, and how much data we got

function createSeenRepoEntry(owner, repo, metadata = {}) {
  return {
    id: `${owner}/${repo}`,
    owner,
    repo,
    crawledAt: Date.now(),
    success: metadata.success !== false,
    error: metadata.error || null,
    docSize: metadata.docSize || 0,
  };
}

function isSeen(seenRepos, owner, repo) {
  if (!seenRepos) 
    return false;
  const id = `${owner}/${repo}`;
  return !!seenRepos[id];
}

function markAsSeen(seenRepos, owner, repo, metadata = {}) {
  const repos = seenRepos || {};
  const entry = createSeenRepoEntry(owner, repo, metadata);
  repos[entry.id] = entry;
  return repos;
}

function getSeenCount(seenRepos) {
  if (!seenRepos) 
    return 0;
  return Object.keys(seenRepos).length;
}

function getSuccessfulCount(seenRepos) {
  if (!seenRepos) 
    return 0;
  return Object.values(seenRepos)
      .filter(entry => entry.success)
      .length;
}

function getFailedCount(seenRepos) {
  if (!seenRepos) 
    return 0;
  return Object.values(seenRepos)
      .filter(entry => !entry.success)
      .length;
}

function getStats(seenRepos) {
  if (!seenRepos) {
    return {
      total: 0,
      successful: 0,
      failed: 0,
      totalBytes: 0,
      averageDocSize: 0,
    };
  }

  const entries = Object.values(seenRepos);
  const successful = entries.filter(e => e.success).length;
  const failed = entries.filter(e => !e.success).length;
  const totalBytes = entries.reduce((sum, e) => sum + (e.docSize || 0), 0);
  const averageDocSize = entries.length > 0 ? totalBytes / entries.length : 0;

  return {
    total: entries.length,
    successful,
    failed,
    totalBytes,
    averageDocSize,
  };
}

function initSeenRepos(store, jobId, callback) {
  const storageKeys = require('../../services/storageKeys.js');
  const key = storageKeys.seenReposKey(jobId);

  store.get(key, (err, existing) => {
    if (err && err.message && err.message.includes('not found')) {
      return callback(null, {});
    }
    if (err) 
        return callback(err);

    callback(null, existing || {});
  });
}

function persistSeenRepos(store, jobId, seenRepos, callback) {
  const storageKeys = require('../../services/storageKeys.js');
  const key = storageKeys.seenReposKey(jobId);

  store.put(key, seenRepos, callback);
}

function clearSeenRepos(store, jobId, callback) {
  const storageKeys = require('../../services/storageKeys.js');
  const key = storageKeys.seenReposKey(jobId);

  store.del(key, callback);
}

module.exports = {
  createSeenRepoEntry,
  isSeen,
  markAsSeen,
  getSeenCount,
  getSuccessfulCount,
  getFailedCount,
  getStats,
  initSeenRepos,
  persistSeenRepos,
  clearSeenRepos,
};
