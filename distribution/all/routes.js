// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 *
 * @typedef {Object} Routes
 * @property {(service: object, name: string, callback: Callback) => void} put
 * @property {(configuration: string, callback: Callback) => void} rem
 */

/**
 * @param {Config} config
 * @returns {Routes}
 */
function routes(config) {
  const context = {gid: config.gid || 'all'};

  /**
   * @param {string} method
   * @param {any[]} args
   * @param {Callback} callback
   */
  function dispatch(method, args, callback) {
    const done = typeof callback === 'function' ? callback : () => {};
    const groupComm = globalThis.distribution?.[context.gid]?.comm;
    if (!groupComm || typeof groupComm.send !== 'function') {
      done(new Error(`routes.${method}: comm unavailable for group "${context.gid}"`));
      return;
    }

    const remote = {service: 'routes', method};
    groupComm.send(args, remote, (errors, values) => {
      if (errors instanceof Error) {
        done(errors);
        return;
      }
      done(
          errors && typeof errors === 'object' ? errors : {},
          values && typeof values === 'object' ? values : {},
      );
    });
  }

  /**
   * @param {object} service
   * @param {string} name
   * @param {Callback} callback
   */
  function put(service, name, callback) {
    dispatch('put', [service, name], callback);
  }

  /**
   * @param {string} configuration
   * @param {Callback} callback
   */
  function rem(configuration, callback) {
    dispatch('rem', [configuration], callback);
  }

  return {put, rem};
}

module.exports = routes;
