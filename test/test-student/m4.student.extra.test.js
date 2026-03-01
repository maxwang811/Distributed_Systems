/*
    In this file, add your own test case that will confirm your correct implementation of the extra-credit functionality.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const fs = require('fs');
const path = require('path');
const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

const id = distribution.util.id;

jest.spyOn(process, 'exit').mockImplementation(() => {});

const n1 = {ip: '127.0.0.1', port: 9201};
const n2 = {ip: '127.0.0.1', port: 9202};
const n3 = {ip: '127.0.0.1', port: 9203};
const nodes = [n1, n2, n3];

const gid = `m4_student_extra_${Date.now()}`;
const group = {};

const hasError = (e) => e instanceof Error || (e && typeof e === 'object' && Object.keys(e).length > 0);

const settle = (invoke, allowError = false) => new Promise((resolve, reject) => {
  invoke((e, v) => {
    if (!allowError && hasError(e)) {
      reject(e);
      return;
    }
    resolve({e, v});
  });
});

function findNodeByNid(currentGroup, nid) {
  return Object.values(currentGroup).find((node) => id.getNID(node) === nid);
}

function findMovingKey() {
  const oldNids = Object.values(group).map((node) => id.getNID(node));
  const nextGroup = {...group};
  delete nextGroup[id.getSID(n3)];
  const nextNids = Object.values(nextGroup).map((node) => id.getNID(node));

  for (let i = 0; i < 200; i += 1) {
    const key = `${gid}_needs_reconf_${i}`;
    const kid = id.getID(key);
    const before = id.naiveHash(kid, oldNids);
    const after = id.naiveHash(kid, nextNids);
    if (before !== after) {
      return {
        key,
        afterNode: findNodeByNid(nextGroup, after),
      };
    }
  }

  throw new Error('Unable to find a key whose placement changes after node removal');
}

test('(15 pts) detect the need to reconfigure', (done) => {
  (async () => {
    const moving = findMovingKey();
    const value = {kind: 'store', route: 'needs-reconf'};

    await settle((callback) => distribution[gid].store.put(value, moving.key, callback));
    await settle((callback) => distribution.local.groups.rem(gid, id.getSID(n3), callback));
    await settle((callback) => distribution[gid].groups.rem(gid, id.getSID(n3), callback));

    await new Promise((resolve, reject) => {
      const deadline = Date.now() + 2000;
      const poll = () => {
        distribution[gid].store.get(moving.key, (e, v) => {
          if (!hasError(e) && JSON.stringify(v) === JSON.stringify(value)) {
            resolve();
            return;
          }
          if (Date.now() >= deadline) {
            reject(e || new Error('store did not detect and complete reconfiguration'));
            return;
          }
          setTimeout(poll, 100);
        });
      };
      poll();
    });

    const remoteValue = await settle((callback) => {
      distribution.local.comm.send(
          [{gid, key: moving.key}],
          {node: moving.afterNode, service: 'store', method: 'get'},
          callback,
      );
    });
    expect(remoteValue.v).toEqual(value);
  })().then(() => done(), done);
});

beforeAll((done) => {
  fs.rmSync(path.join(__dirname, '../../store'), {recursive: true, force: true});
  fs.mkdirSync(path.join(__dirname, '../../store'));

  const stopRemote = (index) => {
    if (index >= nodes.length) {
      startCluster();
      return;
    }
    distribution.local.comm.send([], {node: nodes[index], service: 'status', method: 'stop'}, () => {
      stopRemote(index + 1);
    });
  };

  const spawnRemote = (index) => {
    if (index >= nodes.length) {
      group[id.getSID(n1)] = n1;
      group[id.getSID(n2)] = n2;
      group[id.getSID(n3)] = n3;

      distribution.local.groups.put({gid, hash: id.naiveHash}, group, (e) => {
        done(e || undefined);
      });
      return;
    }
    distribution.local.status.spawn(nodes[index], (e) => {
      if (e) {
        done(e);
        return;
      }
      spawnRemote(index + 1);
    });
  };

  const startCluster = () => {
    distribution.node.start((e) => {
      if (e) {
        done(e);
        return;
      }
      spawnRemote(0);
    });
  };

  stopRemote(0);
});

afterAll((done) => {
  const stopRemote = (index) => {
    if (index >= nodes.length) {
      if (globalThis.distribution.node.server) {
        globalThis.distribution.node.server.close();
      }
      done();
      return;
    }
    distribution.local.comm.send([], {node: nodes[index], service: 'status', method: 'stop'}, () => {
      stopRemote(index + 1);
    });
  };

  stopRemote(0);
});
