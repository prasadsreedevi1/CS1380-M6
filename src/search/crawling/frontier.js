// manages the queue of repos to crawl
// keeps track of what's left to do, sorts by priority, pulls one at a time
// prevents the same repo from being added to the queue twice

function createFrontierEntry(owner, repo, options = {}) {
  return {
    owner,
    repo,
    priority: options.priority || 0,
    addedAt: Date.now(),
    source: options.source || 'unknown',
  };
}

function initFrontier(store, jobId, callback) {
  const storageKeys = require('../../services/storageKeys.js');
  const key = storageKeys.frontierKey(jobId);

  store.get(key, (err, existing) => {
    if (err) 
        return callback(err);

    // if frontier already exists in store, use it; otherwise create empty
    const frontier = existing || [];
    callback(null, frontier);
  });
}

function addToFrontier(store, jobId, entry, callback) {
  const storageKeys = require('../../services/storageKeys.js');
  const frontierKey = storageKeys.frontierKey(jobId);
  const seenKey = storageKeys.seenReposKey(jobId);

  // check if already seen
  store.get(seenKey, (err, seenSet) => {
    if (err && !err.message.includes('not found')) {
      return callback(err);
    }

    const seen = seenSet || {};
    const repoId = `${entry.owner}/${entry.repo}`;

    if (seen[repoId]) {
      return callback(null, false);
    }

    seen[repoId] = true;
    store.put(seenKey, seen, (err) => {
      if (err) 
        return callback(err);

      store.get(frontierKey, (err, frontier) => {
        if (err && !err.message.includes('not found')) {
          return callback(err);
        }

        const queue = frontier || [];
        queue.push(entry);

        // sort by priority (descending) and then by addedAt (ascending)
        queue.sort((a, b) => {
          if (b.priority !== a.priority) {
            return b.priority - a.priority;
          }
          return a.addedAt - b.addedAt;
        });

        store.put(frontierKey, queue, (err) => {
          callback(err, !err);
        });
      });
    });
  });
}

function getNextEntry(store, jobId, callback) {
  const storageKeys = require('../../services/storageKeys.js');
  const key = storageKeys.frontierKey(jobId);

  store.get(key, (err, frontier) => {
    if (err) 
        return callback(err);

    const queue = frontier || [];
    if (queue.length === 0) {
      return callback(null, null);
    }

    const entry = queue.shift();
    store.put(key, queue, (err) => {
      callback(err, entry);
    });
  });
}

function getFrontierStats(store, jobId, callback) {
  const storageKeys = require('../../services/storageKeys.js');
  const key = storageKeys.frontierKey(jobId);

  store.get(key, (err, frontier) => {
    if (err) 
        return callback(err);

    const queue = frontier || [];
    const stats = {
      size: queue.length,
      oldestAddedAt: queue.length > 0 ? queue[queue.length - 1].addedAt : null,
      newestAddedAt: queue.length > 0 ? queue[0].addedAt : null,
    };

    callback(null, stats);
  });
}

function clearFrontier(store, jobId, callback) {
  const storageKeys = require('../../services/storageKeys.js');
  const frontierKey = storageKeys.frontierKey(jobId);
  const seenKey = storageKeys.seenReposKey(jobId);

  store.del(frontierKey, (err) => {
    if (err) 
        return callback(err);
    store.del(seenKey, callback);
  });
}

module.exports = {
  createFrontierEntry,
  initFrontier,
  addToFrontier,
  getNextEntry,
  getFrontierStats,
  clearFrontier,
};
