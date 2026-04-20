// @ts-check
'use strict';

const https = require('https');

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
const MAX_PAGES = 5000; // bump up later
const CRAWL_DELAY_MS = 300;

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'in', 'of', 'and', 'to', 'for', 'on', 'at',
  'by', 'with', 'this', 'that', 'it', 'as', 'are', 'was', 'were', 'be',
  'been', 'has', 'have', 'had', 'not', 'but', 'from', 'or', 'its', 'also',
]);

function fetchWiki(path, callback) {
  const url = WIKI_BASE + path;
  const options = {
    headers: {
      'User-Agent': 'geography-search-engine/1.0 (educational project)',
      'Accept': 'text/html',
    },
  };

  const req = https.get(url, options, (res) => {
    // follow one redirect
    if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
      return fetchWiki(res.headers.location.replace(WIKI_BASE, ''), callback);
    }
    if (res.statusCode !== 200) {
      return callback(new Error(`HTTP ${res.statusCode} for ${path}`));
    }

    let raw = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => raw += chunk);
    res.on('end', () => callback(null, raw));
  });

  req.on('error', callback);
  req.setTimeout(10000, () => {
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
    if (links.length >= 30) break;
    const cleanLink = Buffer.from(m[1]).toString('utf8');
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

// crawl runs on the coordinator node rn, make distrib
function crawl(gid, callback) {
  const queue = SEEDS.map((p) => p);
  const seen = new Set(queue);
  let stored = 0;

  function step() {
    if (stored >= MAX_PAGES || queue.length === 0) {
      console.log(`[crawler] done. stored ${stored} pages`);
      return callback(null, stored);
    }

    const path = queue.shift();
    const key = 'page:' + path;

    distribution[gid].store.get(key, (err, existing) => {
      if (!err && existing) {
        return step();
      }

      fetchWiki(path, (err, html) => {
        if (err) {
          console.error(`[crawler] error fetching ${path}: ${err.message}`);
          return setTimeout(step, CRAWL_DELAY_MS);
        }

        const page = parsePage(html, path);
        const titleWords = tokenize(page.title);
        const textWords = tokenize(page.text);
        
        const counts = {};
        
        // if in title boost the counts (weight it more heavily bc wikipedia titles not logn anwyay)
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

        const doc = {
          title: page.title,
          text: page.text.slice(0, 500),
          wordCounts: prunedCounts,
          path,
        };

        distribution[gid].store.put(doc, key, (putErr) => {
          if (putErr) {
            console.error(`[crawler] store error for ${path}: ${putErr.message}`);
          } else {
            stored++;
            if (stored % 10 === 0) console.log(`[crawler] stored ${stored} pages`);
            for (const link of page.links) {
              if (!seen.has(link)) {
                seen.add(link);
                queue.push(link);
              }
            }
          }

          setTimeout(step, CRAWL_DELAY_MS);
        });
      });
    });
  }

  step();
}

module.exports = {crawl, tokenize};
