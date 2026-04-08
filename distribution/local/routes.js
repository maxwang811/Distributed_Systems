/**
 * @typedef {import("../types").Callback} Callback
 * @typedef {string} ServiceName
 */

const serviceTable = new Map(); // serviceName (String) -> service (Object)

/**
 * @param {ServiceName | {service: ServiceName, gid?: string}} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  if (!configuration) return callback(new Error("No configuration provided"));

  if (typeof(configuration) === 'string') {
    configuration = {service: configuration};
  }

  const service = configuration.service;
  const gid = configuration.gid;

  if (gid && gid !== 'local') {
    return callback(null, globalThis.distribution[gid][service]);
  }

  // If no GID, get local service
  const local = serviceTable.get(service);
  if (local) {
    return callback(null, local);
  }

  return callback(new Error(`Service ${configuration} does not exist`));
}

/**
 * @param {object} service
 * @param {string} configuration
 * @param {Callback} callback
 * @returns {void}
 */
function put(service, configuration, callback) {
  serviceTable.set(configuration, service);
  return callback(null, configuration);
}

/**
 * @param {string} configuration
 * @param {Callback} callback
 */
function rem(configuration, callback) {
  const service = serviceTable.get(configuration);
  if (service === undefined) {
    return callback(new Error('No service matches config'), null);
  }
  serviceTable.delete(configuration);
  return callback(null, service);
}

module.exports = {get, put, rem};
