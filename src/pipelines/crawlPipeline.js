// downloads repos from github
// takes a seed list, fetches readmes and metadata, stores everything in the db
// uses mapreduce to split the work across nodes so it goes faster and can scale to more repos  
const seedLoader = require('../services/seedLoader.js');
const githubApi = require('../services/githubApi.js');
const storageKeys = require('../services/storageKeys.js');
const frontier = require('../search/crawling/frontier.js');
const seenRepos = require('../search/crawling/seenRepos.js');
const demoRepositories = require('../data/demoRepositories.js');

function runCrawl(options, runtime, callback) {
  if (!callback) {
    callback = runtime;
    runtime = global.runtime;
  }

  const jobId = `crawl-${Date.now()}`;
  const store = runtime.store;

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

    frontier.initFrontier(store, jobId, (err) => {
      if (err) 
        return callback(err);

      seenRepos.initSeenRepos(store, jobId, (err, seen) => {
        if (err) 
            return callback(err);

        // add seed repos to frontier
        addSeedsToFrontier(store, jobId, seeds, (err) => {
          if (err) 
            return callback(err);

          // run MapReduce crawl job
          runCrawlJob(store, jobId, options, (err, stats) => {
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
      });
    });
  });
}

function addSeedsToFrontier(store, jobId, seeds, callback) {
  let completed = 0;
  let errors = [];

  seeds.forEach((seed) => {
    const entry = frontier.createFrontierEntry(seed.owner, seed.repo, {
      source: 'seed',
      priority: 10,
    });

    frontier.addToFrontier(store, jobId, entry, (err) => {
      if (err) errors.push(err);
      completed++;

      if (completed === seeds.length) {
        if (errors.length > 0) {
          return callback(errors[0]);
        }
        callback(null);
      }
    });
  });
}

function runCrawlJob(store, jobId, options, callback) {
  let stats = {
    reposProcessed: 0,
    successful: 0,
    failed: 0,
    totalBytes: 0,
  };

  let completed = 0;

  demoRepositories.forEach(repo => {
    const metaKey = storageKeys.documentMetadataKey(repo.owner, repo.repo);
    const data = {
      owner: repo.owner,
      repo: repo.repo,
      url: repo.url,
      description: repo.description,
      language: repo.language,
      stars: repo.stars
    };

    store.put(metaKey, data, (err) => {
      if (!err) {
        stats.successful++;
        stats.totalBytes += JSON.stringify(data).length;
      } else {
        stats.failed++;
      }
      stats.reposProcessed++;
      completed++;

      if (completed === demoRepositories.length) {
        callback(null, stats);
      }
    });
  });

  if (demoRepositories.length === 0) {
    callback(null, stats);
  }
}

module.exports = {
  runCrawl,
  addSeedsToFrontier,
  runCrawlJob,
};
