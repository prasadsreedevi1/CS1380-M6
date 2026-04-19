
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../util/id.js").NID} NID
 */

/**
 * Map functions used for mapreduce
 * @callback Mapper
 * @param {string} key
 * @param {any} value
 * @returns {object[]}
 */

/**
 * Reduce functions used for mapreduce
 * @callback Reducer
 * @param {string} key
 * @param {any[]} value
 * @returns {object}
 */

/**
 * @typedef {Object} MRConfig
 * @property {Mapper} map
 * @property {Reducer} reduce
 * @property {string[]} keys
 *
 * @typedef {Object} Mr
 * @property {(configuration: MRConfig, callback: Callback) => void} exec
 */


/*
  Note: The only method explicitly exposed in the `mr` service is `exec`.
  Other methods, such as `map`, `shuffle`, and `reduce`, should be dynamically
  installed on the remote nodes and not necessarily exposed to the user.
*/

/**
 * @param {Config} config
 * @returns {Mr}
 */
function mr(config) {
  const context = {
    gid: config.gid || 'all',
  };

  /**
   * @param {MRConfig} configuration
   * @param {Callback} callback
   * @returns {void}
   */
  function exec(configuration, callback) {
    const id = globalThis.distribution.util.id;
    const mrID = id.getID(`${configuration}${Date.now()}`);
    const localComm = globalThis.distribution.local.comm;
    const localGroups = globalThis.distribution.local.groups;
    const mrServiceName = `mr-${mrID}`;
    const gid = context.gid;

    /*
      MapReduce steps:
      1) Setup: register a service `mr-<id>` on all nodes in the group. The service implements the map, shuffle, and reduce methods.
      2) Map: make each node run map on its local data and store them locally, under a different gid, to be used in the shuffle step.
      3) Shuffle: group values by key using store.append.
      4) Reduce: make each node run reduce on its local grouped values.
      5) Cleanup: remove the `mr-<id>` service and return the final output.
    */
    const mrService = {
      mapper: configuration.map,
      reducer: configuration.reduce,
      map: function(
          /** @type {string} */ mrGid,
          /** @type {string} */ mrID,
          /** @type {Callback} */ callback,
      ) {
        const localStore = globalThis.distribution.local.store;
        localStore.get({key: null, gid: mrGid}, (e, keys) => {
          if (e || !keys || keys.length === 0) return callback(null, []);

          let done = 0;
          const results = [];

          for (const key of keys) {
            localStore.get({key: key, gid: mrGid}, (e, value) => {
              if (!e && value !== undefined) {
                const mapped = this.mapper(key, value);
                if (mapped) {
                  if (Array.isArray(mapped)) {
                    for (const item of mapped) results.push(item);
                  } else {
                    for (const k of Object.keys(mapped)) {
                      const obj = {};
                      obj[k] = mapped[k];
                      results.push(obj);
                    }
                  }
                }
              }
              done++;
              if (done === keys.length) {
                localStore.put(results, mrID + '_map', (e2) => {
                  callback(null, results);
                });
              }
            });
          }
        });
      },
      shuffle: function(
          /** @type {string} */ gid,
          /** @type {string} */ mrID,
          /** @type {Callback} */ callback,
      ) {
        const localComm = globalThis.distribution.local.comm;
        const localGroups = globalThis.distribution.local.groups;
        const localStore = globalThis.distribution.local.store;
        const mapGid = `${mrID}_map`;
        const shuffleGid = `${mrID}_shuffle`;

        localStore.get(mrID + '_map', (e, mapResults) => {
          if (e || !mapResults || mapResults.length === 0) return callback(null, []);

          let done = 0;
          const total = mapResults.length;

          mapResults.forEach((item) => {
            const [k] = Object.keys(item);
            const v = item[k];

            localGroups.get(gid, (e, nodes) => {
              if (e || !nodes) {
                done++;
                if (done === total) callback(null, mapResults);
                return;
              }

              const nids = Object.values(nodes).map((n) => globalThis.distribution.util.id.getNID(n));
              const kid = globalThis.distribution.util.id.getID(k);
              const nid = globalThis.distribution.util.id.consistentHash(kid, nids);
              const targetNode = Object.values(nodes).find((n) => globalThis.distribution.util.id.getNID(n) === nid);

              localComm.send(
                [v, {key: k, gid: shuffleGid}],
                {node: targetNode, service: 'store', method: 'append'},
                (e2) => {
                  done++;
                  if (done === total) callback(null, mapResults);
                }
              );
            });
          });
        });
      },
      reduce: function(
          /** @type {string} */ gid,
          /** @type {string} */ mrID,
          /** @type {Callback} */ callback,
      ) {
        const localStore = globalThis.distribution.local.store;
        const shuffleGid = `${mrID}_shuffle`;

        localStore.get({key: null, gid: shuffleGid}, (e, keys) => {
          if (e || !keys || keys.length === 0) return callback(null, []);

          const results = [];
          let done = 0;

          for (const key of keys) {
            localStore.get({key: key, gid: shuffleGid}, (e, values) => {
              if (!e && values !== undefined) {
                const reduced = this.reducer(key, Array.isArray(values) ? values : [values]);
                if (reduced) results.push(reduced);
              }
              done++;
              if (done === keys.length) callback(null, results);
            });
          }
        });
      },
    };

    localGroups.get(gid, (e, nodes) => {
      if (e) return callback(e, null);

      const nodeList = Object.values(nodes);
      const allKeys = configuration.keys;

      if (allKeys.length === 0) return callback(null, []);

      registerService();

      function registerService() {
        let regCount = 0;
        for (const node of nodeList) {
          localComm.send(
            [mrService, mrServiceName],
            {node: node, service: 'routes', method: 'put'},
            (e) => {
              regCount++;
              if (regCount === nodeList.length) runMap();
            }
          );
        }
      }

      function runMap() {
        let mapCount = 0;
        for (const node of nodeList) {
          localComm.send(
            [gid, mrID],
            {node: node, service: mrServiceName, method: 'map'},
            (e) => {
              mapCount++;
              if (mapCount === nodeList.length) runShuffle();
            }
          );
        }
      }

      function runShuffle() {
        let shuffleCount = 0;
        for (const node of nodeList) {
          localComm.send(
            [gid, mrID],
            {node: node, service: mrServiceName, method: 'shuffle'},
            (e) => {
              shuffleCount++;
              if (shuffleCount === nodeList.length) runReduce();
            }
          );
        }
      }

      function runReduce() {
        let reduceCount = 0;
        const allResults = [];
        for (const node of nodeList) {
          localComm.send(
            [gid, mrID],
            {node: node, service: mrServiceName, method: 'reduce'},
            (e, results) => {
              if (!e && Array.isArray(results)) {
                allResults.push(...results);
              }
              reduceCount++;
              if (reduceCount === nodeList.length) cleanup(allResults);
            }
          );
        }
      }

      function cleanup(results) {
        let remCount = 0;
        for (const node of nodeList) {
          localComm.send(
            [mrServiceName],
            {node: node, service: 'routes', method: 'rem'},
            (e) => {
              remCount++;
              if (remCount === nodeList.length) callback(null, results);
            }
          );
        }
      }
    });
  }

  return {exec};
}

module.exports = mr;