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
const distribution = globalThis.distribution;
const id = distribution.util.id;

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
    const mrId = id.getID(`${configuration}${Date.now()}`);
    const mrGid = `mr${mrId}`;
    const shuffleGroupId = `mr${mrId}shuffle`;

    /*
      MapReduce steps:
      1) Setup: register a service `mr-<id>` on all nodes in the group.
      The service implements the map, shuffle, and reduce methods.

      2) Map: make each node run map on its local data and store them locally,
      under a different gid, to be used in the shuffle step.

      3) Shuffle: group values by key using store.append.
      4) Reduce: make each node run reduce on its local grouped values.
      5) Cleanup: remove the `mr-<id>` service and return the final output.

      Note: Comments inside the stencil describe a possible implementation---you should feel free to make low- and mid-level adjustments as needed.
    */

    const mrService = {
      mapper: configuration.map,
      reducer: configuration.reduce,
      map: function(
          /** @type {string} */ mrGid,
          /** @type {string} */ mrID,
          /** @type {Callback} */ callback,
      ) {
        // Map should read the node's local keys under the mrGid gid and write to store under gid `${mrId}_map`.
        // Expected output: array of objects with a single key per object.
        distribution.local.store.get({key: null, gid: mrGid}, (err, keys) => {
          if (err) {
            return callback(err);
          }
          if (keys.length === 0) {
            return callback(null, []);
          }

          let completed = 0;
          const mapped = [];
          keys.forEach((key) => {
            distribution.local.store.get({key, gid: mrGid}, (_err, val) => {
              completed++;
              if (_err) {
                return callback(_err);
              }

              const result = this.mapper(key, val); // result can be an object or array of objects
              if (Array.isArray(result)) {
                result.forEach((item) => mapped.push(item));
              } else {
                mapped.push(result);
              }

              if (completed === keys.length) {
                distribution.local.store.put(
                    mapped,
                    `${mrID}_map`,
                    (storeErr) => {return callback(storeErr, mapped)}
                );
              }
            })
          })
        })
      },
      shuffle: function(
          /** @type {string} */ gid,
          /** @type {string} */ mrID,
          /** @type {Callback} */ callback,
      ) {
        // Fetch the mapped values from the local store
        // Shuffle groups values by key (via store.append).
        distribution.local.store.get(`${mrID}_map`, (err, mappedData) => {
          // mappedData is array of objects
          if (err) {
            return callback(err);
          }

          let completed = 0;

          mappedData.forEach((obj) => {

            const [key] = Object.keys(obj);
            distribution[gid].store.append(obj[key], key, () => {
              completed++;

              if (completed === mappedData.length) {
                return callback(null, mappedData);
              }
            })
          })
        })
      },
      reduce: function(
          /** @type {string} */ gid,
          /** @type {string} */ mrID,
          /** @type {Callback} */ callback,
      ) {
        // Fetch grouped values from local store, apply reducer, and return final output.
        distribution.local.store.get({key: null, gid}, (err, keys) => {
          if (err) {
            return callback(err);
          }

          if (!Array.isArray(keys) || keys.length === 0) {
            return callback(null, null);
          }

          let completed = 0;
          const reduced = [];

          keys.forEach((key) => {
            distribution.local.store.get({key, gid}, (_, vals) => {
              completed++;
              const result = this.reducer(key, vals);
              reduced.push(result);
              if (completed === keys.length) {
                return callback(null, reduced);
              }
            })
          })
        })
      },
    };

    function copyInputToMapGroup(keys, callback) {
      if (!Array.isArray(keys) || keys.length === 0) {
        return callback(null, null);
      }

      let completed = 0;
      let firstError = null;

      keys.forEach((key) => {
        distribution[context.gid].store.get(key, (err, val) => {
          if (err) {
            firstError = firstError || err;
            completed++;
            if (completed === keys.length) {
              callback(firstError);
            }
            return;
          }

          distribution[context.gid].store.put(val, {key, gid: mrGid}, (err) => {
            if (err) {
              firstError = firstError || err;
            }

            completed++;
            if (completed === keys.length) {
              return callback(firstError, keys);
            }
          });

        })
      })
    }

    // Register the mr service on all nodes in the group and execute in sequence: map, shuffle, reduce.
    distribution[context.gid].routes.put(mrService, `mr-${mrId}`, () => {
      distribution.local.groups.get(context.gid, (groupsErr, groupsRes) => {
        if (groupsErr) {
          return callback(groupsErr);
        }

        const createGroup = (gid, callback) => {
          distribution.local.groups.put({ gid }, groupsRes, (localErr) => {
            if (localErr && Object.keys(localErr).length > 0) { return callback(localErr) }

            distribution[context.gid].groups.put({ gid }, groupsRes, (distErr) => {
              if (distErr && Object.keys(distErr).length > 0) {
                return callback(distErr);
              }
              return callback(null);
            })
          })
        }

        createGroup(mrGid, (err1) => {
          if (err1) {
            return callback(err1);
          }
          createGroup(shuffleGroupId, (err2) => {
            if (err2) {
              return callback(err2);
            }
            copyInputToMapGroup(configuration.keys, (copyErr) => {
              if (copyErr) {
                return callback(copyErr);
              }

              const mapMsg = [mrGid, mrId];
              const mapRemote = {service: `mr-${mrId}`, method: 'map'};
              distribution[context.gid].comm.send(mapMsg, mapRemote, () => {
                  const shuffleMsg = [shuffleGroupId, mrId];
                  const shuffleRemote = {service: `mr-${mrId}`, method: 'shuffle'};
                  distribution[context.gid].comm.send(shuffleMsg, shuffleRemote, () => {
                    const reduceMsg = [shuffleGroupId, mrId];
                    const reduceRemote = {service: `mr-${mrId}`, method: 'reduce'};
                    distribution[context.gid].comm.send(reduceMsg, reduceRemote, (_, reduceRes) => {
                      let finalResults = [];

                      for (const val of Object.values(reduceRes)) {
                        if (val !== null) {
                          finalResults = finalResults.concat(val);
                        }
                      }

                      distribution[context.gid].routes.rem(`mr-${mrId}`, () => {
                        return callback(null, finalResults);
                      })
                    })
                  })
              })
            })
          })
        })

      })

    })


  }

  return {exec};
}

module.exports = mr;
