// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").SID} SID
 * @typedef {import("../types.js").Node} Node
 *
 * @typedef {Object} Remote
 * @property {Node} node
 * @property {string} service
 * @property {string} method

 * @typedef {Object} Payload
 * @property {Remote} remote
 * @property {any} message
 * @property {string} mid
 * @property {string} gid
 *
 *
 * @typedef {Object} Gossip
 * @property {(payload: Payload, remote: Remote, callback: Callback) => void} send
 * @property {(perod: number, func: () => void, callback: Callback) => void} at
 * @property {(intervalID: string, callback: Callback) => void} del
 */

/** @type {Map<string, NodeJS.Timeout>} */
const intervalTable = new Map();

/**
 * @returns {string}
 */
function createIntervalID() {
  const util = globalThis.distribution?.util?.id;
  const getMID = util && typeof util.getMID === 'function' ? util.getMID : null;
  if (!getMID) {
    return `${Date.now()}-${Math.random()}`;
  }
  let id = getMID({kind: 'gossip-interval', date: Date.now(), rand: Math.random()});
  while (intervalTable.has(id)) {
    id = getMID({kind: 'gossip-interval', date: Date.now(), rand: Math.random()});
  }
  return id;
}


/**
 * @param {Config} config
 * @returns {Gossip}
 */
function gossip(config) {
  const context = {};
  context.gid = config.gid || 'all';
  context.subset = config.subset || function(lst) {
    return Math.ceil(Math.log(lst.length));
  };

  /**
   * @param {Payload} payload
   * @param {Remote} remote
   * @param {Callback} callback
   */
  function send(payload, remote, callback) {
    const done = typeof callback === 'function' ? callback : () => {};

    const groups = globalThis.distribution?.local?.groups;
    const localComm = globalThis.distribution?.local?.comm;
    if (!groups || typeof groups.get !== 'function' ||
        !localComm || typeof localComm.send !== 'function') {
      done(new Error('gossip.send: services unavailable'));
      return;
    }

    groups.get(context.gid, (groupError, group) => {
      if (groupError) {
        done(groupError);
        return;
      }

      const members = Object.entries(group || {});
      if (members.length === 0) {
        done(new Error(`gossip.send: group "${context.gid}" has no members`));
        return;
      }

      const sampleSizeRaw = Number(context.subset(members.map((entry) => entry[1])));
      const sampleSize = Math.max(
          1,
          Math.min(
              members.length,
              Number.isFinite(sampleSizeRaw) ? Math.floor(sampleSizeRaw) : 1,
          ),
      );

      const pool = [...members];
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
      }
      const chosen = pool.slice(0, sampleSize);

      const mid = globalThis.distribution.util.id.getMID({
        gid: context.gid,
        remote: remote,
        message: payload,
      });

      /** @type {Error | null} */
      let firstError = null;
      /** @type {Object.<SID, any>} */
      const values = {};
      let pending = chosen.length;

      const finish = () => {
        pending -= 1;
        if (pending === 0) {
          done(firstError, values);
        }
      };

      chosen.forEach(([sid, node]) => {
        /** @type {Payload} */
        const gossipPayload = {
          remote,
          message: payload,
          mid,
          gid: context.gid,
        };
        localComm.send([gossipPayload], {
          node,
          service: 'gossip',
          method: 'recv',
          gid: 'local',
        }, (error, value) => {
          if (error) {
            if (!firstError) {
              firstError = error;
            }
          } else {
            values[sid] = value;
          }
          finish();
        });
      });
    });
  }

  /**
   * @param {number} period
   * @param {() => void} func
   * @param {Callback} callback
   */
  function at(period, func, callback) {
    const done = typeof callback === 'function' ? callback : () => {};
    if (typeof period !== 'number' || Number.isNaN(period) || period <= 0) {
      done(new Error('gossip.at: invalid period'));
      return;
    }
    if (typeof func !== 'function') {
      done(new Error('gossip.at: invalid function'));
      return;
    }

    const intervalID = createIntervalID();
    const timer = setInterval(() => {
      try {
        func();
      } catch {
        // Best-effort scheduler; callback errors are isolated from the timer loop.
      }
    }, period);
    // Background gossip timers should not keep test or CLI processes alive.
    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    intervalTable.set(intervalID, timer);
    done(null, intervalID);
  }

  /**
   * @param {string} intervalID
   * @param {Callback} callback
   */
  function del(intervalID, callback) {
    const done = typeof callback === 'function' ? callback : () => {};
    if (typeof intervalID !== 'string' || intervalID.length === 0) {
      done(new Error('gossip.del: invalid interval id'));
      return;
    }
    if (!intervalTable.has(intervalID)) {
      done(new Error(`gossip.del: unknown interval id "${intervalID}"`));
      return;
    }

    const timer = intervalTable.get(intervalID);
    clearInterval(timer);
    intervalTable.delete(intervalID);
    done(null, intervalID);
  }

  return {send, at, del};
}

module.exports = gossip;
