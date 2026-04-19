// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 *
 * @typedef {Object} StoreConfig
 * @property {?string} key
 * @property {?string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 */

const fs = require('fs');
const path = require('path');

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  const nid = globalThis.distribution.util.id.getNID(globalThis.distribution.node.config);
  let key;
  let gid = 'local';

  if (typeof configuration === 'string') {
    key = configuration;
  } else if (configuration === null) {
    key = globalThis.distribution.util.id.getID(state);
  } else {
    key = configuration.key;
    gid = configuration.gid || 'local';
  }

  const storeDir = path.join(process.cwd(), 'store', nid, gid);
  fs.mkdirSync(storeDir, { recursive: true });
  const filename = key.replace(/[^a-zA-Z0-9]/g, '');
  const filepath = path.join(storeDir, filename);
  const serialized = globalThis.distribution.util.serialize(state);
  fs.writeFileSync(filepath, serialized);

  callback(null, state);
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  const nid = globalThis.distribution.util.id.getNID(globalThis.distribution.node.config);
  let key;
  let gid = 'local';

  if (typeof configuration === 'string') {
    key = configuration;
  } else if (configuration === null) {
    const dir = path.join(process.cwd(), 'store', nid, gid);
    fs.readdir(dir, (err, files) => {
      if (err) return callback(err, null);
      return callback(null, files);
    });
    return;
  } else {
    key = configuration.key;
    gid = configuration.gid || 'local';

    if (key == null) {
      const dir = path.join(process.cwd(), 'store', nid, gid);
      if (!fs.existsSync(dir)) return callback(null, []);
      fs.readdir(dir, (err, files) => {
        if (err) return callback(err, null);
        return callback(null, files);
      });
      return;
    }
  }

  const storeDir = path.join(process.cwd(), 'store', nid, gid);
  const filename = key.replace(/[^a-zA-Z0-9]/g, '');
  const filepath = path.join(storeDir, filename);

  if (!fs.existsSync(filepath)) {
    return callback(new Error('File not found'), null);
  }

  const state = fs.readFileSync(filepath, 'utf8');
  const dState = globalThis.distribution.util.deserialize(state);

  return callback(null, dState);
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  const nid = globalThis.distribution.util.id.getNID(globalThis.distribution.node.config);
  let key;
  let gid = 'local';

  if (typeof configuration === 'string') {
    key = configuration;
  } else if (configuration === null) {
    return callback(new Error('cannot look up a null item'), null);
  } else {
    key = configuration.key;
    gid = configuration.gid || 'local';
  }

  const storeDir = path.join(process.cwd(), 'store', nid, gid);
  const filename = key.replace(/[^a-zA-Z0-9]/g, '');
  const filepath = path.join(storeDir, filename);

  if (!fs.existsSync(filepath)) {
    return callback(new Error('File not found'), null);
  }

  const state = fs.readFileSync(filepath, 'utf8');
  const dState = globalThis.distribution.util.deserialize(state);

  fs.unlinkSync(filepath);
  return callback(null, dState);
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function append(state, configuration, callback) {
  const nid = globalThis.distribution.util.id.getNID(globalThis.distribution.node.config);
  let key;
  let gid = 'local';

  if (typeof configuration === 'string') {
    key = configuration;
  } else if (configuration === null) {
    key = globalThis.distribution.util.id.getID(state);
  } else {
    key = configuration.key;
    gid = configuration.gid || 'local';
  }

  const storeDir = path.join(process.cwd(), 'store', nid, gid);
  fs.mkdirSync(storeDir, { recursive: true });
  const filename = key.replace(/[^a-zA-Z0-9]/g, '');
  const filepath = path.join(storeDir, filename);

  let existing = [];
  if (fs.existsSync(filepath)) {
    const raw = fs.readFileSync(filepath, 'utf8');
    const parsed = globalThis.distribution.util.deserialize(raw);
    if (Array.isArray(parsed)) {
      existing = parsed;
    } else {
      existing = [parsed];
    }
  }

  existing.push(state);
  const serialized = globalThis.distribution.util.serialize(existing);
  fs.writeFileSync(filepath, serialized);

  callback(null, existing);
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

  return callback(null, 'Local store reconfiguration complete');
}

module.exports = {put, get, del, append, reconf};