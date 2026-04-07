#!/usr/bin/env node

/**
 * @typedef {import("./src/runtime/types.js").Node} Node
 */

const log = require('./src/runtime/util/log.js');

/**
 * @param {Node} [config]
 */
function bootstrap(config) {
  const distributionLib = require('@brown-ds/distribution')(config);
  distributionLib; 

  const distribution = {};

  globalThis.distribution = distribution;
  distribution.util = require('./src/runtime/util/util.js');

  distribution.node = require('./src/runtime/local/node.js');
  if (config) {
    distribution.node.config = config;
  }
  distribution.local = require('./src/runtime/local/local.js');

  const {setup} = require('./src/runtime/all/all.js');
  distribution.all = setup({gid: 'all'});

  const nodeGroup = {};
  if (distribution.node && distribution.node.config) {
    const sid = distribution.util.id.getSID(distribution.node.config);
    nodeGroup[sid] = distribution.node.config;
  }
  distribution.local.groups.put({gid: 'all'}, nodeGroup, () => {});
  distribution.mygroup = distribution.local;

  distribution.util.wire.createRPC = distributionLib.util.wire.createRPC;
  distribution.util.serialize = distributionLib.util.serialize;
  distribution.util.deserialize = distributionLib.util.deserialize;
  distribution.local.routes = distributionLib.local.routes;
  distribution.local.status.spawn = distributionLib.local.status.spawn;
  distribution.local.status.stop = distributionLib.local.status.stop;
  distribution.local.comm = distributionLib.local.comm;
  distribution.all.groups = distributionLib.all.groups;
  distribution.all.gossip = distributionLib.all.gossip;
  distribution.node.start = distributionLib.node.start;

  for (const [key, service] of Object.entries(distribution.local)) {
    distribution.local.routes.put(service, key, () => {});
  }

  return distribution;
}

const {useLibrary, debug} = require('./package.json');
const distribution = useLibrary ? require('@brown-ds/distribution') : bootstrap;
globalThis.debug = debug ? true : false;

if (require.main === module) {
  globalThis.distribution = distribution();
  globalThis.distribution.node.start(globalThis.distribution.node.config.onStart || (() => {}));
}

module.exports = distribution;
