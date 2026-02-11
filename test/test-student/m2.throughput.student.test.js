const distribution = require('../../distribution.js')({ip: '127.0.0.1', port: 1268});
globalThis.distribution = distribution;
require('../helpers/sync-guard');

const local = distribution.local;
const wire = distribution.util.wire;

const OPS = Number(process.env.THROUGHPUT_OPS || 1000);
const WARMUP = Number(process.env.THROUGHPUT_WARMUP || 50);
const ENV_LABEL = process.env.THROUGHPUT_ENV || 'dev';

function nowNs() {
  return process.hrtime.bigint();
}

function nsToSeconds(ns) {
  return Number(ns) / 1e9;
}

function opsPerSec(ops, seconds) {
  if (seconds <= 0) return 0;
  return ops / seconds;
}

function runRequests(count, sendFn) {
  return new Promise((resolve, reject) => {
    let remaining = count;
    let failed = false;
    for (let i = 0; i < count; i++) {
      sendFn((err) => {
        if (failed) return;
        if (err) {
          failed = true;
          reject(err);
          return;
        }
        remaining -= 1;
        if (remaining === 0) {
          resolve();
        }
      });
    }
  });
}

const results = new Map();

async function runWorkload(name, sendFn) {
  if (WARMUP > 0) {
    await runRequests(WARMUP, sendFn);
  }
  const start = nowNs();
  await runRequests(OPS, sendFn);
  const end = nowNs();
  const seconds = nsToSeconds(end - start);
  results.set(name, {
    ops: OPS,
    seconds,
    ops_per_sec: opsPerSec(OPS, seconds),
  });
}

afterAll(() => {
  const summary = {
    env: ENV_LABEL,
    ops: OPS,
    warmup: WARMUP,
    results: {},
  };

  for (const [name, data] of results.entries()) {
    summary.results[name] = data;
  }

  console.log('[throughput] ' + JSON.stringify(summary));
});

test('(0 pts) throughput characterization', async () => {
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
