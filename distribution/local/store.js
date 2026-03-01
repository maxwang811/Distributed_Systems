// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 *
 * @typedef {Object} StoreConfig
 * @property {?string} key
 * @property {?string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
*/

/* Notes/Tips:

- Use absolute paths to make sure they are agnostic to where your code is running from!
  Use the `path` module for that.
*/

const fs = require('fs');
const path = require('path');
const serialization = require('../util/serialization.js');
const id = require('../util/id.js');

const STORE_ROOT = path.resolve(__dirname, '..', '..', 'store');


/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  callback = typeof callback === 'function' ? callback : () => {};
  const resolved = resolveConfig(configuration);
  if (!resolved) {
    return callback(new Error('store.put: invalid configuration'));
  }

  const key = resolved.key ?? id.getID(state);
  const serialized = serialization.serialize(state);
  const directory = getGroupDirectory(resolved.gid);
  const filePath = getKeyPath(resolved.gid, key);

  fs.mkdir(directory, {recursive: true}, (mkdirError) => {
    if (mkdirError) {
      return callback(mkdirError);
    }

    return fs.writeFile(filePath, serialized, 'utf8', (writeError) => {
      if (writeError) {
        return callback(writeError);
      }
      return callback(null, state);
    });
  });
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  callback = typeof callback === 'function' ? callback : () => {};
  const resolved = resolveConfig(configuration);
  if (!resolved) {
    return callback(new Error('store.get: invalid configuration'));
  }

  const directory = getGroupDirectory(resolved.gid);
  if (resolved.key === null) {
    return fs.readdir(directory, (readDirError, files) => {
      if (readDirError) {
        if (readDirError.code === 'ENOENT') {
          return callback(null, []);
        }
        return callback(readDirError);
      }

      const keys = files.map(decodeComponent);
      return callback(null, keys);
    });
  }

  const filePath = getKeyPath(resolved.gid, resolved.key);
  return fs.readFile(filePath, 'utf8', (readError, data) => {
    if (readError) {
      if (readError.code === 'ENOENT') {
        return callback(new Error(`store.get: key "${resolved.key}" not found`));
      }
      return callback(readError);
    }

    try {
      return callback(null, serialization.deserialize(data));
    } catch (deserializeError) {
      return callback(deserializeError);
    }
  });
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  callback = typeof callback === 'function' ? callback : () => {};
  const resolved = resolveConfig(configuration);
  if (!resolved || resolved.key === null) {
    return callback(new Error('store.del: invalid configuration'));
  }

  const filePath = getKeyPath(resolved.gid, resolved.key);
  return fs.readFile(filePath, 'utf8', (readError, data) => {
    if (readError) {
      if (readError.code === 'ENOENT') {
        return callback(new Error(`store.del: key "${resolved.key}" not found`));
      }
      return callback(readError);
    }

    let value;
    try {
      value = serialization.deserialize(data);
    } catch (deserializeError) {
      return callback(deserializeError);
    }

    return fs.unlink(filePath, (unlinkError) => {
      if (unlinkError) {
        return callback(unlinkError);
      }
      return callback(null, value);
    });
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

    if ('key' in configuration && configuration.key !== null && typeof configuration.key !== 'string') {
      return null;
    }

    return {
      gid,
      key: configuration.key === null || typeof configuration.key === 'string' ?
        configuration.key :
        null,
    };
  }

  return null;
}

/**
 * @param {string} gid
 * @returns {string}
 */
function getGroupDirectory(gid) {
  return path.join(STORE_ROOT, encodeComponent(getNodeNamespace()), encodeComponent(gid));
}

/**
 * @param {string} gid
 * @param {string} key
 * @returns {string}
 */
function getKeyPath(gid, key) {
  return path.join(getGroupDirectory(gid), encodeComponent(key));
}

/**
 * Convert arbitrary strings to alphanumeric-only path components.
 * @param {string} value
 * @returns {string}
 */
function encodeComponent(value) {
  return Buffer.from(value, 'utf8').toString('hex');
}

/**
 * @param {string} value
 * @returns {string}
 */
function decodeComponent(value) {
  return Buffer.from(value, 'hex').toString('utf8');
}

/**
 * Namespace persistent storage by node so spawned local nodes do not share files.
 * @returns {string}
 */
function getNodeNamespace() {
  const node = globalThis.distribution?.node?.config;
  if (!node || typeof node !== 'object') {
    return 'local';
  }
  try {
    return id.getSID(node);
  } catch {
    return 'local';
  }
}
