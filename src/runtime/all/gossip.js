// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").SID} SID
 * @typedef {import("../types.js").Node} Node
 *
 * @typedef {Object} Remote
 * @property {Node} node
 * @property {string} service
 * @property {string} method

 * @typedef {Object} Payload
 * @property {Remote} remote
 * @property {any} message
 * @property {string} mid
 * @property {string} gid
 *
 *
 * @typedef {Object} Gossip
 * @property {(payload: Payload, remote: Remote, callback: Callback) => void} send
 * @property {(perod: number, func: () => void, callback: Callback) => void} at
 * @property {(intervalID: NodeJS.Timeout, callback: Callback) => void} del
 */

const id = require('../util/id.js');

const activeIntervals = {};

/**
 * @param {Config} config
 * @returns {Gossip}
 */
function gossip(config) {
  const context = {};
  context.gid = config.gid || 'all';
  context.subset = config.subset || function(lst) {
    return Math.ceil(Math.log(lst.length));
  };

  /**
   * @param {any} message
   * @param {Remote} remote
   * @param {Callback} callback
   */
  function send(message, remote, callback) {
    if (!callback) {
      callback = () => {};
    }

    const mid = id.getID(Math.random());

    globalThis.distribution.local.groups.get(context.gid, (err, nodes) => {
      if (err) {
        return callback(err);
      }

      if (!nodes || Object.keys(nodes).length === 0) {
        return callback(new Error(`Group ${context.gid} is empty`));
      }

      const nodeArray = Object.entries(nodes); // [sid, node]
      const subsetSize = context.subset(nodeArray.map((e) => e[1]));
      const selectedIndices = new Set();

      while (selectedIndices.size < Math.min(subsetSize, nodeArray.length)) {
        selectedIndices.add(Math.floor(Math.random() * nodeArray.length));
      }

      const payload = {
        message: message,
        remote: remote,
        mid: mid,
        gid: context.gid,
      };

      let completed = 0;
      const errors = {};
      const values = {};
      const totalNodes = nodeArray.length;

      nodeArray.forEach((entry, idx) => {
        const [sid, node] = entry;

        if (!selectedIndices.has(idx)) {
          completed++;
          if (completed === totalNodes) {
            return callback(null, {values, errors});
          }
          return;
        }

        globalThis.distribution.local.comm.send(
            [payload],
            {
              node: node,
              service: 'gossip',
              method: 'recv',
            },
            (err, result) => {
              if (err) {
                errors[sid] = err;
              } else {
                values[sid] = result;
              }
              completed++;
              if (completed === totalNodes) {
                callback(null, {values, errors});
              }
            },
        );
      });
    });
  }

  /**
   * @param {number} period
   * @param {any} func
   * @param {Callback} callback
   */
  function at(period, func, callback) {
    if (!callback) {
      callback = () => {};
    }

    if (typeof period !== 'number' || period <= 0) {
      return callback(new Error('Period must be a positive number'));
    }

    const interval = setInterval(() => {
      if (typeof func === 'function') {
        func(() => {
        });
      }
    }, period);

    activeIntervals[interval] = interval;

    callback(null, interval);
  }

  /**
   * @param {NodeJS.Timeout} intervalId
   * @param {Callback} callback
   */
  function del(intervalId, callback) {
    if (!callback) {
      callback = () => {};
    }

    if (!intervalId || !activeIntervals[intervalId]) {
      return callback(new Error(`Interval ${intervalId} not found`));
    }

    clearInterval(activeIntervals[intervalId]);
    delete activeIntervals[intervalId];

    callback(null);
  }

  return {send, at, del};
}

module.exports = gossip;

