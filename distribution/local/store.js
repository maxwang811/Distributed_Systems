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
const {normalizeConfig} = require("../util/util");
const util = distribution.util;
let baseFolder = path.join(__dirname, '../../store');

if (!fs.existsSync(baseFolder)) fs.mkdirSync(baseFolder);

baseFolder = path.join(baseFolder, `${util.id.getSID(distribution.node.config)}`);

if (!fs.existsSync(baseFolder)) fs.mkdirSync(baseFolder);

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  const config = normalizeConfig(configuration);
  let key = config.key || util.id.getID(state);

  const gid = config.gid || 'local';

  key = key.replace(/[^a-zA-Z0-9]/g, ''); // remove non-alphanumerics

  const filePath = path.join(baseFolder, `${gid}-${key}.txt`);

  try {
    fs.writeFileSync(filePath, util.serialize(state));
    return callback(null, state);
  } catch (err) {
    return callback(new Error('local.store.put writeFile error'));
  }

}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  const config = normalizeConfig(configuration);
  const gid = config.gid || 'local';
  if (config.key === null) {
    try {
      const keys = fs
          .readdirSync(baseFolder, {withFileTypes: true})
          .filter((entry) => entry.isFile())
          .map((entry) => entry.name)
          .filter((name) => name.startsWith(`${gid}`) && name.endsWith('.txt'))
          .map((name) => name.slice(gid.length + 1, -4));
      return callback(null, keys);
    } catch (err) {
      return callback(new Error(`local.store.get err name: ${err.name}, message: ${err.message}`));
    }
  }
  let key = config.key;

  key = key.replace(/[^a-zA-Z0-9]/g, '');
  const filePath = path.join(baseFolder, `${gid}-${key}.txt`);

  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    if (data === undefined) {
      return callback(new Error(`key ${gid}-${key} doesn't exist in local.mem.store`))
    }
    return callback(null, util.deserialize(data));
  } catch (err) {
    return callback(new Error(`local.store.get err name: ${err.name}, message: ${err.message}`));
  }
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  const config = normalizeConfig(configuration);
  if (config.key === null) {
    return callback(new Error('null config in local.store.del'))
  }
  let key = config.key;
  const gid = config.gid || 'local';

  key = key.replace(/[^a-zA-Z0-9]/g, '');
  const filePath = path.join(baseFolder, `${gid}-${key}.txt`);

  get(config, (err, val) => {
    if (err) {
      return callback(err);
    }
    try {
      fs.rmSync(filePath);
      if (val === undefined) {
        return callback(new Error(`key ${gid}-${key} doesn't exist in local.store`))
      }
      return callback(null, val);
    } catch (err) {
      return callback(new Error(`local.store.del err name: ${err.name}, message: ${err.message}`));
    }
  });
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function append(state, configuration, callback) {
  const config = normalizeConfig(configuration);
  let key = config.key || util.id.getID(state);
  const gid = config.gid || 'local';

  key = key.replace(/[^a-zA-Z0-9]/g, ''); // remove non-alphanumerics
  const filePath = path.join(baseFolder, `${gid}-${key}.txt`);

  try {
    let existing = [];
    try {
      const fileData = fs.readFileSync(filePath);
      existing = util.deserialize(fileData.toString());
    } catch (err) {
      if (err.message === 'ENOENT') {
        return callback(err);
      }
    }

    if (!Array.isArray(existing)) { // Convert to array if not
      existing = [existing];
    }

    const updated = Array.isArray(state) ? existing.concat(state) : existing.concat([state]);
    const serialized = util.serialize(updated);
    fs.writeFileSync(filePath, serialized);

    return callback(null, updated);
  } catch (err) {
    return callback(err);
  }
}

module.exports = {put, get, del, append};
