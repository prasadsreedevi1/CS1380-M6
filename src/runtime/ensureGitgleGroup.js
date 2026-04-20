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
  
  let callbackCalled = false;
  const timeoutId = setTimeout(() => {
    if (!callbackCalled) {
      callbackCalled = true;
      callback(null); 
    }
  }, 5000);
  
  d.local.groups.put('gitgle', group, (err) => {
    if (!callbackCalled) {
      callbackCalled = true;
      clearTimeout(timeoutId);
      callback(err);
    }
  });
}

module.exports = {ensureGitgleGroup};
