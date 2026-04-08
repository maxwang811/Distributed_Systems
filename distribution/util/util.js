// @ts-check
const serialization = require('./serialization.js');
const id = require('./id.js');
const wire = require('./wire.js');
const log = require('./log.js');

/* Helper function that fills in any missing arguments with undefined */
/**
 * @param {string | any[]} func
 * @param {string | any[]} args
 */
function normalize(func, args) {
  const normalizedArgs = [...args];
  // Last argument is the callback
  if (args.length < func.length - 1) {
    const diff = func.length - args.length - 1;
    for (let i = 0; i < diff; i++) {
      normalizedArgs.push(undefined);
    }
  }
  return normalizedArgs;
}

/**
 * @typedef {Object} StoreConfig
 * @property {string | null} key
 * @property {string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 */

/**
 * @param {SimpleConfig} config
 * @returns {import("../types.js").NormalizedConfig}
 */
function normalizeConfig(config) {
  if (config === null) {
    return {gid: null, key: null}
  } if (typeof config === 'string') {
    return {gid: null, key: config}
  }
  return config
}

module.exports = {
  normalize: normalize,
  normalizeConfig: normalizeConfig,
  serialize: serialization.serialize,
  deserialize: serialization.deserialize,
  id: id,
  wire: wire,
  log: log,
};
