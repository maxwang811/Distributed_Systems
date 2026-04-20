// @ts-check
'use strict';

/*
  Single-job distributed indexing pipeline using mr.exec:

  map:    (pageKey, doc) → top 50 terms as [{term: {path, count}}, ...]
  reduce: (term, [{path, count}, ...]) → {term: scoredPostings}

  After mr.exec finishes, the coordinator writes each result into the
  store under 'idx:<term>' for the query server to read.
*/

function hasErr(err) {
  if (!err) return false;
  if (err instanceof Error) return true;
  if (typeof err === 'object' && Object.keys(err).length > 0) return true;
  return false;
}

function mapTermFreq(key, doc) {
  if (!doc || !doc.wordCounts) return [];

  // only emit top 50 terms per page to keep map output file count manageable
  const topTerms = Object.entries(doc.wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 500);

  return topTerms.map(([term, count]) => ({
    [term]: {path: doc.path, count},
  }));
}

// makeReducer bakes N in as a literal so the function is self-contained
// when mr.exec serializes and ships it to remote nodes
function makeReducer(N) {
  return new Function('term', 'entries', `
    const df = entries.length;
    const idf = Math.log((${N} + 1) / (df + 1));
    const scored = entries
      .map(function(e) { return {path: e.path, score: e.count * idf}; })
      .sort(function(a, b) { return b.score - a.score; })
      .slice(0, 100);
    const out = {};
    out[term] = scored;
    return out;
  `);
}

function buildIndex(gid, pageKeys, callback) {
  if (!pageKeys || pageKeys.length === 0) {
    return callback(null);
  }

  const N = pageKeys.length;
  console.log(`[indexer] starting job over ${N} pages`);

  const reduceTermFreq = makeReducer(N);

  distribution[gid].mr.exec({
    map: mapTermFreq,
    reduce: reduceTermFreq,
    keys: pageKeys,
  }, (err, results) => {
    if (hasErr(err)) return callback(err);

    console.log(`[indexer] job done, got ${results.length} terms`);

    if (results.length === 0) return callback(null);

    let done = 0;
    for (const result of results) {
      const [term] = Object.keys(result);
      const scored = result[term];
      const idxKey = 'idx:' + term;

      distribution[gid].store.put(scored, idxKey, () => {
        done++;
        if (done === results.length) {
          console.log('[indexer] index written to store');
          return callback(null);
        }
      });
    }
  });
}

module.exports = {buildIndex};
