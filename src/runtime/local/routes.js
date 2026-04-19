/**
 * @typedef {import("../types").Callback} Callback
 * @typedef {string} ServiceName
 */


/**
 * @param {ServiceName | {service: ServiceName, gid?: string}} configuration
 * @param {Callback} callback
 * @returns {void}
 */


function get(configuration, callback) {
  if (!callback) {
    callback = () => {};
  }

  const parseConfig = (config) => {
    if (typeof config === 'string') {
      return {service: config, gid: 'local'};
    }
    if (config.gid) {
      return {service: config.service, gid: config.gid};
    }
    return {service: config.service, gid: 'local'};
  };

  const {service, gid} = parseConfig(configuration);
  const serviceFunc = globalThis.distribution?.[gid]?.[service];

  if (serviceFunc) {
    return callback(null, serviceFunc);
  } else {
    return callback(new Error(`No route found for service: ${service} in group: ${gid}`));
  }
}

/**
 * @param {object} service
 * @param {string | {service: string, gid?: string}} configuration
 * @param {Callback} callback
 * @returns {void}
 */
function put(service, configuration, callback) {
  if (!callback) {
    callback = () => {};
  }

  let serviceName; let gid;

  if (typeof configuration === 'string') {
    serviceName = configuration;
    gid = 'local';
  } else {
    serviceName = configuration.service;
    if (configuration.gid) {
      gid = configuration.gid;
    } else {
      gid = 'local';
    }
  }

  if (!globalThis.distribution[gid]) {
    globalThis.distribution[gid] = {};
  }
  globalThis.distribution[gid][serviceName] = service;

  return callback(null, configuration);
}

/**
 * @param {string | {service: string, gid?: string}} configuration
 * @param {Callback} callback
 */
function rem(configuration, callback) {
  if (!callback) {
    callback = () => {};
  }

  let serviceName; let gid;

  if (typeof configuration === 'string') {
    serviceName = configuration;
    gid = 'local';
  } else {
    serviceName = configuration.service;
    if (configuration.gid) {
      gid = configuration.gid;
    } else {
      gid = 'local';
    }
  }

  if (!globalThis.distribution[gid]) {
    return callback(new Error(`No route found for service: ${serviceName} in group: ${gid}`));
  }

  if (!globalThis.distribution[gid][serviceName]) {
    return callback(new Error(`No route found for service: ${serviceName} in group: ${gid}`));
  }

  const removed = globalThis.distribution[gid][serviceName];
  delete globalThis.distribution[gid][serviceName];
  return callback(null, removed);
}

module.exports = {get, put, rem};

