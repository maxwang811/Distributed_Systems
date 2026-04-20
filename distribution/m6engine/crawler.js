// @ts-check
'use strict';

const https = require('https');

/**
 * @typedef {Error & {statusCode?: number, retryAfterMs?: number}} FetchError
 */

const SEEDS = [
  '/wiki/Amazon_River',
  '/wiki/Nile',
  '/wiki/Sahara',
  '/wiki/Mount_Everest',
  '/wiki/Himalayas',
  '/wiki/Alps',
  '/wiki/Atlantic_Ocean',
  '/wiki/Pacific_Ocean',
  '/wiki/Mediterranean_Sea',
  '/wiki/Mississippi_River',
  '/wiki/Rocky_Mountains',
  '/wiki/Andes',
  '/wiki/Congo_River',
  '/wiki/Ganges',
  '/wiki/Great_Barrier_Reef',
  '/wiki/Continent',
  '/wiki/North_America',
  '/wiki/South_America',
  '/wiki/Asia',
  '/wiki/Europe',
  '/wiki/Australia',
  '/wiki/Africa',
  '/wiki/Antarctica',
];

const WIKI_BASE = 'https://en.wikipedia.org';
const MAX_PAGES = Number.parseInt(process.env.CRAWL_MAX_PAGES || '100000', 10);
const CRAWL_CONCURRENCY = Number.parseInt(process.env.CRAWL_CONCURRENCY || '63', 10);
const DELETE_CONCURRENCY = Number.parseInt(process.env.CRAWL_DELETE_CONCURRENCY || '32', 10);
const MAX_LINKS_PER_PAGE = Number.parseInt(process.env.CRAWL_MAX_LINKS_PER_PAGE || '40', 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.CRAWL_REQUEST_TIMEOUT_MS || '15000', 10);
const BASE_REQUEST_INTERVAL_MS = Number.parseInt(process.env.CRAWL_REQUEST_INTERVAL_MS || '500', 10);
const MAX_REQUEST_INTERVAL_MS = Number.parseInt(process.env.CRAWL_MAX_REQUEST_INTERVAL_MS || '8000', 10);
const MAX_FETCH_ATTEMPTS = Number.parseInt(process.env.CRAWL_MAX_FETCH_ATTEMPTS || '10', 10);
const MIN_RETRY_DELAY_MS = Number.parseInt(process.env.CRAWL_MIN_RETRY_DELAY_MS || '5000', 10);
const MAX_RETRY_DELAY_MS = Number.parseInt(process.env.CRAWL_MAX_RETRY_DELAY_MS || '120000', 10);

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'in', 'of', 'and', 'to', 'for', 'on', 'at',
  'by', 'with', 'this', 'that', 'it', 'as', 'are', 'was', 'were', 'be',
  'been', 'has', 'have', 'had', 'not', 'but', 'from', 'or', 'its', 'also',
]);

function hasErr(err) {
  if (!err) return false;
  if (err instanceof Error) return true;
  if (typeof err === 'object' && Object.keys(err).length > 0) return true;
  return false;
}

function parseRetryAfter(value) {
  if (!value) return 0;

  const seconds = Number.parseInt(String(value), 10);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const dateMs = Date.parse(String(value));
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return 0;
}

function createHttpError(statusCode, path, retryAfter) {
  /** @type {FetchError} */
  const err = new Error(`HTTP ${statusCode} for ${path}`);
  err.statusCode = statusCode;
  err.retryAfterMs = parseRetryAfter(retryAfter);
  return err;
}

function serializeFetchError(err) {
  const fetchErr = /** @type {FetchError | null | undefined} */ (err);
  const statusCode = fetchErr && fetchErr.statusCode;
  const retryableStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
  const message = fetchErr && fetchErr.message ? fetchErr.message : String(err);
  const retryable = retryableStatuses.has(statusCode) ||
    message.includes('timeout') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT');

  return {
    message,
    statusCode,
    retryAfterMs: fetchErr && fetchErr.retryAfterMs ? fetchErr.retryAfterMs : 0,
    retryable,
  };
}

