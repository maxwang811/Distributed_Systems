#!/usr/bin/env node
/* eslint-disable no-restricted-globals */
/*
  Performance characterization for M4 distributed persistent storage.

  The script acts as a client/controller:
  1. Generate N random key/value pairs in memory.
  2. Insert all objects into a 3-node distributed store and measure latency/throughput.
  3. Read all objects back by key and measure latency/throughput.

  Usage:
    STORE_PERF_NODES=18.1.2.3:1234,18.1.2.4:1234,18.1.2.5:1234 node scripts/m4-perf.js

  Optional environment variables:
    STORE_PERF_CLIENT_IP=127.0.0.1
    STORE_PERF_CLIENT_PORT=1270
    STORE_PERF_GID=storebench
    STORE_PERF_OBJECTS=1000
    STORE_PERF_KEY_BYTES=16
    STORE_PERF_VALUE_BYTES=256
    STORE_PERF_HASH=naive|consistent|rendezvous
*/

const crypto = require('node:crypto');
const distribution = require('../distribution.js')({
  ip: process.env.STORE_PERF_CLIENT_IP || '127.0.0.1',
  port: Number(process.env.STORE_PERF_CLIENT_PORT || 1270),
});

globalThis.distribution = distribution;

const id = distribution.util.id;

const ENV_LABEL = process.env.STORE_PERF_ENV || 'aws';
const GID = process.env.STORE_PERF_GID || `storebench-${Date.now()}`;
const OBJECT_COUNT = Number(process.env.STORE_PERF_OBJECTS || 1000);
const KEY_BYTES = Number(process.env.STORE_PERF_KEY_BYTES || 16);
const VALUE_BYTES = Number(process.env.STORE_PERF_VALUE_BYTES || 256);
const HASH_NAME = process.env.STORE_PERF_HASH || 'naive';

function nowNs() {
  return process.hrtime.bigint();
}

function nsToMs(ns) {
  return Number(ns) / 1e6;
}

function nsToSeconds(ns) {
  return Number(ns) / 1e9;
}

function avg(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function opsPerSec(ops, seconds) {
  if (seconds <= 0) {
    return 0;
  }
  return ops / seconds;
}

function hasError(err) {
  if (!err) {
    return false;
  }
  if (err instanceof Error) {
    return true;
  }
  if (typeof err === 'object') {
    return Object.keys(err).length > 0;
  }
  return true;
}

function promisifyCall(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (err, value) => {
      if (hasError(err)) {
        reject(err);
        return;
      }
      resolve(value);
    });
  });
}

function parseNodes(raw) {
  if (!raw) {
    throw new Error(
        'STORE_PERF_NODES is required; expected "ip1:port1,ip2:port2,ip3:port3" or JSON array',
    );
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeNode);
    }
  } catch {
    // Fall through to comma-separated parser.
  }

  return raw.split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [ip, portText] = entry.split(':');
        return normalizeNode({ip, port: Number(portText)});
      });
}

function normalizeNode(node) {
  if (!node || typeof node !== 'object' ||
      typeof node.ip !== 'string' ||
      typeof node.port !== 'number' ||
      Number.isNaN(node.port)) {
    throw new Error(`Invalid node configuration: ${JSON.stringify(node)}`);
  }
  return {ip: node.ip, port: node.port};
}

function pickHash(name) {
  switch (name) {
    case 'naive':
      return id.naiveHash;
    case 'consistent':
      return id.consistentHash;
    case 'rendezvous':
      return id.rendezvousHash;
    default:
      throw new Error(`Unsupported STORE_PERF_HASH "${name}"`);
  }
}

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

function buildDataset(count) {
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const key = `key-${index}-${randomHex(KEY_BYTES)}`;
    const value = {
      id: index,
      token: randomHex(12),
      blob: randomHex(VALUE_BYTES),
      meta: {
        createdAt: new Date().toISOString(),
        tags: [randomHex(4), randomHex(4), randomHex(4)],
      },
    };
    entries.push({key, value});
  }
  return entries;
}

