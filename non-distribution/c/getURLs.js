#!/usr/bin/env node


const readline = require('readline');
const {JSDOM} = require('jsdom');
const {URL} = require('url');


let baseURL = process.argv[2] || '';

if (baseURL.endsWith('index.html')) {
  baseURL = baseURL.slice(0, baseURL.length - 'index.html'.length);
} else if (baseURL.length > 0 && !baseURL.endsWith('/')) {
  baseURL += '/';
}

const rl = readline.createInterface({
  input: process.stdin,
});

const lines = [];
rl.on('line', (line) => {
  lines.push(line);
});

rl.on('close', () => {
  const html = lines.join('\n');
  const dom = new JSDOM(html);
  const {document} = dom.window;


  const anchors = document.querySelectorAll('a[href]');
  for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    if (!href) {
      continue;
    }
    try {
      const absoluteURL = new URL(href, baseURL).href;

      console.log(absoluteURL);
    } catch (err) {

    }
  }
});
