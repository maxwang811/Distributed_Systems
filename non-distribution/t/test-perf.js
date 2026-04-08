#!/usr/bin/env node
const {execSync} = require('child_process');
const {performance} = require('perf_hooks');
const fs = require('fs');
const corpus = 'https://cs.brown.edu/courses/csci1380/sandbox/1';

function measureCrawler() {
  const startTime = performance.now();
  execSync(`./crawl.sh ${corpus}`);
  const endTime = performance.now();

  const duration = (endTime - startTime) / 1000;
  const visitedPath = './d/visited.txt';
  const numPages = fs.readFileSync(visitedPath, 'utf-8').trim().split('\n').length;
  console.log(`Crawler throughput: ${(numPages/duration).toFixed(2)} URL/sec`);
}

function measureIndexer() {
  const startTime = performance.now();
  execSync(`./index.sh './d/content.txt' ${corpus}`);
  const endTime = performance.now();

  const duration = (endTime - startTime) / 1000;
  const visitedPath = './d/visited.txt';
  const numTerms = fs.readFileSync(visitedPath, 'utf-8').trim().split('\n').length;
  console.log(`Index throughput: ${(numTerms/duration).toFixed(2)} pages/sec`);
}

function measureQuery() {
  const queries = ['pass', 'stuff', 'level', 'search', 'break'];
  const startTime = performance.now();
  queries.forEach((query) => execSync(`./query.js ${query}`));
  const endTime = performance.now();

  const duration = (endTime - startTime) / 1000;
  console.log(`Query throughput: ${(queries.length/duration).toFixed(2)} queries/sec`);
}

measureCrawler();
measureIndexer();
measureQuery();
