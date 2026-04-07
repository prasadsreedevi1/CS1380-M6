// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Node} Node
 */

const id = require('../util/id.js');

/**
 * @typedef {Object} StoreConfig
 * @property {string | null} key
 * @property {string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 *
 * @typedef {Object} Mem
 * @property {(configuration: SimpleConfig, callback: Callback) => void} get
 * @property {(state: any, configuration: SimpleConfig, callback: Callback) => void} put
 * @property {(state: any, configuration: SimpleConfig, callback: Callback) => void} append
 * @property {(configuration: SimpleConfig, callback: Callback) => void} del
 * @property {(newGroup: Object.<string, Node>, oldGroup: Object.<string, Node>, callback: Callback) => void} reconf
 */


/**
 * @param {Config} config
 * @returns {Mem}
 */
function mem(config) {
  const context = {};
  context.gid = config.gid || 'all';
  context.hash = config.hash || globalThis.distribution.util.id.naiveHash;
  context.subset = config.subset || {};
  context.lastKnownGroupSize = Object.keys(context.subset).length;

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
        const remote = {node, service: 'mem', method: 'get'};
        distribution.local.comm.send([null], remote, (err, keys) => {
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
            const keysObject = {};
            allKeys.forEach((key, index) => {
              keysObject[index] = key;
            });
            return callback({}, keysObject);
          }
        });
      });
      return;
    }

    let key;
    if (typeof configuration === 'string') {
      key = configuration;
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
    const remote = {node, service: 'mem', method: 'get'};
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
    const remote = {node, service: 'mem', method: 'put'};
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
    const remote = {node, service: 'mem', method: 'append'};
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
    const remote = {node, service: 'mem', method: 'del'};
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
            const getRemote = {node: sourceNode, service: 'mem', method: 'get'};
            distribution.local.comm.send([{key: key, gid: context.gid}], getRemote, (getErr, value) => {
              if (getErr) {
                errors.push(getErr);
                relocationsComplete++;
                if (relocationsComplete === totalRelocations) {
                  return callback(errors[0]);
                }
                return;
              }

              const putRemote = {node: destNode, service: 'mem', method: 'put'};
              distribution.local.comm.send([value, {key: key, gid: context.gid}], putRemote, (putErr) => {
                if (putErr) {
                  errors.push(putErr);
                  relocationsComplete++;
                  if (relocationsComplete === totalRelocations) {
                    return callback(errors[0]);
                  }
                  return;
                }

                const delRemote = {node: sourceNode, service: 'mem', method: 'del'};
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

  /* For the distributed mem service, the configuration will
          always be a string */
  return {
    get,
    put,
    append,
    del,
    reconf,
  };
}

module.exports = mem;

