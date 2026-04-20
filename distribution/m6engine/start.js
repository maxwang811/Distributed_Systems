require('../../distribution.js')();
const distribution = globalThis.distribution;
const id = distribution.util.id;
const fs = require('fs');
const path = require('path');

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

const {crawl, workerService} = require('./crawler');
const {buildIndex} = require('./indexer');
const {startServer} = require('./query');

const args = process.argv.slice(2);
const serveOnly = args.includes('--serve');
const indexOnly = args.includes('--index');

const perf = {
  startTime: Date.now(),
  crawl: {},
  index: {},
  total: {},
};

function logPerf(msg) {
  console.log(msg);
  fs.appendFileSync(path.join(__dirname, 'performance.txt'), msg + '\n');
}

function writePerfReport() {
  const lines = [
    '=== Performance Report ===',
    `Date: ${new Date().toISOString()}`,
    '',
  ];

  if (perf.crawl.start) {
    const crawlSec = (perf.crawl.end - perf.crawl.start) / 1000;
    const crawlThroughput = perf.crawl.pages / crawlSec;
    lines.push('-- Crawl --');
    lines.push(`  Pages crawled:   ${perf.crawl.pages}`);
    lines.push(`  Duration:        ${crawlSec.toFixed(2)}s`);
    lines.push(`  Throughput:      ${crawlThroughput.toFixed(2)} pages/sec`);
    lines.push(`  Avg latency:     ${(crawlSec / perf.crawl.pages * 1000).toFixed(2)}ms/page`);
    lines.push('');
  }

  if (perf.index.start) {
    const indexSec = (perf.index.end - perf.index.start) / 1000;
    const indexThroughput = perf.index.pages / indexSec;
    lines.push('-- Index --');
    lines.push(`  Pages indexed:   ${perf.index.pages}`);
    lines.push(`  Duration:        ${indexSec.toFixed(2)}s`);
    lines.push(`  Throughput:      ${indexThroughput.toFixed(2)} pages/sec`);
    lines.push(`  Avg latency:     ${(indexSec / perf.index.pages * 1000).toFixed(2)}ms/page`);
    lines.push('');
  }

  const totalSec = (perf.total.end - perf.startTime) / 1000;
  lines.push('-- End to End --');
  lines.push(`  Total duration:  ${totalSec.toFixed(2)}s`);
  lines.push('=========================');

  const report = lines.join('\n');
  console.log(report);
  fs.writeFileSync(path.join(__dirname, 'performance.txt'), report + '\n');
}

function hasErr(err) {
  if (!err) return false;
  if (err instanceof Error) return true;
  if (typeof err === 'object' && Object.keys(err).length > 0) return true;
  return false;
}

function spawnWithRetry(node, maxRetries, callback) {
  let attempts = 0;

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
      const nextNode = {ip: '127.0.0.1', port: currentNode.port + 1};
      console.warn(`[engine] Retrying on next port ${nextNode.port} (attempt ${attempts}/${maxRetries})`);
      delete group[id.getSID(currentNode)];
      attempt(nextNode);
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
            distribution[GID].groups.put(config, group, () => {
              console.log('[engine] registering crawlerWorker service on all nodes...');
              distribution[GID].routes.put(workerService, 'crawlerWorker', (routeErr) => {
                if (hasErr(routeErr)) throw routeErr;
                console.log('[engine] crawlerWorker service registered');
                callback();
              });
            });
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

function runIndex(pageKeys, callback) {
  perf.index.start = Date.now();
  perf.index.pages = pageKeys.length;
  logPerf(`[perf] index start: ${new Date(perf.index.start).toISOString()}, pages: ${pageKeys.length}`);

  buildIndexInChunks(pageKeys, (err) => {
    perf.index.end = Date.now();
    const indexSec = (perf.index.end - perf.index.start) / 1000;
    logPerf(`[perf] index end: ${new Date(perf.index.end).toISOString()}`);
    logPerf(`[perf] index duration: ${indexSec.toFixed(2)}s, throughput: ${(pageKeys.length / indexSec).toFixed(2)} pages/sec`);
    callback(err);
  });
}

function fetchAndRunIndex(callback) {
  distribution[GID].store.get({key: null, gid: GID}, (err, allKeys) => {
    if (hasErr(err)) return callback(err);
    const pageKeys = allKeys.filter((k) => k.startsWith('page:'));
    console.log(`[engine] found ${pageKeys.length} pages to index`);
    runIndex(pageKeys, callback);
  });
}

bootNodes(() => {
  console.log('[engine] nodes up');
  logPerf(`[perf] boot complete: ${new Date().toISOString()}`);

  if (serveOnly) {
    console.log('[engine] starting query server');
    perf.total.end = Date.now();
    writePerfReport();
    startServer(GID, 3000);

  } else if (indexOnly) {
    console.log('[engine] re-indexing');
    fetchAndRunIndex((err) => {
      if (hasErr(err)) throw err;
      perf.total.end = Date.now();
      writePerfReport();
      console.log('[engine] index built, starting query server');
      startServer(GID, 3000);
    });

  } else {
    console.log('[engine] starting crawl...');
    perf.crawl.start = Date.now();
    logPerf(`[perf] crawl start: ${new Date(perf.crawl.start).toISOString()}`);

    crawl(GID, (err, count) => {
      if (hasErr(err)) throw err;
      perf.crawl.end = Date.now();
      perf.crawl.pages = count;
      const crawlSec = (perf.crawl.end - perf.crawl.start) / 1000;
      logPerf(`[perf] crawl end: ${new Date(perf.crawl.end).toISOString()}`);
      logPerf(`[perf] crawl duration: ${crawlSec.toFixed(2)}s, pages: ${count}, throughput: ${(count / crawlSec).toFixed(2)} pages/sec`);
      console.log(`[engine] crawl done (${count} pages)`);

      fetchAndRunIndex((err) => {
        if (hasErr(err)) throw err;
        perf.total.end = Date.now();
        writePerfReport();
        console.log('[engine] index built, starting query server');
        startServer(GID, 3000);
      });
    });
  }
});