// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 */

/**
 * NOTE: This Target is slightly different from local.all.Target
 * @typedef {Object} Target
 * @property {string} service
 * @property {string} method
 * @property {string} [gid]
 *
 * @typedef {Object} Comm
 * @property {(message: any[], configuration: Target, callback: Callback) => void} send
 */

/**
 * @param {Config} config
 * @returns {Comm}
 */
function comm(config) {
  const context = {};
  context.gid = config.gid || 'all';

  /**
   * @param {any[]} message
   * @param {Target} configuration
   * @param {Callback} callback
   */
  function send(message, configuration, callback) {
    if (!callback) {
      callback = () => {};
    }

    const gid = configuration.gid || context.gid;

    globalThis.distribution.local.groups.get(gid, (error, group) => {
      if (error) {
        return callback(error);
      }

      const nodeIds = Object.keys(group || {});
      if (nodeIds.length === 0) {
        return callback(new Error('Group is empty'));
      }

      /** @type {{[key: string]: any}} */
      const values = {};
      /** @type {{[key: string]: Error}} */
      const errors = {};
      let completed = 0;

      nodeIds.forEach((nid) => {
        const node = group[nid];
        const remote = {
          node: node,
          service: configuration.service,
          method: configuration.method,
        };

        globalThis.distribution.local.comm.send(message, remote, (err, result) => {
          if (err) {
            errors[nid] = err;
          } else {
            values[nid] = result;
          }

          completed++;

          if (completed === nodeIds.length) {
            if (Object.keys(errors).length > 0) {
              callback(errors, values);
            } else {
              callback({}, values);
            }
          }
        });
      });
    });
  }

  return {send};
}

module.exports = comm;

