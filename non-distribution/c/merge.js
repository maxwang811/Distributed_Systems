#!/usr/bin/env node


const fs = require('fs');
const readline = require('readline');

const compare = (a, b) => {
  if (a.freq > b.freq) {
    return -1;
  } else if (a.freq < b.freq) {
    return 1;
  } else {
    return 0;
  }
};
const rl = readline.createInterface({
  input: process.stdin,
});


let localIndex = '';
rl.on('line', (line) => {
  localIndex += `${line}\n`;
});

rl.on('close', () => {
  const globalIndexPath = process.argv[2];
  if (!globalIndexPath) {
    console.error('Usage: input > ./merge.js global-index > output');
    process.exit(1);
  }

  fs.readFile(globalIndexPath, 'utf-8', (err, data) => {
    if (err && err.code === 'ENOENT') {
      printMerged(null, '');
      return;
    }
    printMerged(err, data);
  });
});

const printMerged = (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }


  const localIndexLines = localIndex.split('\n').filter((line) => line.trim());
  const globalIndexLines = data.split('\n').filter((line) => line.trim());

  const local = {};
  const global = {};


  for (const line of localIndexLines) {
    const parts = line.split('|');
    if (parts.length < 3) {
      continue;
    }
    const term = parts[0].trim();
    const freq = Number(parts[1].trim());
    const url = parts[2].trim();
    if (!term || !url || Number.isNaN(freq)) {
      continue;
    }
    if (!local[term]) {
      local[term] = new Map();
    }
    local[term].set(url, (local[term].get(url) || 0) + freq);
  }


  for (const line of globalIndexLines) {
    const parts = line.split('|');
    if (parts.length < 2) {
      continue;
    }
    const term = parts[0].trim();
    if (!term) {
      continue;
    }
    const grouped = new Map();
    const rest = parts[1].trim();
    if (rest.length > 0) {
      const tokens = rest.split(/\s+/);
      for (let i = 0; i + 1 < tokens.length; i += 2) {
        const url = tokens[i];
        const freq = Number(tokens[i + 1]);
        if (!url || Number.isNaN(freq)) {
          continue;
        }
        grouped.set(url, freq);
      }
    }
    global[term] = grouped;
  }


  for (const [term, urlMap] of Object.entries(local)) {
    if (!global[term]) {
      global[term] = new Map(urlMap);
      continue;
    }
    const merged = global[term];
    for (const [url, freq] of urlMap.entries()) {
      merged.set(url, (merged.get(url) || 0) + freq);
    }
  }


  const terms = Object.keys(global).sort();
  for (const term of terms) {
    const entries = Array.from(global[term].entries()).map(([url, freq]) => ({
      url,
      freq,
    }));
    entries.sort(compare);
    const pairs = entries.map((entry) => `${entry.url} ${entry.freq}`).join(' ');
    process.stdout.write(`${term} | ${pairs}\n`);
  }
};
