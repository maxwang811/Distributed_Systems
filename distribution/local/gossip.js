// @ts-check
/**
 * @typedef {import("../types").Callback} Callback
 * @typedef {import("../types").Node} Node
 *
 * @typedef {Object} Payload
 * @property {{service: string, method: string, node: Node}} remote
 * @property {any} message
 * @property {string} mid
 * @property {string} gid
 */

const N = 10;

/** @type {string[]} */
const seenOrder = [];
/** @type {Set<string>} */
const seenSet = new Set();

/**
 * @param {string} mid
 */
function remember(mid) {
  if (seenSet.has(mid)) {
    return;
  }
  seenSet.add(mid);
  seenOrder.push(mid);
  if (seenOrder.length > N) {
    const old = seenOrder.shift();
    if (old) {
      seenSet.delete(old);
    }
  }
}

/**
 * @param {Payload} payload
 * @param {Callback} callback
 */
function recv(payload, callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  if (!payload || typeof payload !== 'object') {
    done(new Error('gossip.recv: invalid payload'));
    return;
  }
  if (!payload.remote || typeof payload.remote !== 'object') {
    done(new Error('gossip.recv: invalid remote'));
    return;
  }

  const mid = typeof payload.mid === 'string' && payload.mid.length > 0 ?
    payload.mid :
    globalThis.distribution.util.id.getMID(payload.message);

  if (seenSet.has(mid)) {
    done(null, {mid: mid, duplicate: true});
    return;
  }
  remember(mid);

  const localComm = globalThis.distribution?.local?.comm;
  if (!localComm || typeof localComm.send !== 'function') {
    done(new Error('gossip.recv: local.comm unavailable'));
    return;
  }

  const remote = {
    ...payload.remote,
    gid: payload.remote.gid || 'local',
  };
  const message = Array.isArray(payload.message) ? payload.message : [payload.message];

  localComm.send(message, remote, (error, value) => {
    done(error, {mid: mid, value: value});
  });
}

module.exports = {recv};
