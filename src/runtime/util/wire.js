// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 * @typedef {import("../types.js").Hasher} Hasher
 */
const log = require('../util/log.js');
const id = require('../util/id.js');
const serialization = require('../util/serialization.js');

const toLocal = {};

/**
 * @param {Function} func
 * @returns {Function} func
 */
function createRPC(func) {
  const remotePointer = id.getID(Math.random());
  toLocal[remotePointer] = func;

  log(`RPC func with pointer: ${remotePointer}`);

  const stub = (/** @type {any[]} */ ...args) => {
    const callback = args.pop();
    const remote = {node: '__NODE_INFO__', service: 'rpc'};
    const message = {
      pointer: '__REMOTE_POINTER__',
      args: args,
    };

    globalThis.distribution.local.comm.send(message, remote, callback);
  };

  const originalToString = stub.toString;
  stub.toString = () => {
    let code = originalToString.call(stub);
    code = code.replace('"__REMOTE_POINTER__"', `"${remotePointer}"`);

    const nodeInfo = globalThis.distribution.node.config;
    code = code.replace('"__NODE_INFO__"', serialization.serialize(nodeInfo));

    return code;
  };

  return stub;
}

/**
 * @param {Function} func
 * @returns {string|null}
 */
function toRemote(func) {
  for (const pointer in toLocal) {
    if (toLocal[pointer] === func) {
      return pointer;
    }
  }
  return null;
}

/**
 * The toAsync function transforms a synchronous function that returns a value into an asynchronous one,
 * which accepts a callback as its final argument and passes the value to the callback.
 * @param {Function} func
 */
function toAsync(func) {
  // It's the caller's responsibility to provide a callback
  const asyncFunc = (/** @type {any[]} */ ...args) => {
    const callback = args.pop();
    try {
      const result = func(...args);
      return callback(null, result);
    } catch (error) {
      return callback(error);
    }
  };

  /* Overwrite toString to return the original function's code.
   Otherwise, all functions passed through toAsync would have the same id. */
  asyncFunc.toString = () => func.toString();
  return asyncFunc;
}


module.exports = {
  createRPC,
  toAsync,
  toRemote,
  toLocal,
};

