// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Node} Node
 */


const {normalizeConfig} = require("../util/util");
/**
 * @typedef {Object} StoreConfig
 * @property {string | null} key
 * @property {string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 *
 * @typedef {Object} Mem
 * @property {(configuration: SimpleConfig, callback: Callback) => void} get
 * @property {(state: any, configuration: SimpleConfig, callback: Callback) => void} put
 * @property {(state: any, configuration: SimpleConfig, callback: Callback) => void} append
 * @property {(configuration: SimpleConfig, callback: Callback) => void} del
 * @property {(configuration: Object.<string, Node>, callback: Callback) => void} reconf
 */

const distribution = globalThis.distribution;
const util = distribution.util;
/**
 * @param {Config} config
 * @returns {Mem}
 */
function mem(config) {
  const context = {};
  context.gid = config.gid || 'all';
  context.hash = config.hash || util.id.naiveHash;

  /**
   * @param {string} configuration
   * @param {Callback} callback
   */
  function get(configuration, callback) {
    const config = normalizeConfig(configuration);
    let kid = '';
    if (config.key.length !== 64) {
      kid = util.id.getID(configuration);
    } else {
      kid = config.key;
    }

    const gid = config.gid || context.gid;
    distribution.local.groups.get(gid, (err, val) => {
      if (err) {
        return callback(err);
      }
      const nids = Object.values(val).map(node => util.id.getNID(node));
      const node = context.hash(kid, nids);

      const message = [{key: config.key, gid: gid}];
      const remote = {node: val[node.slice(0, 5)], service: 'mem', method: 'get'}
      distribution.local.comm.send(message, remote, (err, val) => {
        if (err) {
          return callback(err);
        }
        return callback(null, val);
      })
    })
  }

  /**
   * @param {any} state
   * @param {string} configuration
   * @param {Callback} callback
   */
  function put(state, configuration, callback) {
    const config = normalizeConfig(configuration);
    let kid = '';
    if (config.key === null) {
      kid = util.id.getID(state);
    } else if (config.key.length !== 64) {
      kid = util.id.getID(configuration);
    } else {
      kid = config.key;
    }

    const gid = config.gid || context.gid;
    distribution.local.groups.get(gid, (err, val) => {
      if (err) {
        return callback(err);
      }
      const nids = Object.values(val).map(node => util.id.getNID(node));
      const node = context.hash(kid, nids);

      const message = [state, {key: config.key, gid: gid}];
      const remote = {node: val[node.slice(0, 5)], service: 'mem', method: 'put'}
      distribution.local.comm.send(message, remote, (err, val) => {
        if (err) {
          return callback(err);
        }
        return callback(null, val);
      })
    })
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function append(state, configuration, callback) {
    return callback(new Error('mem.append not implemented')); // You'll need to implement this method for the distributed processing milestone.
  }

  /**
   * @param {string} configuration
   * @param {Callback} callback
   */
  function del(configuration, callback) {
    const config = normalizeConfig(configuration);
    let kid = '';
    if (config.key.length !== 64) {
      kid = util.id.getID(configuration);
    } else {
      kid = config.key;
    }

    const gid = config.gid || context.gid;
    distribution.local.groups.get(gid, (err, val) => {
      if (err) {
        return callback(err);
      }
      const nids = Object.values(val).map(node => util.id.getNID(node));
      const node = context.hash(kid, nids);

      const message = [{key: config.key, gid: gid}];
      const remote = {node: val[node.slice(0, 5)], service: 'mem', method: 'del'}
      distribution.local.comm.send(message, remote, (err, val) => {
        if (err) {
          return callback(err);
        }
        return callback(null, val);
      })
    })
  }

  /**
   * @param {Object.<string, Node>} configuration
   * @param {Callback} callback
   */
  function reconf(configuration, callback) {
    return callback(new Error('mem.reconf not implemented'));
  }
  /* For the distributed mem service, the configuration will
          always be a string */
  return {
    get,
    put,
    append,
    del,
    reconf,
  };
}

module.exports = mem;
