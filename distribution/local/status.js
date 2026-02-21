// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

/**
 * @param {string} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  if (typeof configuration !== 'string') {
    return callback(new Error('status.get: invalid configuration'));
  }

  const nodeConfig = globalThis.distribution.node.config;
  const id = globalThis.distribution.util.id;

  switch (configuration) {
    case 'nid':
      return callback(null, id.getNID(nodeConfig));
    case 'sid':
      return callback(null, id.getSID(nodeConfig));
    case 'ip':
      return callback(null, nodeConfig.ip);
    case 'port':
      return callback(null, nodeConfig.port);
    case 'counts': {
      const counts = globalThis.distribution.node.counts ?? 0;
      return callback(null, counts);
    }
    case 'heapTotal':
      return callback(null, process.memoryUsage().heapTotal);
    case 'heapUsed':
      return callback(null, process.memoryUsage().heapUsed);
    default:
      return callback(new Error(`status.get: unknown key "${configuration}"`));
  }
};


/**
 * @param {Node} configuration
 * @param {Callback} callback
 */
function spawn(configuration, callback) {
  const proc = require('node:child_process');
  const path = require('node:path');
  const fs = require('node:fs');
  const log = require('../util/log.js');

  if (!configuration || typeof configuration !== 'object') {
    callback(new Error('status.spawn: invalid configuration'));
    return;
  }

  const config = {...configuration};
  config.onStart = config.onStart || (() => {});

  if (!config.ip || !config.port || typeof config.port !== 'number') {
    callback(new Error('Port and IP are required in the configuration'));
    return;
  }

  log(`[status.spawn] Spawning node with configuration: ${JSON.stringify(config)}`);

  const getDistributionPath = () => {
    let distributionPath = '';
    try {
      const top = proc.execSync('git rev-parse --show-toplevel', {encoding: 'utf8'}).trim();
      distributionPath = path.join(top, 'distribution.js');
      if (fs.existsSync(distributionPath)) {
        return distributionPath;
      }
    } catch (error) {
      log(`[status] Could not determine git root: ${error?.message}`);
    }

    distributionPath = path.join(__dirname, '../../', 'distribution.js');
    if (fs.existsSync(distributionPath)) {
      return distributionPath;
    }
    distributionPath = path.join(process.cwd(), 'distribution.js');
    if (fs.existsSync(distributionPath)) {
      return distributionPath;
    }
    throw new Error('Failed to find project root.');
  };

  let settled = false;
  const done = (err, nodeConfig) => {
    if (settled) {
      return;
    }
    settled = true;
    callback(err, nodeConfig);
  };

  const onSpawned = (err, nodeConfig) => {
    if (err) {
      done(err);
      return;
    }
    const groups = globalThis.distribution?.local?.groups;
    if (groups && typeof groups.add === 'function') {
      groups.add('all', nodeConfig, () => {
        done(null, nodeConfig);
      });
      return;
    }
    done(null, nodeConfig);
  };

  const createOnStart = (onStart, callbackOnParent) => {
    const callbackRPC = globalThis.distribution.util.wire.createRPC(
        globalThis.distribution.util.wire.toAsync(callbackOnParent),
    );
    const source = `
      return function (error) {
        const onStart = ${onStart.toString()};
        const callbackRPC = ${callbackRPC.toString()};
        if (error) {
          callbackRPC(error, null, () => {});
          return;
        }
        try {
          onStart();
          callbackRPC(null, globalThis.distribution.node.config, () => {});
        } catch (e) {
          callbackRPC(e, null, () => {});
        }
      };
    `;
    return new Function(source)();
  };

  config.onStart = createOnStart(config.onStart, onSpawned);

  const distributionPath = getDistributionPath();
  log(`[status.spawn] Using distribution path: ${distributionPath}`);
  const child = proc.spawn(process.execPath, [
    distributionPath,
    '--config',
    globalThis.distribution.util.serialize(config),
  ], {
    detached: true,
    stdio: 'inherit',
  });

  child.once('error', (error) => {
    done(error);
  });
}

/**
 * @param {Callback} callback
 */
function stop(callback) {
  const log = require('../util/log.js');
  if (typeof callback !== 'function' && typeof arguments[1] === 'function') {
    callback = arguments[1];
  }
  log('[status.stop] Shutting down node');
  const {ip, port} = globalThis.distribution.node.config || {};
  const shouldExitProcess = process.argv.some((arg) => /(^|\/)distribution\.js$/.test(arg));
  const finish = () => {
    if (typeof callback === 'function') {
      callback(null, {ip, port});
    }
    if (shouldExitProcess) {
      process.nextTick(() => process.exit(0));
    }
  };
  if (globalThis.distribution.node.server &&
      typeof globalThis.distribution.node.server.close === 'function') {
    globalThis.distribution.node.server.close(() => finish());
    return;
  }
  finish();
}

module.exports = {get, spawn, stop};
