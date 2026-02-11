// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

const http = require('node:http');
const net = require('node:net');
const log = require('../util/log.js');

/**
 * @param {Callback | undefined} callback
 * @returns {Callback}
 */
function createGuardedCallback(callback) {
  let calls = 0;
  return (error, value) => {
    calls += 1;
    if (calls > 1) {
      log(`Warning: Callback function called ${calls} times`);
      return;
    }
    if (callback) {
      callback(error, value);
    }
  };
}

/**
 * @typedef {Object} Target
 * @property {string} service
 * @property {string} method
 * @property {Node} node
 * @property {string} [gid]
 */

/**
 * @param {Array<any>} message
 * @param {Target} remote
 * @param {(error: Error, value?: any) => void} callback
 * @returns {void}
 */
function send(message, remote, callback) {
  const guardedCallback = createGuardedCallback(callback);

  if (remote === undefined) {
    guardedCallback(new Error('Remote is required'));
    return;
  }
  if (remote?.node?.ip === undefined || remote?.node?.port === undefined) {
    guardedCallback(new Error('Remote node IP and port required'));
    return;
  }
  if (typeof remote.node.ip !== 'string' || net.isIP(remote.node.ip) === 0) {
    guardedCallback(new Error('Remote node IP is invalid'));
    return;
  }
  if (typeof remote.node.port !== 'number' || Number.isNaN(remote.node.port)) {
    guardedCallback(new Error('Remote node port is invalid'));
    return;
  }
  if (remote?.service === undefined) {
    guardedCallback(new Error('Remote service is required'));
    return;
  }
  if (typeof remote.service !== 'string' || remote.service.length === 0) {
    guardedCallback(new Error('Remote service is invalid'));
    return;
  }
  if (remote?.method === undefined) {
    guardedCallback(new Error('Remote method is required'));
    return;
  }
  if (typeof remote.method !== 'string' || remote.method.length === 0) {
    guardedCallback(new Error('Remote method is invalid'));
    return;
  }
  if (!(message instanceof Array)) {
    guardedCallback(new Error('Message must be an array of arguments'));
    return;
  }

  const node = remote.node;
  const service = remote.service;
  const method = remote.method;
  const gid = remote.gid || 'local';

  const tryLocalDispatch = () => {
    const routes = globalThis.distribution?.local?.routes;
    if (!routes) {
      return false;
    }
    routes.get({service: service, gid: gid}, (err, svc) => {
      if (err) {
        guardedCallback(err);
        return;
      }
      if (!svc || typeof svc[method] !== 'function') {
        guardedCallback(new Error(`Method ${method} not found in service ${service}`));
        return;
      }
      const fn = svc[method].bind(svc);
      const args = Array.isArray(message) ? [...message] : [];
      if (args.length === 0 && fn.length === 1) {
        args.push(undefined);
      }
      const normalized = globalThis.distribution.util.normalize(fn, args);
      try {
        fn(...normalized, (err, value) => {
          guardedCallback(err, value);
        });
      } catch (err) {
        guardedCallback(err);
      }
    });
    return true;
  };

  const targetIp = node.ip;

  log(
      `[comm.send]: Sending ${JSON.stringify(message)} to ${service}:${method} on ${targetIp}:${node.port}`,
  );

  const payload = globalThis.distribution.util.serialize(message);
  const options = {
    hostname: targetIp,
    port: node.port,
    path: `/${gid}/${service}/${method}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      let error;
      let value;
      try {
        const result = globalThis.distribution.util.deserialize(body);
        error = result[0];
        value = result[1];
      } catch (err) {
        let snippet = body.slice(0, 50);
        if (body.length > 50) {
          snippet += '...';
        }
        guardedCallback(new Error(`Failed to deserialize HTTP response: ${snippet}`));
        return;
      }
      guardedCallback(error, value);
    });
    res.on('error', (err) => {
      guardedCallback(new Error(`HTTP response error: ${err?.message}`));
    });
  });

  let localFallbackTried = false;
  req.on('error', (err) => {
    if (!localFallbackTried &&
        (err?.code === 'EPERM' || err?.code === 'EADDRNOTAVAIL')) {
      localFallbackTried = true;
      if (tryLocalDispatch()) {
        return;
      }
    }
    guardedCallback(new Error(`HTTP request error: ${err?.message}`));
  });
  req.setTimeout(2000, () => {
    req.destroy(new Error('HTTP request timeout'));
  });

  req.write(payload);
  req.end();
}

module.exports = {send};
