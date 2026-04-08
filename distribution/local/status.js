// @ts-check
const path = require("node:path");
const id = require('../util/id.js');
const proc = require('node:child_process');
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

/**
 * @param {string} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  const config = distribution.node.config;
  switch (configuration) {
    case 'nid':
      // getNID takes a Node object
      return callback(null, id.getNID(config));
    case 'sid':
      return callback(null, id.getSID(config));
    case 'ip':
      return callback(null, config.ip);
    case 'port':
      return callback(null, config.port);
    case 'counts':
      return callback(null, 0);
    case 'heapTotal':
      return callback(null, process.memoryUsage().heapTotal);
    case 'heapUsed':
      return callback(null, process.memoryUsage().heapUsed);
    default:
      return callback(new Error('Not a supported configuration in status.get'));
  }
}


/**
 * @param {Node} configuration
 * @param {Callback} callback
 */
function spawn(configuration, callback) {
  configuration.onStart = configuration.onStart || function () {};

  if (!configuration.ip || !configuration.port) {
    return callback(new Error("Port or ip not specified in local.status.spawn"));
  }

  const afterStart = (err, startedConfig) => {
    if (err) {
      return callback(err);
    }
    globalThis.distribution.local.groups.add('all', startedConfig, (err, val) => {
      if (err) return callback(err);
      return callback(null, startedConfig);
    })
  }

  configuration.onStart = afterStart;

  const serializedConfig = globalThis.distribution.util.serialize(configuration);
  const distributionPath = path.resolve(__dirname, '../../distribution.js');
  proc.spawn('node', [distributionPath, '--config', serializedConfig], {detached: true, stdio: "inherit"});
}

/**
 * @param {Callback} callback
 */
function stop(callback) {
  callback(null, 'Stopping node');

  setTimeout(() => {
    const server = globalThis.distribution.node.server;
    if (server) {
      server.close(() => {
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }, 100);
}

module.exports = {get, spawn, stop};