function fetchWiki(path, callback, redirectsLeft = 5) {
  const url = path.startsWith('http') ? path : WIKI_BASE + path;
  const options = {
    headers: {
      'User-Agent': 'geography-search-engine/1.0 (educational project)',
      'Accept': 'text/html',
    },
  };

  const req = https.get(url, options, (res) => {
    if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
      res.resume();
      if (redirectsLeft <= 0) {
        return callback(new Error(`too many redirects fetching ${path}`));
      }
      return fetchWiki(res.headers.location.replace(WIKI_BASE, ''), callback, redirectsLeft - 1);
    }
    if (res.statusCode !== 200) {
      res.resume();
      return callback(createHttpError(res.statusCode, path, res.headers['retry-after']));
    }

    let raw = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => raw += chunk);
    res.on('end', () => callback(null, raw));
  });

  req.on('error', callback);
  req.setTimeout(REQUEST_TIMEOUT_MS, () => {
    req.destroy(new Error(`timeout fetching ${path}`));
  });
}

function parsePage(html, path) {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const rawTitle = titleMatch
    ? titleMatch[1].replace(/\s*[-|].*$/, '').trim()
    : path;
    
  const title = Buffer.from(rawTitle).toString('utf8');

  let paragraphs = '';
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = pRegex.exec(html)) !== null) {
    paragraphs += match[1] + ' ';
  }

  if (!paragraphs) paragraphs = html;

  const stripped = paragraphs
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const rawText = stripped.slice(0, 5000);
  const text = Buffer.from(rawText).toString('utf8');

  const linkRe = /href="(\/wiki\/[^":?#\s]+)"/g;
  const links = [];
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    if (links.length >= MAX_LINKS_PER_PAGE) break;
    const cleanLink = Buffer.from(m[1]).toString('utf8');
    if (cleanLink.includes('/wiki/Special:') || cleanLink.includes('/wiki/Help:')) continue;
    if (cleanLink.includes('/wiki/File:') || cleanLink.includes('/wiki/Template:')) continue;
    if (cleanLink.includes('/wiki/Category:') || cleanLink.includes('/wiki/Talk:')) continue;
    links.push(cleanLink);
  }

  return {title, text, links};
}

function tokenize(str) {
  const words = str
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const tokens = [...words];

  // bigrams
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(words[i] + '_' + words[i + 1]);
  }

  return tokens;
}

function buildDoc(path, page) {
  const titleWords = tokenize(page.title);
  const textWords = tokenize(page.text);
  const counts = {};

  // Title words are stronger search signals than body words.
  for (const w of titleWords) {
    counts[w] = (counts[w] || 0) + 20;
  }

  for (const w of textWords) {
    counts[w] = (counts[w] || 0) + 1;
  }

  const sortedTokens = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 300);

  const prunedCounts = {};
  for (const [term, freq] of sortedTokens) {
    prunedCounts[term] = freq;
  }

  return {
    title: page.title,
    text: page.text.slice(0, 500),
    wordCounts: prunedCounts,
    path,
  };
}

function crawlOne(path, callback) {
  fetchWiki(path, (err, html) => {
    if (err) return callback(null, {error: serializeFetchError(err)});

    const page = parsePage(html, path);
    return callback(null, {
      doc: buildDoc(path, page),
      links: page.links,
    });
  });
}

function mapLimit(items, limit, iteratee, callback) {
  if (items.length === 0) return callback(null);

  let next = 0;
  let running = 0;
  let completed = 0;
  let stopped = false;

  function pump() {
    if (stopped) return;
    if (completed === items.length) return callback(null);

    while (running < limit && next < items.length) {
      const item = items[next++];
      running++;
      iteratee(item, (err) => {
        running--;
        completed++;
        if (err && !stopped) {
          stopped = true;
          return callback(err);
        }
        pump();
      });
    }
  }

  pump();
}

function clearPreviousCrawl(gid, callback) {
  distribution[gid].store.get({key: null, gid}, (err, keys) => {
    if (hasErr(err)) return callback(err);
    const staleKeys = (keys || []).filter((key) => (
      key.startsWith('page:') ||
      key.startsWith('idx:') ||
      key.startsWith('map-') ||
      key.startsWith('shuffle-')
    ));

    if (staleKeys.length === 0) return callback(null);

    console.log(`[crawler] deleting ${staleKeys.length} stale store keys`);
    mapLimit(staleKeys, DELETE_CONCURRENCY, (key, done) => {
      distribution[gid].store.del({key, gid}, (delErr) => {
        if (hasErr(delErr)) {
          console.error(`[crawler] cleanup failed for ${key}: ${delErr.message || delErr}`);
        }
        done(null);
      });
    }, callback);
  });
}

