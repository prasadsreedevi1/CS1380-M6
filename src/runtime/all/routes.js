// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 *
 * @typedef {Object} Routes
 * @property {(service: object, name: string, callback: Callback) => void} put
 * @property {(configuration: string, callback: Callback) => void} rem
 */

/**
 * @param {Config} config
 * @returns {Routes}
 */
function routes(config) {
  const context = {};
  context.gid = config.gid || 'all';

  /**
   * @param {object} service
   * @param {string} name
   * @param {Callback} callback
   */
  function put(service, name, callback) {
    if (!callback) {
      callback = () => {};
    }

    const message = [service, name];
    const remote = {service: 'routes', method: 'put'};

    globalThis.distribution[context.gid].comm.send(message, remote, (errors, values) => {
      if (errors && Object.keys(errors).length > 0) {
        return callback(errors, values);
      }
      callback({}, values);
    });
  }

  /**
   * @param {string} configuration
   * @param {Callback} callback
   */
  function rem(configuration, callback) {
    if (!callback) {
      callback = () => {};
    }

    const message = [configuration];
    const remote = {service: 'routes', method: 'rem'};

    globalThis.distribution[context.gid].comm.send(message, remote, (errors, values) => {
      if (errors && Object.keys(errors).length > 0) {
        return callback(errors, values);
      }
      callback({}, values);
    });
  }

  return {put, rem};
}

module.exports = routes;

