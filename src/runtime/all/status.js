// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../util/id.js").Node} Node
 *
 * @typedef {Object} Status
 * @property {(configuration: string, callback: Callback) => void} get
 * @property {(configuration: Node, callback: Callback) => void} spawn
 * @property {(callback: Callback) => void} stop
 */

const {id} = require('../util/util.js');

/**
 * @param {Config} config
 * @returns {Status}
 */
function status(config) {
  const context = {};
  context.gid = config.gid || 'all';

  /**
   * @param {string} configuration
   * @param {Callback} callback
   */
  function get(configuration, callback) {
    callback = callback || (() => {});

    switch (configuration) {
      case 'heapTotal': {
        const remote = {service: 'status', method: 'get', gid: context.gid};
        globalThis.distribution.all.comm.send([configuration], remote, (errors, values) => {
          let sum = 0;
          for (const nid in values) {
            sum += values[nid] || 0;
          }
          callback({}, sum);
        });
        break;
      }

      case 'heapUsed': {
        const remote = {service: 'status', method: 'get'};
        globalThis.distribution[context.gid].comm.send([configuration], remote, (errors, values) => {
          if (errors && Object.keys(errors).length > 0) {
            return callback(errors, values);
          }
          callback({}, values);
        });
        break;
      }

      case 'ip':
      case 'port':
      case 'nid':
      case 'sid':
      case 'random': {
        const remote = {service: 'status', method: 'get'};
        globalThis.distribution[context.gid].comm.send([configuration], remote, (errors, values) => {
          if (errors && Object.keys(errors).length > 0) {
            return callback(errors, values);
          }
          const valuesArray = Object.values(values);
          callback({}, valuesArray);
        });
        break;
      }

      default:
        callback(new Error(`Unknown configuration: ${configuration}`));
    }
  }

  /**
   * @param {Node} configuration
   * @param {Callback} callback
   */
  function spawn(configuration, callback) {
    if (!callback) {
      callback = () => {};
    }

    globalThis.distribution.local.status.spawn(configuration, (error, node) => {
      if (error) {
        return callback(error);
      }

      globalThis.distribution.all.groups.add(context.gid, node, (error) => {
        if (error) {
          return callback(error);
        }

        callback(null, node);
      });
    });
  }

  /**
   * @param {Callback} callback
   */
  function stop(callback) {
    if (!callback) {
      callback = () => {};
    }

    const nodeIdentifier = globalThis.distribution.util.id.getNID(
        globalThis.distribution.node.config,
    );

    globalThis.distribution.all.groups.get(context.gid, (error, group) => {
      if (error) {
        return callback(error);
      }

      globalThis.distribution.all.comm.send([], {
        service: 'status',
        method: 'stop',
        gid: context.gid,
      }, () => {
        globalThis.distribution.local.status.stop(callback);
      });
    });
  }

  return {get, stop, spawn};
}

module.exports = status;

