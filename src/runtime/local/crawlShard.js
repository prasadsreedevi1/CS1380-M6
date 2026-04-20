const fs = require('fs');
const seedLoader = require('../../services/seedLoader.js');
const storageKeys = require('../../services/storageKeys.js');
const {fetchRepoData} = require('../../pipelines/repoDataFetcher.js');

function run(config, callback) {
  const shardFile = config && config.shardFile;
  const gid = (config && config.gid) || 'gitgle';
  if (!shardFile) {
    callback(new Error('Missing shardFile'));
    return;
  }
  if (!fs.existsSync(shardFile)) {
    callback(new Error(`Shard file not found on worker: ${shardFile}`));
    return;
  }

  const scope = globalThis.distribution[gid];
  const store = (scope && scope.store) || (globalThis.distribution.all && globalThis.distribution.all.store);
  if (!store) {
    callback(new Error(`Store for gid "${gid}" is unavailable`));
    return;
  }

  seedLoader.loadSeeds(shardFile, (err, seeds) => {
    if (err) {
      callback(err);
      return;
    }

    if (!seeds || seeds.length === 0) {
      callback(null, {
        shardFile,
        seedsLoaded: 0,
        reposProcessed: 0,
        successful: 0,
        failed: 0,
        apiCalls: 0,
        apiErrors: 0,
        totalBytes: 0,
        keys: [],
      });
      return;
    }

    let completed = 0;
    let successful = 0;
    let failed = 0;
    let apiCalls = 0;
    let apiErrors = 0;
    let totalBytes = 0;
    const keys = [];

    const staggerMs = Number(process.env.CRAWL_STAGGER_MS || 25);
    seeds.forEach((seed, idx) => {
      setTimeout(() => {
        fetchRepoData(seed, null, (fetchErr, repoData) => {
          if (fetchErr || !repoData) {
            failed += 1;
            apiErrors += 1;
            completed += 1;
            maybeDone();
            return;
          }

          apiCalls += 1;
          const key = storageKeys.documentMetadataKey(repoData.owner, repoData.repo);
          const doc = {
            owner: repoData.owner,
            repo: repoData.repo,
            url: repoData.url || `https://github.com/${repoData.owner}/${repoData.repo}`,
            description: repoData.description || '',
            language: repoData.language || 'Unknown',
            stars: repoData.stars || 0,
            topics: repoData.topics || [],
            readme: repoData.readme || '',
          };

          store.put(doc, {key, gid}, (putErr) => {
            if (putErr) {
              failed += 1;
            } else {
              successful += 1;
              totalBytes += JSON.stringify(doc).length;
              keys.push(key);
            }
            completed += 1;
            maybeDone();
          });
        });
      }, idx * staggerMs);
    });

    function maybeDone() {
      if (completed !== seeds.length) {
        return;
      }
      callback(null, {
        shardFile,
        seedsLoaded: seeds.length,
        reposProcessed: successful,
        successful,
        failed,
        apiCalls,
        apiErrors,
        totalBytes,
        keys,
      });
    }
  });
}

module.exports = {run};
