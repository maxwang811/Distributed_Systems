// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Node} Node
 */

/**
 * @param {string} name
 * @param {Callback} callback
 */
function get(name, callback) {
  if (typeof callback !== 'function') {
    callback = () => {};
  }
  if (typeof name !== 'string' || name.length === 0) {
    return callback(new Error('groups.get: invalid name'));
  }
  ensureDefaults();
  if (!groupTable.has(name)) {
    return callback(new Error(`groups.get: unknown group "${name}"`));
  }
  return callback(null, groupTable.get(name));
}

/**
 * @param {Config | string} config
 * @param {Object.<string, Node>} group
 * @param {Callback} callback
 */
function put(config, group, callback) {
  if (typeof callback !== 'function') {
    callback = () => {};
  }
  const resolved = resolveConfig(config);
  if (!resolved) {
    return callback(new Error('groups.put: invalid configuration'));
  }
  if (!group || typeof group !== 'object') {
    return callback(new Error('groups.put: invalid group'));
  }

  ensureDefaults();

  const gid = resolved.gid;
  groupTable.set(gid, group);

  // Keep the canonical "all" view synchronized with declared memberships.
  const allGroup = getOrCreateGroup('all');
  Object.values(group).forEach((member) => {
    if (member && typeof member === 'object') {
      allGroup[getId().getSID(member)] = member;
    }
  });

  ensureBuiltinMembership(gid, group);

  const dist = globalThis.distribution;
  if (dist && gid !== 'local' && gid !== 'all' && !dist[gid]) {
    const {setup} = require('../all/all.js');
    dist[gid] = setup(resolved);
  }

  return callback(null, group);
}

/**
 * @param {string} name
 * @param {Callback} callback
 */
function del(name, callback) {
  if (typeof callback !== 'function') {
    callback = () => {};
  }
  if (typeof name !== 'string' || name.length === 0) {
    return callback(new Error('groups.del: invalid name'));
  }

  ensureDefaults();

  if (name === 'all' || name === 'local') {
    return callback(new Error(`groups.del: cannot delete built-in group "${name}"`));
  }

  if (!groupTable.has(name)) {
    return callback(new Error(`groups.del: unknown group "${name}"`));
  }

  const removed = groupTable.get(name);
  groupTable.delete(name);

  const dist = globalThis.distribution;
  if (dist && dist[name]) {
    delete dist[name];
  }

  return callback(null, removed);
}

/**
 * @param {string} name
 * @param {Node} node
 * @param {Callback} callback
 */
function add(name, node, callback) {
  if (typeof callback !== 'function') {
    callback = () => {};
  }
  if (typeof name !== 'string' || name.length === 0) {
    return callback(new Error('groups.add: invalid name'));
  }
  if (!node || typeof node !== 'object') {
    return callback(new Error('groups.add: invalid node'));
  }

  ensureDefaults();

  if (!groupTable.has(name)) {
    return callback(new Error(`groups.add: unknown group "${name}"`));
  }

  const group = groupTable.get(name);
  const sid = getId().getSID(node);
  group[sid] = node;
  getOrCreateGroup('all')[sid] = node;

  return callback(null, group);
};

/**
 * @param {string} name
 * @param {string} node
 * @param {Callback} callback
 */
function rem(name, node, callback) {
  if (typeof callback !== 'function') {
    callback = () => {};
  }
  if (typeof name !== 'string' || name.length === 0) {
    return callback(new Error('groups.rem: invalid name'));
  }
  if (typeof node !== 'string' || node.length === 0) {
    return callback(new Error('groups.rem: invalid node'));
  }

  ensureDefaults();

  if (!groupTable.has(name)) {
    return callback(new Error(`groups.rem: unknown group "${name}"`));
  }

  const group = groupTable.get(name);
  if (Object.prototype.hasOwnProperty.call(group, node)) {
    if (groupTable.has('all')) {
      delete groupTable.get('all')[node];
    }
    delete group[node];
  }
  ensureBuiltinMembership(name, group);
  return callback(null, group);
};

module.exports = {get, put, del, add, rem};

/** @type {Map<string, Object.<string, Node>>} */
const groupTable = new Map();

function getId() {
  const dist = globalThis.distribution;
  if (dist && dist.util && dist.util.id) {
    return dist.util.id;
  }
  return require('../util/id.js');
}

function ensureDefaults() {
  const dist = globalThis.distribution;
  if (!dist || !dist.node || !dist.node.config) {
    return;
  }
  const node = dist.node.config;
  const sid = getId().getSID(node);
  getOrCreateGroup('all')[sid] = node;
  getOrCreateGroup('local')[sid] = node;
}

/**
 * @param {string} gid
 * @param {Object.<string, Node>} group
 */
function ensureBuiltinMembership(gid, group) {
  if (gid !== 'all' && gid !== 'local') {
    return;
  }
  const dist = globalThis.distribution;
  if (!dist || !dist.node || !dist.node.config) {
    return;
  }
  const node = dist.node.config;
  const sid = getId().getSID(node);
  group[sid] = node;
}

/**
 * @param {Config | string} config
 * @returns {Config | null}
 */
function resolveConfig(config) {
  if (typeof config === 'string') {
    return {gid: config};
  }
  if (config && typeof config === 'object' && typeof config.gid === 'string') {
    return config;
  }
  return null;
}

/**
 * @param {string} name
 * @returns {Object.<string, Node>}
 */
function getOrCreateGroup(name) {
  if (!groupTable.has(name)) {
    groupTable.set(name, {});
  }
  return groupTable.get(name);
}
