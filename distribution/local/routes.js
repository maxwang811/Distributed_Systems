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
  if (typeof configuration === 'string') {
    serviceName = configuration;
  } else if (typeof configuration === 'object' &&
      typeof configuration.service === 'string') {
    if (configuration.gid && configuration.gid !== 'local') {
      return callback(new Error('routes.get: invalid gid'));
    }
    serviceName = configuration.service;
  } else {
    return callback(new Error('routes.get: invalid configuration'));
  }

  if (!routeTable.has(serviceName)) {
    return callback(new Error(`routes.get: unknown service "${serviceName}"`));
  }

  return callback(null, routeTable.get(serviceName));
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
