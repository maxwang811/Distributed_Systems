// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Hasher} Hasher
 * @typedef {import("../types.js").Node} Node
 */

const {normalizeConfig} = require("../util/util");
/**
 * @typedef {Object} StoreConfig
 * @property {string | null} key
 * @property {string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 */

const distribution = globalThis.distribution;
const util = distribution.util;

/**
 * @param {Config} config
 */
function store(config) {
  const context = {
    gid: config.gid || 'all',
    hash: config.hash || distribution.util.id.naiveHash,
    subset: config.subset,
  };

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function get(configuration, callback) {
    const config = normalizeConfig(configuration);
    if (config.key === null) { // Null key, get all keys
      const payload = [{key: null, gid: context.gid}];

      distribution[context.gid].comm.send(payload, {service: 'store', method: 'get'}, (err, result) => {
        const flattened = Object.values(result).reduce((acc, value) => acc.concat(value), []);
        return callback(err, flattened);
      });
      return;
    }
    let kid = '';
    // if (config.key.length !== 64) {
    //   kid = util.id.getID(configuration);
    // } else {
    //   kid = config.key;
    // }

    if (!/^[a-f0-9]{64}$/i.test(config.key)) {
      kid = util.id.getID(config.key);
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
      const remote = {node: val[node.slice(0, 5)], service: 'store', method: 'get'}
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
  function put(state, configuration, callback) {
    const config = normalizeConfig(configuration);
    let kid = '';
    // if (config.key === null) {
    //   kid = util.id.getID(state);
    // } else if (config.key.length !== 64) {
    //   kid = util.id.getID(configuration);
    // } else {
    //   kid = config.key;
    // }
    if (config.key === null) {
      kid = util.id.getID(state);
    } else if (!/^[a-f0-9]{64}$/i.test(config.key)) {
      kid = util.id.getID(config.key);
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
      const remote = {node: val[node.slice(0, 5)], service: 'store', method: 'put'}
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
    const config = normalizeConfig(configuration);
    let kid = '';
    if (config.key === null) {
      kid = util.id.getID(state);
    } else if (!/^[a-f0-9]{64}$/i.test(config.key)) {
      kid = util.id.getID(config.key);
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
      const remote = {node: val[node.slice(0, 5)], service: 'store', method: 'append'}
      distribution.local.comm.send(message, remote, (err, val) => {
        if (err) {
          return callback(err);
        }
        return callback(null, val);
      })
    })
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function del(configuration, callback) {
    const config = normalizeConfig(configuration);
    let kid = '';
    if (!/^[a-f0-9]{64}$/i.test(config.key)) {
      kid = util.id.getID(config.key);
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
      const remote = {node: val[node.slice(0, 5)], service: 'store', method: 'del'}
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
    return callback(new Error('store.reconf not implemented'));
  }

  /* For the distributed store service, the configuration will
          always be a string */
  return {get, put, append, del, reconf};
}

module.exports = store;
