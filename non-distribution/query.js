#!/usr/bin/env node


const fs = require('fs');
const {execSync} = require('child_process');
const path = require('path');


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


function query(indexFile, args) {
  const input = args.join(' ');

  dbgLog('E', 'query.js:query', 'query called', {indexFile, inputLen: input.length});

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

  dbgLog('E', 'query.js:search', 'searching index', {tokens: tokens.length, queryStringLen: queryString.length, indexLines: lines.length});

  for (const line of lines) {
    if (line.includes(queryString)) {
      process.stdout.write(`${line}\n`);
    }
  }
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: ./query.js [query_strings...]');
  process.exit(1);
}

const indexFile = 'd/global-index.txt';
query(indexFile, args);
