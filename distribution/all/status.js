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
  const context = {gid: config.gid || 'all'};

  /**
   * @param {string} configuration
   * @param {Callback} callback
   */
  function get(configuration, callback) {
    const done = typeof callback === 'function' ? callback : () => {};
    const groupComm = globalThis.distribution?.[context.gid]?.comm;
    if (!groupComm || typeof groupComm.send !== 'function') {
      done(new Error(`status.get: comm unavailable for group "${context.gid}"`));
      return;
    }

    const remote = {service: 'status', method: 'get'};
    groupComm.send([configuration], remote, (errors, values) => {
      if (errors instanceof Error) {
        done(errors);
        return;
      }

      const safeErrors = errors && typeof errors === 'object' ? errors : {};
      const safeValues = values && typeof values === 'object' ? values : {};

      if (configuration === 'heapTotal' || configuration === 'heapUsed') {
        const sum = Object.values(safeValues)
            .reduce((acc, value) => acc + (typeof value === 'number' ? value : 0), 0);
        done(safeErrors, sum);
        return;
      }

      if (configuration === 'nid' || configuration === 'sid') {
        done(safeErrors, Object.values(safeValues));
        return;
      }

      done(safeErrors, safeValues);
    });
  }

  /**
   * @param {Node} configuration
   * @param {Callback} callback
   */
  function spawn(configuration, callback) {
    const done = typeof callback === 'function' ? callback : () => {};
    const localStatus = globalThis.distribution?.local?.status;
    const localGroups = globalThis.distribution?.local?.groups;
    const groupComm = globalThis.distribution?.[context.gid]?.comm;

    if (!localStatus || typeof localStatus.spawn !== 'function') {
      done(new Error('status.spawn: local.status unavailable'));
      return;
    }
    if (!localGroups || typeof localGroups.add !== 'function') {
      done(new Error('status.spawn: local.groups unavailable'));
      return;
    }

    localStatus.spawn(configuration, (spawnError, node) => {
      if (spawnError) {
        done(spawnError);
        return;
      }
      if (groupComm && typeof groupComm.send === 'function') {
        const remote = {service: 'groups', method: 'add'};
        groupComm.send([context.gid, configuration], remote, () => {});
      }
      localGroups.add(context.gid, configuration, (groupError) => {
        if (groupError) {
          done(groupError);
          return;
        }
        done(null, node);
      });
    });
  }

  /**
   * @param {Callback} callback
   */
  function stop(callback) {
    const done = typeof callback === 'function' ? callback : () => {};
    const groupComm = globalThis.distribution?.[context.gid]?.comm;
    const localStatus = globalThis.distribution?.local?.status;
    if (!groupComm || typeof groupComm.send !== 'function' ||
        !localStatus || typeof localStatus.stop !== 'function') {
      done(new Error('status.stop: services unavailable'));
      return;
    }

    const remote = {service: 'status', method: 'stop'};
    groupComm.send([], remote, () => {
      localStatus.stop(done);
    });
  }

  return {get, stop, spawn};
}

module.exports = status;
