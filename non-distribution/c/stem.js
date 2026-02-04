#!/usr/bin/env node


const readline = require('readline');
const natural = require('natural');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', function(line) {
  const term = line.trim();
  if (term.length === 0) {
    return;
  }
  const stemmed = natural.PorterStemmer.stem(term);
  process.stdout.write(`${stemmed}\n`);
});
