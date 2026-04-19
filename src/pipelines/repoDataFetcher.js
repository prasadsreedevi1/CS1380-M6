const githubApi = require('../services/githubApi.js');

function fetchRepoData(seed, demoList, callback) {
  githubApi.getRepositoryDocument(seed.owner, seed.repo, null, (err, apiData) => {
    if (!err && apiData) {
      return callback(null, apiData);
    }
    
    const hit = demoList.find(
      (r) => r.owner === seed.owner && r.repo === seed.repo,
    );
    
    if (hit) {
      return callback(null, hit);
    }
    
    const synthetic = {
      owner: seed.owner,
      repo: seed.repo,
      url: `https://github.com/${seed.owner}/${seed.repo}`,
      description: `${seed.repo} repository from ${seed.owner}`,
      language: 'Unknown',
      stars: 0,
      topics: [],
      readme: '',
    };
    
    callback(null, synthetic);
  });
}

module.exports = {
  fetchRepoData,
};
