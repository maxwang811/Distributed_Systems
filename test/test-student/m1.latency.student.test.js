/*
  Latency characterization for serialization/deserialization.
  Run locally and in cloud; set LATENCY_ENV to label the environment.
*/

const distribution = require('../../distribution.js')();
const util = distribution.util;
require('../helpers/sync-guard');

const SAMPLES = Number(process.env.LATENCY_SAMPLES || 200);
const WARMUP = Number(process.env.LATENCY_WARMUP || 20);
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

const results = new Map();

function runWorkload(name, value) {
  for (let i = 0; i < WARMUP; i++) {
    const warm = util.serialize(value);
    util.deserialize(warm);
  }

  const serializeSamples = [];
  const deserializeSamples = [];

  for (let i = 0; i < SAMPLES; i++) {
    let start = nowNs();
    const serialized = util.serialize(value);
    let end = nowNs();
    serializeSamples.push(nsToMs(end - start));

    start = nowNs();
    util.deserialize(serialized);
    end = nowNs();
    deserializeSamples.push(nsToMs(end - start));
  }

  results.set(name, {serializeSamples, deserializeSamples});
}

afterAll(() => {
  const summary = {
    env: ENV_LABEL,
    samples: SAMPLES,
    warmup: WARMUP,
    results: {},
  };

  for (const [name, data] of results.entries()) {
    const serializeAvg = avg(data.serializeSamples);
    const deserializeAvg = avg(data.deserializeSamples);
    summary.results[name] = {
      serialize_avg_ms: serializeAvg,
      deserialize_avg_ms: deserializeAvg,
      avg_latency_ms: serializeAvg + deserializeAvg,
    };
  }

  console.log('[latency] ' + JSON.stringify(summary));
});

test('(0 pts) latency characterization', () => {
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
