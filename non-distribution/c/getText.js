#!/usr/bin/env node


const {convert} = require('html-to-text');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
});

const lines = [];
rl.on('line', (line) => {
  lines.push(line);
});


rl.on('close', () => {
  const html = lines.join('\n');
  const text = convert(html, {wordwrap: false});
  process.stdout.write(text);
});
