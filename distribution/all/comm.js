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

/**
 * @param {Config} config
 * @returns {Comm}
 */
function comm(config) {
  const context = {gid: config.gid || 'all'};

  /**
   * @param {any[]} message
   * @param {Target} configuration
   * @param {Callback} callback
   */
  function send(message, configuration, callback) {
    const done = typeof callback === 'function' ? callback : () => {};
    const groups = globalThis.distribution?.local?.groups;
    const localComm = globalThis.distribution?.local?.comm;

    if (!groups || typeof groups.get !== 'function' ||
        !localComm || typeof localComm.send !== 'function') {
      done(new Error('comm.send: local services unavailable'));
      return;
    }

    groups.get(context.gid, (groupError, group) => {
      if (groupError) {
        done(groupError);
        return;
      }

      const members = Object.entries(group || {});
      if (members.length === 0) {
        done(new Error(`comm.send: group "${context.gid}" has no members`));
        return;
      }

      /** @type {Object.<string, Error>} */
      const errors = {};
      /** @type {Object.<string, any>} */
      const values = {};
      let pending = members.length;

      const finish = () => {
        pending -= 1;
        if (pending === 0) {
          done(errors, values);
        }
      };

      members.forEach(([sid, node]) => {
        /** @type {Target & { node?: any }} */
        const remote = {
          ...configuration,
          gid: configuration?.gid || 'local',
          node,
        };
        localComm.send(message, remote, (error, value) => {
          if (error) {
            errors[sid] = error;
          } else {
            values[sid] = value;
          }
          finish();
        });
      });
    });
  }

  return {send};
}

module.exports = comm;
