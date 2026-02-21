/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');
const id = distribution.util.id;
const local = distribution.local;
const self = distribution.node.config;

const gid = `m3_student_${Date.now()}`;
const gid2 = `${gid}_rpc`;

test('(1 pts) student test', (done) => {
  const group = {
    [id.getSID(self)]: self,
  };

  local.groups.put({gid}, group, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(group);
      expect(globalThis.distribution[gid]).toBeDefined();
      expect(typeof globalThis.distribution[gid].status.get).toEqual('function');
      done();
    } catch (error) {
      done(error);
    }
  });
});


test('(1 pts) student test', (done) => {
  local.routes.get({service: 'status', gid}, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toBe(globalThis.distribution[gid].status);
      done();
    } catch (error) {
      done(error);
    }
  });
});


test('(1 pts) student test', (done) => {
  const remote = {node: self, service: 'status', method: 'get'};
  local.comm.send(['sid'], remote, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(id.getSID(self));
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) student test', (done) => {
  const group = {
    [id.getSID(self)]: self,
  };
  local.groups.put({gid: gid2}, group, (e) => {
    if (e) {
      done(e);
      return;
    }
    const remote = {node: self, gid: gid2, service: 'status', method: 'get'};
    local.comm.send(['nid'], remote, (e2, v) => {
      try {
        expect(e2).toEqual({});
        expect(v).toEqual([id.getNID(self)]);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(1 pts) student test', (done) => {
  globalThis.distribution[gid2].comm.send([], {service: 'status', method: 'bad'}, (e, v) => {
    try {
      const sid = id.getSID(self);
      expect(e[sid]).toBeInstanceOf(Error);
      expect(v).toEqual({});
      done();
    } catch (error) {
      done(error);
    }
  });
});

afterAll((done) => {
  local.groups.del(gid, () => {
    local.groups.del(gid2, () => {
      done();
    });
  });
});
