/*
  Latency characterization for comm and rpc.
  Run locally and in cloud; set LATENCY_ENV to label the environment.
*/

const distribution = require('../../distribution.js')({ip: '127.0.0.1', port: 1267});
globalThis.distribution = distribution;
require('../helpers/sync-guard');

const local = distribution.local;
const wire = distribution.util.wire;

const SAMPLES = Number(process.env.LATENCY_SAMPLES || 1000);
const WARMUP = Number(process.env.LATENCY_WARMUP || 50);
const ENV_LABEL = process.env.LATENCY_ENV || 'dev';

function nowNs() {
  return process.hrtime.bigint();
}

function nsToMs(ns) {
  return Number(ns) / 1e6;
}

function avg(values) {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, v) => sum + v, 0);
  return total / values.length;
}

function sendOne(sendFn) {
  return new Promise((resolve, reject) => {
    sendFn((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

const results = new Map();

async function runWorkload(name, sendFn) {
  for (let i = 0; i < WARMUP; i++) {
    await sendOne(sendFn);
  }

  const samples = [];
  for (let i = 0; i < SAMPLES; i++) {
    const start = nowNs();
    await sendOne(sendFn);
    const end = nowNs();
    samples.push(nsToMs(end - start));
  }

  results.set(name, samples);
}

afterAll(() => {
  const summary = {
    env: ENV_LABEL,
    samples: SAMPLES,
    warmup: WARMUP,
    results: {},
  };

  for (const [name, samples] of results.entries()) {
    summary.results[name] = {
      avg_latency_ms: avg(samples),
    };
  }

  console.log('[latency] ' + JSON.stringify(summary));
});

test('(0 pts) latency characterization', async () => {
  const node = distribution.node.config;
  const remote = {node: node, service: 'status', method: 'get'};

  const echo = (value) => value;
  const echoRPC = wire.createRPC(wire.toAsync(echo));

  await runWorkload('comm', (cb) => {
    local.comm.send(['nid'], remote, cb);
  });

  await runWorkload('rpc', (cb) => {
    echoRPC('ping', cb);
  });

  expect(true).toEqual(true);
});

beforeAll((done) => {
  distribution.node.start((e) => {
    if (e) {
      done(e);
      return;
    }
    done();
  });
});

afterAll((done) => {
  if (globalThis.distribution.node.server) {
    globalThis.distribution.node.server.close();
  }
  done();
});
