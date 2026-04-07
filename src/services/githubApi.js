// fetches readme and metadata from github api
// handles both raw readme files and api calls for repo info
// supports retries with different readme filenames

const fetch = require('node-fetch');

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';

let requestCount = 0;
let lastResetTime = Date.now();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_UNAUTHENTICATED = 10;
const RATE_LIMIT_AUTHENTICATED = 500;

function getReadme(owner, repo, branch = 'main', callback) {
  if (!callback) {
    callback = branch;
    branch = 'main';
  }

  if (!owner || !repo) {
    return callback(new Error('Owner and repo are required'));
  }

  // try common README filenames
  const readmeFiles = ['README.md', 'README.MD', 'README.txt', 'README'];

  const tryFetchReadme = (fileIndex) => {
    if (fileIndex >= readmeFiles.length) {
      return callback(null, ''); 
    }

    const filename = readmeFiles[fileIndex];
    const url = `${GITHUB_RAW_BASE}/${owner}/${repo}/${branch}/${filename}`;

    fetch(url, {timeout: 10000})
        .then(res => {
          if (res.ok) {
            return res.text().then(text => callback(null, text));
          } else {
            tryFetchReadme(fileIndex + 1); 
          }
        })
        .catch(err => {
          tryFetchReadme(fileIndex + 1);
        });
  };

  tryFetchReadme(0);
}

function getRepositoryMetadata(owner, repo, token, callback) {
  if (!callback) {
    callback = token;
    token = null;
  }

  if (!owner || !repo) {
    return callback(new Error('Owner and repo are required'));
  }

  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  fetch(url, {headers, timeout: 10000})
      .then(res => {
        if (!res.ok) {
          return callback(new Error(`GitHub API error: ${res.status}`));
        }
        return res.json().then(data => {
          const metadata = {
            language: data.language,
            stars: data.stargazers_count,
            topics: data.topics || [],
            description: data.description,
            url: data.html_url,
            owner: data.owner.login,
            repo: data.name,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
          callback(null, metadata);
        });
      })
      .catch(err => {
        callback(err);
      });
}

function getRepositoryDocument(owner, repo, token, callback) {
  if (!callback) {
    callback = token;
    token = null;
  }

  let completed = 0;
  let metadata = null;
  let readme = null;
  let error = null;

  getRepositoryMetadata(owner, repo, token, (err, data) => {
    if (err) error = err;
    metadata = data;
    completed++;
    if (completed === 2) {
      finalize();
    }
  });

  getReadme(owner, repo, 'main', (err, content) => {
    if (err) console.log('Error fetching README:', err.message);
    readme = content || '';
    completed++;
    if (completed === 2) {
      finalize();
    }
  });

  function finalize() {
    if (error) {
      return callback(error);
    }
    if (!metadata) {
      return callback(new Error('Failed to fetch metadata'));
    }
    const doc = {...metadata, readme};
    callback(null, doc);
  }
}

module.exports = {
  getReadme,
  getRepositoryMetadata,
  getRepositoryDocument,
};
