// @ts-check

/*
  coordinaor

  assumes node grp running+ registered
  use 
    node search_engine.js 
    node search_engine.js --serve
*/

const {crawl} = require('./crawler');
const {buildIndex} = require('./indexer');
const {startServer} = require('./query');

const GID = 'search'; // change to match whatever gid your group uses
const QUERY_PORT = 3000;

const args = process.argv.slice(2);
const serveOnly = args.includes('--serve');

if (serveOnly) {
  startServer(GID, QUERY_PORT);
} else {
  runPipeline();
}

function runPipeline() {
  console.log('[engine] starting crawl');

  crawl(GID, (err, count) => {
    if (err) {
      console.error('[engine] crawl error:', err);
      process.exit(1);
    }
    console.log(`[engine] crawl done (${count} pages), fetching page keys`);
    distribution[GID].store.get({key: null, gid: GID}, (err, allKeys) => {
      if (err) {
        console.error('[engine] failed to list store keys:', err);
        process.exit(1);
      }
      
      const pageKeys = allKeys.filter((k) => k.startsWith('page:'));
      console.log(`[engine] found ${pageKeys.length} page keys, building index`);

      buildIndex(GID, pageKeys, (err) => {
        if (err) {
          console.error('[engine] index error:', err);
          process.exit(1);
        }

        console.log('[engine] index ready');
        startServer(GID, QUERY_PORT);
      });
    });
  });
}
