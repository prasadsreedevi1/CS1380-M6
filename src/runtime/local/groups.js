// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Node} Node
 */

const {id} = require('../util/util.js');
const localGroups = {};

/**
 * @param {string} name
 * @param {Callback} callback
 */
function get(name, callback) {
  if (!callback) {
    callback = () => {};
  }

  if (name in localGroups) {
    return callback(null, localGroups[name]);
  } else {
    return callback(new Error(`No group found with name: ${name}`));
  }
}

/**
 * @param {Config | string} config
 * @param {Object.<string, Node>} group
 * @param {Callback} callback
 */
function put(config, group, callback) {
  if (!callback) {
    callback = () => {};
  }

  let gid;
  if (typeof config === 'string') {
    gid = config;
  } else {
    gid = config.gid;
  }

  localGroups[gid] = group;

  const allModule = require('../all/all.js');
  const serviceConfig = typeof config === 'string' ?
    {gid, subset: group} :
    {...config, subset: group};
  globalThis.distribution[gid] = allModule.setup(serviceConfig);

  callback(null, group);
}

/**
 * @param {string} name
 * @param {Callback} callback
 */
function del(name, callback) {
  if (!callback) {
    callback = () => {};
  }

  if (name in localGroups) {
    const group = localGroups[name];
    delete localGroups[name];
    delete globalThis.distribution[name];
    return callback(null, group);
  } else {
    return callback(new Error(`No group found with name: ${name}`));
  }
}

/**
 * @param {string} name
 * @param {Node} node
 * @param {Callback} callback
 */
function add(name, node, callback) {
  if (!callback) {
    callback = () => {};
  }

  if (!(name in localGroups)) {
    return callback(new Error(`No group found with name: ${name}`));
  }

  const sid = id.getSID(node);
  localGroups[name][sid] = node;
  callback(null, localGroups[name]);
};

/**
 * @param {string} name
 * @param {string | Node} node
 * @param {Callback} callback
 */
function rem(name, node, callback) {
  if (!callback) {
    callback = () => {};
  }

  if (!(name in localGroups)) {
    return callback(new Error(`No group found with name: ${name}`));
  }

  const sid = typeof node === 'string' ? node : id.getSID(node);
  delete localGroups[name][sid];
  callback(null, localGroups[name]);
};

module.exports = {get, put, del, add, rem};

