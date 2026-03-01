// @ts-check
/**
 * @typedef {import("../types.js").Node} Node
 * @typedef {import("../types.js").ID} ID
 * @typedef {import("../types.js").NID} NID
 * @typedef {import("../types.js").SID} SID
 * @typedef {import("../types.js").Hasher} Hasher
 */

const assert = require('assert');
const crypto = require('crypto');

/**
 * @param {any} obj
 * @returns {ID}
 */
function getID(obj) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(obj));
  return hash.digest('hex');
}

/**
 * The NID is the SHA256 hash of the JSON representation of the node
 * @param {Node} node
 * @returns {NID}
 */
function getNID(node) {
  node = {ip: node.ip, port: node.port};
  return getID(node);
}

/**
 * The SID is the first 5 characters of the NID
 * @param {Node} node
 * @returns {SID}
 */
function getSID(node) {
  return getNID(node).substring(0, 5);
}

/**
 * @param {any} message
 * @returns {string}
 */
function getMID(message) {
  const msg = {};
  msg.date = new Date().getTime();
  msg.mss = message;
  return getID(msg);
}

/**
 * @param {string} id
 * @returns {bigint}
 */
function idToNum(id) {
  assert(typeof id === 'string', 'idToNum: id is not in KID form!');
  const trimmed = id.startsWith('0x') ? id.slice(2) : id;
  if (/^[0-9a-fA-F]+$/.test(trimmed)) {
    return BigInt(`0x${trimmed}`);
  }
  return BigInt(id);
}

/** @type { Hasher } */
const naiveHash = (kid, nids) => {
  const sortedNids = [...nids].sort();
  const index = Number(idToNum(kid) % BigInt(sortedNids.length));
  return sortedNids[index];
};

/** @type { Hasher } */
const consistentHash = (kid, nids) => {
  if (nids.length === 0) {
    throw new Error('consistentHash: no nodes available');
  }

  const keyHash = idToNum(kid);
  const ring = nids
      .map((nid) => ({id: nid, num: idToNum(nid)}))
      .sort((a, b) => {
        if (a.num < b.num) {
          return -1;
        }
        if (a.num > b.num) {
          return 1;
        }
        return 0;
      });

  for (const entry of ring) {
    if (keyHash <= entry.num) {
      return entry.id;
    }
  }

  return ring[0].id;
};

/** @type { Hasher } */
const rendezvousHash = (kid, nids) => {
  if (nids.length === 0) {
    throw new Error('rendezvousHash: no nodes available');
  }

  let bestScore = null;
  let bestNid = null;

  for (const nid of nids) {
    const score = scoreRendezvous(kid, nid);
    if (bestScore === null || score > bestScore) {
      bestScore = score;
      bestNid = nid;
    }
  }

  return bestNid;
};

module.exports = {
  getID,
  getNID,
  getSID,
  getMID,
  naiveHash,
  consistentHash,
  rendezvousHash,
};

/**
 * @param {string} kid
 * @param {string} nid
 * @returns {bigint}
 */
function scoreRendezvous(kid, nid) {
  return idToNum(getID(kid + nid));
}
