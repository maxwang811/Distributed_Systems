/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const fs = require('fs');
const path = require('path');
const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

const id = distribution.util.id;

jest.spyOn(process, 'exit').mockImplementation(() => {});

const n1 = {ip: '127.0.0.1', port: 9101};
const n2 = {ip: '127.0.0.1', port: 9102};
const n3 = {ip: '127.0.0.1', port: 9103};
const n4 = {ip: '127.0.0.1', port: 9104};
const nodes = [n1, n2, n3, n4];

const gidPrefix = `m4_student_${Date.now()}`;
const consistentGid = `${gidPrefix}_consistent`;
const rendezvousGid = `${gidPrefix}_rendezvous`;
const reconfGid = `${gidPrefix}_reconf`;

const consistentGroup = {};
const rendezvousGroup = {};
const reconfGroup = {};

const hasError = (e) => e instanceof Error || (e && typeof e === 'object' && Object.keys(e).length > 0);

const settle = (invoke) => new Promise((resolve, reject) => {
  invoke((e, v) => {
    if (hasError(e)) {
      reject(e);
      return;
    }
    resolve(v);
  });
});

const putValue = (service, value, key) => settle((callback) => service.put(value, key, callback));
const getValue = (service, key) => settle((callback) => service.get(key, callback));
const removeNode = (gid, sid) => settle((callback) => distribution.local.groups.rem(gid, sid, callback));
const removeGroupNode = (gid, sid) => settle((callback) => distribution[gid].groups.rem(gid, sid, callback));

function findNodeByNid(group, nid) {
  return Object.values(group).find((node) => id.getNID(node) === nid);
}

function findMovingKey(hash, oldGroup, removedNode) {
  const oldNids = Object.values(oldGroup).map((node) => id.getNID(node));
  const nextGroup = {...oldGroup};
  delete nextGroup[id.getSID(removedNode)];
  const nextNids = Object.values(nextGroup).map((node) => id.getNID(node));

  for (let i = 0; i < 200; i += 1) {
    const key = `${gidPrefix}_moving_${i}`;
    const kid = id.getID(key);
    const before = hash(kid, oldNids);
    const after = hash(kid, nextNids);
    if (before !== after) {
      return {
        key,
        nextGroup,
        beforeNode: findNodeByNid(oldGroup, before),
        afterNode: findNodeByNid(nextGroup, after),
      };
    }
  }

  throw new Error('Unable to find a key that moves after reconfiguration');
}

test('(1 pts) student test', (done) => {
  try {
    const kid = id.getID('student-consistent-order');
    const forward = [n1, n2, n3].map((node) => id.getNID(node));
    const reversed = [...forward].reverse();

    expect(id.consistentHash(kid, forward)).toEqual(id.consistentHash(kid, reversed));
    done();
  } catch (error) {
    done(error);
  }
});


test('(1 pts) student test', (done) => {
  (async () => {
    const key = `${gidPrefix}_mem_consistent`;
    const value = {kind: 'mem', route: 'consistent'};

    await putValue(distribution[consistentGid].mem, value, key);

    const nodesInGroup = Object.values(consistentGroup);
    const nids = nodesInGroup.map((node) => id.getNID(node));
    const expectedNid = id.consistentHash(id.getID(key), nids);
    const expectedNode = findNodeByNid(consistentGroup, expectedNid);
    const remoteValue = await settle((callback) => {
      distribution.local.comm.send(
          [{gid: consistentGid, key}],
          {node: expectedNode, service: 'mem', method: 'get'},
          callback,
      );
    });

    expect(remoteValue).toEqual(value);
  })().then(() => done(), done);
});


test('(1 pts) student test', (done) => {
  (async () => {
    const key = `${gidPrefix}_store_rendezvous`;
    const value = {kind: 'store', route: 'rendezvous'};

    await putValue(distribution[rendezvousGid].store, value, key);

    const nodesInGroup = Object.values(rendezvousGroup);
    const nids = nodesInGroup.map((node) => id.getNID(node));
    const expectedNid = id.rendezvousHash(id.getID(key), nids);
    const expectedNode = findNodeByNid(rendezvousGroup, expectedNid);
    const remoteValue = await settle((callback) => {
      distribution.local.comm.send(
          [{gid: rendezvousGid, key}],
          {node: expectedNode, service: 'store', method: 'get'},
          callback,
      );
    });

    expect(remoteValue).toEqual(value);
  })().then(() => done(), done);
});

test('(1 pts) student test', (done) => {
  (async () => {
    const entries = [
      [`${gidPrefix}_scan_1`, {n: 1}],
      [`${gidPrefix}_scan_2`, {n: 2}],
      [`${gidPrefix}_scan_3`, {n: 3}],
    ];

    for (const [key, value] of entries) {
      await putValue(distribution[consistentGid].mem, value, key);
    }

    const keys = await getValue(distribution[consistentGid].mem, null);
    expect(Array.isArray(keys)).toBe(true);
    expect(keys).toEqual(expect.arrayContaining(entries.map(([key]) => key)));
  })().then(() => done(), done);
});

test('(1 pts) student test', (done) => {
  (async () => {
    const beforeGroup = {...reconfGroup};
    const moving = findMovingKey(id.naiveHash, beforeGroup, n3);
    const value = {kind: 'mem', route: 'reconf'};

    await putValue(distribution[reconfGid].mem, value, moving.key);
    await removeNode(reconfGid, id.getSID(n3));
    await removeGroupNode(reconfGid, id.getSID(n3));
    await settle((callback) => distribution[reconfGid].mem.reconf(beforeGroup, callback));

    const remoteValue = await settle((callback) => {
      distribution.local.comm.send(
          [{gid: reconfGid, key: moving.key}],
          {node: moving.afterNode, service: 'mem', method: 'get'},
          callback,
      );
    });

    expect(remoteValue).toEqual(value);
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
      createGroups();
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

  const createGroups = () => {
    consistentGroup[id.getSID(n1)] = n1;
    consistentGroup[id.getSID(n2)] = n2;
    consistentGroup[id.getSID(n3)] = n3;

    rendezvousGroup[id.getSID(n2)] = n2;
    rendezvousGroup[id.getSID(n3)] = n3;
    rendezvousGroup[id.getSID(n4)] = n4;

    reconfGroup[id.getSID(n1)] = n1;
    reconfGroup[id.getSID(n2)] = n2;
    reconfGroup[id.getSID(n3)] = n3;

    distribution.local.groups.put(
        {gid: consistentGid, hash: id.consistentHash},
        consistentGroup,
        (e) => {
          if (e) {
            done(e);
            return;
          }
          distribution.local.groups.put(
              {gid: rendezvousGid, hash: id.rendezvousHash},
              rendezvousGroup,
              (e2) => {
                if (e2) {
                  done(e2);
                  return;
                }
                distribution.local.groups.put(
                    {gid: reconfGid, hash: id.naiveHash},
                    reconfGroup,
                    (e3) => done(e3 || undefined),
                );
              },
          );
        },
    );
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
