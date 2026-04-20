const githubApi = require('../services/githubApi.js');

function fetchRepoData(seed, demoList, callback) {
  const mode = (process.env.FETCH_MODE || 'mock').toLowerCase();

  if (mode === 'mock') {
    const synthetic = {
      owner: seed.owner,
      repo: seed.repo,
      url: `https://github.com/${seed.owner}/${seed.repo}`,
      description: `${seed.repo} repository from ${seed.owner}`,
      language: 'Unknown',
      stars: 0,
      topics: [],
      readme: `# ${seed.owner}/${seed.repo}\n\nmock document for benchmarking distributed crawl and index.`,
    };
    callback(null, synthetic);
    return;
  }

  githubApi.getRepositoryDocument(seed.owner, seed.repo, null, (err, apiData) => {
    if (err) {
      const errorMsg = `Failed to fetch ${seed.owner}/${seed.repo} from GitHub API: ${err.message}`;
      return callback(new Error(errorMsg));
    }

    if (!apiData) {
      const errorMsg = `No data returned for ${seed.owner}/${seed.repo}`;
      return callback(new Error(errorMsg));
    }

    callback(null, apiData);
  });
}

module.exports = {
  fetchRepoData,
};
