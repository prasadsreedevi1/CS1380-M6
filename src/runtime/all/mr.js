
function mr(config) {
  const context = {
    gid: config.gid || 'all',
  };

  function exec(configuration, callback) {
    const id = globalThis.distribution.util.id;
    const mrID = id.getID(`${configuration}${Date.now()}`);
    const localComm = globalThis.distribution.local.comm;
    const localGroups = globalThis.distribution.local.groups;
    const mrServiceName = `mr-${mrID}`;
    const gid = context.gid;

    const mrService = {
      mapper: configuration.map,
      reducer: configuration.reduce,
      // Args: (mrGid, mrID, jobKeys?, callback). Remote workers do not have `configuration`
      // in closure (serialization), so the coordinator passes jobKeys via RPC in runMap.
      map: function(mrGid, mrID, jobKeys, callback) {
        let cb = callback;
        let keysArg = jobKeys;
        if (typeof keysArg === 'function') {
          cb = keysArg;
          keysArg = undefined;
        }

        const localStore = globalThis.distribution.local.store;
        const id = globalThis.distribution.util.id;

        const jobKeyList = Array.isArray(keysArg)
          ? keysArg
          : (configuration && configuration.keys ? configuration.keys : null);

        const mapKeyList = (keyList) => {
          if (!keyList || keyList.length === 0) {
            return cb(null, []);
          }

          let done = 0;
          const results = [];

          for (const key of keyList) {
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
              if (done === keyList.length) {
                localStore.put(results, mrID + '_map', (e2) => {
                  cb(null, results);
                });
              }
            });
          }
        };

        // Try every job key on this node. Listing keys from disk uses sanitized
        // filenames (e.g. metafbfacebookreact) while routing used meta:owner:repo;
        // naiveHash(key) can disagree, so we do not pre-filter by hash — wrong-node
        // gets return no value and are skipped inside mapKeyList.
        if (jobKeyList && jobKeyList.length > 0) {
          mapKeyList.call(this, jobKeyList);
          return;
        }

        localStore.get({key: null, gid: mrGid}, (e, keys) => {
          if (e || !keys || keys.length === 0) {
            return cb(null, []);
          }
          mapKeyList.call(this, keys);
        });
      },
      shuffle: function(gid, mrID, callback) {
        const localComm = globalThis.distribution.local.comm;
        const localGroups = globalThis.distribution.local.groups;
        const localStore = globalThis.distribution.local.store;
        const mapGid = `${mrID}_map`;
        const shuffleGid = `${mrID}_shuffle`;
        const currentNID = globalThis.distribution.util.id.getNID(globalThis.distribution.node.config);

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
              
              if (nid === currentNID) {
                localStore.append(v, {key: k, gid: shuffleGid}, (e2) => {
                  done++;
                  if (done === total) callback(null, mapResults);
                });
              } else {
                const targetNode = Object.values(nodes).find((n) => globalThis.distribution.util.id.getNID(n) === nid);
                localComm.send(
                  [v, {key: k, gid: shuffleGid}],
                  {node: targetNode, service: 'store', method: 'append', gid: 'local'},
                  (e2) => {
                    done++;
                    if (done === total) callback(null, mapResults);
                  }
                );
              }
            });
          });
        });
      },
      reduce: function(gid, mrID, callback) {
        const localStore = globalThis.distribution.local.store;
        const shuffleGid = `${mrID}_shuffle`;

        localStore.get({key: null, gid: shuffleGid}, (e, keys) => {
          if (e || !keys || keys.length === 0) {
            return callback(null, []);
          }

          const results = [];
          let done = 0;

          for (const key of keys) {
            localStore.get({key: key, gid: shuffleGid}, (e, values) => {
              if (!e && values !== undefined) {
                const reduced = this.reducer(key, Array.isArray(values) ? values : [values]);
                if (reduced) {
                  results.push(reduced);
                }
              }
              done++;
              if (done === keys.length) {
                callback(null, results);
              }
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
        let failed = false;
        let regCount = 0;
        for (const node of nodeList) {
          localComm.send(
            [mrService, mrServiceName],
            {node: node, service: 'routes', method: 'put'},
            (e) => {
              if (failed) return;
              if (e) {
                failed = true;
                return callback(new Error(`MR registerService failed on ${node.ip}:${node.port}: ${e.message}`), null);
              }
              regCount++;
              if (regCount === nodeList.length) runMap();
            }
          );
        }
      }

      function runMap() {
        let failed = false;
        let mapCount = 0;
        const keysPayload = allKeys || [];
        for (const node of nodeList) {
          localComm.send(
            [gid, mrID, keysPayload],
            {node: node, service: mrServiceName, method: 'map'},
            (e) => {
              if (failed) return;
              if (e) {
                failed = true;
                return callback(new Error(`MR map failed on ${node.ip}:${node.port}: ${e.message}`), null);
              }
              mapCount++;
              if (mapCount === nodeList.length) runShuffle();
            }
          );
        }
      }

      function runShuffle() {
        let failed = false;
        let shuffleCount = 0;
        for (const node of nodeList) {
          localComm.send(
            [gid, mrID],
            {node: node, service: mrServiceName, method: 'shuffle'},
            (e) => {
              if (failed) return;
              if (e) {
                failed = true;
                return callback(new Error(`MR shuffle failed on ${node.ip}:${node.port}: ${e.message}`), null);
              }
              shuffleCount++;
              if (shuffleCount === nodeList.length) runReduce();
            }
          );
        }
      }

      function runReduce() {
        let failed = false;
        let reduceCount = 0;
        const allResults = [];
        for (const node of nodeList) {
          localComm.send(
            [gid, mrID],
            {node: node, service: mrServiceName, method: 'reduce'},
            (e, results) => {
              if (failed) return;
              if (e) {
                failed = true;
                return callback(new Error(`MR reduce failed on ${node.ip}:${node.port}: ${e.message}`), null);
              }
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
              if (remCount === nodeList.length) {
                callback(null, results);
              }
            }
          );
        }
      }
    });
  }

  return {exec};
}

module.exports = mr;