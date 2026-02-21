/**
 * @typedef {import("../types").Callback} Callback
 * @typedef {string} ServiceName
 */

/** @type {Map<ServiceName, object>} */
const routeTable = new Map();

/**
 * @param {ServiceName | {service: ServiceName, gid?: string}} configuration
 * @param {Callback} callback
 * @returns {void}
 */
function get(configuration, callback) {
  if (configuration == null) {
    return callback(new Error('routes.get: invalid configuration'));
  }

  let serviceName;
  let gid = 'local';
  if (typeof configuration === 'string') {
    serviceName = configuration;
  } else if (typeof configuration === 'object' &&
      typeof configuration.service === 'string') {
    serviceName = configuration.service;
    if (configuration.gid !== undefined) {
      if (typeof configuration.gid !== 'string' || configuration.gid.length === 0) {
        return callback(new Error('routes.get: invalid gid'));
      }
      gid = configuration.gid;
    }
  } else {
    return callback(new Error('routes.get: invalid configuration'));
  }

  if (gid === 'local') {
    if (!routeTable.has(serviceName)) {
      return callback(new Error(`routes.get: unknown service "${serviceName}"`));
    }
    return callback(null, routeTable.get(serviceName));
  }

  const dist = globalThis.distribution;
  const group = dist && dist[gid];
  if (!group || typeof group !== 'object') {
    return callback(new Error(`routes.get: unknown gid "${gid}"`));
  }
  if (!group[serviceName]) {
    return callback(new Error(`routes.get: unknown service "${serviceName}"`));
  }
  return callback(null, group[serviceName]);
}

/**
 * @param {object} service
 * @param {string} configuration
 * @param {Callback} callback
 * @returns {void}
 */
function put(service, configuration, callback) {
  if (!service || typeof configuration !== 'string' || configuration.length === 0) {
    return callback(new Error('routes.put: invalid configuration'));
  }
  routeTable.set(configuration, service);
  return callback(null, configuration);
}

/**
 * @param {string} configuration
 * @param {Callback} callback
 */
function rem(configuration, callback) {
  if (typeof configuration !== 'string' || configuration.length === 0) {
    return callback(new Error('routes.rem: invalid configuration'));
  }
  if (!routeTable.has(configuration)) {
    return callback(new Error(`routes.rem: unknown service "${configuration}"`));
  }
  const removed = routeTable.get(configuration);
  routeTable.delete(configuration);
  return callback(null, removed);
}

module.exports = {get, put, rem};
