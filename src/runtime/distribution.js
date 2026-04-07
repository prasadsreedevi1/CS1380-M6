// src/runtime/distribution.js

const node = require('./local/node.js');
const local = require('./local/local.js');
const all = require('./all/all.js');
const util = require('./util/util.js');

globalThis.distribution = globalThis.distribution || {};
globalThis.distribution.util = util;
globalThis.distribution.local = local;

globalThis.distribution.node = {
  config: node.setNodeConfig ? node.setNodeConfig() : {},
  server: null,
};

// Initialize the default group namespace
// This may later be extended with additional groups (e.g. search, crawl, index)
if (all.setup) {
  globalThis.distribution.all = all.setup({ gid: 'all', subset: {} });
} else {
  globalThis.distribution.all = all;
}

node.start((err) => {
  if (err) {
    console.error('Failed to start distribution node:', err);
    process.exit(1);
  }
});
