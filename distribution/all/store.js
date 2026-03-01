// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Hasher} Hasher
 * @typedef {import("../types.js").Node} Node
 */


/**
 * @typedef {Object} StoreConfig
 * @property {string | null} key
 * @property {string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 */


/**
 * @param {Config} config
 */
function store(config) {
  const context = {
    gid: config.gid || 'all',
    hash: config.hash || globalThis.distribution.util.id.naiveHash,
    subset: config.subset,
  };

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function get(configuration, callback) {
    callback = typeof callback === 'function' ? callback : () => {};
    const resolved = resolveConfig(configuration, context.gid);
    if (!resolved) {
      return callback(new Error('store.get: invalid configuration'));
    }

    if (resolved.key === null) {
      return listKeys(resolved.gid, callback);
    }

    return withTargetNode(resolved.gid, resolved.key, context.hash, (error, node) => {
      if (error) {
        return callback(error);
      }
      return globalThis.distribution.local.comm.send(
          [{gid: resolved.gid, key: resolved.key}],
          {node, service: 'store', method: 'get'},
          callback,
      );
    });
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function put(state, configuration, callback) {
    callback = typeof callback === 'function' ? callback : () => {};
    const resolved = resolveConfig(configuration, context.gid);
    if (!resolved) {
      return callback(new Error('store.put: invalid configuration'));
    }

    const key = resolved.key === null ? globalThis.distribution.util.id.getID(state) : resolved.key;
    return withTargetNode(resolved.gid, key, context.hash, (error, node) => {
      if (error) {
        return callback(error);
      }
      return globalThis.distribution.local.comm.send(
          [state, {gid: resolved.gid, key}],
          {node, service: 'store', method: 'put'},
          callback,
      );
    });
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function append(state, configuration, callback) {
    return callback(new Error('store.append not implemented'));
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function del(configuration, callback) {
    callback = typeof callback === 'function' ? callback : () => {};
    const resolved = resolveConfig(configuration, context.gid);
    if (!resolved || resolved.key === null) {
      return callback(new Error('store.del: invalid configuration'));
    }

    return withTargetNode(resolved.gid, resolved.key, context.hash, (error, node) => {
      if (error) {
        return callback(error);
      }
      return globalThis.distribution.local.comm.send(
          [{gid: resolved.gid, key: resolved.key}],
          {node, service: 'store', method: 'del'},
          callback,
      );
    });
  }

  /**
   * @param {Object.<string, Node>} configuration
   * @param {Callback} callback
   */
  function reconf(configuration, callback) {
    callback = typeof callback === 'function' ? callback : () => {};
    return reconfigure('store', context, configuration, callback);
  }

  /* For the distributed store service, the configuration will
          always be a string */
  return {get, put, append, del, reconf, hash: context.hash};
}

module.exports = store;

/**
 * @param {SimpleConfig} configuration
 * @param {string} defaultGid
 * @returns {{gid: string, key: string | null} | null}
 */
function resolveConfig(configuration, defaultGid) {
  if (configuration === null) {
    return {gid: defaultGid, key: null};
  }

  if (typeof configuration === 'string') {
    return {gid: defaultGid, key: configuration};
  }

  if (configuration && typeof configuration === 'object') {
    if ('key' in configuration && configuration.key !== null && typeof configuration.key !== 'string') {
      return null;
    }
    return {
      gid: defaultGid,
      key: configuration.key === null || typeof configuration.key === 'string' ?
        configuration.key :
        null,
    };
  }

  return null;
}

/**
 * @param {string} gid
 * @param {Callback} callback
 */
function listKeys(gid, callback) {
  const groupComm = globalThis.distribution?.[gid]?.comm;
  if (!groupComm || typeof groupComm.send !== 'function') {
    callback(new Error(`store.get: comm unavailable for group "${gid}"`));
    return;
  }

  groupComm.send([{gid, key: null}], {service: 'store', method: 'get'}, (errors, values) => {
    if (errors instanceof Error) {
      callback(errors);
      return;
    }

    const uniqueKeys = new Set();
    Object.values(values || {}).forEach((keys) => {
      if (Array.isArray(keys)) {
        keys.forEach((key) => uniqueKeys.add(key));
      }
    });

    callback(errors && typeof errors === 'object' ? errors : {}, [...uniqueKeys]);
  });
}

/**
 * @param {string} gid
 * @param {string} key
 * @param {Hasher} hasher
 * @param {(error: Error | null, node?: Node) => void} callback
 */
function withTargetNode(gid, key, hasher, callback) {
  getGroup(gid, (groupError, group) => {
    if (groupError) {
      callback(groupError);
      return;
    }

    try {
      const node = pickNodeForKey(gid, key, group, hasher);
      callback(null, node);
    } catch (error) {
      callback(error);
    }
  });
}

/**
 * @param {string} gid
 * @param {(error: Error | null, group?: Object.<string, Node>) => void} callback
 */
function getGroup(gid, callback) {
  globalThis.distribution.local.groups.get(gid, (error, group) => {
    if (error) {
      callback(error);
      return;
    }
    callback(null, group || {});
  });
}

/**
 * @param {string} gid
 * @param {string} key
 * @param {Object.<string, Node>} group
 * @param {Hasher} hasher
 * @returns {Node}
 */
function pickNodeForKey(gid, key, group, hasher) {
  const nodes = Object.values(group);
  if (nodes.length === 0) {
    throw new Error(`store: group "${gid}" has no members`);
  }

  const idUtil = globalThis.distribution.util.id;
  const nids = nodes.map((node) => idUtil.getNID(node));
  const targetNid = hasher(idUtil.getID(key), nids);
  const node = nodes.find((candidate) => idUtil.getNID(candidate) === targetNid);
  if (!node) {
    throw new Error(`store: unable to resolve node for key "${key}"`);
  }
  return node;
}

/**
 * @param {string} service
 * @param {{gid: string, hash: Hasher}} context
 * @param {Object.<string, Node>} previousGroup
 * @param {Callback} callback
 */
function reconfigure(service, context, previousGroup, callback) {
  if (!previousGroup || typeof previousGroup !== 'object') {
    callback(new Error(`${service}.reconf: invalid configuration`));
    return;
  }

  getGroup(context.gid, (groupError, currentGroup) => {
    if (groupError) {
      callback(groupError);
      return;
    }

    const priorNodes = Object.values(previousGroup);
    const currentNodes = Object.values(currentGroup || {});
    if (currentNodes.length === 0) {
      callback(new Error(`${service}.reconf: group "${context.gid}" has no members`));
      return;
    }

    const idUtil = globalThis.distribution.util.id;
    const oldNids = priorNodes.map((node) => idUtil.getNID(node));
    const newNids = currentNodes.map((node) => idUtil.getNID(node));
    const allKeys = new Set();

    let pending = priorNodes.length;
    if (pending === 0) {
      callback(null, []);
      return;
    }

    const finishScanning = () => {
      const keys = [...allKeys];
      if (keys.length === 0) {
        callback(null, []);
        return;
      }

      const moved = [];
      let remaining = keys.length;
      const doneMove = (error) => {
        if (remaining < 0) {
          return;
        }
        if (error) {
          remaining = -1;
          callback(error);
          return;
        }
        remaining -= 1;
        if (remaining === 0) {
          callback(null, moved);
        }
      };

      keys.forEach((key) => {
        const kid = idUtil.getID(key);
        const oldNid = context.hash(kid, oldNids);
        const newNid = context.hash(kid, newNids);
        if (oldNid === newNid) {
          doneMove(null);
          return;
        }

        const sourceNode = priorNodes.find((node) => idUtil.getNID(node) === oldNid);
        const destinationNode = currentNodes.find((node) => idUtil.getNID(node) === newNid);
        if (!sourceNode || !destinationNode) {
          doneMove(new Error(`${service}.reconf: unable to resolve nodes for key "${key}"`));
          return;
        }

        globalThis.distribution.local.comm.send(
            [{gid: context.gid, key}],
            {node: sourceNode, service, method: 'get'},
            (readError, value) => {
              if (readError) {
                doneMove(readError);
                return;
              }
              globalThis.distribution.local.comm.send(
                  [value, {gid: context.gid, key}],
                  {node: destinationNode, service, method: 'put'},
                  (writeError) => {
                    if (writeError) {
                      doneMove(writeError);
                      return;
                    }
                    globalThis.distribution.local.comm.send(
                        [{gid: context.gid, key}],
                        {node: sourceNode, service, method: 'del'},
                        (deleteError) => {
                          if (deleteError) {
                            doneMove(deleteError);
                            return;
                          }
                          moved.push(key);
                          doneMove(null);
                        },
                    );
                  },
              );
            },
        );
      });
    };

    priorNodes.forEach((node) => {
      globalThis.distribution.local.comm.send(
          [{gid: context.gid, key: null}],
          {node, service, method: 'get'},
          (error, keys) => {
            if (!error && Array.isArray(keys)) {
              keys.forEach((key) => allKeys.add(key));
            }
            pending -= 1;
            if (pending === 0) {
              finishScanning();
            }
          },
      );
    });
  });
}