function getExistingPageKeys(gid, callback) {
  distribution[gid].store.get({key: null, gid}, (err, keys) => {
    if (hasErr(err)) return callback(err);
    return callback(null, (keys || []).filter((key) => key.startsWith('page:')));
  });
}

function crawl(gid, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  const crawlOptions = options || {};

  function start(existingPageKeys) {
    distribution.local.groups.get(gid, (groupErr, group) => {
      if (hasErr(groupErr)) return callback(groupErr);
      return crawlDistributed(gid, Object.values(group), existingPageKeys, callback);
    });
  }

  if (crawlOptions.reset) {
    return clearPreviousCrawl(gid, (clearErr) => {
      if (hasErr(clearErr)) return callback(clearErr);
      return start([]);
    });
  }

  return getExistingPageKeys(gid, (pageKeyErr, existingPageKeys) => {
    if (hasErr(pageKeyErr)) return callback(pageKeyErr);
    return start(existingPageKeys);
  });
}

function crawlDistributed(gid, workers, existingPageKeys, callback) {
  if (!workers || workers.length === 0) {
    return callback(new Error(`crawler group ${gid} has no worker nodes`));
  }

  const existingPaths = new Set(
    (existingPageKeys || []).map((key) => key.slice('page:'.length)),
  );
  const queue = SEEDS.map((path) => ({path, attempts: 0, readyAt: 0}));
  const seen = new Set([...existingPaths, ...SEEDS]);
  let totalStored = existingPaths.size;
  let newStored = 0;
  let inFlight = 0;
  let workerIndex = 0;
  let finished = false;
  let scheduleTimer = null;
  let nextDispatchAt = 0;
  let requestIntervalMs = BASE_REQUEST_INTERVAL_MS;
  let successesSinceThrottle = 0;
  let retryCount = 0;
  let droppedCount = 0;

  console.log(
    `[crawler] starting distributed crawl: max=${MAX_PAGES}, existing=${totalStored}, workers=${workers.length}, concurrency=${CRAWL_CONCURRENCY}, interval=${BASE_REQUEST_INTERVAL_MS}ms`,
  );

  function finish(err) {
    if (finished) return;
    finished = true;
    if (scheduleTimer) clearTimeout(scheduleTimer);
    if (err) return callback(err);
    console.log(`[crawler] done. total=${totalStored} pages, new=${newStored}, retries=${retryCount}, dropped=${droppedCount}`);
    return callback(null, totalStored);
  }

  function armSchedule(delayMs) {
    if (finished || scheduleTimer) return;
    scheduleTimer = setTimeout(() => {
      scheduleTimer = null;
      schedule();
    }, Math.max(1, delayMs));
  }

  function getReadyIndex(now) {
    let bestIndex = -1;
    let bestReadyAt = Infinity;

    for (let i = 0; i < queue.length; i++) {
      if (queue[i].readyAt <= now) return i;
      if (queue[i].readyAt < bestReadyAt) {
        bestReadyAt = queue[i].readyAt;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  function retryDelayMs(entry, errorInfo) {
    const retryAfterMs = errorInfo && errorInfo.retryAfterMs ? errorInfo.retryAfterMs : 0;
    const exponentialMs = MIN_RETRY_DELAY_MS * (2 ** Math.max(0, entry.attempts - 1));
    return Math.min(MAX_RETRY_DELAY_MS, Math.max(MIN_RETRY_DELAY_MS, retryAfterMs, exponentialMs));
  }

  function shouldRetry(entry, errorInfo) {
    if (!errorInfo || !errorInfo.retryable) return false;
    return entry.attempts < MAX_FETCH_ATTEMPTS;
  }

  function recordFetchError(entry, errorInfo) {
    const message = errorInfo && errorInfo.message ? errorInfo.message : 'unknown fetch error';
    const statusCode = errorInfo && errorInfo.statusCode;

    if (statusCode === 429) {
      requestIntervalMs = Math.min(MAX_REQUEST_INTERVAL_MS, Math.ceil(requestIntervalMs * 1.5));
      console.error(
        `[crawler] throttled by Wikipedia; interval=${requestIntervalMs}ms, path=${entry.path}`,
      );
    }

    if (!shouldRetry(entry, errorInfo)) {
      droppedCount++;
      console.error(`[crawler] dropping ${entry.path}: ${message}`);
      return;
    }

    const nextEntry = {
      path: entry.path,
      attempts: entry.attempts + 1,
      readyAt: Date.now() + retryDelayMs(entry, errorInfo),
    };
    retryCount++;
    queue.push(nextEntry);
    console.error(
      `[crawler] retrying ${entry.path} after ${Math.round((nextEntry.readyAt - Date.now()) / 1000)}s: ${message}`,
    );
  }

  function recordSuccess() {
    successesSinceThrottle++;
    if (requestIntervalMs > BASE_REQUEST_INTERVAL_MS && successesSinceThrottle >= 50) {
      requestIntervalMs = Math.max(BASE_REQUEST_INTERVAL_MS, Math.floor(requestIntervalMs * 0.9));
      successesSinceThrottle = 0;
      console.log(`[crawler] easing request interval to ${requestIntervalMs}ms`);
    }
  }

  function schedule() {
    if (finished) return;
    if (totalStored >= MAX_PAGES) return finish(null);
    if (queue.length === 0 && inFlight === 0) return finish(null);

    while (
      inFlight < CRAWL_CONCURRENCY &&
      queue.length > 0 &&
      totalStored + inFlight < MAX_PAGES
    ) {
      const now = Date.now();
      const readyIndex = getReadyIndex(now);
      const entry = queue[readyIndex];
      const waitMs = Math.max(entry.readyAt - now, nextDispatchAt - now);

      if (waitMs > 0) {
        armSchedule(waitMs);
        return;
      }

      queue.splice(readyIndex, 1);
      nextDispatchAt = now + requestIntervalMs;
      dispatch(entry);
    }
  }

  function dispatch(entry) {
    inFlight++;
    const worker = workers[workerIndex % workers.length];
    workerIndex++;

    distribution.local.comm.send(
      [entry.path],
      {node: worker, service: 'crawlerWorker', method: 'crawlOne'},
      (err, result) => {
        if (hasErr(err)) {
          recordFetchError(entry, {
            message: err.message || String(err),
            retryable: true,
            retryAfterMs: 0,
          });
          inFlight--;
          return schedule();
        }

        if (result && result.error) {
          recordFetchError(entry, result.error);
          inFlight--;
          return schedule();
        }

        if (!result || !result.doc) {
          console.error(`[crawler] empty worker result for ${entry.path}`);
          inFlight--;
          return schedule();
        }

        if (existingPaths.has(entry.path)) {
          if (Array.isArray(result.links)) {
            for (const link of result.links) {
              if (!seen.has(link)) {
                seen.add(link);
                queue.push({path: link, attempts: 0, readyAt: 0});
              }
            }
          }
          inFlight--;
          return schedule();
        }

        distribution[gid].store.put(result.doc, 'page:' + entry.path, (putErr) => {
          if (hasErr(putErr)) {
            console.error(`[crawler] store error for ${entry.path}: ${putErr.message || putErr}`);
          } else {
            existingPaths.add(entry.path);
            totalStored++;
            newStored++;
            recordSuccess();
            if (totalStored % 100 === 0) console.log(`[crawler] stored ${totalStored} total pages`);
            if (totalStored < MAX_PAGES && Array.isArray(result.links)) {
              for (const link of result.links) {
                if (!seen.has(link)) {
                  seen.add(link);
                  queue.push({path: link, attempts: 0, readyAt: 0});
                }
              }
            }
          }
          inFlight--;
          schedule();
        });
      },
    );
  }

  schedule();
}

const workerService = {
  crawlOne: function(path, callback) {
    const {crawlOne} = require('./crawler');
    return crawlOne(path, callback);
  }
};

module.exports = {crawl, crawlOne, tokenize, workerService};