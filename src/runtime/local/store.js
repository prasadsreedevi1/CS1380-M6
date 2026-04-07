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

/* Notes/Tips:

- Use absolute paths to make sure they are agnostic to where your code is running from!
  Use the `path` module for that.
*/

const fs = require('fs');
const path = require('path');
const id = require('../util/id.js');

const localStorePath = path.join(process.cwd(), 'store');
/**
 * @param {string} key
 * @returns {string}
 */
function normalizeKey(key) {
  return key.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
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
 * @param {string} data
 * @returns {{error: Error | null, value: any}}
 */
function safeParse(data) {
  try {
    return {error: null, value: JSON.parse(data)};
  } catch (e) {
    return {error: e, value: null};
  }
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  const key = getKeyFromConfig(state, configuration);
  let gid = 'default';
  if (configuration && typeof configuration === 'object' && configuration.gid) {
    gid = configuration.gid;
  }
  const sanitized = normalizeKey(key) + '_' + gid;
  const filePath = path.join(localStorePath, sanitized + '.json');

  if (!fs.existsSync(localStorePath)) {
    fs.mkdirSync(localStorePath, { recursive: true });
  }

  console.log(`[Store] Writing to file: ${filePath} with data:`, state);

  fs.writeFile(filePath, JSON.stringify(state), (err) => {
    if (err) 
      return callback(err);
    return callback(null, state);
  });
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  if (configuration === null) {
    const dir = localStorePath;
    const fs_inner = require('fs');
    fs_inner.readdir(dir, (err, files) => {
      if (err) 
        return callback(err);

      const keys = files.map((f) => {
        const baseFileName = f.replace('.json', '');
        const parts = baseFileName.split('_');
        if (parts.length > 1) {
          parts.pop();
          return parts.join('_');
        }
        return baseFileName;
      });
      return callback(null, keys);
    });
    return;
  }

  const key = getKeyFromConfig(null, configuration);
  let gid = 'default';
  if (configuration && typeof configuration === 'object' && configuration.gid) {
    gid = configuration.gid;
  }
  const sanitized = normalizeKey(key) + '_' + gid;
  const filePath = path.join(localStorePath, sanitized + '.json');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) 
      return callback(new Error(err.message));
    const {error, value} = safeParse(data);
    if (error) 
      return callback(error);
    return callback(null, value);
  });
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  const key = getKeyFromConfig(null, configuration);
  let gid = 'default';
  if (configuration && typeof configuration === 'object' && configuration.gid) {
    gid = configuration.gid;
  }
  const sanitized = normalizeKey(key) + '_' + gid;
  const filePath = path.join(localStorePath, sanitized + '.json');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) 
      return callback(new Error(err.message));
    const {error, value} = safeParse(data);
    if (error) 
      return callback(error);
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) 
        return callback(new Error(unlinkErr.message));
      return callback(null, value);
    });
  });
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function append(state, configuration, callback) {
  const key = getKeyFromConfig(state, configuration);
  let gid = 'default';
  if (configuration && typeof configuration === 'object' && configuration.gid) {
    gid = configuration.gid;
  }
  const sanitized = normalizeKey(key) + '_' + gid;
  const filePath = path.join(localStorePath, sanitized + '.json');

  try {
    let array = [];

    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const {error, value} = safeParse(data);
      if (!error) {
        if (Array.isArray(value)) {
          array = value;
        } else {
          array = [value];
        }
      }
    } catch (readErr) {
      array = [];
    }

    array.push(state);

    fs.writeFileSync(filePath, JSON.stringify(array));
    return callback(null, array);
  } catch (err) {
    return callback(new Error(err.message));
  }
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

