// fetches readme and metadata from github api - REAL API ONLY
// no fallback to demo or synthetic data

const fetch = require('node-fetch');

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';

let apiStats = {
  successfulCalls: 0,
  failedCalls: 0,
  readmesFound: 0,
  readmesMissing: 0,
};

let requestCount = 0;
let lastResetTime = Date.now();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_UNAUTHENTICATED = 10;
const RATE_LIMIT_AUTHENTICATED = 500;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;

const REQUEST_DELAY_MS = 100;
let lastRequestTime = 0;

function delayBeforeRequest() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  const delayNeeded = Math.max(0, REQUEST_DELAY_MS - timeSinceLastRequest);
  if (delayNeeded > 0) {
    return new Promise(resolve => setTimeout(resolve, delayNeeded));
  }
  return Promise.resolve();
}

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
      apiStats.readmesMissing++;
      return callback(null, ''); 
    }

    const filename = readmeFiles[fileIndex];
    const url = `${GITHUB_RAW_BASE}/${owner}/${repo}/${branch}/${filename}`;

    fetch(url, {timeout: 10000})
        .then(res => {
          if (res.ok) {
            apiStats.readmesFound++;
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

  const finalToken = token || GITHUB_TOKEN;
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
  };

  if (finalToken) {
    headers['Authorization'] = `token ${finalToken}`;
  }

  delayBeforeRequest().then(() => {
    lastRequestTime = Date.now();
    
    fetch(url, {headers, timeout: 10000})
        .then(res => {
          if (res.status === 429) {
            apiStats.failedCalls++;
            const retryAfter = res.headers.get('Retry-After') || 60;
            const delayMs = parseInt(retryAfter) * 1000;
            console.warn(`[RATE LIMIT] GitHub API rate limited. Waiting ${retryAfter}s...`);
            
            setTimeout(() => {
              getRepositoryMetadata(owner, repo, token, callback);
            }, delayMs);
            return;
          }
          
          if (!res.ok) {
            apiStats.failedCalls++;
            return callback(new Error(`GitHub API error: ${res.status} for ${owner}/${repo}`));
          }
          return res.json().then(data => {
            apiStats.successfulCalls++;
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
              __source: 'real_api',
              __fetchedAt: Date.now(),
            };
            callback(null, metadata);
          });
        })
        .catch(err => {
          apiStats.failedCalls++;
          callback(err);
        });
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

function getApiStats() {
  return { ...apiStats };
}

function resetApiStats() {
  apiStats = {
    successfulCalls: 0,
    failedCalls: 0,
    readmesFound: 0,
    readmesMissing: 0,
  };
}

module.exports = {
  getReadme,
  getRepositoryMetadata,
  getRepositoryDocument,
  getApiStats,
  resetApiStats,
};
