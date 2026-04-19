// Registers gitgle with at least this node so distribution.gitgle.store / .mr exist.
// Matches what test-crawl.js does with groups.put (single-node minimum).

/**
 * @param {(err?: Error | null) => void} callback
 */
function ensureGitgleGroup(callback) {
  const d = globalThis.distribution;
  if (!d) {
    return callback(new Error('distribution not bootstrapped'));
  }
  if (d.gitgle && d.gitgle.mr && d.gitgle.store) {
    return callback(null);
  }
  const cfg = d.node.config;
  if (!cfg || !cfg.ip || !cfg.port) {
    return callback(new Error('node config missing'));
  }
  const sid = d.util.id.getSID(cfg);
  const group = {[sid]: cfg};
  d.local.groups.put({gid: 'gitgle'}, group, callback);
}

module.exports = {ensureGitgleGroup};
