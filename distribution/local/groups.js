// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Node} Node
 */

const distribution = globalThis.distribution;
const id = distribution.util.id;
const groupsMap = new Map(); // groupName: str -> nodeSet: Object<SID -> Node>
groupsMap.set('all', {[id.getSID(distribution.node.config)]: distribution.node.config});


/**
 * @param {string} name
 * @param {Callback} callback
 */
function get(name, callback) {
  const group = groupsMap.get(name);
  if (group === undefined) {
    return callback(new Error(`Group ${name} does not exist in local.groups.get`));
  }
  return callback(null, group);
}

/**
 * @param {Config | string} config
 * @param {Object.<string, Node>} group
 * @param {Callback} callback
 */
function put(config, group, callback) {
  let gid = (typeof config == 'string') ? config : config.gid;
  if (typeof config == 'string') {
    config = {gid: config};
  }
  groupsMap.set(gid, group);

  const allGroup = groupsMap.get('all');
  // Add all the nodes to all group too
  Object.values(group).forEach((node) => {
    allGroup[id.getSID(node)] = node;
  })

  distribution[gid] = {};
  distribution[gid].comm = require('../all/comm.js')(config);
  distribution[gid].routes = require('../all/routes.js')(config);
  distribution[gid].status = require('../all/status.js')(config);
  distribution[gid].groups = require('../all/groups.js')(config);
  distribution[gid].mem = require('../all/mem.js')(config);
  distribution[gid].store = require('../all/store.js')(config);
  distribution[gid].mr = require('../all/mr.js')(config);
  return callback(null, group);
}

/**
 * @param {string} name
 * @param {Callback} callback
 */
function del(name, callback) {
  const groupToDel = groupsMap.get(name);
  if (groupToDel === undefined) {
    return callback(new Error(`Cannot delete group ${name} because it doesn't exist. local.groups.del`));
  }
  groupsMap.delete(name);
  distribution[name] = undefined;
  return callback(null, groupToDel);
}

/**
 * @param {string} name
 * @param {Node} node
 * @param {Callback} callback
 */
function add(name, node, callback) {
  if (callback === undefined) {
    return new Promise((resolve, reject) => {
      add(name, node, (e, v) => {
        if (e) {
          reject(e);
        } else {
          resolve(v);
        }
      })
    })
  }
  const group = groupsMap.get(name);
  const allGroup = groupsMap.get('all');
  if (group === undefined) {
    return callback(new Error(`Group ${name} does not exist. local.groups.add`));
  }
  group[id.getSID(node)] = node;
  allGroup[id.getSID(node)] = node;
  return callback(null, group);
}

/**
 * @param {string} name
 * @param {string} node
 * @param {Callback} callback
 */
function rem(name, node, callback) {
  const group = groupsMap.get(name);
  const allGroup = groupsMap.get(name);
  if (group === undefined) {
    return callback(new Error(`Group ${name} does not exist. local.groups.rem`));
  }
  const nodeToRem = group[node];
  if (nodeToRem === undefined) {
    return callback(new Error(`Node ${nodeToRem} does not exist. local.groups.rem`));
  }

  delete group[node];
  delete allGroup[node];
  return callback(null, group);
}

module.exports = {get, put, del, add, rem};
