require('./distribution.js')();
const distribution = globalThis.distribution;
const id = distribution.util.id;
const crypto = require('crypto');

const n1 = {ip: '3.12.150.184', port: 8080};
const n2 = {ip: '18.191.147.90', port: 8081};
const n3 = {ip: '3.144.244.38', port: 8082};

const NUM_OBJECTS = 1000;

const pairs = [];
for (let i = 0; i < NUM_OBJECTS; i++) {
  const key = crypto.randomBytes(8).toString('hex');
  const value = {
    data: crypto.randomBytes(32).toString('hex'),
    time: Date.now(),
    index: i
  }
  pairs.push({key, value})
}

console.log(`Created ${NUM_OBJECTS} pairs of objects`)

distribution.node.start((server) => {
  const awsGroup = {};
  awsGroup[id.getSID(n1)] = n1;
  awsGroup[id.getSID(n2)] = n2;
  awsGroup[id.getSID(n3)] = n3;

  distribution.local.groups.put('aws', awsGroup, (err, val) => {
    if (err) {
      return new Error('putting group failed');
    }

    const start = performance.now();

    const insertNext = (i) => {
      if (i >= NUM_OBJECTS) {
        const now = performance.now();
        const time = now - start; // ms
        const throughput = NUM_OBJECTS / (time / 1000);
        const latency = time / NUM_OBJECTS;
        console.log(`Inserting ${NUM_OBJECTS} objects took ${time.toFixed(3)} ms`);
        console.log(`Insertion throughput: ${throughput.toFixed(3)} insertions per sec`);
        console.log(`Insertion latency: ${latency.toFixed(3)} ms per insertion`);
        retrieveAll();
        return;
      }

      distribution.aws.store.put(pairs[i].value, pairs[i].key, (err, val) => {
        if (err) {
          return new Error('Insertion error at index i');
        }
        insertNext(i+1);
      })
    }

    const retrieveAll = () => {
      const start = performance.now();

      const retrieveNext = (i) => {
        if (i >= NUM_OBJECTS) {
          const now = performance.now();
          const time = now - start; // ms
          const throughput = NUM_OBJECTS / (time / 1000);
          const latency = time / NUM_OBJECTS;
          console.log(`Retrieving ${NUM_OBJECTS} objects took ${time.toFixed(3)} ms`);
          console.log(`Retrieval throughput: ${throughput.toFixed(3)} retrievals per sec`);
          console.log(`Retrieval latency: ${latency.toFixed(3)} ms per retrieval`);
          return;
        }

        const key = pairs[i].key;
        distribution.aws.store.get(key, (err, val) => {
          if (err) {
            return new Error(`Error getting key ${key}`)
          }
          retrieveNext(i + 1);
        })
      }

      retrieveNext(0);
    }

    insertNext(0);
  })
})


