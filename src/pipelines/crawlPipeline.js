// downloads repos from github
// takes a seed list, fetches readmes and metadata, stores everything in the db
// uses mapreduce to split the work across nodes so it goes faster and can scale to more repos
const seedLoader = require('../services/seedLoader.js');
const githubApi = require('../services/githubApi.js');
const storageKeys = require('../services/storageKeys.js');
const demoRepositories = require('../data/demoRepositories.js');

function repoRecordForSeed(seed, demoList) {
  const hit = demoList.find(
    (r) => r.owner === seed.owner && r.repo === seed.repo,
  );
  if (hit) {
    return hit;
  }
  return {
    owner: seed.owner,
    repo: seed.repo,
    url: `https://github.com/${seed.owner}/${seed.repo}`,
    description: `${seed.repo} repository from ${seed.owner}`,
    language: 'Mixed',
    stars: 0,
    readme: `${seed.owner}/${seed.repo} - open source repository.`,
  };
}

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
  };

  seedLoader.loadSeeds(options.seedFile, (err, seeds) => {
    if (err) return callback(err);

    crawlStats.seedsLoaded = seeds.length;
    if (seeds.length === 0) {
      return callback(new Error('No seeds found in seed file'));
    }

    const repos = seeds.map((s) => repoRecordForSeed(s, demoRepositories));

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

    // Use the distributed group store so each key lands on the same node that
    // store.get / mr.exec will hash to. (Round-robin comm.send to workers breaks that.)
    const keys = [];
    let completed = 0;

    function tryFinishMapReduce() {
      if (completed < repos.length) {
        return;
      }
      if (keys.length === 0) {
        return callback(new Error('No repos stored'));
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

        callback(null, stats);
      });
    }

    repos.forEach((repo) => {
      const metaKey = storageKeys.documentMetadataKey(repo.owner, repo.repo);
      const data = {
        owner: repo.owner,
        repo: repo.repo,
        url: repo.url,
        description: repo.description,
        language: repo.language,
        stars: repo.stars,
        readme: repo.readme || '',
      };

      store.put(data, {key: metaKey, gid: 'gitgle'}, (err) => {
        if (!err) keys.push(metaKey);
        completed++;
        tryFinishMapReduce();
      });
    });
  });
}

module.exports = {
  runCrawl,
  runCrawlJob,
};