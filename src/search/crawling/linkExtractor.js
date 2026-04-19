const GITHUB_LINK_PATTERNS = [
  /https:\/\/github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/g,
  /github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/g,
  /@([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/g,
];

// it maps popular npm packages to their GitHub repositories; used during crawling to discover new repos through dependencies
const PACKAGE_TO_REPO = {
  'react': 'facebook/react',
  'react-dom': 'facebook/react',
  'vue': 'vuejs/vue',
  'angular': 'angular/angular',
  'express': 'expressjs/express',
  'lodash': 'lodash/lodash',
  'axios': 'axios/axios',
  'webpack': 'webpack/webpack',
  'prettier': 'prettier/prettier',
  'eslint': 'eslint/eslint',
  'typescript': 'microsoft/typescript',
  'next': 'vercel/next.js',
  'redux': 'reduxjs/redux',
  'django': 'django/django',
  'flask': 'pallets/flask',
  'tensorflow': 'tensorflow/tensorflow',
  'pytorch': 'pytorch/pytorch',
  'pytorch-vision': 'pytorch/vision',
  'kubernetes': 'kubernetes/kubernetes',
  'docker': 'moby/moby',
};

function extractGithubLinks(readmeText) {
  if (!readmeText || typeof readmeText !== 'string') {
    return [];
  }

  const links = new Set();
  
  GITHUB_LINK_PATTERNS.forEach(pattern => {
    let match;
    const regex = new RegExp(pattern);
    
    while ((match = regex.exec(readmeText)) !== null) {
      const owner = match[1];
      const repo = match[2];
      
      if (owner && repo && owner !== 'github' && repo !== 'github' && !owner.includes('.') && repo.length > 1) {
        links.add(`${owner}/${repo}`);
      }
      
      regex.lastIndex = 0;
    }
  });

  return Array.from(links);
}

function extractDependencies(packageJson) {
  if (!packageJson || typeof packageJson !== 'string') {
    return [];
  }

  const deps = new Set();

  try {
    const data = JSON.parse(packageJson);
    
    if (data.dependencies) {
      Object.keys(data.dependencies).forEach(pkg => {
        const mapping = mapNpmPackageToGithub(pkg);
        if (mapping) {
          deps.add(mapping);
        }
      });
    }
  } catch (e) {
  }

  return Array.from(deps);
}

function mapNpmPackageToGithub(npmPackage) {
  return PACKAGE_TO_REPO[npmPackage] || null;
}

module.exports = {
  extractGithubLinks,
  extractDependencies,
  mapNpmPackageToGithub,
};
