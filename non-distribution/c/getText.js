#!/usr/bin/env node

/*
Extract all text from an HTML page.
Usage: input > ./getText.js > output
*/

const {convert} = require('html-to-text');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
});

const lines = [];
rl.on('line', (line) => {
  // 1. Read HTML input from standard input, line by line using the `readline` module.
  lines.push(line);
});

// 2. after all input is received, use convert to output plain text.
rl.on('close', () => {
  const html = lines.join('\n');
  const text = convert(html, {wordwrap: false});
  process.stdout.write(text);
});
