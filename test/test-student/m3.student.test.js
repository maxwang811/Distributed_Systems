/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

const n1 = {ip: '127.0.0.1', port: 8000};
const n2 = {ip: '127.0.0.1', port: 8001};
const n3 = {ip: '127.0.0.1', port: 8002};
const allNodes = [n1, n2, n3];
const id = distribution.util.id;

test('(1 pts) student test', (done) => {
  const group = {n1, n2};
  distribution.local.groups.put('mygroup', group, (err, val) => {
    expect(err).toBeFalsy();
    expect(val).toEqual(group);
    distribution.local.groups.get('mygroup', (err, val) => {
      expect(err).toBeFalsy();
      expect(val).toEqual(group);
      distribution.local.groups.get('non-existent-group', (err, val) => {
        expect(err).toBeTruthy();
        done();
      })
    })
  })
});


test('(1 pts) student test', (done) => {
  const remote = {service: 'status', method: 'get'};
  const localSID = distribution.util.id.getSID(distribution.node.config);
  const localNID = distribution.util.id.getNID(distribution.node.config);

  distribution.all.comm.send(['nid'], remote, (err, val) => {
    expect(err).toEqual({});
    expect(Object.keys(val).length).toEqual(allNodes.length + 1);
    expect(val[localSID]).toEqual(localNID);
    done();
  });
});


test('(1 pts) student test', (done) => {
  const group = {n1, n2};
  distribution.local.groups.put('mygroup', group, (err, val) => {
    expect(err).toBeFalsy();
    expect(val).toEqual(group);
    distribution['mygroup'].status.get('heapTotal', (err, val) => {
      expect(err).toEqual({});
      expect(typeof val).toEqual('number');
      done();
    })
  })
});

test('(1 pts) student test', (done) => {
  const group = {n1, n2};
  const service = {'ping': () => console.log('pong')};
  distribution.local.groups.put('mygroup', group, (err, val) => {
    expect(err).toBeFalsy();
    expect(val).toEqual(group);
    distribution['mygroup'].routes.put(service, 'ping-pong', (err, val) => {
      expect(err).toEqual({});
      expect(typeof val).toEqual('object');
      done();
    })
  });
});

test('(1 pts) student test', (done) => {
  // Fill out this test case...
  const group = {n1, n2};
  distribution.local.groups.put('mygroup', group, (err, val) => {
    expect(err).toBeFalsy();
    expect(val).toEqual(group);
    distribution['mygroup'].status.get('nid', (err, val) => {
      expect(err).toEqual({});
      expect(Object.values(val)).toEqual([id.getNID(n1), id.getNID(n2)]);
      done();
    })
  })
});

test('(0 pts) latency & throughput of nodes scenario', (done) => {
  const cb = () => {console.log('hi')};

  const samples = [];
  for (let i = 8500; i < 8505; i++) {
    const config = {ip: '127.0.0.1', port: i, onStart: cb};
    const start = performance.now();
    const node = require('../../distribution.js')(config);
    const time = performance.now() - start;
    samples.push(time);
  }

  console.log(`latency for creating additional nodes: ${avg(samples).toFixed(3)} ms per node`);

  const now = performance.now();
  const numNodes = 5;
  for (let i = 8505; i < 8505 + numNodes; i++) {
    const config = {ip: '127.0.0.1', port: i, onStart: cb};
    const node = require('../../distribution.js')(config);
  }
  const timeSecs = (performance.now() - now) / 1000;
  console.log(`throughput for creating additional nodes: ${(numNodes / timeSecs).toFixed(3)} nodes/sec`);
  done();
})

function avg(values) {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((acc, val) => acc + val, 0);
  return total / values.length;
}

function startAllNodes(callback) {
  distribution.node.start(() => {
    function startStep(step) {
      if (step >= allNodes.length) {
        callback();
        return;
      }

      distribution.local.status.spawn(allNodes[step], (e, v) => {
        if (e) {
          return callback(e);
        }
        startStep(step + 1);
      });
    }
    startStep(0);
  });
}

function stopAllNodes(callback) {
    const remote = {method: 'stop', service: 'status'};

    function stopStep(step) {
        if (step === allNodes.length) {
            callback();
            return;
        }

        if (step < allNodes.length) {
            remote.node = allNodes[step];
            distribution.local.comm.send([], remote, (e, v) => {
                stopStep(step + 1);
            });
        }
    }

    if (globalThis.distribution.node.server) {
        globalThis.distribution.node.server.close();
    }
    stopStep(0);
}

beforeAll((done) => {
    // Stop any leftover nodes
    stopAllNodes(() => {
        startAllNodes(done);
    });
});

afterAll((done) => {
    stopAllNodes(done);
});
