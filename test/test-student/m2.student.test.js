/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

const local = distribution.local;
const wire = distribution.util.wire;

test('(1 pts) student test', (done) => {
  // Fill out this test case...
  local.status.get('nid', (err, nid) => {
    expect(err).toBeFalsy();
    expect(typeof nid).toBe('string');
    expect(nid.length).toBe(64);

    local.status.get('sid', (err, sid) => {
      expect(err).toBeFalsy();
      expect(typeof sid).toBe('string');
      expect(sid.length).toBe(5);
      expect(sid).toBe(nid.slice(0, 5));
      done();
    });
  });
});


test('(1 pts) student test', (done) => {
  // Fill out this test case...
  local.routes.get('status', (err, statusRoutes) => {
    expect(err).toBeFalsy();
    expect(statusRoutes).toBeDefined();
    expect(typeof statusRoutes.get).toBe('function');

    local.routes.get('comm', (err, commRoutes) => {
      expect(err).toBeFalsy();
      expect(commRoutes).toBeDefined();
      expect(typeof commRoutes.send).toBe('function');
      done();
    });
  });
});


test('(1 pts) student test', (done) => {
  // Fill out this test case...
  // service: object, configuration: string, callback
  const service = {ping: (cb) => cb(null, 'pong')};
  local.routes.put(service, 'f', (err, res) => {
    expect(err).toBeFalsy();
    expect(res).toBe('f');
    local.routes.get('f', (err, fRoutes) => {
      expect(err).toBeFalsy();
      expect(typeof fRoutes.ping).toBe('function');
    });

    const anotherService = {add: (a, b, cb) => cb(a+b)};
    local.routes.put(anotherService, 'ABC', (err, res) => {
      expect(err).toBeFalsy();
      expect(res).toBe('ABC');
      return done();
    });
  });
});

test('(1 pts) student test', (done) => {
  local.routes.rem('serviceWhichDoesNotExist', (err, res) => {
    expect(err).toBeTruthy();

    const service = {'add': (a, b, cb) => cb(a + b)};
    local.routes.put(service, 'testServ', (e, r) => {
      local.routes.rem('testServ', (err, res) => {
        expect(err).toBeFalsy();
        expect(res).toBe(service);
        return done();
      });
    });
  });
});

test('(1 pts) student test', (done) => {
  const remote = {node: distribution.node.config, service: 'status', method: 'get'};

  local.comm.send(['nid'],
      remote, (err, res) => {
        expect(err).toBeFalsy();
        expect(res).toEqual(distribution.util.id.getNID(distribution.node.config));

        local.comm.send(['invalid'],
            remote, (err, res) => {
              expect(err).toBeTruthy();
              return done();
            });
      });
});

test('(1 pts) student test', (done) => {
  const config = distribution.node.config;
  const remote = {node: config, service: 'status', method: 'get'};
  local.comm.send(['sid'], remote, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(distribution.util.id.getSID(config));
      done();
    } catch (error) {
      done(error);
    }
  });
});

const SAMPLES = 1000;

function avg(values) {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((acc, val) => acc + val, 0);
  return total / values.length;
}

async function sendOne(sendFunc) {
  return new Promise((resolve, reject) => {
    sendFunc((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

const latencyResults = new Map();
const throughputResults = new Map();

async function runWorkloadLatency(name, sendFunc) {
  const samples = []
  for (let i = 0; i < SAMPLES; i++) {
    const now = performance.now();
    await sendOne(sendFunc);
    const time = performance.now() - now;
    samples.push(time);
  }
  latencyResults.set(name, avg(samples).toFixed(3));
}

async function runWorkloadThroughput(name, sendFunc) {
  const now = performance.now();
  for (let i = 0; i < SAMPLES; i++) {
    await sendOne(sendFunc);
  }
  const time = performance.now() - now;
  const throughput = (SAMPLES / (time / 1000)).toFixed(3);
  throughputResults.set(name, throughput);
}

test('(0 pt) latency', async () => {
  const node = distribution.node.config;
  const remote = {node: node, service: 'status', method: 'get'};
  const echo = (value) => value;
  const echoRPC = wire.createRPC(wire.toAsync(echo));

  await runWorkloadLatency('comm.send', (cb) => {
    local.comm.send(['sid'], remote, cb);
  });

  await runWorkloadLatency('rpc', (cb) => {
    echoRPC('ping', cb);
  });

  await runWorkloadThroughput('comm.send', (cb) => {
    local.comm.send(['sid'], remote, cb);
  });

  await runWorkloadThroughput('rpc', (cb) => {
    echoRPC('ping', cb);
  });
})

// get "listen EADDRINUSE: address already in use 127.0.0.1:1234" when uncommenting
beforeAll((done) => {
  distribution.node.start((e) => {
    done(e || undefined);
  });
});

afterAll((done) => {
  for (const [name, latency] of throughputResults) {
    console.log(`${name} had throughput ${latency} reqs/sec`);
  }
  for (const [name, latency] of latencyResults) {
    console.log(`${name} had latency ${latency} ms/req`);
  }

  done()
})

afterAll((done) => {
  if (globalThis.distribution.node.server) {
    globalThis.distribution.node.server.close();
  }
  done();
});
