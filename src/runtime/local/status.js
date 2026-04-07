// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

const {id} = require('../util/util.js');
const {fork} = require('child_process');
const {createRPC} = require('../util/wire.js');
const {serialize} = require('../util/serialization.js');

/**
 * @param {string} configuration
 * @param {Callback} callback
 */

const node = null;
const counter = 0;

function get(configuration, callback) {
  if (!callback) {
    callback = () => {};
  }

  // Use the stored node or get it from the global distribution.node.config
  const currentNode = node || globalThis.distribution?.node?.config;

  if (!currentNode) {
    return callback(new Error('Node is not initialized'));
  }

  if (configuration === 'ip') {
    return callback(null, currentNode.ip);
  } else if (configuration === 'port') {
    return callback(null, currentNode.port);
  } else if (configuration === 'nid') {
    return callback(null, id.getNID(currentNode));
  } else if (configuration === 'sid') {
    return callback(null, id.getSID(currentNode));
  } else if (configuration === 'counts') {
    return callback(null, counter);
  } else if (configuration === 'heapTotal') {
    return callback(null, process.memoryUsage().heapTotal);
  } else if (configuration === 'heapUsed') {
    return callback(null, process.memoryUsage().heapUsed);
  } else {
    return callback(new Error(`Unknown configuration: ${configuration}`));
  }
};


/**
 * @param {any} configuration
 * @param {Callback} callback
 */
function spawn(configuration, callback) {
  if (!callback) {
    callback = () => {};
  }

  const config = {...configuration};
  const rpc = createRPC(callback);

  if (config.onStart) {
    const originalOnStart = config.onStart;
    config.onStart = function(cb) {
      originalOnStart(function() {
        rpc(null);
        cb(null);
      });
    };
  } else {
    config.onStart = rpc;
  }

  const serializedConfig = serialize(config);
  const args = ['--config', serializedConfig];
  const options = {};
  const child = fork('distribution.js', args, options);

  return child;
}

/**
 * @param {Callback} callback
 */
function stop(callback) {
  if (!callback) {
    callback = () => {};
  }

  callback(null);

  setTimeout(() => {
    const server = globalThis.distribution?.node?.server;
    if (server) {
      server.close();
    }
  }, 0);
}

module.exports = {get, spawn, stop};

