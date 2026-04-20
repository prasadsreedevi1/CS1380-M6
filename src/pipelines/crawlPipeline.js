const fs = require('fs');
const path = require('path');
const seedLoader = require('../services/seedLoader.js');
const storageKeys = require('../services/storageKeys.js');
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

    if (process.env.SHARDED_CRAWL === '1') {
      return runShardedCrawlJob(store, options, crawlStats, callback);
    }

    const repos = [];
    let fetched = 0;
    let fetchErrors = 0;

    const staggerMs = Number(process.env.CRAWL_STAGGER_MS ?? 100);
    seeds.forEach((seed, index) => {
      setTimeout(() => {
        fetchRepoData(seed, null, (err, repoData) => {
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
      }, index * staggerMs);
    });
  });
}

function runShardedCrawlJob(store, options, crawlStats, callback) {
  const shardDir = process.env.SHARD_DIR || path.join('data', 'seeds', 'shards');
  const shardPrefix = process.env.SHARD_PREFIX || '';

  let shardFiles = [];
  try {
    shardFiles = fs
      .readdirSync(shardDir)
      .filter((name) => name.endsWith('.txt') && (shardPrefix ? name.startsWith(shardPrefix) : true))
      .sort()
      .map((name) => path.join(shardDir, name));
  } catch (_e) {
    return callback(new Error(`Could not read shard directory: ${shardDir}`));
  }

  if (shardFiles.length === 0) {
    return callback(new Error(`No shard files found in ${shardDir}`));
  }

  globalThis.distribution.local.groups.get('gitgle', (groupErr, nodes) => {
    if (groupErr) {
      return callback(groupErr);
    }

    const nodeList = Object.values(nodes || {});
    if (nodeList.length === 0) {
      return callback(new Error('No nodes in gitgle group'));
    }

    const assignments = [];
    shardFiles.forEach((shardFile, idx) => {
      assignments.push({
        shardFile,
        node: nodeList[idx % nodeList.length],
      });
    });
    console.log(`[SHARDED_CRAWL] Found ${shardFiles.length} shards in ${shardDir} (prefix=${shardPrefix || '<none>'})`);

    const allKeys = [];
    let pending = assignments.length;
    assignments.forEach((assignment) => {
      const nodeLabel = `${assignment.node.ip}:${assignment.node.port}`;
      console.log(`[SHARDED_CRAWL] Dispatch ${assignment.shardFile} -> ${nodeLabel}`);
      const remote = {
        node: assignment.node,
        service: 'crawlShard',
        method: 'run',
        gid: 'local',
      };
      globalThis.distribution.local.comm.send(
        [{shardFile: assignment.shardFile, gid: 'gitgle'}],
        remote,
        (nodeErr, nodeStats) => {
          if (nodeErr) {
            console.error(`[SHARDED_CRAWL] Worker ${nodeLabel} failed ${assignment.shardFile}: ${nodeErr.message}`);
            crawlStats.failed += 1;
            crawlStats.apiErrors += 1;
          } else if (nodeStats) {
            console.log(
              `[SHARDED_CRAWL] Worker ${nodeLabel} done ${assignment.shardFile}: ` +
              `seeds=${nodeStats.seedsLoaded || 0} ok=${nodeStats.successful || 0} fail=${nodeStats.failed || 0}`,
            );
            crawlStats.reposProcessed += nodeStats.reposProcessed || 0;
            crawlStats.successful += nodeStats.successful || 0;
            crawlStats.failed += nodeStats.failed || 0;
            crawlStats.totalBytes += nodeStats.totalBytes || 0;
            crawlStats.apiCalls += nodeStats.apiCalls || 0;
            crawlStats.apiErrors += nodeStats.apiErrors || 0;
            if (Array.isArray(nodeStats.keys)) {
              allKeys.push(...nodeStats.keys);
            }
          }

          pending -= 1;
          if (pending === 0) {
            console.log(`[SHARDED_CRAWL] Aggregate keys collected: ${allKeys.length}`);
            if (allKeys.length === 0) {
              callback(new Error('No repos stored successfully'));
              return;
            }
            store.put({keys: allKeys}, {key: 'crawl:all-metadata-keys', gid: 'gitgle'}, (putErr) => {
              if (putErr) {
                callback(putErr);
                return;
              }
              callback(null, crawlStats);
            });
          }
        },
      );
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
    if (err) {
      return callback(err);
    }

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

        // Report from successful store.puts. MR `results` can be empty even when all
        // meta:* writes succeeded (distributed MR reduce/shuffle quirks).
        const storedCount = keys.length;
        stats.reposProcessed = storedCount;
        stats.successful = storedCount;
        stats.failed = storeErrors;
        stats.totalBytes =
          results && results.length > 0
            ? results.reduce((sum, r) => sum + JSON.stringify(r).length, 0)
            : repos
              .filter((r) =>
                keys.includes(storageKeys.documentMetadataKey(r.owner, r.repo)),
              )
              .reduce((sum, r) => sum + JSON.stringify(r).length, 0);

        const metadataKeysKey = 'crawl:all-metadata-keys';
        store.put({keys}, {key: metadataKeysKey, gid: 'gitgle'}, (err) => {
          if (err) {
          } else {
          }
          
          callback(null, stats);
        });
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