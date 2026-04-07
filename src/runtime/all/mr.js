const id = require('../util/id.js');
const localStore = require('../local/store.js');

// @ts-check
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
 * @callback Compactor
 * @param {string} key
 * @param {any[]} value
 * @returns {object}
 */

/**
 * @typedef {Object} MRConfig
 * @property {Mapper} map
 * @property {Reducer} reduce
 * @property {string[]} keys
 * @property {Compactor} [compact]
 * @property {string} [out]
 * @property {boolean} [memory]
 * @property {number} [rounds]
 * @property {Object} [store]
 * @property {boolean} [distributed]
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
 * @param {string} jobId
 * @param {boolean} useMemory
 * @returns {{get: Function, put: Function, append: Function}}
 */
function createIntermediateStore(jobId, useMemory) {
  if (!useMemory) {
    return {
      get: (key, callback) => {
        console.log(`fetching key: ${key}`);
        localStore.get(key, callback);
      },
      put: (key, value, callback) => {
        console.log(`storing key: ${key}, value: ${value}`);
        localStore.put(value, key, callback);
      },
      append: (key, value, callback) => {
        console.log(`appending key: ${key}, value: ${value}`);
        localStore.append(value, key, callback);
      },
    };
  }

  const memoryStorage = globalThis.__mrMemory || {};
  globalThis.__mrMemory = memoryStorage;

  if (!memoryStorage[jobId]) {
    memoryStorage[jobId] = {};
  }

  const jobMem = memoryStorage[jobId];

  return {
    get: (key, callback) => {
      console.log(`fetching key: ${key}`);
      setImmediate(() => {
        const value = jobMem[key];
        callback(null, value);
      });
    },
    put: (key, value, callback) => {
      console.log(`storing key: ${key}, value: ${value}`);
      setImmediate(() => {
        jobMem[key] = value;
        callback(null, value);
      });
    },
    append: (key, value, callback) => {
      console.log(`appending key: ${key}, value: ${value}`);
      setImmediate(() => {
        if (!jobMem[key]) {
          jobMem[key] = [];
        }
        jobMem[key].push(value);
        callback(null, jobMem[key]);
      });
    },
  };
}

/**
 * @param {string} jobId
 */
function cleanupJobMemory(jobId) {
  if (globalThis.__mrMemory && globalThis.__mrMemory[jobId]) {
    delete globalThis.__mrMemory[jobId];
  }
}

/**
 * @param {Config} config
 * @returns {Mr}
 */
