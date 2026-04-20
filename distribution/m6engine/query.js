// @ts-check

const http = require('http');

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'in', 'of', 'and', 'to', 'for', 'on', 'at',
  'by', 'with', 'this', 'that', 'it', 'as', 'are', 'was', 'were', 'be',
  'been', 'has', 'have', 'had', 'not', 'but', 'from', 'or', 'its', 'also',
]);

function parseQuery(q) {
  return q
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

// look up each term in the index and merge scores across terms
function search(gid, query, callback) {
  const terms = parseQuery(query);
  if (terms.length === 0) return callback(null, []);

  const scores = {};
  let pending = terms.length;

  for (const term of terms) {
    distribution[gid].store.get('idx:' + term, (err, postings) => {
      if (!err && Array.isArray(postings)) {
        for (const {path, score} of postings) {
          scores[path] = (scores[path] || 0) + score;
        }
      }

      pending--;
      if (pending > 0) return;

      // sort by score, take top 10, then fetch titles/snippets
      const ranked = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      if (ranked.length === 0) return callback(null, []);

      const results = [];
      let fetches = ranked.length;

      for (const [path, score] of ranked) {
        distribution[gid].store.get('page:' + path, (err, doc) => {
          results.push({
            title: doc ? doc.title : path,
            path,
            snippet: doc ? doc.text : '',
            score: Math.round(score * 100) / 100,
          });

          fetches--;
          if (fetches === 0) {
            // re-sort since async fetches may have come back out of order
            results.sort((a, b) => b.score - a.score);
            callback(null, results);
          }
        });
      }
    });
  }
}

function serveHtml(query, results) {
  const rows = results.map((r) => `
    <div class="result">
      <a href="https://en.wikipedia.org${r.path}">${r.title}</a>
      <span class="score">(score: ${r.score})</span>
      <p>${r.snippet.slice(0, 200)}...</p>
    </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>geo search</title>
  <style>
    body { font-family: sans-serif; max-width: 700px; margin: 40px auto; padding: 0 16px; }
    input { width: 400px; padding: 6px; font-size: 16px; }
    button { padding: 6px 12px; font-size: 16px; }
    .result { margin: 20px 0; }
    .result a { font-size: 18px; }
    .score { color: #888; font-size: 13px; margin-left: 8px; }
    .result p { color: #444; margin: 4px 0 0; }
  </style>
</head>
<body>
  <h2>geography search</h2>
  <form method="get" action="/search">
    <input name="q" value="${query}" autofocus />
    <button type="submit">search</button>
  </form>
  <div id="results">
    ${query ? (results.length > 0 ? rows : '<p>no results</p>') : ''}
  </div>
</body>
</html>`;
}

function startServer(gid, port) {
  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url, `http://localhost:${port}`);

    if (parsed.pathname === '/') {
      res.writeHead(200, {'Content-Type': 'text/html'});
      return res.end(serveHtml('', []));
    }

    if (parsed.pathname === '/search') {
      const q = (parsed.searchParams.get('q') || '').trim();
      const wantsJson = (req.headers['accept'] || '').includes('application/json');

      search(gid, q, (err, results) => {
        if (err) {
          res.writeHead(500);
          return res.end(JSON.stringify({error: err.message}));
        }

        if (wantsJson) {
          res.writeHead(200, {'Content-Type': 'application/json'});
          return res.end(JSON.stringify({query: q, results}));
        }

        res.writeHead(200, {'Content-Type': 'text/html'});
        return res.end(serveHtml(q, results));
      });

      return;
    }
    if (parsed.pathname === '/debug') {
      const q = parsed.searchParams.get('term') || 'amazon';
      distribution[gid].store.get('idx:' + q, (err, val) => {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({err: err ? err.message : null, val}));
      });
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });

  server.listen(port, () => {
    console.log(`[query] server listening on http://localhost:${port}`);
  });

  return server;
}

module.exports = {search, startServer};
