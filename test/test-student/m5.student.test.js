/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

const id = distribution.util.id;

const n1 = {ip: '127.0.0.1', port: 7110};
const n2 = {ip: '127.0.0.1', port: 7111};
const n3 = {ip: '127.0.0.1', port: 7112};

const test1Group = {};
const test2Group = {};
const test3Group = {};
const test4Group = {};
const test5Group = {};

test('(1 pts) student test', (done) => {
  // Fill out this test case...
    const mapper = (key, value) => {
        const words = value.split(/(\s+)/).filter((e) => e !== ' ');
        const out = {};
        out[words[1]] = parseInt(words[3]);
        return out;
    };

    const reducer = (key, values) => {
        const out = {};
        out[key] = values.reduce((a, b) => Math.max(a, b), -Infinity);
        return out;
    };

    const dataset = [
        {'000': '006701199099999 1950 0515070049999999N9 +0000 1+9999'},
        {'106': '004301199099999 2017 0515120049999999N9 +0022 1+9999'},
        {'212': '004301199099999 1950 0515180049999999N9 -0011 1+9999'},
        {'318': '004301265099999 1949 0324120040500001N9 +0111 1+9999'},
        {'424': '004301265099999 1949 0324180040500001N9 +0780 1+9999'},
    ];

    const expected = [{'2017': 22}, {'1949': 780}, {'1950': 0}];

    const doMapReduce = () => {
        distribution.test1.store.get(null, (e, v) => {
            try {
                expect(v.length).toEqual(dataset.length);
            } catch (e) {
                done(e);
            }

            distribution.test1.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
                try {
                    expect(v).toEqual(expect.arrayContaining(expected));
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    };

    let cntr = 0;
    // Send the dataset to the cluster
    dataset.forEach((o) => {
        const key = Object.keys(o)[0];
        const value = o[key];
        distribution.test1.store.put(value, key, (e, v) => {
            cntr++;
            // Once the dataset is in place, run the map reduce
            if (cntr === dataset.length) {
                doMapReduce();
            }
        });
    });
});


test('(1 pts) student test', (done) => {
    const mapper = (key, value) => {
        const out = [];
        for (const word of value.split(' ')) {
            out.push({[word]: 1});
        }
        return out;
    };

    const reducer = (key, values) => {
        // key: word, values: array of 1s for each time it was seen
        return {[key] : values.reduce((acc, val) => acc + val, 0)};
    };

    const dataset = [
        {'asdqwd': 'The the quick brown fox'},
        {'da': 'fox brown want'}
    ];

    const expected = [{'The': 1}, {'the': 1}, {'quick': 1}, {'brown': 2}, {'fox': 2}, {'want': 1}];

    const doMapReduce = () => {
        distribution.test2.store.get(null, (e, v) => {
            try {
                expect(v.length).toEqual(dataset.length);
            } catch (e) {
                done(e);
            }

            distribution.test2.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, val) => {
                try {
                    expect(val).toEqual(expect.arrayContaining(expected));
                    expect(val.length).toBe(expected.length);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    };

    let cntr = 0;

    // Send the dataset to the cluster
    dataset.forEach((o) => {
        const key = Object.keys(o)[0];
        const value = o[key];
        distribution.test2.store.put(value, key, (e, v) => {
            cntr++;
            // Once the dataset is in place, run the map reduce
            if (cntr === dataset.length) {
                doMapReduce();
            }
        });
    });
});


test('(1 pts) student test', (done) => {
    const mapper = (key, value) => {
        const words = value.split(/\s+/).filter(Boolean);
        const out = [];
        const docLen = words.length;
        const counts = {};

        // Initialize word counts
        for (const word of words) {
            if (counts[word] === undefined) {
                counts[word] = 1;
            } else {
                counts[word] += 1;
            }
        }

        // Add objects to output array
        for (const [word, count] of Object.entries(counts)) {
            const temp = {[word] : {'doc': key, 'count': count, 'docLen': docLen}};
            out.push(temp);
        }

        return out;
    };

    // Reduce function: calculate TF-IDF for each word
    const reducer = (key, values) => {
        const totalDocs = 3;
        const out = {};
        for (const obj of values) {
            // obj: {doc, count, docLen}
            const doc = obj['doc'];
            const tf = obj['count'] / obj['docLen'];
            const idf = Math.log10(totalDocs / values.length);

            out[doc] = Number((tf * idf).toFixed(2));
        }
        return {[key]: out};
    };

    const dataset = [
        {'doc1': 'machine learning is amazing'},
        {'doc2': 'deep learning powers amazing systems'},
        {'doc3': 'machine learning and deep learning are related'},
    ];

    const expected = [{'is': {'doc1': 0.12}},
        {'deep': {'doc2': 0.04, 'doc3': 0.03}},
        {'systems': {'doc2': 0.1}},
        {'learning': {'doc1': 0, 'doc2': 0, 'doc3': 0}},
        {'amazing': {'doc1': 0.04, 'doc2': 0.04}},
        {'machine': {'doc1': 0.04, 'doc3': 0.03}},
        {'are': {'doc3': 0.07}}, {'powers': {'doc2': 0.1}},
        {'and': {'doc3': 0.07}}, {'related': {'doc3': 0.07}}];

    const doMapReduce = () => {
        distribution.test3.store.get(null, (e, v) => {
            try {
                expect(v.length).toEqual(dataset.length);
            } catch (e) {
                done(e);
            }

            distribution.test3.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
                try {
                    expect(v).toEqual(expect.arrayContaining(expected));
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    };

    let cntr = 0;

    // Send the dataset to the cluster
    dataset.forEach((o) => {
        const key = Object.keys(o)[0];
        const value = o[key];
        distribution.test3.store.put(value, key, (e, v) => {
            cntr++;
            // Once the dataset is in place, run the map reduce
            if (cntr === dataset.length) {
                doMapReduce();
            }
        });
    });
});

test('(1 pts) student test', (done) => {
    const mapper = (key, value) => {
        const out = [];
        for (const word of value.split(' ')) {
            out.push({[word]: 1});
        }
        return out;
    };

    const reducer = (key, values) => {
        // key: word, values: array of 1s for each time it was seen
        return {[key] : values.reduce((acc, val) => acc + val, 0)};
    };

    const dataset = [
        {'d1': 'word a'},
        {'d2': 'a b c'}
    ];

    const expected = [{'word': 1}, {'a': 2}, {'b': 1}, {'c': 1}];

    const doMapReduce = () => {
        distribution.test4.store.get(null, (e, v) => {
            try {
                expect(v.length).toEqual(dataset.length);
            } catch (e) {
                done(e);
            }

            distribution.test4.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, val) => {
                try {
                    expect(val).toEqual(expect.arrayContaining(expected));
                    expect(val.length).toBe(expected.length);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    };

    let cntr = 0;

    // Send the dataset to the cluster
    dataset.forEach((o) => {
        const key = Object.keys(o)[0];
        const value = o[key];
        distribution.test4.store.put(value, key, (e, v) => {
            cntr++;
            // Once the dataset is in place, run the map reduce
            if (cntr === dataset.length) {
                doMapReduce();
            }
        });
    });
});

test('(1 pts) student test', (done) => {
  // Fill out this test case...
    const mapper = (key, value) => {
        const out = [];
        for (const word of value.split(' ')) {
            out.push({[word]: 1});
        }
        return out;
    };

    const reducer = (key, values) => {
        // key: word, values: array of 1s for each time it was seen
        return {[key] : values.reduce((acc, val) => acc + val, 0)};
    };

    const dataset = [
        {'d1': 'word a a a'},
        {'d2': 'a b c'},
        {'d3': 'I I word'}
    ];

    const expected = [{'word': 2}, {'a': 4}, {'b': 1}, {'c': 1}, {'I': 2}];

    const doMapReduce = () => {
        distribution.test5.store.get(null, (e, v) => {
            try {
                expect(v.length).toEqual(dataset.length);
            } catch (e) {
                done(e);
            }

            distribution.test5.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, val) => {
                try {
                    expect(val).toEqual(expect.arrayContaining(expected));
                    expect(val.length).toBe(expected.length);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    };

    let cntr = 0;

    // Send the dataset to the cluster
    dataset.forEach((o) => {
        const key = Object.keys(o)[0];
        const value = o[key];
        distribution.test5.store.put(value, key, (e, v) => {
            cntr++;
            // Once the dataset is in place, run the map reduce
            if (cntr === dataset.length) {
                doMapReduce();
            }
        });
    });
});

beforeAll((done) => {
    test1Group[id.getSID(n1)] = n1;
    test1Group[id.getSID(n2)] = n2;
    test1Group[id.getSID(n3)] = n3;
    test2Group[id.getSID(n1)] = n1;
    test2Group[id.getSID(n2)] = n2;
    test2Group[id.getSID(n3)] = n3;
    test3Group[id.getSID(n1)] = n1;
    test3Group[id.getSID(n2)] = n2;
    test3Group[id.getSID(n3)] = n3;
    test4Group[id.getSID(n1)] = n1;
    test4Group[id.getSID(n2)] = n2;
    test4Group[id.getSID(n3)] = n3;
    test5Group[id.getSID(n1)] = n1;
    test5Group[id.getSID(n2)] = n2;
    test5Group[id.getSID(n3)] = n3;

    const startNodes = (cb) => {
        distribution.local.status.spawn(n1, (e, v) => {
            distribution.local.status.spawn(n2, (e, v) => {
                distribution.local.status.spawn(n3, (e, v) => {
                    cb();
                });
            });
        });
    };

    distribution.node.start(() => {
        const test1Config = {gid: 'test1'};
        const test2Config = {gid: 'test2'};
        const test3Config = {gid: 'test3'};
        const test4Config = {gid: 'test4'};
        const test5Config = {gid: 'test5'};
        startNodes(() => {
            distribution.local.groups.put(test1Config, test1Group, (e, v) => {
                distribution.test1.groups.put(test1Config, test1Group, (e, v) => {
                    distribution.local.groups.put(test2Config, test2Group, (e, v) => {
                        distribution.test2.groups.put(test2Config, test2Group, (e, v) => {
                            distribution.local.groups.put(test3Config, test3Group, (e, v) => {
                                distribution.test3.groups.put(test3Config, test3Group, (e, v) => {
                                    distribution.local.groups.put(test4Config, test4Group, (e, v) => {
                                        distribution.test4.groups.put(test4Config, test4Group, (e, v) => {
                                            distribution.local.groups.put(test5Config, test5Group, (e, v) => {
                                                distribution.test5.groups.put(test5Config, test5Group, (e, v) => {
                                                    done();
                                                })
                                            })
                                        })
                                    })
                                })
                            })
                        })
                    })
                })
            });
        });
    });
});

afterAll((done) => {
    const remote = {service: 'status', method: 'stop'};
    remote.node = n1;
    distribution.local.comm.send([], remote, (e, v) => {
        remote.node = n2;
        distribution.local.comm.send([], remote, (e, v) => {
            remote.node = n3;
            distribution.local.comm.send([], remote, (e, v) => {
                if (globalThis.distribution.node.server) {
                    globalThis.distribution.node.server.close();
                }
                done();
            });
        });
    });
});
