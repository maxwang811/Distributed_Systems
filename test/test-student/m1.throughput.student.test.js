/*
  Throughput characterization for serialization/deserialization.
  Run locally and in cloud; set THROUGHPUT_ENV to label the environment.
*/

const distribution = require('../../distribution.js')();
const util = distribution.util;
require('../helpers/sync-guard');

const OPS = Number(process.env.THROUGHPUT_OPS || 20000);
const WARMUP = Number(process.env.THROUGHPUT_WARMUP || 2000);
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

const results = new Map();

function runWorkload(name, value) {
  for (let i = 0; i < WARMUP; i++) {
    const warm = util.serialize(value);
    util.deserialize(warm);
  }

  let start = nowNs();
  for (let i = 0; i < OPS; i++) {
    util.serialize(value);
  }
  let end = nowNs();
  const serializeSeconds = nsToSeconds(end - start);

  const serialized = util.serialize(value);
  start = nowNs();
  for (let i = 0; i < OPS; i++) {
    util.deserialize(serialized);
  }
  end = nowNs();
  const deserializeSeconds = nsToSeconds(end - start);

  start = nowNs();
  for (let i = 0; i < OPS; i++) {
    util.deserialize(util.serialize(value));
  }
  end = nowNs();
  const roundtripSeconds = nsToSeconds(end - start);

  results.set(name, {
    serialize: {
      ops: OPS,
      seconds: serializeSeconds,
      ops_per_sec: opsPerSec(OPS, serializeSeconds),
    },
    deserialize: {
      ops: OPS,
      seconds: deserializeSeconds,
      ops_per_sec: opsPerSec(OPS, deserializeSeconds),
    },
    roundtrip: {
      ops: OPS,
      seconds: roundtripSeconds,
      ops_per_sec: opsPerSec(OPS, roundtripSeconds),
    },
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

test('(0 pts) throughput characterization', () => {
  const base = {
    n: 27,
    s: 'alpha',
    b: false,
    nil: null,
    u: undefined,
    arr: [1, 'two', 3, true],
  };

  const fn = function f(a, b) {
    return a + b;
  };
  const functionWorkload = {
    label: 'fn',
    fn,
    arr: [fn, (x) => x * 2],
  };

  const complex = {
    title: 'complex',
    when: new Date('2020-01-02T03:04:05.000Z'),
    err: new TypeError('bad input'),
    list: [
      {k: 'v', nums: [1, 2, 3]},
      {k: 'w', nums: [4, 5, 6]},
    ],
    map: {a: {b: {c: [1, 'x', null]}}},
  };

  runWorkload('base', base);
  runWorkload('function', functionWorkload);
  runWorkload('complex', complex);

  expect(true).toEqual(true);
});
