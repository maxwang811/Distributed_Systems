#!/usr/bin/env node

/*
Search the inverted index for a particular (set of) terms.
Usage: ./query.js your search terms

The behavior of this JavaScript file should be similar to the following shell pipeline:
grep "$(echo "$@" | ./c/process.sh | ./c/stem.js | tr "\r\n" "  ")" d/global-index.txt

Here is one idea on how to develop it:
1. Read the command-line arguments using `process.argv`. A user can provide any string to search for.
2. Normalize, remove stopwords from and stem the query string — use already developed components
3. Search the global index using the processed query string.
4. Print the matching lines from the global index file.

Examples:
./query.js A     # Search for "A" in the global index. This should return all lines that contain "A" as part of an 1-gram, 2-gram, or 3-gram.
./query.js A B   # Search for "A B" in the global index. This should return all lines that contain "A B" as part of a 2-gram, or 3-gram.
./query.js A B C # Search for "A B C" in the global index. This should return all lines that contain "A B C" as part of a 3-gram.

Note: Since you will be removing stopwords from the search query, you will not find any matches for words in the stopwords list.

The simplest way to use existing components is to call them using execSync.
For example, `execSync(`echo "${input}" | ./c/process.sh`, {encoding: 'utf-8'});`
*/


const fs = require('fs');
const {execSync} = require('child_process');
const path = require('path');

// #region agent log
function dbgLog(hypothesisId, location, message, data) {
  const runId = process.env.DEBUG_RUN_ID || 'run1';
  try {
    fetch('http://127.0.0.1:7242/ingest/c630c085-126e-40b9-a624-35c73b6ff0ed', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId,
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  } catch (_) {}
}
// #endregion

function query(indexFile, args) {
  const input = args.join(' ');
  // #region agent log
  dbgLog('E', 'query.js:query', 'query called', {indexFile, inputLen: input.length});
  // #endregion
  let processed = '';
  try {
    const escaped = input.replace(/(["\\$`])/g, '\\$1');
    const command = `echo "${escaped}" | ./c/process.sh | ./c/stem.js`;
    processed = execSync(command, {encoding: 'utf-8', cwd: __dirname});
  } catch (err) {
    console.error('Error processing query:', err.message);
    process.exit(1);
  }

  const tokens = processed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return;
  }

  const queryString = tokens.join(' ');
  let data = '';
  try {
    data = fs.readFileSync(path.resolve(__dirname, indexFile), 'utf-8');
  } catch (err) {
    console.error('Error reading index file:', err.message);
    process.exit(1);
  }

  const lines = data.split('\n');
  // #region agent log
  dbgLog('E', 'query.js:search', 'searching index', {tokens: tokens.length, queryStringLen: queryString.length, indexLines: lines.length});
  // #endregion
  for (const line of lines) {
    if (line.includes(queryString)) {
      process.stdout.write(`${line}\n`);
    }
  }
}

const args = process.argv.slice(2); // Get command-line arguments
if (args.length < 1) {
  console.error('Usage: ./query.js [query_strings...]');
  process.exit(1);
}

const indexFile = 'd/global-index.txt'; // Path to the global index file
query(indexFile, args);