async function verifyNodes(nodes) {
  for (const node of nodes) {
    await promisifyCall(
        distribution.local.comm.send,
        ['sid'],
        {node, service: 'status', method: 'get'},
    );
  }
}

async function configureGroup(gid, nodes, hash) {
  const members = {};
  nodes.forEach((node) => {
    members[id.getSID(node)] = node;
  });
  await promisifyCall(distribution.local.groups.put, {gid, hash}, members);
}

async function runPutPhase(gid, entries) {
  const latenciesMs = [];
  const responses = [];
  const start = nowNs();

  for (const entry of entries) {
    const opStart = nowNs();
    const stored = await promisifyCall(distribution[gid].store.put, entry.value, entry.key);
    const opEnd = nowNs();
    responses.push(stored);
    latenciesMs.push(nsToMs(opEnd - opStart));
  }

  const end = nowNs();
  responses.forEach((stored, index) => {
    if (JSON.stringify(stored) !== JSON.stringify(entries[index].value)) {
      throw new Error(`Put verification failed for key "${entries[index].key}"`);
    }
  });
  return summarizePhase(entries.length, end - start, latenciesMs);
}

async function runGetPhase(gid, entries) {
  const latenciesMs = [];
  const responses = [];
  const start = nowNs();

  for (const entry of entries) {
    const opStart = nowNs();
    const value = await promisifyCall(distribution[gid].store.get, entry.key);
    const opEnd = nowNs();
    responses.push(value);
    latenciesMs.push(nsToMs(opEnd - opStart));
  }

  const end = nowNs();
  responses.forEach((value, index) => {
    if (JSON.stringify(value) !== JSON.stringify(entries[index].value)) {
      throw new Error(`Get verification failed for key "${entries[index].key}"`);
    }
  });
  return summarizePhase(entries.length, end - start, latenciesMs);
}

function summarizePhase(ops, totalNs, latenciesMs) {
  const seconds = nsToSeconds(totalNs);
  return {
    ops,
    seconds,
    ops_per_sec: opsPerSec(ops, seconds),
    latency_ms: {
      avg: avg(latenciesMs),
      p50: percentile(latenciesMs, 50),
      p95: percentile(latenciesMs, 95),
      min: latenciesMs.length ? Math.min(...latenciesMs) : 0,
      max: latenciesMs.length ? Math.max(...latenciesMs) : 0,
    },
  };
}

async function main() {
  const nodes = parseNodes(process.env.STORE_PERF_NODES);
  if (nodes.length !== 3) {
    throw new Error(`Expected exactly 3 AWS nodes, received ${nodes.length}`);
  }

  if (!Number.isInteger(OBJECT_COUNT) || OBJECT_COUNT <= 0) {
    throw new Error('STORE_PERF_OBJECTS must be a positive integer');
  }

  const hash = pickHash(HASH_NAME);
  const datasetStart = nowNs();
  const entries = buildDataset(OBJECT_COUNT);
  const datasetEnd = nowNs();

  await verifyNodes(nodes);
  await configureGroup(GID, nodes, hash);

  const put = await runPutPhase(GID, entries);
  const get = await runGetPhase(GID, entries);

  const summary = {
    milestone: 'M4',
    task: 'T5',
    env: ENV_LABEL,
    gid: GID,
    hash: HASH_NAME,
    nodes,
    objects: OBJECT_COUNT,
    key_bytes: KEY_BYTES,
    value_bytes: VALUE_BYTES,
    dataset_generation_ms: nsToMs(datasetEnd - datasetStart),
    put,
    get,
    timestamp: new Date().toISOString(),
  };

  console.log('[m4-perf] ' + JSON.stringify(summary));
}

main().catch((error) => {
  console.error('[m4-perf:error]', error);
  process.exitCode = 1;
});
