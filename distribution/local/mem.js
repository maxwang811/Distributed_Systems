// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 *
 * @typedef {Object} StoreConfig
 * @property {string | null} key
 * @property {string | null} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 */

const store = {};

const util = globalThis.distribution.util;
/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  if (configuration === null) {
    configuration = util.id.getID(state);
  }
  store[configuration] = state;
  return callback(null, state);
};

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function append(state, configuration, callback) {
  return callback(new Error('mem.append not implemented')); // You'll need to implement this method for the distributed processing milestone.
};

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  if (configuration === null) {
    return callback(null, Object.keys(store));
  }

  if (!(typeof configuration === 'string')) {
    configuration = configuration.key;
  }

  const result = store[configuration];

  if (result === undefined) {
    return callback(new Error(`Key ${configuration} doesn't exist in ephemeral mem store`));
  }
  return callback(null, result);
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  const result = store[configuration];
  if (result === undefined) {
    return callback(new Error(`Key ${configuration} doesn't exist in ephemeral mem store`));
  }
  delete store[configuration];

  return callback(null, result);
};

module.exports = {put, get, del, append};
