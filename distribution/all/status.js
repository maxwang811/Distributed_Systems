// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../util/id.js").Node} Node
 *
 * @typedef {Object} Status
 * @property {(configuration: string, callback: Callback) => void} get
 * @property {(configuration: Node, callback: Callback) => void} spawn
 * @property {(callback: Callback) => void} stop
 */

/**
 * @param {Config} config
 * @returns {Status}
 */
function status(config) {
  const context = {};
  context.gid = config.gid || 'all';

  /**
   * @param {string} configuration
   * @param {Callback} callback
   */
  function get(configuration, callback) {
    const gid = context.gid;
    const remote = {service: 'status', method: 'get'};
    distribution[gid].comm.send([configuration], remote, (err, val) => {

      if (configuration === 'heapTotal') {
        const totalHeapUsed = Object.values(val).reduce((acc, val) => acc + val, 0);
        return callback(err, totalHeapUsed);
      }

      if (configuration === 'nid' || configuration === 'sid') {
        return callback(err, Object.values(val));
      }

      return callback(err, val);
    });
  }

  /**
   * @param {Node} configuration
   * @param {Callback} callback
   */
  function spawn(configuration, callback) {
    callback(new Error('status.spawn not implemented')); // If you won't implement this, check the skip.sh script.
  }

  /**
   * @param {Callback} callback
   */
  function stop(callback) {
    callback(new Error('status.stop not implemented')); // If you won't implement this, check the skip.sh script.
  }

  return {get, stop, spawn};
}

module.exports = status;
