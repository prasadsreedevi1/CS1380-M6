// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

const http = require('node:http');
const {serialize, deserialize} = require('../util/serialization.js');

/**
 * @typedef {Object} Target
 * @property {string} service
 * @property {string} method
 * @property {Node} node
 * @property {string} [gid]
 */

/**
 * @param {Array<any>} message
 * @param {Target} remote
 * @param {(error: Error, value?: any) => void} callback
 * @returns {void}
 */
function send(message, remote, callback) {
  if (!callback) {
    callback = () => {};
  }

  if (!remote || !remote.node || !remote.service || !remote.method) {
    return callback(new Error('Invalid remote target'));
  }

  const gid = remote.gid || 'local';

  const options = {
    hostname: remote.node.ip,
    port: remote.node.port,
    path: `/${gid}/${remote.service}/${remote.method}`,
    method: 'PUT',
  };

  const httpRequest = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const [error, value] = deserialize(data);
        if (error) {
          return callback(new Error(error.message || JSON.stringify(error)));
        } else {
          return callback(null, value);
        }
      } catch (error) {
        return callback(new Error(`Failed to deserialize response: ${error.message}`));
      }
    });
  });

  httpRequest.on('error', (error) => {
    return callback(new Error(`HTTP request error: ${error.message}`));
  });

  try {
    const serialized = serialize(message);
    httpRequest.write(serialized);
    httpRequest.end();
  } catch (error) {
    return callback(new Error(`Failed to serialize message: ${error.message}`));
  }
}

module.exports = {send};

