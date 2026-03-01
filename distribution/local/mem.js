
// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 *
 * @typedef {Object} MemConfig
 * @property {?string} key
 * @property {?string} gid
 *
 * @typedef {MemConfig | string | null} SimpleConfig
 */

const id = require('../util/id.js');

/** @type {Map<string, Map<string, any>>} */
const memTable = new Map();

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  callback = typeof callback === 'function' ? callback : () => {};
  const resolved = resolveConfig(configuration);
  if (!resolved) {
    return callback(new Error('mem.put: invalid configuration'));
  }

  const key = resolved.key ?? id.getID(state);
  const table = getGroupTable(resolved.gid);
  table.set(key, state);
  return callback(null, state);
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function append(state, configuration, callback) {
  return callback(new Error('mem.append not implemented'));
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  callback = typeof callback === 'function' ? callback : () => {};
  const resolved = resolveConfig(configuration);
  if (!resolved) {
    return callback(new Error('mem.get: invalid configuration'));
  }

  const table = getGroupTable(resolved.gid);
  if (resolved.key === null) {
    return callback(null, Array.from(table.keys()));
  }

  if (!table.has(resolved.key)) {
    return callback(new Error(`mem.get: key "${resolved.key}" not found`));
  }

  return callback(null, table.get(resolved.key));
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  callback = typeof callback === 'function' ? callback : () => {};
  const resolved = resolveConfig(configuration);
  if (!resolved || resolved.key === null) {
    return callback(new Error('mem.del: invalid configuration'));
  }

  const table = getGroupTable(resolved.gid);
  if (!table.has(resolved.key)) {
    return callback(new Error(`mem.del: key "${resolved.key}" not found`));
  }

  const value = table.get(resolved.key);
  table.delete(resolved.key);
  return callback(null, value);
}

module.exports = {put, get, del, append};

/**
 * @param {SimpleConfig} configuration
 * @returns {{gid: string, key: string | null} | null}
 */
function resolveConfig(configuration) {
  if (configuration === null) {
    return {gid: 'local', key: null};
  }

  if (typeof configuration === 'string') {
    return {gid: 'local', key: configuration};
  }

  if (configuration && typeof configuration === 'object') {
    const gid = typeof configuration.gid === 'string' && configuration.gid.length > 0 ?
      configuration.gid :
      'local';
    const key = configuration.key === null || typeof configuration.key === 'string' ?
      configuration.key :
      null;

    if ('key' in configuration && configuration.key !== null && typeof configuration.key !== 'string') {
      return null;
    }

    return {gid, key};
  }

  return null;
}

/**
 * @param {string} gid
 * @returns {Map<string, any>}
 */
function getGroupTable(gid) {
  if (!memTable.has(gid)) {
    memTable.set(gid, new Map());
  }
  return memTable.get(gid);
}
