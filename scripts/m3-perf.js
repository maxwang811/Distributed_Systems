#!/usr/bin/env node
/* eslint-disable no-restricted-globals, no-restricted-syntax */
/*
  Performance characterization for M3 features:
  - spawn throughput + latency
  - gossip throughput + latency

  Usage:
    node scripts/m3-perf.js

  Optional environment variables:
    PERF_ENV=dev
    PERF_BASE_PORT=1268
    SPAWN_WARMUP=2
    SPAWN_OPS=10
    SPAWN_SAMPLES=10
    GOSSIP_WARMUP=20
    GOSSIP_OPS=200
    GOSSIP_SAMPLES=100
    GOSSIP_NODES=4
    GOSSIP_CONCURRENCY=20
*/

const distribution = require('../distribution.js')({
  ip: '127.0.0.1',
  port: Number(process.env.PERF_BASE_PORT || 1268),
});
globalThis.distribution = distribution;
require('../test/helpers/sync-guard');

const id = distribution.util.id;
const local = distribution.local;

const ENV_LABEL = process.env.PERF_ENV || 'dev';
const BASE_PORT = Number(process.env.PERF_BASE_PORT || 1268);
const SPAWN_WARMUP = Number(process.env.SPAWN_WARMUP || 2);
const SPAWN_OPS = Number(process.env.SPAWN_OPS || 10);
const SPAWN_SAMPLES = Number(process.env.SPAWN_SAMPLES || 10);
const GOSSIP_WARMUP = Number(process.env.GOSSIP_WARMUP || 20);
const GOSSIP_OPS = Number(process.env.GOSSIP_OPS || 200);
const GOSSIP_SAMPLES = Number(process.env.GOSSIP_SAMPLES || 100);
const GOSSIP_NODES = Number(process.env.GOSSIP_NODES || 4);
const GOSSIP_CONCURRENCY = Number(process.env.GOSSIP_CONCURRENCY || 20);
const GID = 'perfgroup';

const spawnedNodes = [];
let spawnPortCursor = BASE_PORT + 20;

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
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function opsPerSec(ops, seconds) {
  if (seconds <= 0) return 0;
  return ops / seconds;
}

function hasError(err) {
  if (!err) return false;
  if (err instanceof Error) return true;
  if (typeof err === 'object') return Object.keys(err).length > 0;
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

function stopNode(node) {
  return new Promise((resolve) => {
    local.comm.send([], {node, service: 'status', method: 'stop'}, () => {
      resolve();
    });
  });
}

function nextSpawnNode() {
  const node = {ip: '127.0.0.1', port: spawnPortCursor};
  spawnPortCursor += 1;
  return node;
}

async function spawnOnceMeasured() {
  const node = nextSpawnNode();
  const start = nowNs();
  await promisifyCall(local.status.spawn, node);
  const end = nowNs();
  await stopNode(node);
  return nsToMs(end - start);
}

async function runSpawnBenchmarks() {
  for (let i = 0; i < SPAWN_WARMUP; i++) {
    await spawnOnceMeasured();
  }

  const throughputStart = nowNs();
  for (let i = 0; i < SPAWN_OPS; i++) {
    await spawnOnceMeasured();
  }
  const throughputEnd = nowNs();
  const throughputSeconds = nsToSeconds(throughputEnd - throughputStart);

  const latencySamples = [];
  for (let i = 0; i < SPAWN_SAMPLES; i++) {
    latencySamples.push(await spawnOnceMeasured());
  }

  return {
    throughput: {
      ops: SPAWN_OPS,
      seconds: throughputSeconds,
      ops_per_sec: opsPerSec(SPAWN_OPS, throughputSeconds),
    },
    latency: {
      samples: SPAWN_SAMPLES,
      avg_latency_ms: avg(latencySamples),
    },
  };
}

async function setupGossipCluster() {
  for (let i = 0; i < GOSSIP_NODES; i++) {
    const node = nextSpawnNode();
    await promisifyCall(local.status.spawn, node);
    spawnedNodes.push(node);
  }

  const members = {};
  members[id.getSID(distribution.node.config)] = distribution.node.config;
  for (const node of spawnedNodes) {
    members[id.getSID(node)] = node;
  }

  await promisifyCall(local.groups.put, {gid: GID}, members);
}

function gossipSendOne() {
  return promisifyCall(distribution[GID].gossip.send, ['nid'], {
    node: distribution.node.config,
    service: 'status',
    method: 'get',
  });
}

async function runConcurrent(total, concurrency, task) {
  const limit = Math.max(1, Math.min(total, concurrency));
  let next = 0;
  let inFlight = 0;
  let settled = false;

  return new Promise((resolve, reject) => {
    const launch = () => {
      while (!settled && inFlight < limit && next < total) {
        next += 1;
        inFlight += 1;
        task().then(() => {
          inFlight -= 1;
          if (next === total && inFlight === 0) {
            settled = true;
            resolve();
            return;
          }
          launch();
        }).catch((err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        });
      }
      if (!settled && total === 0) {
        settled = true;
        resolve();
      }
    };
    launch();
  });
}

async function runGossipBenchmarks() {
  await setupGossipCluster();

  for (let i = 0; i < GOSSIP_WARMUP; i++) {
    await gossipSendOne();
  }

  const throughputStart = nowNs();
  await runConcurrent(GOSSIP_OPS, GOSSIP_CONCURRENCY, gossipSendOne);
  const throughputEnd = nowNs();
  const throughputSeconds = nsToSeconds(throughputEnd - throughputStart);

  const latencySamples = [];
  for (let i = 0; i < GOSSIP_SAMPLES; i++) {
    const start = nowNs();
    await gossipSendOne();
    const end = nowNs();
    latencySamples.push(nsToMs(end - start));
  }

  return {
    throughput: {
      ops: GOSSIP_OPS,
      seconds: throughputSeconds,
      ops_per_sec: opsPerSec(GOSSIP_OPS, throughputSeconds),
      concurrency: Math.max(1, Math.min(GOSSIP_OPS, GOSSIP_CONCURRENCY)),
    },
    latency: {
      samples: GOSSIP_SAMPLES,
      avg_latency_ms: avg(latencySamples),
    },
  };
}

async function cleanup() {
  for (const node of spawnedNodes) {
    await stopNode(node);
  }
  if (distribution.node.server) {
    await new Promise((resolve) => distribution.node.server.close(resolve));
  }
}

async function main() {
  await promisifyCall(distribution.node.start);

  const spawn = await runSpawnBenchmarks();
  const gossip = await runGossipBenchmarks();

  const summary = {
    env: ENV_LABEL,
    base_port: BASE_PORT,
    config: {
      spawn: {warmup: SPAWN_WARMUP, ops: SPAWN_OPS, samples: SPAWN_SAMPLES},
      gossip: {
        warmup: GOSSIP_WARMUP,
        ops: GOSSIP_OPS,
        samples: GOSSIP_SAMPLES,
        nodes: GOSSIP_NODES,
        concurrency: GOSSIP_CONCURRENCY,
      },
    },
    results: {spawn, gossip},
  };
  console.log('[m3-perf] ' + JSON.stringify(summary));
}

main().catch((err) => {
  console.error('[m3-perf:error]', err);
  process.exitCode = 1;
}).finally(async () => {
  await cleanup();
});
