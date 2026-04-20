const githubApi = require('../services/githubApi.js');

function fetchRepoData(seed, demoList, callback) {
  
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
