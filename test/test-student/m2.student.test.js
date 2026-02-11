const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');
const local = distribution.local;
const id = distribution.util.id;
const config = distribution.node.config;

test('(1 pts) student test', (done) => {
  local.status.get('sid', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(id.getSID(config));
      done();
    } catch (error) {
      done(error);
    }
  });
});


test('(1 pts) student test', (done) => {
  local.status.get('does-not-exist', (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});


test('(1 pts) student test', (done) => {
  local.routes.get('status', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toBe(local.status);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) student test', (done) => {
  local.routes.get('not-a-route', (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) student test', (done) => {
  const echoService = {
    echo: (value) => value,
  };
  local.routes.put(echoService, 'echo', (e) => {
    if (e) {
      done(e);
      return;
    }
    local.routes.get('echo', (e2, v) => {
      try {
        expect(e2).toBeFalsy();
        expect(v.echo('ping')).toEqual('ping');
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(1 pts) student test', (done) => {
  const tempService = {
    hello: () => 'world',
  };
  local.routes.put(tempService, 'temp', (e) => {
    if (e) {
      done(e);
      return;
    }
    local.routes.rem('temp', (e2, v) => {
      try {
        expect(e2).toBeFalsy();
        expect(v).toBe(tempService);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(1 pts) student test', (done) => {
  const tempService = {
    hello: () => 'world',
  };
  local.routes.put(tempService, 'temp-remove', (e) => {
    if (e) {
      done(e);
      return;
    }
    local.routes.rem('temp-remove', (e2) => {
      if (e2) {
        done(e2);
        return;
      }
      local.routes.get('temp-remove', (e3, v) => {
        try {
          expect(e3).toBeInstanceOf(Error);
          expect(v).toBeFalsy();
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('(1 pts) student test', (done) => {
  const remote = {node: config, service: 'status', method: 'get'};
  local.comm.send(['nid'], remote, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(id.getNID(config));
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) student test', (done) => {
  const remote = {node: config, service: 'status', method: 'nope'};
  local.comm.send([], remote, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) student test', (done) => {
  const remote = {node: config, service: 'status', method: 'get'};
  local.comm.send(['sid'], remote, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(id.getSID(config));
      done();
    } catch (error) {
      done(error);
    }
  });
});

beforeAll((done) => {
  distribution.node.start((e) => {
    done(e || undefined);
  });
});

afterAll((done) => {
  if (globalThis.distribution.node.server) {
    globalThis.distribution.node.server.close();
  }
  done();
});
