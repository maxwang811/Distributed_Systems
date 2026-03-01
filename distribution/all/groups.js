// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../util/id.js").Node} Node
 *
 * @typedef {Object} Groups
 * @property {(config: Config | string, group: Object.<string, Node>, callback: Callback) => void} put
 * @property {(name: string, callback: Callback) => void} del
 * @property {(name: string, callback: Callback) => void} get
 * @property {(name: string, node: Node, callback: Callback) => void} add
 * @property {(name: string, node: string, callback: Callback) => void} rem
 */

/**
 * @param {Config} config
 * @returns {Groups}
 */
function groups(config) {
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
      done(new Error(`groups.${method}: comm unavailable for group "${context.gid}"`));
      return;
    }

    const remote = {service: 'groups', method};
    groupComm.send(args, remote, (errors, values) => {
      if (errors instanceof Error) {
        done(errors);
        return;
      }

      const filteredErrors = filterErrors(method, errors);
      done(
          filteredErrors,
          values && typeof values === 'object' ? values : {},
      );
    });
  }

  /**
   * @param {Config | string} config
   * @param {Object.<string, Node>} group
   * @param {Callback} callback
   */
  function put(config, group, callback) {
    dispatch('put', [config, group], callback);
  }

  /**
   * @param {string} name
   * @param {Callback} callback
   */
  function del(name, callback) {
    dispatch('del', [name], callback);
  }

  /**
   * @param {string} name
   * @param {Callback} callback
   */
  function get(name, callback) {
    dispatch('get', [name], callback);
  }

  /**
   * @param {string} name
   * @param {Node} node
   * @param {Callback} callback
   */
  function add(name, node, callback) {
    dispatch('add', [name, node], callback);
  }

  /**
   * @param {string} name
   * @param {string} node
   * @param {Callback} callback
   */
  function rem(name, node, callback) {
    dispatch('rem', [name, node], callback);
  }

  return {
    put, del, get, add, rem,
  };
}

module.exports = groups;

/**
 * Allow idempotent remote removals when a node never created a local record.
 * @param {string} method
 * @param {any} errors
 * @returns {Object.<string, Error>}
 */
function filterErrors(method, errors) {
  if (!errors || typeof errors !== 'object') {
    return {};
  }

  /** @type {Object.<string, Error>} */
  const filtered = {};
  Object.entries(errors).forEach(([sid, error]) => {
    const ignore = method === 'rem' &&
      error instanceof Error &&
      typeof error.message === 'string' &&
      error.message.includes('unknown group');
    if (!ignore) {
      filtered[sid] = error;
    }
  });
  return filtered;
}
