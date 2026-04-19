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
  d.local.groups.put('gitgle', group, callback);
}

module.exports = {ensureGitgleGroup};
