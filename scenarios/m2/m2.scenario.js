require('../../distribution.js')();
const distribution = globalThis.distribution;

test('(2 pts) (scenario) simple callback practice', () => {
  const results = [];

  function add(a, b, callback) {
    const result = a + b;
    callback(result);
  }

  function storeResults(result) {
    results.push(result);
  }

  add(1, 2, storeResults);
  add(2, 3, storeResults);
  add(3, 4, storeResults);

  expect(results).toEqual([3, 5, 7]);
});

test('(2 pts) (scenario) collect errors and successful results', (done) => {
  const appleDeliveryService = (callback) => {
    setTimeout(() => callback(null, 'good apples'), 10);
  };

  const pineappleDeliveryService = (callback) => {
    setTimeout(() => callback(new Error('bad pineapples')), 5);
  };

  const bananaDeliveryService = (callback) => {
    setTimeout(() => callback(null, 'good bananas'), 15);
  };

  const peachDeliveryService = (callback) => {
    setTimeout(() => callback(null, 'good peaches'), 1);
  };

  const mangoDeliveryService = (callback) => {
    setTimeout(() => callback(new Error('bad mangoes')), 20);
  };

  const services = [
    appleDeliveryService, pineappleDeliveryService, bananaDeliveryService,
    peachDeliveryService, mangoDeliveryService,
  ];

  const doneAndAssert = (es, vs) => {
    try {
      expect(vs.length).toEqual(3);
      expect(vs).toContain('good apples');
      expect(vs).toContain('good bananas');
      expect(vs).toContain('good peaches');
      for (const e of es) {
        expect(e instanceof Error).toEqual(true);
      }
      const messages = es.map((e) => e.message);
      expect(messages.length).toEqual(2);
      expect(messages).toContain('bad pineapples');
      expect(messages).toContain('bad mangoes');
      done();
    } catch (e) {
      done(e);
    }
  };

  const vs = [];
  const es = [];
  let expecting = services.length;
  for (const service of services) {
    service((e, v) => {
      if (e) {
        es.push(e);
      } else {
        vs.push(v);
      }
      expecting -= 1;
      if (expecting === 0) {
        doneAndAssert(es, vs);
      }
    });
  }
});

test('(5 pts) (scenario) use rpc', (done) => {
  let n = 0;
  const addOne = () => {
    return ++n;
  };

  const node = {ip: '127.0.0.1', port: 9009};

  let addOneRPC = distribution.util.wire.createRPC(
      distribution.util.wire.toAsync(addOne));

  const rpcService = {
    addOne: addOneRPC,
  };

  distribution.node.start(() => {
    function cleanup(callback) {
      if (globalThis.distribution.node.server) {
        globalThis.distribution.node.server.close();
      }
      distribution.local.comm.send([],
          {node: node, service: 'status', method: 'stop'},
          callback);
    }

    distribution.local.status.spawn(node, (e, v) => {
      distribution.local.comm.send([rpcService, 'addOneService'],
          {node: node, service: 'routes', method: 'put'}, (e, v) => {
            distribution.local.comm.send([],
                {node: node, service: 'addOneService', method: 'addOne'}, (e, v) => {
                  distribution.local.comm.send([],
                      {node: node, service: 'addOneService', method: 'addOne'}, (e, v) => {
                        distribution.local.comm.send([],
                            {node: node, service: 'addOneService', method: 'addOne'}, (e, v) => {
                              try {
                                expect(e).toBeFalsy();
                                expect(v).toEqual(3);
                                expect(n).toEqual(3);
                                cleanup(done);
                              } catch (error) {
                                cleanup(() => {
                                  done(error);
                                });
                              }
                            });
                      });
                });
          });
    });
  });
});