function mr(config) {
  const context = {
    gid: config.gid || 'all',
  };

  function serialize(fn) {
    return fn.toString();
  }

  function deserialize(fnString) {
    return new Function(`return (${fnString})`)();
  }

  function hashKey(key, numNodes) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash = hash & hash; 
    }
    return Math.abs(hash) % numNodes;
  }

  function cleanupResources() {
    console.log('cleaning up resources');
    if (globalThis.__mrMemory) {
      delete globalThis.__mrMemory;
    }
  }

  /**
   * @param {MRConfig} mrConfig
   * @param {Callback} callback
   */
  /*
      MapReduce steps:
      1) Setup: register a service `mr-<id>` on all nodes in the group. The service implements the map, shuffle, and reduce methods.
      2) Map: make each node run map on its local data and store them locally, under a different gid, to be used in the shuffle step.
      3) Shuffle: group values by key using store.append.
      4) Reduce: make each node run reduce on its local grouped values.
      5) Cleanup: remove the `mr-<id>` service and return the final output.
    */
  function exec(mrConfig, callback) {
    const { keys, map, reduce, compact, out, memory, rounds, store, distributed } = mrConfig;

    console.log('Starting exec with config:', mrConfig);

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      console.error('Invalid or missing keys:', keys);
      return callback(new Error('Invalid or missing keys in MapReduce configuration'));
    }

    if (!map || !reduce || !callback) {
      return callback(new Error('Missing required parameters: map, reduce, or callback'));
    }

    const numRounds = rounds || 1;
    const useMemory = memory || false;
    const mrStore = store || null;
    const useDistributed = distributed || false;  

    console.time('Execution Time');

    if (numRounds > 1) {
      console.log('Running multi-round MapReduce with', numRounds, 'rounds');
      return runMultiRoundMR(
        { keys, map, reduce, compact, out, useMemory, numRounds, store: mrStore, distributed: useDistributed },
        (err, results) => {
          cleanupResources();
          callback(err, results);
        }
      );
    }

    console.log('Running single-round MapReduce');
    runSingleRoundMR(
      { keys, map, reduce, compact, out, useMemory, store: mrStore, distributed: useDistributed },
      (err, results) => {
        cleanupResources();
        callback(err, results);
      }
    );
  }

  /**
   * @param {Object} config
   * @param {Callback} callback
   */
  function runSingleRoundMR(config, callback) {
    const { keys, map, reduce, compact, out, useMemory, store, distributed } = config;

    console.log('Starting single-round MapReduce with keys:', keys);
    console.time('Single-round execution time');

    if (!keys || keys.length === 0) {
      console.timeEnd('Single-round execution time');
      return callback(null, []);
    }

    const shuffledResults = {};
    let mapCompletionCount = 0;

    const handleValueFetched = (mapKey, err, value, retryCount = 0) => {
      if ((err || value === undefined) && retryCount < 5) {
        const delayMs = Math.min(100 * Math.pow(2, retryCount), 2000);
        console.log(`[Map Phase] Retry ${retryCount + 1}/5 for key ${mapKey}, waiting ${delayMs}ms...`);
        return setTimeout(() => {
          if (store) {
            store.get(mapKey, (err2, value2) => {
              handleValueFetched(mapKey, err2, value2, retryCount + 1);
            });
          } else {
            const storeConfig = { key: mapKey, gid: context.gid };
            localStore.get(storeConfig, (err2, value2) => {
              if ((err2 || value2 === undefined) && context.gid !== 'all') {
                localStore.get(mapKey, (err3, value3) => {
                  handleValueFetched(mapKey, err3, value3, retryCount + 1);
                });
              } else {
                handleValueFetched(mapKey, err2, value2, retryCount + 1);
              }
            });
          }
        }, delayMs);
      }

      if ((err || value === undefined) && retryCount >= 5) {
        console.error(`error fetching value for key (map phase): ${mapKey}. Max retries reached. Using default value.`);
        value = '';
      }

      try {
        let mapResults = map(mapKey, value);

        if (!Array.isArray(mapResults)) {
          mapResults = [mapResults];
        }

        mapResults.forEach((result) => {
          if (result && typeof result === 'object') {
            Object.keys(result).forEach((resultKey) => {
              let resultValue = result[resultKey];

              if (!isNaN(resultValue)) {
                resultValue = Number(resultValue);
              }

              if (!shuffledResults[resultKey]) {
                shuffledResults[resultKey] = [];
              }
              shuffledResults[resultKey].push(resultValue);
            });
          } else {
            console.error(`invalid map result (map phase):`, result);
          }
        });
      } catch (mapErr) {
        console.error(`error during map phase for key ${mapKey}:`, mapErr);
      }

      mapCompletionCount++;

      if (mapCompletionCount === keys.length) {
        // All maps complete - proceed to reduce phase
        performReduce();
      }
    };

    const performReduce = () => {
      const reduceResults = [];
      let reduceCount = 0;
      const totalReduceKeys = Object.keys(shuffledResults).length;

      if (totalReduceKeys === 0) {
        console.timeEnd('Single-round execution time');
        return callback(null, reduceResults);
      }

      try {
        Object.keys(shuffledResults).forEach((reduceKey) => {
          const values = shuffledResults[reduceKey];
          const reducedValue = reduce(reduceKey, values);
          reduceResults.push(reducedValue);

          if (out && out !== 'null' && out !== '') {
            const outputStore = globalThis.distribution && globalThis.distribution[out] && globalThis.distribution[out].store;
            if (outputStore) {
              outputStore.put(JSON.stringify(reducedValue), reduceKey, (err, result) => {
                reduceCount++;
                if (reduceCount === totalReduceKeys) {
                  console.log('[Reduce Phase] All results persisted to output group:', out);
                  console.timeEnd('Single-round execution time');
                  callback(null, reduceResults);
                }
              });
            } else {
              reduceCount++;
              console.warn(`Output group "${out}" not available for persistence`);
              if (reduceCount === totalReduceKeys) {
                console.timeEnd('Single-round execution time');
                callback(null, reduceResults);
              }
            }
          } else {
            reduceCount++;
          }
        });

        if (!out || out === 'null' || out === '') {
          console.timeEnd('Single-round execution time');
          callback(null, reduceResults);
        }
      } catch (reduceErr) {
        console.error(`error during reduce phase:`, reduceErr);
        console.timeEnd('Single-round execution time');
        return callback(reduceErr);
      }
    };

    keys.forEach((key) => {
      if (store) {
        store.get(key, (err, value) => {
          handleValueFetched(key, err, value, 0);
        });
      } else {
        const storeConfig = { key: key, gid: context.gid };
        localStore.get(storeConfig, (err, value) => {
          if ((err || value === undefined) && context.gid !== 'all') {
            console.log(`[Map Phase] First fetch failed for ${key} with gid=${context.gid}, trying fallback...`);
            localStore.get(key, (err2, value2) => {
              handleValueFetched(key, err2, value2, 0);
            });
          } else {
            handleValueFetched(key, err, value, 0);
          }
        });
      }
    });
  }

  /**
   * @param {Object} config
   * @param {Callback} callback
   */
  function runMultiRoundMR(config, callback) {
    const { keys, map, reduce, compact, out, useMemory, numRounds, store, distributed } = config;

    const roundMetadata = {
      jobId: `mr-${id.getMID(Date.now()).substring(0, 8)}`,
      currentRound: 1,
      totalRounds: numRounds,
      currentInputKeys: keys,
      outputGroup: out,
      status: 'running',
      allRoundOutputs: []
    };

    function runRound(roundNum, inputKeys) {
      const isFinalRound = roundNum === numRounds;
      const roundOut = isFinalRound ? out : null;

      const roundConfig = {
        keys: inputKeys,
        map: map,
        reduce: reduce,
        compact: compact,
        out: roundOut,
        useMemory: useMemory,
        store: store,
        distributed: distributed
      };

      runSingleRoundMR(roundConfig, (err, results) => {
        if (err) {
          return callback(err);
        }

        roundMetadata.allRoundOutputs.push({
          round: roundNum,
          results: results
        });

        if (isFinalRound) {
          roundMetadata.status = 'completed';
          cleanupJobMemory(roundMetadata.jobId);
          return callback(null, results);
        }

        let nextRoundKeys = [];

        if (roundOut) {
          if (Array.isArray(results)) {
            nextRoundKeys = results.map((r, idx) => String(idx));
          }
        } else {
          // Intermediate round: results are arrays of objects
          // Extract keys from the result objects (they should have a key property or be keyed)
          if (Array.isArray(results)) {
            nextRoundKeys = results.map((r, idx) => String(idx));
          } else if (typeof results === 'object') {
            nextRoundKeys = Object.keys(results);
          }
        }

        runRound(roundNum + 1, nextRoundKeys);
      });
    }

    runRound(1, keys);
  }

  return { exec };
}

module.exports = mr;


