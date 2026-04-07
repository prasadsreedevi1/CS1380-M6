// downloads repos from github
// takes a seed list, fetches readmes and metadata, stores everything in the db
// uses mapreduce to split the work across nodes so it goes faster

const seedLoader = require('../services/seedLoader.js');
const githubApi = require('../services/githubApi.js');
const storageKeys = require('../services/storageKeys.js');
const frontier = require('../search/crawling/frontier.js');
const seenRepos = require('../search/crawling/seenRepos.js');

function runCrawl(options, runtime, callback) {
  if (!callback) {
    callback = runtime;
    runtime = global.runtime;
  }

  const jobId = `crawl-${Date.now()}`;
  const store = runtime.store;
  const executor = runtime.executor;

  let crawlStats = {
    jobId,
    startTime: Date.now(),
    seedsLoaded: 0,
    reposProcessed: 0,
    successful: 0,
    failed: 0,
    totalBytes: 0,
  };

  // load seeds
  seedLoader.loadSeeds(options.seedFile, (err, seeds) => {
    if (err) return callback(err);

    crawlStats.seedsLoaded = seeds.length;
    if (seeds.length === 0) {
      return callback(new Error('No seeds found in seed file'));
    }

    // initialize frontier and seen repos
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
          runCrawlJob(store, executor, jobId, options, (err, stats) => {
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

function runCrawlJob(store, executor, jobId, options, callback) {
  const crawlJob = {
    name: `crawl-${jobId}`,
    map: function(input, output) {
      const frontier = require('../search/crawling/frontier.js');
      const githubApi = require('../services/githubApi.js');
      const storageKeys = require('../services/storageKeys.js');

      frontier.getNextEntry(this.store, input.jobId, (err, entry) => {
        if (err || !entry) {
          return output.emit('empty', {});
        }

        // fetch README and metadata
        githubApi.getReadme(entry.owner, entry.repo, (err, readme) => {
          if (err) {
            return output.emit('doc', {
              owner: entry.owner,
              repo: entry.repo,
              success: false,
            });
          }

          githubApi.getRepositoryMetadata(entry.owner, entry.repo, (err, metadata) => {
            if (err) metadata = {};

            output.emit('doc', {
              owner: entry.owner,
              repo: entry.repo,
              readme: readme || '',
              metadata: metadata,
              crawledAt: Date.now(),
              success: !!readme,
            });
          });
        });
      });
    },

    reduce: function(key, values, output) {
      // reduce: Store documents in distributed storage
      const storageKeys = require('../services/storageKeys.js');

      values.forEach(doc => {
        if (doc && doc.owner && doc.repo) {
          const key = storageKeys.documentKey(doc.owner, doc.repo);
          this.store.put(key, doc, (err) => {
            if (!err) {
              output.emit('stored', {
                owner: doc.owner,
                repo: doc.repo,
              });
            }
          });
        }
      });
    },
  };

  let stats = {
    reposProcessed: 0,
    successful: 0,
    failed: 0,
    totalBytes: 0,
  };

  const pollInterval = setInterval(() => {
    frontier.getFrontierStats(store, jobId, (err, frontierStats) => {
      if (err || !frontierStats || frontierStats.size === 0) {
        clearInterval(pollInterval);
        return callback(null, stats);
      }
    });
  }, 1000);
}

module.exports = {
  runCrawl,
  addSeedsToFrontier,
  runCrawlJob,
};
