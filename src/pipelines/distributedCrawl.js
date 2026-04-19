const githubApi = require('../services/githubApi.js');
const storageKeys = require('../services/storageKeys.js');

function distributedCrawl(seeds, runtime, callback) {
  if (!seeds || seeds.length === 0) {
    return callback(new Error('No seeds provided'));
  }

  const store = runtime.store;
  const mr = runtime.executor;
  const jobId = `crawl-${Date.now()}`;

  const stats = {
    jobId,
    seedsLoaded: seeds.length,
    mapPhaseCompleted: 0,
    shufflePhaseCompleted: 0,
    reducePhaseCompleted: 0,
    totalReposFetched: 0,
    totalFailed: 0,
    startTime: Date.now(),
  };

  mapPhase(seeds, (err, repoList) => {
    if (err) return callback(err);

    stats.mapPhaseCompleted = repoList.length;

    shufflePhase(repoList, runtime, (err, shuffleData) => {
      if (err) return callback(err);

      stats.shufflePhaseCompleted = Object.keys(shuffleData).length;

      reducePhase(shuffleData, runtime, (err, reduceStats) => {
        if (err) return callback(err);

        stats.reducePhaseCompleted = reduceStats.successful;
        stats.totalReposFetched = reduceStats.successful;
        stats.totalFailed = reduceStats.failed;
        stats.endTime = Date.now();
        stats.duration = stats.endTime - stats.startTime;

        callback(null, stats);
      });
    });
  });
}

function mapPhase(seeds, callback) {
  const repos = [];
  let processed = 0;
  let errors = 0;

  if (seeds.length === 0) {
    return callback(null, []);
  }

  seeds.forEach((seed, idx) => {
    const [owner, repo] = seed.split('/');

    if (!owner || !repo) {
      errors++;
      processed++;
      if (processed === seeds.length) {
        finalize();
      }
      return;
    }

    githubApi.getReadme(owner, repo, (err, readme) => {
      if (err) {
        readme = '';
      }

      githubApi.getRepositoryMetadata(owner, repo, (err2, metadata) => {
        if (!metadata) {
          metadata = {
            language: 'Unknown',
            stars: 0,
            topics: [],
          };
        }

        repos.push({
          owner,
          repo,
          readme: readme || '',
          language: metadata.language,
          stars: metadata.stars,
          topics: metadata.topics || [],
          url: `https://github.com/${owner}/${repo}`,
        });

        processed++;
        if (processed === seeds.length) {
          finalize();
        }
      });
    });
  });

  function finalize() {
    if (errors > 0) {
      console.log(`  [MAP] Warning: ${errors} seed fetch failures, got ${repos.length} repos`);
    }
    callback(null, repos);
  }
}

function shufflePhase(repoList, runtime, callback) {
  const store = runtime.store;
  const distribution = globalThis.distribution;
  distribution.local.groups.get('gitgle', (err, nodeGroup) => {
    if (err) return callback(err);

    const activeNodes = Object.keys(nodeGroup);
    if (activeNodes.length === 0) {
      return callback(new Error('No active nodes in group'));
    }

    const partitions = {};
    const nodeList = Object.values(nodeGroup);

    repoList.forEach(repo => {
      const nidStr = nodeId;

      if (!partitions[nidStr]) {
        partitions[nidStr] = [];
      }
      partitions[nidStr].push(repo);
    });

    Object.entries(partitions).forEach(([nid, repos]) => {
      console.log(`    Shard ${nid}: ${repos.length} repos`);
    });

    callback(null, partitions);
  });
}

function reducePhase(partitions, runtime, callback) {
  const store = runtime.store;
  const distribution = globalThis.distribution;

  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;

  const nodeIds = Object.keys(partitions);
  if (nodeIds.length === 0) {
    return callback(null, {successful: 0, failed: 0});
  }

  const currentNodeConfig = distribution.node.config;
  const currentNodeId = distribution.util.id.getSID(currentNodeConfig);

  const myPartition = partitions[currentNodeId] || [];

  if (myPartition.length === 0) {
    return callback(null, {successful: 0, failed: 0});
  }

  let processed = 0;
  let successful = 0;
  let failed = 0;

  myPartition.forEach((repo, idx) => {
    setTimeout(() => {
      const docId = `${repo.owner}/${repo.repo}`;
      const key = storageKeys.documentMetadataKey(repo.owner, repo.repo);

      const docData = {
        owner: repo.owner,
        repo: repo.repo,
        url: repo.url,
        readme: repo.readme,
        language: repo.language,
        stars: repo.stars,
        topics: repo.topics,
        crawledAt: new Date().toISOString(),
      };

      store.put(docData, {key}, (err) => {
        if (err) {
          console.log(`    ✗ ${docId}: ${err.message}`);
          failed++;
        } else {
          console.log(`    ✓ ${docId} (${repo.language}, ${repo.stars}⭐)`);
          successful++;
        }

        processed++;
        if (processed === myPartition.length) {
          finalize();
        }
      });
    }, idx * 50);
  });

  function finalize() {
    callback(null, {successful, failed});
  }
}

module.exports = {
  distributedCrawl,
  mapPhase,
  shufflePhase,
  reducePhase,
};
