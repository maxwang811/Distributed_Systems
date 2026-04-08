// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

const http = require('http');
const distribution = globalThis.distribution;

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
 */
function send(message, remote, callback) {
  // console.log('beginning of send');
  if (!Array.isArray(message)) {
    return callback(new Error('Message must be an array'), null);
  }
  if (!remote || !remote.node) {
    return callback(new Error('Missing node'), null);
  }
  if (!remote.node.ip) {
    return callback(new Error('Missing node IP'), null);
  }
  if (!remote.node.port) {
    return callback(new Error('Missing node port'), null);
  }
  if (!remote.service || remote.service === '') {
    return callback(new Error('Missing or empty service'), null);
  }
  if (!remote.method || remote.method === '') {
    return callback(new Error('Missing or empty method'), null);
  }
  const args = distribution.util.serialize(message);
  const gid = remote.gid || 'local';
  const path = `/${gid}/${remote.service}/${remote.method}`;
  const options = {
    hostname: remote.node.ip,
    port: remote.node.port,
    path: path,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const result = distribution.util.deserialize(data);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(result[0], result[1]);
        } else {
          return callback(result[0] || new Error('Invalid response from http'));
        }
      } catch (e) {
        return callback(e);
      }
    });
    res.on('error', (err) => {
      return callback(err);
    });
  });

  req.on('error', (err) => {
    return callback(err);
  });
  req.write(args);
  req.end();
}

module.exports = {send};
