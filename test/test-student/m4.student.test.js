/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/
require('../../distribution.js')();
const distribution = globalThis.distribution;
const id = distribution.util.id;

const n1 = {ip: '127.0.0.1', port: 9001};
const n2 = {ip: '127.0.0.1', port: 9002};
const n3 = {ip: '127.0.0.1', port: 9003};
const n4 = {ip: '127.0.0.1', port: 9004};
const n5 = {ip: '127.0.0.1', port: 9005};
const n6 = {ip: '127.0.0.1', port: 9006};


require('../helpers/sync-guard');

test('(1 pts) student test', (done) => {
  const obj = {first: 'A', last: 'Z'}
  distribution.local.mem.put(obj, 'key', (err, val) => {
    expect(err).toBeFalsy();
    expect(val).toEqual(obj);
    distribution.local.mem.get('key', (err, val) => {
      expect(err).toBeFalsy();
      expect(val).toEqual(obj);
      done();
    });
  });
});


test('(1 pts) student test', (done) => {
  const obj = {first: 'A', last: 'Z'}
  distribution.local.store.put(obj, 'key', (err, val) => {
    expect(err).toBeFalsy();
    expect(val).toEqual(obj);
    distribution.local.store.get('key', (err, val) => {
      expect(err).toBeFalsy();
      expect(val).toEqual(obj);
      done();
    });
  });
});


test('(1 pts) student test', (done) => {
  const user = {'first': 'Alan'};
  const myGroup = {};
  myGroup[id.getSID(n1)] = n1;
  myGroup[id.getSID(n2)] = n2;
  distribution.local.groups.put('browncs', myGroup, (err, val) => {
    expect(err).toBeFalsy();
    expect(val).toEqual(myGroup);
    distribution.all.mem.put(user, 'keyy', (e, v) => {
      expect(e).toBeFalsy();
      expect(v).toEqual(user);
      distribution.browncs.mem.get('keyy', (e, v) => {
        expect(e).toBeTruthy();
        done();
      })
    })
  })
});

test('(1 pts) student test', (done) => {
  const user = {'first': 'Alan'};
  const myGroup = {};
  myGroup[id.getSID(n1)] = n1;
  myGroup[id.getSID(n2)] = n2;
  distribution.local.groups.put('browncs', myGroup, (err, val) => {
    expect(err).toBeFalsy();
    expect(val).toEqual(myGroup);
    distribution.all.store.put(user, 'itemkey', (e, v) => {
      expect(e).toBeFalsy();
      expect(v).toEqual(user);
      distribution.browncs.store.get('itemkey', (e, v) => {
        expect(v).toBeFalsy();
        expect(e).toBeTruthy();
        done();
      })
    })
  })
});

test('(1 pts) student test', (done) => {
  const obj = {first: 'A', last: 'Z'}
  distribution.local.mem.put(obj, 'key', (err, val) => {
    expect(err).toBeFalsy();
    expect(val).toEqual(obj);
    distribution.local.mem.del('key', (err, val) => {
      expect(err).toBeFalsy();
      expect(val).toEqual(obj);
      distribution.local.mem.get('key', (err, val) => {
        expect(err).toBeTruthy();
        done();
      })
    });
  });
});

beforeAll((done) => {
  // First, stop the nodes if they are running
  const remote = {service: 'status', method: 'stop'};

  remote.node = n1;
  distribution.local.comm.send([], remote, (e, v) => {
    remote.node = n2;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n3;
      distribution.local.comm.send([], remote, (e, v) => {
        remote.node = n4;
        distribution.local.comm.send([], remote, (e, v) => {
          remote.node = n5;
          distribution.local.comm.send([], remote, (e, v) => {
            remote.node = n6;
            distribution.local.comm.send([], remote, (e, v) => {
              startNodes();
            });
          });
        });
      });
    });
  });

  const startNodes = () => {
    // Now, start the nodes listening node
    distribution.node.start(() => {
      // Start the nodes
      distribution.local.status.spawn(n1, (e, v) => {
        distribution.local.status.spawn(n2, (e, v) => {
          distribution.local.status.spawn(n3, (e, v) => {
            distribution.local.status.spawn(n4, (e, v) => {
              distribution.local.status.spawn(n5, (e, v) => {
                distribution.local.status.spawn(n6, (e, v) => {
                  done();
                });
              });
            });
          });
        });
      });
    });
  };
});


afterAll((done) => {
  const remote = {service: 'status', method: 'stop'};
  remote.node = n1;
  distribution.local.comm.send([], remote, (e, v) => {
    remote.node = n2;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n3;
      distribution.local.comm.send([], remote, (e, v) => {
        remote.node = n4;
        distribution.local.comm.send([], remote, (e, v) => {
          remote.node = n5;
          distribution.local.comm.send([], remote, (e, v) => {
            remote.node = n6;
            distribution.local.comm.send([], remote, (e, v) => {
              if (globalThis.distribution.node.server) {
                globalThis.distribution.node.server.close();
              }
              done();
            });
          });
        });
      });
    });
  });
});
