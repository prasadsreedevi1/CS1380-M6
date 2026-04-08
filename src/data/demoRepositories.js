/**
 * Generate repository data from seed file
 * Dynamically creates repository records based on the seed list
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate a synthetic README based on repository name
 * This provides searchable content for demonstration
 */
function generateReadme(owner, repo) {
  const keywords = {
    'react': 'JavaScript library UI components web development',
    'vue': 'JavaScript framework UI progressive web',
    'angular': 'TypeScript framework web application platform',
    'node': 'JavaScript runtime server backend platform',
    'express': 'JavaScript web framework HTTP API server',
    'next': 'React framework production rendering',
    'redux': 'JavaScript state management library',
    'axios': 'HTTP client library JavaScript promise',
    'go': 'Go programming language system tools',
    'python': 'Python programming language framework',
    'django': 'Python web framework backend development',
    'flask': 'Python web micro framework server',
    'typescript': 'TypeScript language JavaScript superset',
    'tensorflow': 'machine learning framework deep learning AI',
    'pytorch': 'machine learning framework neural networks',
    'kubernetes': 'container orchestration deployment platform',
    'docker': 'container platform application deployment',
    'webpack': 'JavaScript module bundler build tool',
    'eslint': 'JavaScript linter code quality tool',
    'prettier': 'code formatter JavaScript TypeScript',
    'graphql': 'API query language data fetching',
    'mongodb': 'database NoSQL document storage',
    'postgres': 'database SQL relational storage',
    'mysql': 'database SQL relational data',
    'redis': 'database cache storage key value',
    'terraform': 'infrastructure code provisioning tool',
    'ansible': 'automation configuration management tool',
    'prometheus': 'monitoring metrics collection system',
    'elasticsearch': 'search engine data analytics platform',
    'moment': 'JavaScript date library time manipulation',
    'lodash': 'JavaScript utility library functions',
    'ember': 'JavaScript framework web application',
    'riot': 'JavaScript UI library components',
    'meteor': 'JavaScript framework full stack development',
    'storybook': 'UI component development tool',
    'react-native': 'mobile applications iOS Android JavaScript',
    'flutter': 'mobile framework cross platform development'
  };

  let content = `${owner}/${repo} - Repository for ${repo}. `;
  
  // Add relevant keywords based on repo name
  const repoLower = repo.toLowerCase();
  for (const [key, value] of Object.entries(keywords)) {
    if (repoLower.includes(key) || key.includes(repoLower)) {
      content += value + '. ';
    }
  }

  // Add generic searchable content
  content += `This is a popular open source project on GitHub. ` +
             `Build and develop with ${repo}. ` +
             `Learn more at https://github.com/${owner}/${repo}. `;

  return content;
}

/**
 * Load repositories from seed file
 */
function loadRepositoriesFromSeed() {
  const seedPath = path.join(__dirname, '../..', 'data/seeds/github-repos.txt');
  const seedContent = fs.readFileSync(seedPath, 'utf8');
  const repositories = [];

  seedContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [owner, repo] = trimmed.split('/');
      if (owner && repo) {
        repositories.push({
          owner: owner.trim(),
          repo: repo.trim(),
          url: `https://github.com/${owner.trim()}/${repo.trim()}`,
          description: `${repo} repository from ${owner}`,
          language: 'Mixed',
          stars: Math.floor(Math.random() * 200000),
          readme: generateReadme(owner.trim(), repo.trim())
        });
      }
    }
  });

  return repositories;
}

const seedRepositories = loadRepositoriesFromSeed();

module.exports = seedRepositories;
