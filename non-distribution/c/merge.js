#!/usr/bin/env node

/*
Merge the current inverted index (assuming the right structure) with the global index file
Usage: input > ./merge.js global-index > output

The inverted indices have the different structures!

Each line of a local index is formatted as:
  - `<word/ngram> | <frequency> | <url>`

Each line of a global index is be formatted as:
  - `<word/ngram> | <url_1> <frequency_1> <url_2> <frequency_2> ... <url_n> <frequency_n>`
  - Where pairs of `url` and `frequency` are in descending order of frequency
  - Everything after `|` is space-separated

-------------------------------------------------------------------------------------
Example:

local index:
  word1 word2 | 8 | url1
  word3 | 1 | url9
EXISTING global index:
  word1 word2 | url4 2
  word3 | url3 2

merge into the NEW global index:
  word1 word2 | url1 8 url4 2
  word3 | url3 2 url9 1

Remember to error gracefully, particularly when reading the global index file.
*/

const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
});

// 1. Read the incoming local index data from standard input (stdin) line by line.
let localIndex = '';
rl.on('line', (line) => {
  localIndex += line + '\n';
});

rl.on('close', () => {
  // 2. Read the global index name/location, using process.argv
  // and call printMerged as a callback
  const globalIndex = process.argv[2];
  fs.readFile(globalIndex, 'utf-8', printMerged);
});

const printMerged = (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

  // Split the data into an array of lines
  const localIndexLines = localIndex.split('\n');
  const globalIndexLines = data.split('\n');

  localIndexLines.pop();
  globalIndexLines.pop();

  const local = {};
  const global = {};

  // 3. For each line in `localIndexLines`, parse them and add them to the `local` object
  // where keys are terms and values store a url->freq map (one entry per url).
  for (const line of localIndexLines) {
    let parts = line.split('|');
    parts = parts.map((part) => part.trim());

    const term = parts[0];
    const freq = parts[1];
    const url = parts[2];

    let urlMap = local[term];
    if (!urlMap) {
      urlMap = new Map();
      local[term] = urlMap;
    }
    urlMap.set(url, parseInt(urlMap.get(url) || 0, 10) + parseInt(freq, 10));
  }

  // 4. For each line in `globalIndexLines`, parse them and add them to the `global` object
  // where keys are terms and values are url->freq maps (one entry per url).
  // Use the .trim() method to remove leading and trailing whitespace from a string.
  for (const line of globalIndexLines) {
    let parts = line.split('|');
    parts = parts.map((part) => part.trim());

    const term = parts[0];
    const urlsAndFreqs = parts[1].split(' ');

    for (let i = 0; i < urlsAndFreqs.length; i += 2) {
      const url = urlsAndFreqs[i];
      const freq = urlsAndFreqs[i+1];

      let urlMap = global[term];
      if (!urlMap) {
        urlMap = new Map();
        global[term] = urlMap;
      }
      urlMap.set(url, parseInt(urlMap.get(url) || 0) + parseInt(freq));
    }
  }

  // 5. Merge the local index into the global index:
  // - For each term in the local index, if the term exists in the global index:
  //     - Merge by url so there is at most one entry per url.
  //     - Sum frequencies for duplicate urls.
  // - If the term does not exist in the global index:
  //     - Add it as a new entry with the local index's data.
  // 6. Print the merged index to the console in the same format as the global index file:
  //    - Each line contains a term, followed by a pipe (`|`), followed by space-separated pairs of `url` and `freq`.
  //    - Terms should be printed in alphabetical order.
  for (const [term, localUrlMap] of Object.entries(local)) {
    for (const [url, freq] of localUrlMap.entries()) {
      let globalUrlMap = global[term];
      if (!globalUrlMap) {
        globalUrlMap = new Map();
        global[term] = globalUrlMap;
      }
      globalUrlMap.set(url, parseInt(globalUrlMap.get(url) || 0) + parseInt(freq));
    }
  }

  const sortedTerms = Object.keys(global).sort();
  for (const term of sortedTerms) {
    const urlMap = global[term];
    const sortedEntries = [...urlMap.entries()].sort((a, b) => b[1] - a[1]);
    let output = '';
    for (const [url, freq] of sortedEntries) {
      output += ' ' + url + ' ' + freq;
    }
    console.log(term + ' |' + output);
  }
};
