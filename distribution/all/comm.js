// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 */

/**
 * NOTE: This Target is slightly different from local.all.Target
 * @typedef {Object} Target
 * @property {string} service
 * @property {string} method
 * @property {string} [gid]
 *
 * @typedef {Object} Comm
 * @property {(message: any[], configuration: Target, callback: Callback) => void} send
 */
const distribution = globalThis.distribution;
/**
 * @param {Config} config
 * @returns {Comm}
 */
function comm(config) {
  const context = {};
  context.gid = config.gid || 'all';

  /**
   * @param {any[]} message
   * @param {Target} configuration
   * @param {Callback} callback
   */
  function send(message, configuration, callback) {
    let counter = 0;
    const errorsMap = {}; // Node -> Error
    const valuesMap = {}; // Node -> value
    distribution.local.groups.get(context.gid, (err, group) => {
      if (err) {
        return callback(err);
      }

      const nodeSIDs = Object.keys(group);
      const groupLen = nodeSIDs.length;

      if (groupLen === 0) {
        return callback(new Error(`No nodes in group ${context.gid}`))
      }

      for (const sid of nodeSIDs) {
        const node = group[sid];
        const tempConfig = {service: configuration.service, node: node,
          method: configuration.method, gid: configuration.gid || 'local'};

        distribution.local.comm.send(message, tempConfig, (err, val) => {
          if (err) {
            errorsMap[sid] = err;
          } else {
            valuesMap[sid] = val;
          }
          counter++;
          if (counter >= groupLen) {
            // @ts-ignore
            return callback(errorsMap, valuesMap);
          }
        })
      }
    })
  }

  return {send};
}

module.exports = comm;
