require('../../distribution.js')();
const distribution = globalThis.distribution;
const id = distribution.util.id;

const n1 = {ip: '127.0.0.1', port: 8000};
const n2 = {ip: '127.0.0.1', port: 8001};
const n3 = {ip: '127.0.0.1', port: 8002};
const allNodes = [n1, n2, n3];


test('(5 pts) (scenario) create group', (done) => {
/*
    Create a group with the nodes n1, n2, and n3.
    Then, fetch their NIDs using the distributed status service.
*/

  const groupA = {};
  groupA[id.getSID(n1)] = n1;
  groupA[id.getSID(n2)] = n2;
  groupA[id.getSID(n3)] = n3;

  const nids = Object.values(allNodes).map((node) => id.getNID(node));

  // Use distribution.local.groups.put to add groupA to the local node
  // Note: The groupA.status.get call should be inside the put method's callback.
  distribution.local.groups.put({gid: 'groupA'}, groupA, (e) => {
    if (e) {
      done(e);
      return;
    }
    distribution.groupA.status.get('nid', (e2, v) => {
      try {
        expect(e2).toEqual({});
        expect(v).toEqual(expect.arrayContaining(nids));
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(5 pts) (scenario) dynamic group membership', (done) => {
/*
  Dynamically add a node (n3) to groupB after the group is initially created
  with nodes n1 and n2. Validate that the distributed status service reflects
  the updated group membership on all nodes.
*/
  const groupB = {};
  // Pick some initial nodes...
  const initialNodes = [n1, n2];
  // Pick the final set of nodes...
  const allNodesAfterAdd = [n1, n2, n3];

  // Create groupB...
  initialNodes.forEach((node) => {
    groupB[id.getSID(node)] = node;
  });

  const config = {gid: 'groupB'};

  // Create the group with initial nodes
  distribution.local.groups.put(config, groupB, (e, v) => {
    if (e) {
      done(e);
      return;
    }
    distribution.groupB.groups.put(config, groupB, (e2) => {
      if (e2 && Object.keys(e2).length > 0) {
        done(new Error('groupB setup failed on one or more nodes'));
        return;
      }
    // Add a new node dynamically to the group
      distribution.groupB.groups.add('groupB', n3, (e3) => {
        if (e3 && Object.keys(e3).length > 0) {
          done(new Error('groupB add failed on one or more nodes'));
          return;
        }
        distribution.groupB.groups.get('groupB', (e4, v2) => {
          try {
            expect(e4).toEqual({});
            Object.values(v2).forEach((groupView) => {
              expect(Object.values(groupView)).toEqual(expect.arrayContaining(allNodesAfterAdd));
            });
            done();
          } catch (error) {
            done(error);
          }
        });
      });
    });
  });
});


test('(5 pts) (scenario) group relativity', (done) => {
/*
    Make it so that node n1 sees group groupC as containing only n2.
    while node n2 sees group groupC as containing n1 and n2.
*/
  const groupC = {};
  // Create groupC in an appropriate way...
  groupC[id.getSID(n1)] = n1;
  groupC[id.getSID(n2)] = n2;


  const config = {gid: 'groupC'};

  distribution.local.groups.put(config, groupC, (e, v) => {
    if (e) {
      done(e);
      return;
    }
    distribution.groupC.groups.put(config, groupC, (e2, v2) => {
      if (e2 && Object.keys(e2).length > 0) {
        done(new Error('groupC propagation failed'));
        return;
      }
      // Modify the local 'view' of the group...
      const n1OnlySeesN2 = {[id.getSID(n2)]: n2};
      const remote = {node: n1, service: 'groups', method: 'put'};
      distribution.local.comm.send([config, n1OnlySeesN2], remote, (e3) => {
        if (e3) {
          done(e3);
          return;
        }
        distribution.groupC.groups.get('groupC', (e4, v3) => {
          const n1View = v3[id.getSID(n1)];
          const n2View = v3[id.getSID(n2)];
          try {
            expect(e4).toEqual({});
            expect(Object.keys(n2View)).toEqual(expect.arrayContaining(
                [id.getSID(n1), id.getSID(n2)],
            ));
            expect(Object.keys(n1View)).toEqual(expect.arrayContaining(
                [id.getSID(n2)],
            ));
            done();
          } catch (error) {
            done(error);
          }
        });
      });
    });
  });
});

test('(5 pts) (scenario) use the gossip service', (done) => {
/*
    First, create group groupD a number of nodes of your choosing.
    Then, using the groups.put method,  a new group is created called 'newgroup'.
    Add a new node to 'newgroup' using the gossip service to propagate the new group membership to all (or a subset of) nodes in groupD.

    Experiment with:
    1. The number of nodes in groupD
    2. The subset function used in the gossip service
    3. The expected number of nodes receiving the new group membership
    4. The time delay between adding the new node to 'newgroup' and checking the group membership in groupD
*/

  // Create groupD in an appropriate way...
  const groupD = {};
  allNodes.forEach((node) => {
    groupD[id.getSID(node)] = node;
  });

  // How many nodes are expected to receive the new group membership?
  const nExpected = 0;

  // Experiment with the subset function used in the gossip service...
  const config = {gid: 'groupD', subset: (lst) => Math.max(1, Math.ceil(Math.log2(lst.length || 1)))};

  // Instantiated groupD
  distribution.local.groups.put(config, groupD, (e, v) => {
    if (e) {
      done(e);
      return;
    }
    distribution.groupD.groups.put(config, groupD, (e, v) => {
      if (e && Object.keys(e).length > 0) {
        done(new Error('groupD propagation failed'));
        return;
      }
      // Created group 'newgroup' (this will be the group that we add a new node to)
      distribution.groupD.groups.put('newgroup', {}, (e, v) => {
        if (e && Object.keys(e).length > 0) {
          done(new Error('newgroup creation failed'));
          return;
        }
        const newNode = {ip: '127.0.0.1', port: 4444};
        const message = [
          'newgroup',
          newNode,
        ];
        const remote = {service: 'groups', method: 'add'};
        // Adding a new node to 'newgroup' using the gossip service
        distribution.groupD.gossip.send(message, remote, (e, v) => {
          if (!(e instanceof Error)) {
            done(new Error('Expected gossip.send to fail without E2/E3 implementation'));
            return;
          }
          // Experiment with the time delay between adding the new node to 'newgroup' and checking the group membership in groupD...
          const delay = 20;
          setTimeout(() => {
            distribution.groupD.groups.get('newgroup', (e, v) => {
              let count = 0;
              for (const k in v) {
                if (Object.keys(v[k]).length > 0) {
                  count++;
                }
              }
              /* Gossip only provides weak guarantees */
              try {
                expect(count).toBeGreaterThanOrEqual(nExpected);
                expect(e).toEqual({});
                done();
              } catch (error) {
                done(error);
              }
            });
          }, delay);
        });
      });
    });
  });
});


/*
    This is the setup for the test scenario.
    Do not modify the code below.
*/

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
    if (step == allNodes.length) {
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
