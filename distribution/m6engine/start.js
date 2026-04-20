require('../../distribution.js')();
const distribution = globalThis.distribution;
const id = distribution.util.id;

const BASE_PORT = 7110;
const NUM_WORKERS = 190;

const GID = 'search';
const group = {};

const nodes = [];
for (let i = 0; i < NUM_WORKERS; i++) {
  const node = {ip: '127.0.0.1', port: BASE_PORT + i};
  nodes.push(node);
  group[id.getSID(node)] = node;
}

const {crawl} = require('./crawler');
const {buildIndex} = require('./indexer');
const {startServer} = require('./query');

const args = process.argv.slice(2);
const serveOnly = args.includes('--serve');
const indexOnly = args.includes('--index');

function hasErr(err) {
  if (!err) return false;
  if (err instanceof Error) return true;
  if (typeof err === 'object' && Object.keys(err).length > 0) return true;
  return false;
}

function bootNodes(callback) {
  distribution.node.start((err) => {
    if (hasErr(err)) throw err;
    let i = 0;
    function spawnNext() {
      if (i >= nodes.length) {
        const config = {gid: GID};
        return distribution.local.groups.put(config, group, () => {
          distribution[GID].groups.put(config, group, callback);
        });
      }
      distribution.local.status.spawn(nodes[i++], spawnNext);
    }
    spawnNext();
  });
}

function buildIndexInChunks(pageKeys, callback) {
  const CHUNK_SIZE = 5000;
  const chunks = [];
  for (let i = 0; i < pageKeys.length; i += CHUNK_SIZE) {
    chunks.push(pageKeys.slice(i, i + CHUNK_SIZE));
  }

  let i = 0;
  function nextChunk() {
    if (i >= chunks.length) return callback(null);
    console.log(`[engine] indexing chunk ${i + 1}/${chunks.length}`);
    buildIndex(GID, chunks[i], (err) => {
      if (hasErr(err)) return callback(err);
      i++;
      nextChunk();
    });
  }

  nextChunk();
}

function runIndex(callback) {
  distribution[GID].store.get({key: null, gid: GID}, (err, allKeys) => {
    if (hasErr(err)) return callback(err);
    const pageKeys = allKeys.filter((k) => k.startsWith('page:'));
    console.log(`[engine] found ${pageKeys.length} pages to index`);
    buildIndexInChunks(pageKeys, callback);
  });
}

bootNodes(() => {
  console.log('[engine] nodes up');

  if (serveOnly) {
    console.log('[engine] starting query server');
    startServer(GID, 3000);

  } else if (indexOnly) {
    console.log('[engine] re-indexing');
    runIndex((err) => {
      if (hasErr(err)) throw err;
      console.log('[engine] index built, starting query server');
      startServer(GID, 3000);
    });

  } else {
    console.log('[engine] starting crawl...');
    crawl(GID, (err, count) => {
      if (hasErr(err)) throw err;
      console.log(`[engine] crawl done (${count} pages)`);
      runIndex((err) => {
        if (hasErr(err)) throw err;
        console.log('[engine] index built, starting query server');
        startServer(GID, 3000);
      });
    });
  }
});