const seedLoader = require('../services/seedLoader.js');
const storageKeys = require('../services/storageKeys.js');
const { fetchRepoData } = require('./repoDataFetcher.js');

function runRecursiveCrawl(options, runtime, callback) {
  if (!callback) {
    callback = runtime;
    runtime = global.runtime;
  }

  const store = runtime.store || globalThis.distribution.gitgle.store;
  const linkExtractor = require('../search/crawling/linkExtractor.js');
  
  const jobId = `recurse-crawl-${Date.now()}`;
  const maxDepth = options.maxDepth || 2;
  const maxRepos = options.maxRepos || 100;

  seedLoader.loadSeeds(options.seedFile, (err, seeds) => {
    if (err) return callback(err);

    const stats = {
      jobId,
      startTime: Date.now(),
      seedsLoaded: seeds.length,
      totalCrawled: 0,
      successful: 0,
      newDiscovered: 0,
      depth0: 0,
      depth1: 0,
      depth2: 0,
      errors: 0,
    };

    const seedEntries = seeds.map(s => ({
      owner: s.owner,
      repo: s.repo,
      depth: 0,
    }));

    function processNextFromFrontier() {
      if (stats.totalCrawled >= maxRepos) {
        finishCrawl();
        return;
      }

      if (stats.depth0 < seedEntries.length) {
        const entry = seedEntries[stats.depth0];
        stats.depth0++;
        crawlRepoAndFollowLinks(entry, seedEntries, processNextFromFrontier);
      } else {
        finishCrawl();
      }
    }

    function crawlRepoAndFollowLinks(entry, frontier, next) {
      if (stats.totalCrawled >= maxRepos) {
        return next();
      }

      const {owner, repo, depth = 0} = entry;
      
      fetchRepoData({owner, repo}, null, (err, repoData) => {
        if (err) {
          stats.errors++;
          return next();
        }

        stats.totalCrawled++;

        const metaKey = storageKeys.documentMetadataKey(owner, repo);
        const data = {
          owner,
          repo,
          url: `https://github.com/${owner}/${repo}`,
          description: repoData.description || '',
          language: repoData.language || 'Unknown',
          stars: repoData.stars || 0,
          topics: repoData.topics || [],
          readme: repoData.readme || '',
        };

        store.put(data, {key: metaKey, gid: 'gitgle'}, (err2) => {
          if (!err2) stats.successful++;

          if (depth < maxDepth) {
            const links = linkExtractor.extractGithubLinks(repoData.readme || '');
            
            links.forEach(link => {
              const [newOwner, newRepo] = link.split('/');
              const alreadyExists = frontier.some(e => 
                e.owner === newOwner && e.repo === newRepo
              );
              
              if (!alreadyExists && stats.totalCrawled < maxRepos) {
                const newEntry = {owner: newOwner, repo: newRepo, depth: depth + 1};
                
                if (depth + 1 === 1) stats.depth1++;
                if (depth + 1 === 2) stats.depth2++;
                
                frontier.push(newEntry);
                stats.newDiscovered++;
              }
            });
          }

          next();
        });
      });
    }

    function finishCrawl() {
      stats.endTime = Date.now();
      stats.duration = stats.endTime - stats.startTime;
      
      callback(null, stats);
    }

    processNextFromFrontier();
  });
}

module.exports = {
  runRecursiveCrawl,
};
