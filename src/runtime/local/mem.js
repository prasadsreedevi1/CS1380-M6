// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {Object} StoreConfig
 * @property {string | null} key
 * @property {string | null} gid
 * @typedef {StoreConfig | string | null} SimpleConfig
 */

const id = require('../util/id.js');
const dataStorage = {};

/**
 * @param {any} state
 * @param {Config} configuration
 * @returns {string | null}
 */
function getKeyFromConfig(state, configuration) {
  if (typeof configuration === 'string') {
    return configuration;
  } else if (configuration === null) {
    return id.getID(state);
  }
  return /** @type {StoreConfig} */ (configuration).key;
}

/**
 * @param {any} state
 * @param {Config} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  const key = getKeyFromConfig(state, configuration);
  let gid = 'default';
  if (configuration && typeof configuration === 'object' && configuration.gid) {
    gid = configuration.gid;
  }
  const storageKey = key + '_' + gid;
  dataStorage[storageKey] = state;
  return callback(null, state);
}

/**
 * @param {any} state
 * @param {Config} configuration
 * @param {Callback} callback
 */
function append(state, configuration, callback) {
  const key = getKeyFromConfig(state, configuration);
  let gid = 'default';
  if (configuration && typeof configuration === 'object' && configuration.gid) {
    gid = configuration.gid;
  }
  const storageKey = key + '_' + gid;

  if (!(storageKey in dataStorage)) {
    dataStorage[storageKey] = [];
  }
  if (!Array.isArray(dataStorage[storageKey])) {
    dataStorage[storageKey] = [dataStorage[storageKey]];
  }

  dataStorage[storageKey].push(state);

  return callback(null, dataStorage[storageKey]);
}

/**
 * @param {Config} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  if (configuration === null) {
    const keys = new Set();
    for (const storageKey of Object.keys(dataStorage)) {
      const parts = storageKey.split('_');
      if (parts.length > 1) {
        parts.pop();
        keys.add(parts.join('_'));
      } else {
        keys.add(storageKey);
      }
    }
    return callback(null, Array.from(keys));
  }

  const key = getKeyFromConfig(null, configuration);
  let gid = 'default';
  if (configuration && typeof configuration === 'object' && configuration.gid) {
    gid = configuration.gid;
  }
  const storageKey = key + '_' + gid;

  if (!(storageKey in dataStorage)) {
    return callback(new Error('Key not found: ' + key));
  }

  return callback(null, dataStorage[storageKey]);
}

/**
 * @param {Config} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  const key = getKeyFromConfig(null, configuration);
  let gid = 'default';
  if (configuration && typeof configuration === 'object' && configuration.gid) {
    gid = configuration.gid;
  }
  const storageKey = key + '_' + gid;

  if (!(storageKey in dataStorage)) {
    return callback(new Error('Key not found: ' + key));
  }

  const value = dataStorage[storageKey];
  delete dataStorage[storageKey];

  return callback(null, value);
}

/**
 * @param {Object.<string, any>} newGroup
 * @param {Object.<string, any>} oldGroup
 * @param {Callback} callback
 */
function reconf(newGroup, oldGroup, callback) {
  if (!callback && typeof oldGroup === 'function') {
    callback = /** @type {Callback} */ (oldGroup);
  }

  if (!callback) {
    callback = () => {};
  }

  return callback(null, 'Local mem reconfiguration complete');
}

module.exports = {put, get, del, append, reconf};

