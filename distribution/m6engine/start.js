require('../../distribution.js')();
const distribution = globalThis.distribution;
const id = distribution.util.id;

const BASE_PORT = 7110;
const NUM_WORKERS = 63;

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

function spawnWithRetry(node, maxRetries, callback) {
  let attempts = 0;
  const FALLBACK_PORT_START = BASE_PORT + NUM_WORKERS;

  function attempt(currentNode) {
    attempts++;
    distribution.local.status.spawn(currentNode, (err) => {
      if (!err) {
        group[id.getSID(currentNode)] = currentNode;
        return callback(null);
      }
      if (attempts >= maxRetries) {
        console.error(`[engine] Giving up on port ${currentNode.port} after ${attempts} attempts`);
        return callback(err);
      }
      const nextPort = FALLBACK_PORT_START + attempts;
      const nextNode = {ip: '127.0.0.1', port: nextPort};
      console.warn(`[engine] Retrying on new port ${nextPort} (attempt ${attempts}/${maxRetries})`);
      delete group[id.getSID(currentNode)];
      setTimeout(() => attempt(nextNode), 500 * attempts);
    });
  }

  attempt(node);
}

function bootNodes(callback) {
  distribution.node.start((err) => {
    if (hasErr(err)) throw err;

    let spawnedCount = 0;
    let index = 0;
    const CONCURRENCY = 10;
    const MAX_RETRIES = 3;

    function launcher() {
      if (index >= nodes.length) {
        if (spawnedCount === nodes.length) {
          console.log(`[engine] All ${nodes.length} workers processed.`);
          const config = {gid: GID};
          return distribution.local.groups.put(config, group, () => {
            distribution[GID].groups.put(config, group, callback);
          });
        }
        return;
      }

      while (index < nodes.length && (index - spawnedCount) < CONCURRENCY) {
        const nodeToSpawn = nodes[index++];

        spawnWithRetry(nodeToSpawn, MAX_RETRIES, (err) => {
          spawnedCount++;
          if (err) {
            console.error(`[engine] Worker on port ${nodeToSpawn.port} failed permanently, continuing without it`);
            delete group[id.getSID(nodeToSpawn)];
          }
          launcher();
        });
      }
    }

    console.log(`[engine] Booting ${nodes.length} workers...`);
    launcher();
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