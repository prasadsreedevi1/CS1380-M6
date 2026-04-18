// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Hasher} Hasher
 * @typedef {import("../types.js").Node} Node
 */

const id = require('../util/id.js');


/**
 * @typedef {Object} StoreConfig
 * @property {string | null} key
 * @property {string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 */


/**
 * @param {Config} config
 */
function store(config) {
  const context = {
    gid: config.gid || 'all',
    hash: config.hash || globalThis.distribution.util.id.naiveHash,
    subset: config.subset || {},
    lastKnownGroupSize: Object.keys(config.subset || {}).length,
  };

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function get(configuration, callback) {
    if (configuration === null) {
      const nodes = Object.values(context.subset);
      const distribution = globalThis.distribution;
      const allKeys = [];
      let completedRequests = 0;
      const errors = [];

      if (nodes.length === 0) {
        return callback({}, {});
      }

      nodes.forEach((node) => {
        const remote = {node, service: 'store', method: 'get'};
        // Must send gid so workers list store/<nid>/<gid>/, not the default local/ dir.
        distribution.local.comm.send(
          [{key: null, gid: context.gid}],
          remote,
          (err, keys) => {
          completedRequests++;
          if (err) {
            errors.push(err);
          } else if (Array.isArray(keys)) {
            keys.forEach((key) => {
              if (!allKeys.includes(key)) {
                allKeys.push(key);
              }
            });
          }

          if (completedRequests === nodes.length) {
            if (errors.length > 0) {
              return callback(errors[0]);
            }
            return callback(null, allKeys);
          }
        });
      });
      return;
    }

    let key;
    if (typeof configuration === 'string') {
      key = configuration;
    } else if (configuration === null) {
      return callback(new Error('Cannot get without a key'));
    } else {
      key = configuration.key;
    }

    let gid = context.gid;
    if (configuration && typeof configuration === 'object' && configuration.gid) {
      gid = configuration.gid;
    }
    const kid = id.getID(key);
    const nodes = Object.values(context.subset);
    const nids = nodes.map((n) => id.getNID(n));
    const nid = context.hash(kid, nids);

    const node = nodes.find((n) => id.getNID(n) === nid);
    const remote = {node, service: 'store', method: 'get'};
    const distribution = globalThis.distribution;
    distribution.local.comm.send([{key: key, gid: gid}], remote, callback);
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function put(state, configuration, callback) {
    let key;
    if (typeof configuration === 'string') {
      key = configuration;
    } else if (configuration === null) {
      key = id.getID(state);
    } else {
      key = configuration.key;
    }

    let gid = context.gid;
    if (configuration && typeof configuration === 'object' && configuration.gid) {
      gid = configuration.gid;
    }
    const kid = id.getID(key);
    const nodes = Object.values(context.subset);
    const nids = nodes.map((n) => id.getNID(n));
    const nid = context.hash(kid, nids);

    const node = nodes.find((n) => id.getNID(n) === nid);
    const remote = {node, service: 'store', method: 'put'};
    const distribution = globalThis.distribution;
    distribution.local.comm.send([state, {key: key, gid: gid}], remote, callback);
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function append(state, configuration, callback) {
    let key;
    if (typeof configuration === 'string') {
      key = configuration;
    } else if (configuration === null) {
      key = id.getID(state);
    } else {
      key = configuration.key;
    }

    let gid = context.gid;
    if (configuration && typeof configuration === 'object' && configuration.gid) {
      gid = configuration.gid;
    }
    const kid = id.getID(key);
    const nodes = Object.values(context.subset);
    const nids = nodes.map((n) => id.getNID(n));
    const nid = context.hash(kid, nids);

    const node = nodes.find((n) => id.getNID(n) === nid);
    const remote = {node, service: 'store', method: 'append'};
    const distribution = globalThis.distribution;
    distribution.local.comm.send([state, {key: key, gid: gid}], remote, callback);
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function del(configuration, callback) {
    let key;
    if (typeof configuration === 'string') {
      key = configuration;
    } else if (configuration === null) {
      return callback(new Error('Cannot delete without a key'));
    } else {
      key = configuration.key;
    }

    let gid = context.gid;
    if (configuration && typeof configuration === 'object' && configuration.gid) {
      gid = configuration.gid;
    }
    const kid = id.getID(key);
    const nodes = Object.values(context.subset);
    const nids = nodes.map((n) => id.getNID(n));
    const nid = context.hash(kid, nids);

    const node = nodes.find((n) => id.getNID(n) === nid);
    const remote = {node, service: 'store', method: 'del'};
    const distribution = globalThis.distribution;
    distribution.local.comm.send([{key: key, gid: gid}], remote, callback);
  }

  /**
   * @param {Object.<string, Node>} newGroup
   * @param {Object.<string, Node>} oldGroup
   * @param {Callback} callback
   */
  function reconf(newGroup, oldGroup, callback) {
    if (!callback && typeof oldGroup === 'function') {
      callback = oldGroup;
      oldGroup = context.subset;
    }

    if (!oldGroup) {
      oldGroup = context.subset;
    }

    if (!callback || typeof callback !== 'function') {
      callback = () => {};
    }

    const distribution = globalThis.distribution;

    get(null, (err, keys) => {
      if (err && Object.keys(err).length > 0) {
        context.subset = newGroup;
        return callback(err);
      }

      let keyArray = [];
      if (keys && typeof keys === 'object') {
        keyArray = Object.values(keys);
      }

      if (!Array.isArray(keyArray) || keyArray.length === 0) {
        context.subset = newGroup;
        return callback(null, 'No keys to relocate');
      }

      const oldNodes = Object.values(oldGroup);
      const newNodes = Object.values(newGroup);
      const oldNids = oldNodes.map((n) => id.getNID(n));
      const newNids = newNodes.map((n) => id.getNID(n));

      let relocationsComplete = 0;
      let totalRelocations = 0;
      const errors = [];

      keys.forEach((key) => {
        const kid = id.getID(key);
        const oldNid = context.hash(kid, oldNids);
        const newNid = context.hash(kid, newNids);

        if (oldNid !== newNid) {
          totalRelocations++;

          const sourceNode = oldNodes.find((n) => id.getNID(n) === oldNid);
          const destNode = newNodes.find((n) => id.getNID(n) === newNid);

          if (sourceNode && destNode) {
            const getRemote = {node: sourceNode, service: 'store', method: 'get'};
            distribution.local.comm.send([{key: key, gid: context.gid}], getRemote, (getErr, value) => {
              if (getErr) {
                errors.push(getErr);
                relocationsComplete++;
                if (relocationsComplete === totalRelocations) {
                  return callback(errors[0]);
                }
                return;
              }

              const putRemote = {node: destNode, service: 'store', method: 'put'};
              distribution.local.comm.send([value, {key: key, gid: context.gid}], putRemote, (putErr) => {
                if (putErr) {
                  errors.push(putErr);
                  relocationsComplete++;
                  if (relocationsComplete === totalRelocations) {
                    return callback(errors[0]);
                  }
                  return;
                }

                const delRemote = {node: sourceNode, service: 'store', method: 'del'};
                distribution.local.comm.send([{key: key, gid: context.gid}], delRemote, (delErr) => {
                  if (delErr) {
                    errors.push(delErr);
                  }

                  relocationsComplete++;
                  if (relocationsComplete === totalRelocations) {
                    context.subset = newGroup;
                    if (errors.length > 0) {
                      return callback(errors[0]);
                    }
                    return callback(null, 'Reconfiguration complete');
                  }
                });
              });
            });
          } else {
            errors.push(new Error(`Could not find source or destination node for key: ${key}`));
            relocationsComplete++;
            if (relocationsComplete === totalRelocations) {
              if (errors.length > 0) {
                return callback(errors[0]);
              }
              return callback(null, 'Reconfiguration complete');
            }
          }
        }
      });

      if (totalRelocations === 0) {
        context.subset = newGroup;
        return callback(null, 'No relocations needed');
      }
    });
  }

  /* For the distributed store service, the configuration will
          always be a string */
  return {get, put, append, del, reconf};
}

module.exports = store;

