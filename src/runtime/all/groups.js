// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../util/id.js").Node} Node
 *
 * @typedef {Object} Groups
 * @property {(config: Config | string, group: Object.<string, Node>, callback: Callback) => void} put
 * @property {(name: string, callback: Callback) => void} del
 * @property {(name: string, callback: Callback) => void} get
 * @property {(name: string, node: Node, callback: Callback) => void} add
 * @property {(name: string, node: string, callback: Callback) => void} rem
 */

/**
 * @param {Config} config
 * @returns {Groups}
 */
function groups(config) {
  const context = {gid: config.gid || 'all'};

  /**
   * @param {Config | string} config
   * @param {Object.<string, Node>} group
   * @param {Callback} callback
   */
  function put(config, group, callback) {
    if (!callback) {
      callback = () => {};
    }

    const message = [config, group];
    const remote = {service: 'groups', method: 'put'};

    globalThis.distribution[context.gid].comm.send(message, remote, (errors, values) => {
      globalThis.distribution.local.groups.put(config, group, () => {
        if (errors && Object.keys(errors).length > 0) {
          return callback(errors, values);
        }
        callback({}, values);
      });
    });
  }

  /**
   * @param {string} name
   * @param {Callback} callback
   */
  function del(name, callback) {
    if (!callback) {
      callback = () => {};
    }

    const message = [name];
    const remote = {service: 'groups', method: 'del'};

    globalThis.distribution[context.gid].comm.send(message, remote, (errors, values) => {
      globalThis.distribution.local.groups.del(name, () => {
        if (errors && Object.keys(errors).length > 0) {
          return callback(errors, values);
        }
        callback({}, values);
      });
    });
  }

  /**
   * @param {string} name
   * @param {Callback} callback
   */
  function get(name, callback) {
    if (!callback) {
      callback = () => {};
    }

    const message = [name];
    const remote = {service: 'groups', method: 'get'};

    globalThis.distribution[context.gid].comm.send(message, remote, (errors, values) => {
      if (errors && Object.keys(errors).length > 0) {
        return callback(errors, values);
      }
      callback({}, values);
    });
  }

  /**
   * @param {string} name
   * @param {Node} nodeOrSid
   * @param {Node | Callback} nodeOrCallback
   * @param {Callback} [maybeCallback]
   */
  function add(name, nodeOrSid, nodeOrCallback, maybeCallback) {
    let node; let callback;
    if (typeof nodeOrCallback === 'function') {
      node = nodeOrSid;
      callback = nodeOrCallback;
    } else {
      node = nodeOrCallback;
      callback = maybeCallback;
    }

    if (!callback) {
      callback = () => {};
    }

    globalThis.distribution.local.groups.add(name, node, () => {
      globalThis.distribution.local.groups.get(name, (e, group) => {
        if (e) {
          return callback(e);
        }

        const message = [name, group];
        const remote = {service: 'groups', method: 'put'};

        globalThis.distribution[context.gid].comm.send(message, remote, (errors, values) => {
          if (errors && Object.keys(errors).length > 0) {
            return callback(errors, values);
          }
          callback({}, values);
        });
      });
    });
  }

  /**
   * @param {string} name
   * @param {string} node
   * @param {Callback} callback
   */
  function rem(name, node, callback) {
    if (!callback) {
      callback = () => {};
    }

    globalThis.distribution.local.groups.rem(name, node, () => {
      globalThis.distribution.local.groups.get(name, (e, group) => {
        if (e) {
          return callback(e);
        }

        const message = [name, group];
        const remote = {service: 'groups', method: 'put'};

        globalThis.distribution[context.gid].comm.send(message, remote, (errors, values) => {
          if (errors && Object.keys(errors).length > 0) {
            return callback(errors, values);
          }
          callback({}, values);
        });
      });
    });
  }

  return {
    put, del, get, add, rem,
  };
}

module.exports = groups;

