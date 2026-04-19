// @ts-check
/**
 * @typedef {import("../types").Callback} Callback
 * @typedef {import("../types").Node} Node
 *
 * @typedef {Object} Payload
 * @property {{service: string, method: string, node: Node}} remote
 * @property {any} message
 * @property {string} mid
 * @property {string} gid
 */

const {id} = require('../util/util.js');

const N = 10;

const seenMessages = new Set();

/**
 * @param {Payload} payload
 * @param {Callback} callback
 */
function recv(payload, callback) {
  if (!callback) {
    callback = () => {};
  }

  if (!payload || typeof payload !== 'object') {
    return callback(new Error('Invalid payload'));
  }

  const {message, mid, gid, remote} = payload;

  if (seenMessages.has(mid)) {
    return callback(null);
  }

  seenMessages.add(mid);

  if (!remote || !remote.service || !remote.method) {
    return callback(new Error('Invalid remote in payload'));
  }

  globalThis.distribution.local.routes.get(remote.service, (err, service) => {
    if (err) {
      return callback(err);
    }

    if (!service || typeof service[remote.method] !== 'function') {
      return callback(new Error(`Service ${remote.service}.${remote.method} not found`));
    }

    const args = Array.isArray(message) ? message : [message];
    service[remote.method](...args, (err, result) => {
      if (gid && globalThis.distribution[gid] &&
          globalThis.distribution[gid].gossip) {
        globalThis.distribution[gid].gossip.send(message, remote, () => {
          callback(err, result);
        });
      } else {
        callback(err, result);
      }
    });
  });
}

module.exports = {recv};

