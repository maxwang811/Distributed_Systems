require('./distribution.js')();
const distribution = globalThis.distribution;
const id = distribution.util.id;

const n1 = {ip: '127.0.0.1', port: 7210};
const n2 = {ip: '127.0.0.1', port: 7211};
const n3 = {ip: '127.0.0.1', port: 7212};
const nodes = [n1, n2, n3];

const GID = 'm5bench';
const NUM_RUNS = 8;
const NUM_DOCS = 300;
const WORDS_PER_DOC = 200;

function call(op) {
    return new Promise((resolve, reject) => {
        op((err, val) => {
            if (err && err.length > 0) {
                return reject(err);
            }
            return resolve(val);
        })
    })
}

function buildGroup(nodeList) {
    const group = [];
    nodeList.forEach((n) => {
        group[id.getSID(n)] = n;
    })
    return group;
}

function generateDocs(numDocs, wordsPerDoc) {
    const docs = [];
    const vocab = ['flush', 'straight', 'pair', 'kicker', 'c-bet', 'range', 'float', 'boat', 'quad', 'set'];
    for (let i = 0; i < numDocs; i++) {
        const words = [];
        for (let j = 0; j < wordsPerDoc; j++) {
            const word = vocab[Math.floor(Math.random() * Math.random() * vocab.length)];
            words.push(word);
        }
        docs.push({key: `doc-${i}`, value: words});
    }
    return docs
}

async function loadDataset(gid, docs) {
    for (const doc of docs) {
        await call((cb) => distribution[gid].store.put(doc.value, doc.key, cb));
    }
}

function mapper(key, value) {
    const out = [];
    const words = value.split(' ');
    for (const word of words) {
        out.push({[word]: 1});
    }
    return out;
}

function reducer(key, values) {
    return {[key]: values.reduce((acc, val) => acc + val, 0)}
}

async function runOneMR(keys) {
    const start = performance.now();
    const result = await(call((cb) => {
        distribution[GID].mr.exec({keys: keys, map: mapper, reduce: reducer}, cb);
    }))
    const end = performance.now();
    return {ms: end - start, result}
}

function avg(values) {
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
}

async function cleanup() {
    for (const node of nodes) {
        try {
            await call((cb) => {
                distribution.local.comm.send([], {service: 'status', method: 'stop', node}, cb);
            })
        } catch (e) {

        }
    }

    if (distribution.node && distribution.node.server) {
        distribution.node.server.close();
    }
}

async function main() {
    const group = buildGroup(nodes);
    const docs = generateDocs(NUM_DOCS, WORDS_PER_DOC);
    const keys = docs.map((doc) => doc.key);
    console.log("M5 MapReduce Performance Characterization using Word Count workflow");
    console.log(`Num runs: ${NUM_RUNS}, num docs: ${NUM_DOCS}, words per doc: ${WORDS_PER_DOC}`);

    try {
        await call((cb) => distribution.node.start(cb));

        for (const node of nodes) {
            await call((cb) => distribution.local.status.spawn(node, cb));
        }

        const config = {gid: GID};
        await call((cb) => distribution.local.groups.put(config, group, cb));
        await call((cb) => distribution[GID].groups.put(config, group, cb));

        await loadDataset(GID, docs);

        const latencies = [];
        await runOneMR(keys);

        const start = performance.now();
        for (let i = 0; i < NUM_RUNS; i++) {
            const {ms, result} = await runOneMR(keys);
            latencies.push(ms);
            console.log(`Run ${i}/${NUM_RUNS}: ${ms.toFixed(2)} ms`);
        }
        const end = performance.now();
        const totalTime = end - start;

        console.log(`Throughput: ${(NUM_RUNS / (totalTime / 1000)).toFixed(2)} MR jobs per second`);
        console.log(`Latency: ${avg(latencies).toFixed(2)} ms per job`);
    } finally {
        await cleanup()
    }
}

main().catch((err) => {
    console.error("Benchmark failed: ", err);
    process.exitCode = 1;
})

