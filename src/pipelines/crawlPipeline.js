const seedLoader = require('../services/seedLoader.js');
const storageKeys = require('../services/storageKeys.js');
const demoRepositories = require('../data/demoRepositories.js');
const { fetchRepoData } = require('./repoDataFetcher.js');
const { runRecursiveCrawl } = require('./recursiveCrawl.js');

function runCrawl(options, runtime, callback) {
  if (!callback) {
    callback = runtime;
    runtime = global.runtime;
  }

  const jobId = `crawl-${Date.now()}`;
  const store = runtime.store || globalThis.distribution.gitgle.store;
  const mr = runtime.executor || globalThis.distribution.gitgle.mr;

  let crawlStats = {
    jobId,
    startTime: Date.now(),
    seedsLoaded: 0,
    reposProcessed: 0,
    successful: 0,
    failed: 0,
    totalBytes: 0,
    apiCalls: 0,
    apiErrors: 0,
  };

  seedLoader.loadSeeds(options.seedFile, (err, seeds) => {
    if (err) return callback(err);

    crawlStats.seedsLoaded = seeds.length;
    if (seeds.length === 0) {
      return callback(new Error('No seeds found in seed file'));
    }

    const repos = [];
    let fetched = 0;
    let fetchErrors = 0;

    seeds.forEach((seed, index) => {
      setTimeout(() => {
        fetchRepoData(seed, demoRepositories, (err, repoData) => {
          if (err) {
            fetchErrors++;
          }
          if (repoData) {
            repos.push(repoData);
            crawlStats.apiCalls++;
          }
          fetched++;
          if (fetched === seeds.length) {
            crawlStats.apiErrors = fetchErrors;
            runCrawlJob(store, mr, jobId, options, repos, (err, stats) => {
              if (err) {
                return callback(err, {
                  ...crawlStats,
                  error: err.message,
                });
              }

              crawlStats = {...crawlStats, ...stats};
              crawlStats.endTime = Date.now();
              crawlStats.duration = crawlStats.endTime - crawlStats.startTime;

              callback(null, crawlStats);
            });
          }
        });
      }, index * 100);
    });
  });
}

function runCrawlJob(store, mr, jobId, options, repos, callback) {
  let stats = {
    reposProcessed: 0,
    successful: 0,
    failed: 0,
    totalBytes: 0,
  };

  globalThis.distribution.local.groups.get('gitgle', (err, nodes) => {
    if (err) return callback(err);

    const nodeList = Object.values(nodes);
    if (nodeList.length === 0) {
      return callback(new Error('No nodes in gitgle group'));
    }

    if (repos.length === 0) {
      return callback(new Error('No repositories to crawl'));
    }

    const keys = [];
    let completed = 0;
    let storeErrors = 0;

    function tryFinishMapReduce() {
      if (completed < repos.length) {
        return;
      }
      if (keys.length === 0) {
        return callback(new Error('No repos stored successfully'));
      }

      mr.exec({
        keys,
        map: function(key, repoData) {
          if (!repoData) return [];
          const docId = `${repoData.owner}/${repoData.repo}`;
          const result = {};
          result[docId] = repoData;
          return [result];
        },
        reduce: function(docId, metadataList) {
          const metadata = metadataList[0];
          if (!metadata) return null;
          const result = {};
          result[docId] = metadata;
          return result;
        },
      }, (err, results) => {
        if (err) return callback(err);

        stats.reposProcessed = results ? results.length : 0;
        stats.successful = results ? results.length : 0;
        stats.totalBytes = results
          ? results.reduce((sum, r) => sum + JSON.stringify(r).length, 0)
          : 0;
        stats.failed = storeErrors;

        callback(null, stats);
      });
    }

    repos.forEach((repo) => {
      const metaKey = storageKeys.documentMetadataKey(repo.owner, repo.repo);
      const data = {
        owner: repo.owner,
        repo: repo.repo,
        url: repo.url || `https://github.com/${repo.owner}/${repo.repo}`,
        description: repo.description || '',
        language: repo.language || 'Unknown',
        stars: repo.stars || 0,
        topics: repo.topics || [],
        readme: repo.readme || '',
      };

      store.put(data, {key: metaKey, gid: 'gitgle'}, (err) => {
        if (err) {
          storeErrors++;
        } else {
          keys.push(metaKey);
        }
        completed++;
        tryFinishMapReduce();
      });
    });
  });
}


module.exports = {
  runCrawl,
  runCrawlJob,
  runRecursiveCrawl,
};