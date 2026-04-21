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
    const orchestrator = globalThis.distribution.node.config;

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
      keysToProcess: configuration.keys,
      gid: context.gid,  
      orchestrator: orchestrator,

      map: function(mrGid, mrID, callback) {
        globalThis.distribution.local.store.get({key: null, gid: this.gid}, (e, keys) => {
          if (e) return callback(e, null);
          
          const gidkeys = keys.filter(k => this.keysToProcess.includes(k));
          
          if (gidkeys.length === 0) {
            globalThis.distribution.local.comm.send(
              [{results: [], node: globalThis.distribution.node.config}],
              {node: this.orchestrator, service: mrGid, method: 'notify'},
              (e, v) => callback(null, [])
            );
            return;
          } 
          
          const res = [];
          let storect = 0;
          let i = 0;

          const stepMap = () => {
            if (i >= gidkeys.length) {
              if (res.length === 0) {
                globalThis.distribution.local.comm.send(
                    [{results: [], node: globalThis.distribution.node.config}],
                    {node: this.orchestrator, service: mrGid, method: 'notify'},
                    (e, v) => callback(null, [])
                );
                return;
              }

              let j = 0;
              const stepStore = () => {
                if (j >= res.length) {
                  globalThis.distribution.local.comm.send(
                      [{results: res, node: globalThis.distribution.node.config}],
                      {node: this.orchestrator, service: mrGid, method: 'notify'},
                      (e, v) => callback(null, res)
                  );
                  return;
                }

                const pair = res[j];
                const k = Object.keys(pair)[0];
                const uniqidx = storect++; 
                const nodeID = globalThis.distribution.util.id.getSID(globalThis.distribution.node.config);
                const mapKey = `${mrID}_map_${nodeID}_${k}_${uniqidx}`;

                globalThis.distribution.local.store.put(pair, {key: mapKey, gid: this.gid}, (e, v) => {
                  if (e) return callback(e, null);
                  j++;
                  stepStore();
                });
              };
              stepStore();
              return;
            }

            const originalKey = gidkeys[i];
            globalThis.distribution.local.store.get({key: originalKey, gid: this.gid}, (e, v) => { 
              if (e) return callback(e, null);
              
              const pairs = this.mapper(originalKey, v);
              pairs.forEach((pair) => res.push(pair));
              
              i++;
              stepMap();
            });
          };
          
          stepMap();
        });
      },

      shuffle: function(gid, mrID, callback) {
        const id = globalThis.distribution.util.id;
        globalThis.distribution.local.store.get({key: null, gid: this.gid}, (e, keys) => {
          if (e) return callback(e, null);
          
          const nodeID = id.getSID(globalThis.distribution.node.config);
          const mappref = `${mrID}_map_${nodeID}_`;
          const mapkeys = keys.filter((k) => k.includes(mappref));
          
          if (mapkeys.length === 0) {
            globalThis.distribution.local.comm.send(
              [{results: [], node: globalThis.distribution.node.config}],
              {node: this.orchestrator, service: gid, method: 'notify'},
              (e, v) => callback(null, [])
            );
            return;
          }

          globalThis.distribution.local.groups.get(this.gid, (e, group) => {
            if (e) return callback(e, null);
            
            const nodes = Object.values(group);
            let i = 0;

            const stepShuffle = () => {
              if (i >= mapkeys.length) {
                globalThis.distribution.local.comm.send(
                  [{results: [], node: globalThis.distribution.node.config}],
                  {node: this.orchestrator, service: gid, method: 'notify'},
                  (e, v) => callback(null, [])
                );
                return;
              }

              const mapKey = mapkeys[i];
              const storekey = mapKey.slice(mapKey.indexOf(mappref));
              
              globalThis.distribution.local.store.get({key: storekey, gid: this.gid}, (e, pair) => {
                if (e) return callback(e, null);

                const realkey = Object.keys(pair)[0];
                const val = pair[realkey];
                const nids = nodes.map((n) => id.getNID(n));
                
                const chosennid = id.naiveHash(id.getID(realkey), nids);
                const dstconfig = nodes.find((n) => id.getNID(n) === chosennid);
                const dstid = id.getSID(dstconfig);
                const shufKey = `${mrID}_shuffle_${dstid}_${realkey}`;
                
                globalThis.distribution.local.comm.send(
                  [val, {key: shufKey, gid: this.gid}],
                  {node: dstconfig, service: 'store', method: 'append'},
                  (e, v) => {
                    if (e) return callback(e, null);
                    i++;
                    stepShuffle();
                  }
                );
              });
            };
            stepShuffle();
          });
        });
      },

      reduce: function(gid, mrID, callback) {
        const nodeID = globalThis.distribution.util.id.getSID(globalThis.distribution.node.config);
        const shufPrefix = `${mrID}_shuffle_${nodeID}_`;
        
        globalThis.distribution.local.store.get({key: null, gid: this.gid}, (e, keys) => {
          if (e) return callback(e, null);
          
          const shufkeys = keys.filter((k) => k.includes(shufPrefix));
          
          if (shufkeys.length === 0) {
            globalThis.distribution.local.comm.send(
                [{results: [], node: globalThis.distribution.node.config}],
                {node: this.orchestrator, service: gid, method: 'notify'},
                (e, v) => callback(null, [])
            );
            return;
          }
          
          const redres = [];
          let i = 0;

          const stepReduce = () => {
            if (i >= shufkeys.length) {
              globalThis.distribution.local.comm.send(
                [{results: redres, node: globalThis.distribution.node.config}],
                {node: this.orchestrator, service: gid, method: 'notify'},
                (e, v) => callback(null, redres)
              );
              return;
            }

            const shufKey = shufkeys[i];
            const storekey = shufKey.slice(shufKey.indexOf(shufPrefix));
            const origkey = storekey.slice(shufPrefix.length);
            
            globalThis.distribution.local.store.get({key: storekey, gid: this.gid}, (e, v) => { 
              if (e) return callback(e, null);
              
              const res = this.reducer(origkey, v);
              redres.push(res);
              
              i++;
              stepReduce();
            });
          };
          stepReduce();
        });
      }
    };

    function copyInputToMapGroup(keys, callback) {
      if (!Array.isArray(keys) || keys.length === 0) {
        return callback(null, null);
      }

      console.log(`[mr] copy starting ${keys.length} keys...`);

      let completed = 0;
      let firstError = null;

      keys.forEach((key) => {
        distribution[context.gid].store.get(key, (err, val) => {
          if (err) {
            firstError = firstError || err;
            completed++;
            if (completed % 500 === 0) {
              console.log(`[mr] copy progress ${completed}/${keys.length}`);
            }
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
              const t0 = Date.now();
              distribution[context.gid].comm.send(mapMsg, mapRemote, () => {
                  console.log(`[mr] map done in ${((Date.now()-t0)/1000).toFixed(1)}s`);
                  const t1 = Date.now();
                  const shuffleMsg = [shuffleGroupId, mrId];
                  const shuffleRemote = {service: `mr-${mrId}`, method: 'shuffle'};

                  distribution[context.gid].comm.send(shuffleMsg, shuffleRemote, () => {
                    console.log(`[mr] shuffle done in ${((Date.now()-t1)/1000).toFixed(1)}s`);
                    const t2 = Date.now();
                    const reduceMsg = [shuffleGroupId, mrId];
                    const reduceRemote = {service: `mr-${mrId}`, method: 'reduce'};
                    distribution[context.gid].comm.send(reduceMsg, reduceRemote, (_, reduceRes) => {
                      console.log(`[mr] reduce done in ${((Date.now()-t2)/1000).toFixed(1)}s`);
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
